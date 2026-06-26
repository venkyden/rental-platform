"""
E-sign Path B service — landlord-uploaded lease → e-sign → tamper-evident proof.

In-house Ed25519 engine (DOSSIER §5.7 decision, 2026-06-24): reuses the credential
signing key via `CredentialService.sign_payload`/`verify_payload`, so the published
public key verifies both credentials and lease signatures. No DocuSeal/Documenso, no
second service to host (0 opex/capex). DocuSeal/QTSP stay the deferred SG-5 v2 upgrade.

Legal frame: a French residential lease is an *acte sous seing privé* → no qualified
signature required; eIDAS simple/advanced is valid for a bail. Path B = landlord's OWN
document (Roomivo authors no wording → clear of loi 1971), recorded as ATTACHED / NOT
LEGALITY-VERIFIED until the LU-* red-line check ships.

Edge cases enforced (DOSSIER §5.7):
- SG-1: signer must be a verified party (`can_sign`).
- SG-2: manifest emitted only when BOTH parties have signed (`build_manifest` is called
  by the router only once `is_fully_signed`).
- SG-3: the exact PDF bytes are pinned by SHA-256 (`compute_document_hash`); a mismatch
  surfaces as tampering at sign-time and in `verify_manifest`.
- SG-4: `export_signature_evidence_pdf` is the dispute evidence pack (labelled simple/AES,
  never QTSP).
"""

import io
import os

from app.core.timeutils import utcnow
from app.services.credential import credential_service

# Honest provenance label until the LU-* legality red-line check ships (DOSSIER §5.6).
LEGALITY_STATUS_ATTACHED = "ATTACHED_NOT_LEGALITY_VERIFIED"

ESIGN_DISCLAIMER = (
    "Signatures électroniques simples (eIDAS) recueillies par Roomivo. Le document a été "
    "fourni par le bailleur : Roomivo n'en a pas rédigé les clauses et n'atteste pas de sa "
    "conformité légale. Ce procès-verbal atteste l'identité vérifiée des signataires, "
    "l'intégrité du document (empreinte SHA-256) et l'horodatage de chaque signature. "
    "Ne constitue pas une signature électronique qualifiée (QTSP)."
)


def compute_document_hash(pdf_bytes: bytes) -> str:
    """SHA-256 hex of the exact bytes being signed — the SG-3 tamper anchor."""
    import hashlib

    return hashlib.sha256(pdf_bytes).hexdigest()


def party_of(user, lease) -> str | None:
    """Return 'landlord' | 'tenant' if `user` is a party to `lease`, else None."""
    if lease.landlord_id is not None and user.id == lease.landlord_id:
        return "landlord"
    if lease.tenant_id is not None and user.id == lease.tenant_id:
        return "tenant"
    return None


def can_sign(user, lease) -> tuple[bool, str | None]:
    """
    SG-1: a signer must be a *verified* party to the lease.

    Returns (True, None) if allowed, else (False, reason). The reason is safe to
    surface to the caller (no PII).
    """
    if party_of(user, lease) is None:
        return False, "Signer is not a party to this lease"
    if not getattr(user, "identity_verified", False):
        return False, "Identity verification required before signing"
    return True, None


def build_audit_entry(
    party: str,
    user,
    *,
    ip: str | None,
    user_agent: str | None,
    consent: str,
    credential_id: str | None = None,
) -> dict:
    """
    One signer's record for the audit trail. Carries no PII source data — only the
    display name (already public on the lease) plus the verification + consent facts.
    """
    return {
        "party": party,
        "user_id": str(user.id),
        "display_name": getattr(user, "full_name", None) or "—",
        "identity_verified": True,  # guaranteed by can_sign() before we reach here
        "credential_id": credential_id,
        "consent": consent,
        "signed_at": utcnow().replace(microsecond=0).isoformat(),
        "ip": ip,
        "user_agent": user_agent,
    }


def is_fully_signed(audit_entries: list[dict], lease) -> bool:
    """
    SG-2 gate: both required parties have an audit entry. A lease with no tenant yet
    can never be fully signed (and must not be — both sides must be verified).
    """
    if lease.tenant_id is None or lease.landlord_id is None:
        return False
    parties = {e.get("party") for e in audit_entries}
    return {"landlord", "tenant"}.issubset(parties)


def build_manifest(
    lease, document_hash: str, audit_entries: list[dict], legality: dict | None = None
) -> dict:
    """
    Assemble the canonical, signable manifest once both parties have signed (SG-2).
    The manifest binds the exact document (hash), the parties, and the timestamps.

    `legality` is the §5.6 red-line result recorded at upload. Carrying it into the
    signed manifest is the LU-6 evidence: the flags were shown and the parties signed
    anyway (shown-and-overridden). Absent → treated as ATTACHED / NOT LEGALITY-VERIFIED.
    """
    legality = legality or {"status": LEGALITY_STATUS_ATTACHED, "flags": [], "notes": []}
    return {
        "manifest_id": "sig_" + os.urandom(16).hex(),
        "lease_id": str(lease.id),
        "property_id": str(lease.property_id),
        "document_hash": document_hash,
        "document_source": getattr(lease, "document_source", None) or "uploaded",
        "legality_status": legality.get("status", LEGALITY_STATUS_ATTACHED),
        "legality_flags": legality.get("flags", []),
        "legality_notes": legality.get("notes", []),
        "finalised_at": utcnow().replace(microsecond=0).isoformat(),
        "signatures": audit_entries,
        "disclaimer": ESIGN_DISCLAIMER,
    }


def sign_manifest(manifest: dict) -> dict:
    """Ed25519-sign the manifest in place; returns it with a hex `signature`."""
    signed = dict(manifest)
    signed.pop("signature", None)
    signed["signature"] = credential_service.sign_payload(signed)
    return signed


def verify_manifest(manifest: dict, *, current_document_hash: str | None = None) -> bool:
    """
    Verify the manifest's Ed25519 signature (SG-3). If `current_document_hash` is
    given (recomputed from the on-disk PDF), also confirm the document is unaltered.
    """
    sig = manifest.get("signature")
    if not sig:
        return False
    payload = {k: v for k, v in manifest.items() if k != "signature"}
    if not credential_service.verify_payload(payload, sig):
        return False
    if current_document_hash is not None and manifest.get("document_hash") != current_document_hash:
        return False
    return True


def export_signature_evidence_pdf(
    manifest: dict, verify_base_url: str = "https://roomivo.app"
) -> bytes:
    """
    Watermarked signature evidence pack (SG-4): the dispute artifact listing both
    signers, their verification + consent, the document SHA-256, per-signature
    timestamps/IP, the Ed25519 signature, and the verify-by-ID instruction.
    Labelled as a simple/advanced eIDAS signature — never QTSP.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
        )
    except ImportError:
        raise RuntimeError("reportlab is required for evidence PDF export")

    buf = io.BytesIO()
    width, height = A4

    class _WatermarkedDoc(SimpleDocTemplate):
        def handle_pageBegin(self):
            super().handle_pageBegin()
            c = self.canv
            c.saveState()
            c.setFont("Helvetica-Bold", 50)
            c.setFillColorRGB(0.85, 0.85, 0.85, alpha=0.35)
            c.translate(width / 2, height / 2)
            c.rotate(40)
            c.drawCentredString(0, 0, "ROOMIVO — SIGNÉ")
            c.restoreState()

    doc = _WatermarkedDoc(
        buf, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
    )

    styles = getSampleStyleSheet()
    blue = colors.HexColor("#1A3C6E")
    light_blue = colors.HexColor("#E8F0FB")
    mid_gray = colors.HexColor("#555555")

    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=blue, fontSize=16, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=blue, fontSize=12, spaceAfter=2)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=mid_gray, fontSize=9, leading=14)
    small = ParagraphStyle("small", parent=styles["Normal"], textColor=mid_gray, fontSize=8, leading=12)
    label_style = ParagraphStyle("label", parent=styles["Normal"], textColor=blue, fontSize=9, fontName="Helvetica-Bold")

    role_fr = {"landlord": "Propriétaire / Bailleur", "tenant": "Locataire"}
    story = []

    story.append(Paragraph("ROOMIVO", h1))
    story.append(Paragraph("Procès-verbal de signature électronique", h2))
    story.append(HRFlowable(width="100%", thickness=1.5, color=blue, spaceAfter=10))

    # ── document block ───────────────────────────────────────────────────────
    story.append(Paragraph("Document signé", h2))
    legality_status = manifest.get("legality_status", LEGALITY_STATUS_ATTACHED)
    legality_flags = manifest.get("legality_flags", [])
    if legality_status == "VALIDATED":
        conformity = "Contrôle de légalité passé (VÉRIFIÉ)"
    else:
        conformity = "Joint — non vérifié juridiquement"
        if legality_flags:
            conformity += f" ; {len(legality_flags)} signalement(s) présenté(s) et passé(s) outre"
    doc_rows = [
        [Paragraph("Empreinte SHA-256", label_style), Paragraph(manifest.get("document_hash", "—"), small)],
        [Paragraph("Origine", label_style), Paragraph("Fourni par le bailleur (non rédigé par Roomivo)", body)],
        [Paragraph("Statut de conformité", label_style), Paragraph(conformity, body)],
        [Paragraph("Finalisé le", label_style), Paragraph(manifest.get("finalised_at", "—"), body)],
    ]
    doc_table = Table(doc_rows, colWidths=[5 * cm, None])
    doc_table.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [light_blue, colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C0C0C0")),
    ]))
    story.append(doc_table)

    # LU-6 liability evidence: name the points that were shown and signed over anyway.
    legality_notes = manifest.get("legality_notes", [])
    if legality_status != "VALIDATED" and legality_notes:
        story.append(Spacer(1, 0.2 * cm))
        story.append(Paragraph("Signalements présentés aux parties avant signature :", small))
        for note in legality_notes:
            story.append(Paragraph(f"• {note}", small))
    story.append(Spacer(1, 0.4 * cm))

    # ── signers ──────────────────────────────────────────────────────────────
    story.append(Paragraph("Signataires (identité vérifiée)", h2))
    sig_rows = [[
        Paragraph("Partie", label_style),
        Paragraph("Nom", label_style),
        Paragraph("Signé le", label_style),
        Paragraph("Consentement", label_style),
    ]]
    for entry in manifest.get("signatures", []):
        sig_rows.append([
            Paragraph(role_fr.get(entry.get("party", ""), entry.get("party", "")), body),
            Paragraph(entry.get("display_name", "—"), body),
            Paragraph(entry.get("signed_at", "—"), small),
            Paragraph("Oui ✓" if entry.get("consent") else "Non", body),
        ])
    sig_table = Table(sig_rows, colWidths=[3.5 * cm, None, 4 * cm, 2.5 * cm])
    sig_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), blue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [light_blue, colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#C0C0C0")),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 0.4 * cm))

    # ── verify-by-ID + signature ─────────────────────────────────────────────
    story.append(Paragraph("Comment vérifier ce procès-verbal", h2))
    mid = manifest.get("manifest_id", "")
    story.append(Paragraph(
        f"<b>Ne faites pas confiance au lien — vérifiez la signature sur {verify_base_url} "
        f"avec la clé publique Ed25519 publiée.</b>", body,
    ))
    story.append(Paragraph(f"Identifiant du procès-verbal : <font name='Courier'>{mid}</font>", body))
    sig_hex = manifest.get("signature", "")
    sig_display = sig_hex[:32] + "..." if len(sig_hex) > 32 else sig_hex
    story.append(Paragraph(f"Signature Ed25519 : <font name='Courier'>{sig_display}</font>", small))
    story.append(Spacer(1, 0.3 * cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=mid_gray, spaceAfter=6))
    story.append(Paragraph(ESIGN_DISCLAIMER, small))

    doc.build(story)
    return buf.getvalue()
