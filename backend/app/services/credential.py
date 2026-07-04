"""
Credential signing service — Ed25519 sign/verify + evidence PDF generation.

Key rules (non-negotiable from DOSSIER §2):
- Bands not raw numbers: claims hold ">=3.0" not actual RFR.
- Assurance NEVER silently upgraded: HIGH only from HIGH sources.
- Signature is over the canonical payload JSON (sort_keys, compact separators).
- Source documents are NEVER stored here; only the banded credential record is.
"""

import hashlib
import io
import json
import logging
import os
from datetime import datetime, timedelta

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "Certifies verification of the stated facts only. "
    "Does not warrant future conduct or good faith."
)

DEFAULT_TTL_DAYS = 30

# Valid assurance levels — order matters for the "never inflate" check
ASSURANCE_LEVELS = {"HIGH", "MEDIUM", "UNVERIFIED"}

# Valid identity sources (extended as rails are added)
VALID_IDENTITY_SOURCES = {
    "france_identite_justificatif",
    "nfc_passport_chip",
    "ocr_liveness",          # MEDIUM only
    "mrz_ocr_liveness",      # MEDIUM only
}

# Sources that may only produce MEDIUM assurance
MEDIUM_ONLY_SOURCES = {"ocr_liveness", "mrz_ocr_liveness"}


def _validate_claims(claims: dict) -> None:
    """
    Enforce assurance-labelling rules before signing.
    Raises ValueError on violation so the signing path is never reached.
    """
    if not isinstance(claims, dict):
        raise ValueError("claims must be a dict")

    identity_assurance = claims.get("identity_assurance")
    identity_source = claims.get("identity_source")
    solvency_assurance = claims.get("solvency_assurance")
    solvency_ratio = claims.get("solvency_ratio")

    if identity_assurance is not None:
        if identity_assurance not in ASSURANCE_LEVELS:
            raise ValueError(f"identity_assurance must be one of {ASSURANCE_LEVELS}")

        if identity_source is not None:
            if identity_source not in VALID_IDENTITY_SOURCES:
                raise ValueError(f"identity_source '{identity_source}' is not a recognised source")
            # AS-3: HIGH only from HIGH-capable sources
            if identity_assurance == "HIGH" and identity_source in MEDIUM_ONLY_SOURCES:
                raise ValueError(
                    f"identity_source '{identity_source}' cannot produce HIGH assurance — "
                    "assign MEDIUM (assurance inflation is not permitted)"
                )

    if solvency_assurance is not None:
        if solvency_assurance not in ASSURANCE_LEVELS:
            raise ValueError(f"solvency_assurance must be one of {ASSURANCE_LEVELS}")

    if solvency_ratio is not None:
        # Must be a banded string like ">=3.0", not a raw number
        if not isinstance(solvency_ratio, str):
            raise ValueError(
                "solvency_ratio must be a banded string (e.g. '>=3.0'), never a raw number"
            )
        if not any(solvency_ratio.startswith(op) for op in (">=", ">", "<", "<=", "~")):
            raise ValueError(
                "solvency_ratio must start with a comparison operator (>=, >, <=, <)"
            )


def _canonical_payload(payload: dict) -> bytes:
    """Deterministic JSON bytes used as the signature input."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def _evidence_claim_rows(claims: dict) -> list:
    """Build (label, value, assurance) text rows for the evidence-PDF claims table.

    Handles BOTH claim vocabularies so every issued credential renders correctly:
    - direct POST /issue: `identity_verified`, `property_control`, `property_assurance`
    - POST /issue-mine: `identity_assurance`, `property_control_assurance`,
      `property_control_label`
    Assurance is rendered as an affirmative phrase — never the internal tier word.
    """
    def phrase(level: str) -> str:
        return "Vérifié ✓" if level in ("HIGH", "MEDIUM") else "Non vérifié"

    rows = []

    # Identity — present in either vocabulary; skip a purely UNVERIFIED identity.
    identity_assur = claims.get("identity_assurance", "UNVERIFIED")
    if "identity_verified" in claims or identity_assur != "UNVERIFIED":
        verified = claims.get("identity_verified", identity_assur in ("HIGH", "MEDIUM"))
        rows.append(("Identité vérifiée", "Oui" if verified else "Non", phrase(identity_assur)))

    if "solvency_ratio" in claims:
        rows.append((
            "Capacité fiscale (ratio)",
            str(claims["solvency_ratio"]),
            phrase(claims.get("solvency_assurance", "UNVERIFIED")),
        ))

    if "funds_coverage_band" in claims:
        band_fr = {
            "covers_12m_plus": "couvre 12 mois ou plus de loyer",
            "covers_6m": "couvre 6 à 11 mois de loyer",
            "covers_3m": "couvre 3 à 5 mois de loyer",
            "covers_under_3m": "couvre moins de 3 mois de loyer",
            "amount_only": "fonds vérifiés",
        }
        src = " (via garant/sponsor)" if claims.get("funds_coverage_source") == "sponsor" else ""
        rows.append((
            "Capacité fiscale (fonds)",
            band_fr.get(claims["funds_coverage_band"], "fonds vérifiés") + src,
            phrase(claims.get("funds_coverage_assurance", "UNVERIFIED")),
        ))

    if "property_dpe_class" in claims:
        rows.append((
            "Classe DPE (ADEME)",
            str(claims["property_dpe_class"]),
            phrase(claims.get("property_assurance", "UNVERIFIED")),
        ))

    # Property control — present in either vocabulary.
    if "property_control" in claims or "property_control_assurance" in claims:
        if "property_control_label" in claims:
            prop_value = str(claims["property_control_label"])
        else:
            prop_value = "Oui" if claims.get("property_control") else "Non"
        prop_assur = claims.get("property_control_assurance") or claims.get("property_assurance", "UNVERIFIED")
        rows.append(("Contrôle du bien (non-attestation de propriété)", prop_value, phrase(prop_assur)))

    if "mrh_insurance_assurance" in claims:
        mrh_ok = claims.get("mrh_insurance_verified")
        mrh_status_label = "Vérifié ✓" if mrh_ok else "Signalé ⚠"
        flags = claims.get("mrh_insurance_flags") or []
        flag_note = f" — signalements : {', '.join(flags)}" if flags else ""
        rows.append((
            "Assurance MRH (loi 89 art. 7g)",
            f"{mrh_status_label}{flag_note}",
            phrase(claims.get("mrh_insurance_assurance", "UNVERIFIED")),
        ))

    return rows


def _kid_for(public_key: Ed25519PublicKey) -> str:
    """Key id: first 16 hex chars of SHA-256 over raw 32-byte public key."""
    raw = public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return hashlib.sha256(raw).hexdigest()[:16]


class CredentialService:
    """
    Singleton service for issuing and verifying signed credentials.

    Key lifecycle (runbook: docs/features/trust-layer/KEY-LIFECYCLE.md):
    - CREDENTIAL_SIGNING_KEY (hex 32-byte Ed25519 seed): ACTIVE key — signs
      every new credential; its `kid` is embedded inside signed payload.
    - CREDENTIAL_RETIRED_VERIFY_KEYS (comma-separated hex 32-byte raw public
      keys): RETIRED keys kept verify-only until every credential they signed
      expires. Rotation = move old public key here, set new signing seed.
    - Records carrying kid verify against that key only (unknown kid fails
      closed); legacy records without kid tried against all known keys.

    Signing var absent (dev only): ephemeral key generated with logged
    warning. Production MUST set the env var and keep it stable.
    """

    def __init__(
        self,
        signing_key_hex: str | None = None,
        retired_verify_keys_hex: list[str] | None = None,
    ):
        if signing_key_hex:
            seed = bytes.fromhex(signing_key_hex)
            if len(seed) != 32:
                raise ValueError("CREDENTIAL_SIGNING_KEY must be exactly 32 bytes (64 hex chars)")
            self._private_key = Ed25519PrivateKey.from_private_bytes(seed)
        else:
            logger.warning(
                "CREDENTIAL_SIGNING_KEY not set — using ephemeral Ed25519 key. "
                "Credentials will not survive process restart. Set the env var in production."
            )
            self._private_key = Ed25519PrivateKey.generate()

        self._public_key = self._private_key.public_key()
        self._kid = _kid_for(self._public_key)

        # kid -> public key; insertion order = active first, then retired
        self._verify_keys: dict[str, Ed25519PublicKey] = {self._kid: self._public_key}
        for pub_hex in retired_verify_keys_hex or []:
            raw = bytes.fromhex(pub_hex)
            if len(raw) != 32:
                raise ValueError(
                    "CREDENTIAL_RETIRED_VERIFY_KEYS entries must be 32-byte raw "
                    "Ed25519 public keys (64 hex chars)"
                )
            pub = Ed25519PublicKey.from_public_bytes(raw)
            self._verify_keys[_kid_for(pub)] = pub

    # ── public key ──────────────────────────────────────────────────────────

    def public_key_pem(self) -> str:
        return self._public_key.public_bytes(
            Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
        ).decode()

    def key_history(self) -> list[dict]:
        """All known verification keys, active first, for the /public-keys endpoint."""
        return [
            {
                "kid": kid,
                "public_key_pem": key.public_bytes(
                    Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
                ).decode(),
                "status": "active" if kid == self._kid else "retired",
            }
            for kid, key in self._verify_keys.items()
        ]

    # ── issuance ─────────────────────────────────────────────────────────────

    def issue(
        self,
        subject_role: str,
        rail: str,
        claims: dict,
        subject_display_name: str | None = None,
        ttl_days: int = DEFAULT_TTL_DAYS,
    ) -> dict:
        """
        Build and sign a credential. Returns the full payload dict including signature.
        The caller is responsible for persisting the Credential model row.

        Claims are validated before signing — any assurance-inflation attempt raises.
        """
        if subject_role not in ("tenant", "landlord", "property"):
            raise ValueError(f"subject_role must be tenant | landlord | property, got '{subject_role}'")
        if rail not in ("FR", "INTL"):
            raise ValueError(f"rail must be FR or INTL, got '{rail}'")

        _validate_claims(claims)

        now = datetime.utcnow().replace(microsecond=0)
        expires = now + timedelta(days=ttl_days)
        credential_id = "vc_" + os.urandom(16).hex()

        payload = {
            "credential_id": credential_id,
            "subject_role": subject_role,
            "issued_at": now.isoformat() + "Z",
            "expires_at": expires.isoformat() + "Z",
            "rail": rail,
            "claims": claims,
            "disclaimer": DISCLAIMER,
            "kid": self._kid,
        }

        sig = self._private_key.sign(_canonical_payload(payload))
        payload["signature"] = sig.hex()
        payload["subject_display_name"] = subject_display_name
        return payload

    # ── verification ─────────────────────────────────────────────────────────

    def verify_signature(self, record: dict) -> bool:
        """
        Re-verify Ed25519 signature on stored credential record.
        Signed payload excludes subject_display_name (added after signing).

        Records carrying kid verify against that key only — unknown kid
        fails closed. Legacy records (no kid) tried against all known keys.
        """
        payload = {k: record[k] for k in (
            "credential_id", "subject_role", "issued_at", "expires_at",
            "rail", "claims", "disclaimer", "kid",
        ) if k in record}

        kid = record.get("kid")
        if kid is not None:
            key = self._verify_keys.get(kid)
            if key is None:
                logger.warning("verify_signature: unknown kid %s — failing closed", kid)
                return False
            candidates = [key]
        else:
            candidates = list(self._verify_keys.values())

        for key in candidates:
            try:
                key.verify(
                    bytes.fromhex(record["signature"]),
                    _canonical_payload(payload),
                )
                return True
            except (InvalidSignature, KeyError, ValueError):
                continue
        return False

    # ── generic payload signing (reused by the e-sign rail) ───────────────────

    def sign_payload(self, payload: dict) -> str:
        """
        Sign an arbitrary dict with the same Ed25519 key used for credentials.

        Returns the hex-encoded signature over the canonical JSON of `payload`.
        Used by the e-sign rail (DOSSIER §5.7) so lease signatures and credentials
        share one verifiable key — the published public key checks both.
        """
        return self._private_key.sign(_canonical_payload(payload)).hex()

    def verify_payload(self, payload: dict, signature_hex: str) -> bool:
        """
        Re-verify signature produced by `sign_payload` over `payload`.
        Tried against all known keys (these signatures carry no kid).
        """
        for key in self._verify_keys.values():
            try:
                key.verify(
                    bytes.fromhex(signature_hex),
                    _canonical_payload(payload),
                )
                return True
            except (InvalidSignature, KeyError, ValueError):
                continue
        return False

    # ── evidence PDF ─────────────────────────────────────────────────────────

    def export_evidence_pdf(self, record: dict, verify_base_url: str = "https://roomivo.app") -> bytes:
        """
        Generate a watermarked, signed evidence document as PDF bytes.

        Target use-case: deposit-theft dispute (court / police / insurer submission).
        Contains: subject identity, banded claims, assurance tiers, timestamps,
        credential ID, verify-by-ID instruction, disclaimer.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import cm
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
            )
            from reportlab.pdfgen import canvas as pdfgen_canvas
        except ImportError:
            raise RuntimeError("reportlab is required for evidence PDF export")

        buf = io.BytesIO()
        width, height = A4

        # ── watermark layer ─────────────────────────────────────────────────
        class _WatermarkedDoc(SimpleDocTemplate):
            def handle_pageBegin(self):
                super().handle_pageBegin()
                c = self.canv
                c.saveState()
                c.setFont("Helvetica-Bold", 55)
                c.setFillColorRGB(0.85, 0.85, 0.85, alpha=0.35)
                c.translate(width / 2, height / 2)
                c.rotate(40)
                c.drawCentredString(0, 0, "ROOMIVO VÉRIFIÉ")
                c.restoreState()

        doc = _WatermarkedDoc(
            buf,
            pagesize=A4,
            leftMargin=2.5 * cm,
            rightMargin=2.5 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2.5 * cm,
        )

        styles = getSampleStyleSheet()
        blue = colors.HexColor("#1A3C6E")
        light_blue = colors.HexColor("#E8F0FB")
        mid_gray = colors.HexColor("#555555")

        h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=blue, fontSize=16, spaceAfter=4)
        h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=blue, fontSize=12, spaceAfter=2)
        body = ParagraphStyle("body", parent=styles["Normal"], textColor=mid_gray, fontSize=9, leading=14)
        small = ParagraphStyle("small", parent=styles["Normal"], textColor=mid_gray, fontSize=8, leading=12)
        mono = ParagraphStyle("mono", parent=styles["Normal"], fontName="Courier", fontSize=8, textColor=mid_gray, leading=12)
        label_style = ParagraphStyle("label", parent=styles["Normal"], textColor=blue, fontSize=9, fontName="Helvetica-Bold")

        story = []

        # ── header ──────────────────────────────────────────────────────────
        story.append(Paragraph("ROOMIVO", h1))
        story.append(Paragraph("Document de Vérification Certifié", h2))
        story.append(HRFlowable(width="100%", thickness=1.5, color=blue, spaceAfter=10))

        # ── subject block ────────────────────────────────────────────────────
        role_fr = {"tenant": "Locataire", "landlord": "Propriétaire / Bailleur", "property": "Bien immobilier"}
        role_label = role_fr.get(record.get("subject_role", ""), record.get("subject_role", ""))
        display_name = record.get("subject_display_name") or "—"
        rail_label = {"FR": "France (France Identité / DGFiP)", "INTL": "International (passeport NFC / OCR)"}.get(record.get("rail", ""), record.get("rail", ""))

        subject_data = [
            [Paragraph("Rôle", label_style), Paragraph(role_label, body)],
            [Paragraph("Sujet", label_style), Paragraph(display_name, body)],
            [Paragraph("Rail", label_style), Paragraph(rail_label, body)],
        ]
        subject_table = Table(subject_data, colWidths=[4 * cm, None])
        subject_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), light_blue),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [light_blue, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C0C0C0")),
        ]))
        story.append(subject_table)
        story.append(Spacer(1, 0.4 * cm))

        # ── claims table ─────────────────────────────────────────────────────
        story.append(Paragraph("Attestations vérifiées", h2))
        claims = record.get("claims", {})

        claims_rows = [[
            Paragraph("Attestation", label_style),
            Paragraph("Valeur / Bande", label_style),
            Paragraph("Niveau d'assurance", label_style),
        ]]
        for _label, _value, _assur in _evidence_claim_rows(claims):
            claims_rows.append([
                Paragraph(_label, body),
                Paragraph(_value, body),
                Paragraph(_assur, body),
            ])

        if len(claims_rows) > 1:
            claims_table = Table(claims_rows, colWidths=[5 * cm, 4 * cm, None])
            claims_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), blue),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [light_blue, colors.white]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C0C0C0")),
            ]))
            story.append(claims_table)
        else:
            story.append(Paragraph("Aucune attestation enregistrée.", body))

        story.append(Spacer(1, 0.4 * cm))

        # ── timestamps + credential ID ───────────────────────────────────────
        story.append(Paragraph("Métadonnées de l'attestation", h2))
        meta_data = [
            [Paragraph("Identifiant", label_style), Paragraph(record.get("credential_id", "—"), mono)],
            [Paragraph("Émis le", label_style), Paragraph(record.get("issued_at", "—"), body)],
            [Paragraph("Expire le", label_style), Paragraph(record.get("expires_at", "—"), body)],
        ]
        meta_table = Table(meta_data, colWidths=[4 * cm, None])
        meta_table.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [light_blue, colors.white]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C0C0C0")),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.4 * cm))

        # ── verify-by-ID block ───────────────────────────────────────────────
        story.append(Paragraph("Comment vérifier ce document", h2))
        cid = record.get("credential_id", "")
        verify_url = f"{verify_base_url}/c/{cid}"
        story.append(Paragraph(
            f"<b>Ne faites pas confiance au lien — saisissez vous-même l'identifiant sur {verify_base_url}</b>",
            body,
        ))
        story.append(Paragraph(f"Identifiant : <font name='Courier'>{cid}</font>", body))
        story.append(Paragraph(f"URL de vérification : {verify_url}", body))

        sig_hex = record.get("signature", "")
        sig_display = sig_hex[:32] + "..." if len(sig_hex) > 32 else sig_hex
        story.append(Paragraph(f"Signature Ed25519 : <font name='Courier'>{sig_display}</font>", small))
        story.append(Spacer(1, 0.3 * cm))

        # ── disclaimer ───────────────────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=0.5, color=mid_gray, spaceAfter=6))
        story.append(Paragraph(DISCLAIMER, small))
        story.append(Paragraph(
            "Ce document est produit par Roomivo, étudiant-entrepreneur (SNEE / PÉPITE Pays de la Loire). "
            "Il certifie des faits vérifiés à la date d'émission et ne constitue pas une garantie "
            "de bonne foi ou de comportement futur.",
            small,
        ))

        doc.build(story)
        return buf.getvalue()


# ── singleton ────────────────────────────────────────────────────────────────
# Loaded once at import time. The key is read from env here so the service is
# ready before the first request without needing FastAPI lifespan wiring.

def _load_service() -> CredentialService:
    key_hex = os.environ.get("CREDENTIAL_SIGNING_KEY")
    retired_raw = os.environ.get("CREDENTIAL_RETIRED_VERIFY_KEYS", "")
    retired = [k.strip() for k in retired_raw.split(",") if k.strip()]
    return CredentialService(signing_key_hex=key_hex, retired_verify_keys_hex=retired)


credential_service: CredentialService = _load_service()
