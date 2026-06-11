# DPE Reclassification Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the publish-time hard block on DPE class G with a warn-and-acknowledge flow grounded in French law, while keeping the DPE class display mandatory (L126-33) and preferring the ADEME-verified class over the self-typed one for post-Jan-2026 accuracy.

**Architecture:** A new pure, side-effect-free service `dpe_compliance.py` produces a `DPEAssessment` (authoritative class, date-aware décence verdict, bilingual warnings). The publish endpoint consumes it: missing class → 400 (L126-33); class G / expired → 409 unless `acknowledge_dpe_warning` is passed, then publishes with an audit-trail timestamp. The wizard mirrors this: it no longer disables publish for G, instead showing the décence warning + a required acknowledgment checkbox.

**Tech Stack:** Python 3 / FastAPI / SQLAlchemy (backend), pytest (tests), Next.js / React / TypeScript (frontend), existing `t(key, undefined, fallback)` i18n.

**Spec:** `docs/superpowers/specs/2026-06-10-dpe-reclassification-enforcement-design.md`

---

## File Structure

- **Create** `backend/app/services/dpe_compliance.py` — pure assessment logic + the décence calendar. One responsibility: turn class/assurance/expired/date into facts.
- **Create** `backend/tests/test_dpe_compliance.py` — unit tests for the pure function.
- **Modify** `backend/app/routers/properties.py:817-831` — replace the DPE block in `publish_property`; add an optional request body.
- **Modify** `backend/tests/test_properties.py:172-212` — update the G-ban test to the new 409/ack behavior; add ack + ADEME-override cases.
- **Modify** `frontend/app/properties/new/steps/Step9Success.tsx` — G becomes a warning with a required ack checkbox, not a hard error.
- **Modify** `frontend/app/properties/new/page.tsx:190-200` — pass `acknowledge_dpe_warning`; surface 409.
- **Modify** `frontend/lib/i18n.ts` (en `create:` ~1294, fr `create:` ~3605) — add parallel FR/EN décence strings.

### Deliberate refinements vs. spec
- **No new DB column / migration.** The spec's "persist resolved warnings" is satisfied by recomputing warnings on read from `dpe_rating`; only the acknowledgment audit trail is stored, in the existing `ownership_data` JSON. This avoids a migration for derivable data.
- **No in-wizard `/dpe` verify flow.** The `/dpe` endpoint needs an ADEME DPE number, which the spec explicitly keeps out of the wizard (friction). So the wizard shows a *"Déclaré — non vérifié ADEME"* label only; a full opt-in verification CTA is a deferred follow-up (it depends on the out-of-scope number capture).

---

## Task 1: Pure DPE compliance service

**Files:**
- Create: `backend/app/services/dpe_compliance.py`
- Test: `backend/tests/test_dpe_compliance.py`

- [ ] **Step 1: Write the failing unit tests**

```python
# backend/tests/test_dpe_compliance.py
"""
Unit tests for DPE décence-énergétique compliance (loi Climat) + class accuracy.

Pure-function tests (no DB) for app.services.dpe_compliance. AAA structure.
Legal calendar: G prohibited from 2025-01-01, F from 2028-01-01, E from 2034-01-01.
"""
from datetime import date

from app.services.dpe_compliance import assess_dpe


def test_class_g_today_is_prohibited_and_requires_ack():
    a = assess_dpe("G", None, None, False, date(2026, 6, 10))
    assert a.authoritative_class == "G"
    assert a.class_source == "self_declared"
    assert a.requires_acknowledgment is True
    assert any(w.code == "DECENCE_PROHIBITED" for w in a.warnings)


def test_class_f_today_is_allowed_but_flagged_upcoming():
    a = assess_dpe("F", None, None, False, date(2026, 6, 10))
    assert a.requires_acknowledgment is False
    codes = {w.code for w in a.warnings}
    assert "DECENCE_PROHIBITED" not in codes
    assert "DECENCE_UPCOMING" in codes


def test_class_f_becomes_prohibited_in_2028():
    a = assess_dpe("F", None, None, False, date(2028, 6, 1))
    assert a.requires_acknowledgment is True
    assert any(w.code == "DECENCE_PROHIBITED" for w in a.warnings)


def test_class_e_prohibited_from_2034():
    before = assess_dpe("E", None, None, False, date(2033, 12, 31))
    after = assess_dpe("E", None, None, False, date(2034, 1, 1))
    assert before.requires_acknowledgment is False
    assert after.requires_acknowledgment is True


def test_expired_dpe_requires_ack():
    a = assess_dpe("C", None, None, True, date(2026, 6, 10))
    assert a.requires_acknowledgment is True
    assert any(w.code == "DPE_EXPIRED" for w in a.warnings)


def test_high_ademe_class_overrides_self_typed():
    # Landlord typed F, but ADEME says G (post-reclassification)
    a = assess_dpe("F", "G", "HIGH", False, date(2026, 6, 10))
    assert a.authoritative_class == "G"
    assert a.class_source == "ademe_verified"
    assert a.requires_acknowledgment is True


def test_non_high_ademe_does_not_override():
    # PENDING/UNVERIFIED assurance must not be trusted over self-typed
    a = assess_dpe("D", "G", "UNVERIFIED", False, date(2026, 6, 10))
    assert a.authoritative_class == "D"
    assert a.class_source == "self_declared"


def test_self_declared_class_is_flagged_unverified():
    a = assess_dpe("D", None, None, False, date(2026, 6, 10))
    assert a.class_source == "self_declared"
    assert any(w.code == "SELF_DECLARED_UNVERIFIED" for w in a.warnings)


def test_no_class_anywhere():
    a = assess_dpe(None, None, None, None, date(2026, 6, 10))
    assert a.authoritative_class is None
    assert a.class_source == "none"
    assert a.requires_acknowledgment is False


def test_warnings_are_bilingual():
    a = assess_dpe("G", None, None, False, date(2026, 6, 10))
    w = next(w for w in a.warnings if w.code == "DECENCE_PROHIBITED")
    assert w.en and w.fr
    assert "G" in w.en
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_dpe_compliance.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.dpe_compliance'`.

- [ ] **Step 3: Implement the service**

```python
# backend/app/services/dpe_compliance.py
"""
DPE décence-énergétique compliance (loi Climat) + class-accuracy assessment.

Pure and side-effect-free (mirrors french_compliance.py). Produces facts only;
the caller (publish endpoint) decides what to block on.

Legal basis:
  - Art. L126-33 CCH: the DPE class must appear in the rental ad (incl. digital
    platforms); the platform must therefore display a class, and it must be accurate.
  - Décence énergétique (loi Climat, via Art. 6 loi 89): a dwelling below the class
    in force may not be the object of a NEW or RENEWED lease. The prohibition bites at
    lease formation, not at advertising — so this module flags it for acknowledgment
    rather than blocking. Calendar: min class F from 2025-01-01, E from 2028-01-01,
    D from 2034-01-01.
  - The Jan 2026 ADEME coefficient reform reclassified ~850k units, so a self-typed
    class is unreliable — an ADEME-verified (HIGH) class wins when present.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

_VALID = "ABCDEFG"
_RANK = {c: i for i, c in enumerate(_VALID, start=1)}  # A=1 (best) .. G=7 (worst)

# (effective_date, minimum allowed class in force from that date)
_DECENCE_CALENDAR = [
    (date(2025, 1, 1), "F"),
    (date(2028, 1, 1), "E"),
    (date(2034, 1, 1), "D"),
]


@dataclass
class DPEWarning:
    code: str         # DECENCE_PROHIBITED | DECENCE_UPCOMING | DPE_EXPIRED | SELF_DECLARED_UNVERIFIED
    severity: str     # "error" (requires ack) | "info"
    en: str
    fr: str


@dataclass
class DPEAssessment:
    authoritative_class: Optional[str]
    class_source: str                 # "ademe_verified" | "self_declared" | "none"
    expired: bool
    requires_acknowledgment: bool
    warnings: list = field(default_factory=list)


def _clean(cls: Optional[str]) -> Optional[str]:
    c = (cls or "").upper().strip()
    return c if c in _VALID else None


def _min_class_in_force(today: date) -> Optional[str]:
    minc = None
    for eff, mc in _DECENCE_CALENDAR:
        if today >= eff:
            minc = mc
    return minc


def _upcoming_prohibition_date(cls: str, today: date) -> Optional[date]:
    for eff, mc in _DECENCE_CALENDAR:
        if eff > today and _RANK[cls] > _RANK[mc]:
            return eff
    return None


def assess_dpe(
    self_typed_class: Optional[str],
    ademe_class: Optional[str],
    assurance: Optional[str],
    expired: Optional[bool],
    today: date,
) -> DPEAssessment:
    """Resolve the authoritative DPE class and produce décence/accuracy warnings."""
    ademe = _clean(ademe_class)
    typed = _clean(self_typed_class)

    if assurance == "HIGH" and ademe:
        authoritative, source = ademe, "ademe_verified"
    elif typed:
        authoritative, source = typed, "self_declared"
    else:
        authoritative, source = None, "none"

    expired = bool(expired)
    warnings: list = []

    if authoritative:
        min_in_force = _min_class_in_force(today)
        prohibited_now = min_in_force is not None and _RANK[authoritative] > _RANK[min_in_force]
        if prohibited_now:
            warnings.append(DPEWarning(
                code="DECENCE_PROHIBITED",
                severity="error",
                en=(f"This dwelling is class {authoritative}. Since it is below the "
                    f"minimum energy class required for rental, it cannot be the object "
                    f"of a new or renewed lease as a primary residence (décence "
                    f"énergétique, loi Climat). The listing may still be published with "
                    f"its true class displayed."),
                fr=(f"Ce logement est classé {authoritative}. Étant sous la classe "
                    f"minimale exigée pour la location, il ne peut faire l'objet d'un "
                    f"nouveau bail ou d'un renouvellement en résidence principale "
                    f"(décence énergétique, loi Climat). L'annonce reste publiable avec "
                    f"sa classe réelle affichée."),
            ))
        else:
            upcoming = _upcoming_prohibition_date(authoritative, today)
            if upcoming:
                warnings.append(DPEWarning(
                    code="DECENCE_UPCOMING",
                    severity="info",
                    en=(f"Class {authoritative} dwellings become prohibited for new "
                        f"leases from {upcoming.isoformat()} (décence énergétique)."),
                    fr=(f"Les logements classés {authoritative} seront interdits à la "
                        f"location à compter du {upcoming.isoformat()} (décence "
                        f"énergétique)."),
                ))

    if expired:
        warnings.append(DPEWarning(
            code="DPE_EXPIRED",
            severity="error",
            en=("This DPE has expired or uses the pre-July-2021 methodology; a valid "
                "DPE is required for a new lease."),
            fr=("Ce DPE est expiré ou utilise l'ancienne méthode (avant juillet 2021) ; "
                "un DPE valide est requis pour un nouveau bail."),
        ))

    if source == "self_declared":
        warnings.append(DPEWarning(
            code="SELF_DECLARED_UNVERIFIED",
            severity="info",
            en=("This DPE class was declared by the owner and not verified against "
                "ADEME; it may be affected by the Jan 2026 reclassification."),
            fr=("Cette classe DPE est déclarée par le propriétaire et non vérifiée "
                "auprès de l'ADEME ; elle peut être concernée par la reclassification "
                "de janvier 2026."),
        ))

    requires_ack = any(w.severity == "error" for w in warnings)

    return DPEAssessment(
        authoritative_class=authoritative,
        class_source=source,
        expired=expired,
        requires_acknowledgment=requires_ack,
        warnings=warnings,
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_dpe_compliance.py -v`
Expected: PASS (10 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/dpe_compliance.py backend/tests/test_dpe_compliance.py
git commit -m "feat(dpe): pure décence-énergétique assessment service (Phase 2 item 9)"
```

---

## Task 2: Publish-gate rewrite + integration tests

**Files:**
- Modify: `backend/app/routers/properties.py` (DPE block at lines 817-831; endpoint signature at 728-735)
- Modify: `backend/tests/test_properties.py:172-212`

- [ ] **Step 1: Update the existing G-ban test and add new cases (failing)**

Replace `test_publish_dpe_g_ban` (lines 172-212) in `backend/tests/test_properties.py` with the three tests below. They reuse the existing mock pattern; note `ownership_data` is now set on the mock.

```python
    def test_publish_dpe_g_requires_acknowledgment(self, landlord_client):
        """Class G no longer hard-blocks; publish returns 409 until acknowledged."""
        from app.main import app
        from app.core.database import get_db
        from app.models.property import Property
        from unittest.mock import AsyncMock, MagicMock
        import uuid
        from conftest import MOCK_LANDLORD

        property_id = uuid.uuid4()
        mock_prop = MagicMock(spec=Property)
        mock_prop.id = property_id
        mock_prop.landlord_id = MOCK_LANDLORD.id
        mock_prop.dpe_rating = "G"
        mock_prop.ownership_data = None
        mock_prop.deposit = None
        mock_prop.monthly_rent = 1000
        mock_prop.size_sqm = 40
        mock_prop.furnished = False
        mock_prop.loyer_reference_majore = None
        mock_prop.complement_de_loyer = None
        mock_prop.complement_de_loyer_justification = None
        mock_prop.room_details = []
        mock_prop.photos = ["photo1.jpg"]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_prop))
        )
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async def override_get_db():
            yield mock_db

        target_app = app.app if hasattr(app, 'app') else app
        target_app.dependency_overrides[get_db] = override_get_db
        try:
            resp = landlord_client.post(f"/properties/{property_id}/publish")
            assert resp.status_code == 409
            detail = resp.json()["detail"]
            assert detail["code"] == "dpe_acknowledgment_required"
            assert any(w["code"] == "DECENCE_PROHIBITED" for w in detail["warnings"])
        finally:
            from conftest import mock_get_db
            target_app.dependency_overrides[get_db] = mock_get_db

    def test_publish_dpe_g_with_acknowledgment_succeeds(self, landlord_client):
        """Class G publishes when the décence warning is acknowledged."""
        from app.main import app
        from app.core.database import get_db
        from app.models.property import Property
        from unittest.mock import AsyncMock, MagicMock
        import uuid
        from conftest import MOCK_LANDLORD

        property_id = uuid.uuid4()
        mock_prop = MagicMock(spec=Property)
        mock_prop.id = property_id
        mock_prop.landlord_id = MOCK_LANDLORD.id
        mock_prop.dpe_rating = "G"
        mock_prop.ownership_data = None
        mock_prop.deposit = None
        mock_prop.monthly_rent = 1000
        mock_prop.size_sqm = 40
        mock_prop.furnished = False
        mock_prop.loyer_reference_majore = None
        mock_prop.complement_de_loyer = None
        mock_prop.complement_de_loyer_justification = None
        mock_prop.room_details = []
        mock_prop.photos = ["photo1.jpg"]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_prop))
        )
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async def override_get_db():
            yield mock_db

        target_app = app.app if hasattr(app, 'app') else app
        target_app.dependency_overrides[get_db] = override_get_db
        try:
            resp = landlord_client.post(
                f"/properties/{property_id}/publish",
                json={"acknowledge_dpe_warning": True},
            )
            assert resp.status_code == 200
            assert mock_prop.status == "active"
            assert mock_prop.ownership_data["dpe_decence_acknowledged_class"] == "G"
            assert mock_prop.ownership_data["dpe_decence_acknowledged_at"]
        finally:
            from conftest import mock_get_db
            target_app.dependency_overrides[get_db] = mock_get_db

    def test_publish_high_ademe_class_overrides_self_typed(self, landlord_client):
        """A HIGH ADEME 'G' overrides a self-typed 'F' → rating corrected + 409."""
        from app.main import app
        from app.core.database import get_db
        from app.models.property import Property
        from unittest.mock import AsyncMock, MagicMock
        import uuid
        from conftest import MOCK_LANDLORD

        property_id = uuid.uuid4()
        mock_prop = MagicMock(spec=Property)
        mock_prop.id = property_id
        mock_prop.landlord_id = MOCK_LANDLORD.id
        mock_prop.dpe_rating = "F"
        mock_prop.ownership_data = {"dpe_assurance": "HIGH", "dpe_class": "G", "dpe_expired": False}
        mock_prop.deposit = None
        mock_prop.monthly_rent = 1000
        mock_prop.size_sqm = 40
        mock_prop.furnished = False
        mock_prop.loyer_reference_majore = None
        mock_prop.complement_de_loyer = None
        mock_prop.complement_de_loyer_justification = None
        mock_prop.room_details = []
        mock_prop.photos = ["photo1.jpg"]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_prop))
        )
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async def override_get_db():
            yield mock_db

        target_app = app.app if hasattr(app, 'app') else app
        target_app.dependency_overrides[get_db] = override_get_db
        try:
            resp = landlord_client.post(f"/properties/{property_id}/publish")
            assert resp.status_code == 409
            assert mock_prop.dpe_rating == "G"  # corrected from self-typed F
        finally:
            from conftest import mock_get_db
            target_app.dependency_overrides[get_db] = mock_get_db
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd backend && python -m pytest tests/test_properties.py -k "dpe" -v`
Expected: FAIL — old behavior returns 400 (no body param / still hard-blocks G).

- [ ] **Step 3: Add the request body model and rewrite the DPE block**

In `backend/app/routers/properties.py`, add near the other Pydantic imports/models (top of file, after existing imports):

```python
from pydantic import BaseModel


class PublishRequest(BaseModel):
    acknowledge_dpe_warning: bool = False
```

Change the endpoint signature (line 730-735) to accept the optional body:

```python
async def publish_property(
    request: Request,
    property_id: UUID,
    payload: Optional[PublishRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```

Replace the DPE block (current lines 817-831, from the `# ── French Compliance Validations ──` comment's DPE part down to the end of the `== "G"` block) with:

```python
    # ── French Compliance Validations ──────────────────────────────────────

    # DPE class: décence énergétique (warn + acknowledge, not block) and
    # L126-33 (the class must appear in the ad, and be accurate).
    from datetime import date
    from app.services.dpe_compliance import assess_dpe

    od = property_obj.ownership_data or {}
    assessment = assess_dpe(
        self_typed_class=property_obj.dpe_rating,
        ademe_class=od.get("dpe_class"),
        assurance=od.get("dpe_assurance"),
        expired=od.get("dpe_expired"),
        today=date.today(),
    )

    # L126-33: a rental ad must state the DPE class.
    if assessment.authoritative_class is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A DPE (Diagnostic de Performance Énergétique) class is required to "
                "publish a rental listing (Art. L126-33 CCH). — Une classe DPE est "
                "obligatoire pour publier une annonce de location (art. L126-33 CCH)."
            ),
        )

    # Keep the displayed class accurate (reclassification): authoritative wins.
    if property_obj.dpe_rating != assessment.authoritative_class:
        property_obj.dpe_rating = assessment.authoritative_class

    acknowledged = payload.acknowledge_dpe_warning if payload else False
    if assessment.requires_acknowledgment and not acknowledged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "dpe_acknowledgment_required",
                "warnings": [
                    {"code": w.code, "severity": w.severity, "en": w.en, "fr": w.fr}
                    for w in assessment.warnings
                ],
            },
        )
    if assessment.requires_acknowledgment and acknowledged:
        property_obj.ownership_data = {
            **od,
            "dpe_decence_acknowledged_at": naive_utcnow().isoformat(),
            "dpe_decence_acknowledged_class": assessment.authoritative_class,
        }
```

Leave the deposit-cap, 9m², and rent-control checks that follow exactly as they are.

- [ ] **Step 4: Run the DPE publish tests, then the full file**

Run: `cd backend && python -m pytest tests/test_properties.py -k "dpe" -v`
Expected: PASS (3 passed).

Run: `cd backend && python -m pytest tests/test_properties.py -v`
Expected: PASS (no regressions — deposit/surface/rent-control tests still green).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/properties.py backend/tests/test_properties.py
git commit -m "feat(dpe): warn+ack publish gate, keep L126-33 class display, ADEME class wins"
```

---

## Task 3: Wizard — warn + required acknowledgment

**Files:**
- Modify: `frontend/app/properties/new/steps/Step9Success.tsx`
- Modify: `frontend/app/properties/new/page.tsx:190-200`

- [ ] **Step 1: Make G a warning with a required checkbox in Step9Success**

In `frontend/app/properties/new/steps/Step9Success.tsx`:

Add a `useState` import and a local ack state. Change the top of the component (lines 1-23) so `isDpeGBanned` is treated as a *décence warning*, not a hard error:

```tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    t: TFn;
    mediaSession: { verification_code: string; id: string; expires_at: string } | null;
    publishing: boolean;
    onPublish: (acknowledgeDpe: boolean) => void;
    onReturn: () => void;
}

export default function Step9Success({ formData, t, mediaSession, publishing, onPublish, onReturn }: Props) {
    const [dpeAcknowledged, setDpeAcknowledged] = useState(false);

    const isDepositLimitExceeded =
        formData.deposit !== undefined &&
        formData.monthly_rent > 0 &&
        formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1);
    const isDpeDecenceWarning = formData.dpe_rating === 'G';
    const isSizeTooSmall = formData.size_sqm < 9;
    const hasHardComplianceErrors = isSizeTooSmall || isDepositLimitExceeded;
    const publishBlocked =
        publishing || hasHardComplianceErrors || (isDpeDecenceWarning && !dpeAcknowledged);
```

Replace the DPE list item (lines 58-60) — remove it from the red hard-error block — and add a separate amber décence warning block with the checkbox just before the publish button (before line 74). Insert after the closing `)}` of the `hasHardComplianceErrors` block (after line 73):

```tsx
                {isDpeDecenceWarning && (
                    <div
                        className="p-6 bg-amber-50/80 backdrop-blur-md border border-amber-200/60 rounded-3xl max-w-md mx-auto text-left space-y-3 mb-4 animate-fade-in"
                        role="alert"
                    >
                        <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
                            <Shield className="w-4 h-4 text-amber-600" />
                            <span>{t('property.create.dpe.decenceTitle', undefined, 'Energy decency notice')}</span>
                        </div>
                        <p className="text-xs font-bold text-amber-700">
                            {t('property.create.dpe.decenceG', undefined, 'A class G dwelling cannot be leased as a primary residence (new or renewed lease) under the loi Climat. You may still publish this listing with its class shown.')}
                        </p>
                        <label className="flex items-start gap-2 text-xs font-bold text-amber-800 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dpeAcknowledged}
                                onChange={(e) => setDpeAcknowledged(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span>{t('property.create.dpe.decenceAck', undefined, 'I understand this dwelling cannot be leased as a primary residence in its current energy class.')}</span>
                        </label>
                    </div>
                )}
```

Remove the now-dead lines 58-60 (the `{isDpeGBanned && (<li>...)}` item). Update the publish button (lines 74-82) to use the new gating + pass the ack:

```tsx
                <button
                    onClick={() => onPublish(isDpeDecenceWarning && dpeAcknowledged)}
                    disabled={publishBlocked}
                    className="px-16 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
```

- [ ] **Step 2: Thread the ack through the publish handler**

In `frontend/app/properties/new/page.tsx`, change `handlePublish` (lines 190-200) to accept and send the flag, and surface a 409:

```tsx
    const handlePublish = async (acknowledgeDpe: boolean = false) => {
        if (!propertyId) return;
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`, {
                acknowledge_dpe_warning: acknowledgeDpe,
            });
            setServerDpeWarnings(null);
        } catch (e: any) {
            if (e?.response?.status === 409) {
                const warnings: DpeWarning[] | undefined = e.response.data?.detail?.warnings;
                if (warnings && warnings.length > 0) {
                    setServerDpeWarnings(warnings);
                }
                toast.error(t('property.create.dpe.publishAckRequired', undefined, "This property's verified energy class requires acknowledgment before it can be published. Please review the energy rating."));
            } else {
                setServerDpeWarnings(null);
                const detail = e?.response?.data?.detail;
                const message =
                    typeof detail === 'string'
                        ? detail
                        : t('common.error', undefined, 'Failed to publish property.');
                toast.error(message);
                console.error('Publish error:', e);
            }
        } finally {
            setPublishing(false);
        }
    };
```

The `Step9Success` prop call at line 353 already passes `onPublish={handlePublish}`; the new signature is compatible (the child now calls `onPublish(bool)`).

- [ ] **Step 3: Build to verify the frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors in `Step9Success.tsx` / `page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/properties/new/steps/Step9Success.tsx frontend/app/properties/new/page.tsx
git commit -m "feat(dpe): wizard warns + requires acknowledgment for class G instead of blocking"
```

---

## Task 4: FR/EN i18n parity for décence strings

**Files:**
- Modify: `frontend/lib/i18n.ts` (en `create:` block ~line 1294, fr `create:` block ~line 3605)

- [ ] **Step 1: Read both `create:` blocks to find the insertion points**

Run: `cd frontend && grep -n "create:" lib/i18n.ts`
Then Read ~15 lines after each (≈1294 for en, ≈3605 for fr) to see the existing nesting (e.g. an `errors:` sub-object).

- [ ] **Step 2: Add a `dpe` sub-object to the EN `create:` block**

Inside the EN `create:` object (around line 1294), add:

```ts
            dpe: {
                decenceTitle: 'Energy decency notice',
                decenceG: 'A class G dwelling cannot be leased as a primary residence (new or renewed lease) under the loi Climat. You may still publish this listing with its class shown.',
                decenceAck: 'I understand this dwelling cannot be leased as a primary residence in its current energy class.',
                selfDeclared: 'Declared — not verified against ADEME',
            },
```

- [ ] **Step 3: Add the parallel `dpe` sub-object to the FR `create:` block**

Inside the FR `create:` object (around line 3605), add:

```ts
            dpe: {
                decenceTitle: 'Décence énergétique',
                decenceG: "Un logement classé G ne peut être loué en résidence principale (bail nouveau ou renouvelé) selon la loi Climat. Vous pouvez tout de même publier cette annonce en affichant sa classe.",
                decenceAck: "Je comprends que ce logement ne peut être loué en résidence principale dans sa classe énergétique actuelle.",
                selfDeclared: 'Déclaré — non vérifié auprès de l’ADEME',
            },
```

- [ ] **Step 4: Verify parity and compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: `npx tsc --noEmit` passes (no missing-key / syntax errors). Manually confirm the EN and FR `dpe` sub-objects have identical keys.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/i18n.ts
git commit -m "i18n(dpe): FR/EN décence notice + acknowledgment strings"
```

---

## Final verification

- [ ] **Backend suite**

Run: `cd backend && python -m pytest tests/test_dpe_compliance.py tests/test_properties.py -v`
Expected: all green.

- [ ] **Frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Manual smoke (optional, per test-per-feature rule):** create a draft with `dpe_rating=G`, attempt publish → 409; tick the checkbox → publishes; confirm `ownership_data.dpe_decence_acknowledged_at` is set.

---

## Self-Review

**Spec coverage:**
- New pure service w/ date-aware calendar + authoritative-class resolution + bilingual warnings → Task 1. ✅
- Publish rewrite: warn-not-block G/expired, missing-class 400 (L126-33), 409 + `acknowledge_dpe_warning`, overwrite `dpe_rating` with authoritative class → Task 2. ✅
- Frontend warn + required ack + pass flag + 409 handling → Task 3; assurance label string (`selfDeclared`) → Task 4. ✅
- FR/EN parity → Task 4. ✅
- Unit + integration tests → Tasks 1 & 2. ✅
- Refinements (no migration; no in-wizard verify flow) documented under File Structure with rationale. ✅

**Placeholder scan:** none — every code step contains full code; every command has an expected result.

**Type consistency:** `assess_dpe(self_typed_class, ademe_class, assurance, expired, today)` and `DPEAssessment{authoritative_class, class_source, expired, requires_acknowledgment, warnings}` / `DPEWarning{code, severity, en, fr}` are used identically across Tasks 1, 2, and the tests. `PublishRequest.acknowledge_dpe_warning` matches the JSON body in the tests and the frontend POST. `onPublish(acknowledgeDpe: boolean)` matches between Step9Success and page.tsx.
