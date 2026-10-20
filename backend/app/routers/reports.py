"""
Notice and action (DSA art. 16) and statements of reasons (art. 17).

Anyone can report a published listing. Reports are read and decided by a
person (no automated decision). The reporter gets a receipt and the decision;
when a report is upheld the listing goes offline, the owner is told why and how
to contest, and the listing cannot be republished until the decision is reversed.
"""

import html
import logging
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.timeutils import naive_utcnow
from app.models.content_report import GROUNDS, REASONS, ContentReport
from app.models.property import Property
from app.models.user import User
from app.routers.admin import require_admin
from app.services.email import _render, email_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports"])
limiter = Limiter(key_func=get_remote_address)

REASON_LABELS = {
    "discrimination": ("Discrimination", "Discrimination"),
    "scam": ("Arnaque ou fraude", "Scam or fraud"),
    "misleading": ("Annonce trompeuse", "Misleading listing"),
    "unsafe_housing": ("Logement indécent ou dangereux", "Unsafe or substandard housing"),
    "other_illegal": ("Autre contenu illégal", "Other illegal content"),
}


class ReportCreate(BaseModel):
    property_id: UUID
    reason: Literal[REASONS]  # type: ignore[valid-type]
    explanation: str = Field(..., min_length=20, max_length=3000)
    notifier_name: str = Field(..., min_length=1, max_length=120)
    notifier_email: EmailStr
    good_faith: Literal[True]


class Decision(BaseModel):
    decision: Literal["upheld", "rejected", "reversed"]
    reason: str = Field(..., min_length=20, max_length=3000)
    ground: Optional[Literal[GROUNDS]] = None  # type: ignore[valid-type]


async def _send(to: str, subject: str, text: str) -> None:
    """Send a plain notice; a failed email is logged, never fatal to the decision."""
    body = "".join(f"<p>{html.escape(p)}</p>" for p in text.split("\n\n"))
    try:
        await email_service.send_email(to, subject, _render(body), text)
    except Exception:
        logger.exception("[Reports] email failed: %s", subject)


def _reason_label(reason: str) -> str:
    fr, en = REASON_LABELS[reason]
    return f"{fr} / {en}"


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_report(request: Request, body: ReportCreate, db: AsyncSession = Depends(get_db)):
    prop = await db.get(Property, body.property_id)
    if prop is None or prop.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    report = ContentReport(
        property_id=prop.id,
        reason=body.reason,
        explanation=body.explanation.strip(),
        notifier_name=body.notifier_name.strip(),
        notifier_email=str(body.notifier_email),
        good_faith=True,
    )
    db.add(report)
    await db.commit()

    await _send(
        report.notifier_email,
        "Signalement reçu / Report received — Roomivo",
        f"Nous avons reçu votre signalement concernant l'annonce « {prop.title} » "
        f"(motif : {REASON_LABELS[report.reason][0]}). Une personne l'examinera et vous "
        "informera de la décision par e-mail. Aucun outil automatisé ne prend cette décision.\n\n"
        f"We have received your report about the listing \"{prop.title}\" "
        f"(reason: {REASON_LABELS[report.reason][1]}). A person will review it and email you "
        "the decision. No automated tool takes this decision.\n\n"
        f"Référence / Reference: {report.id}",
    )
    return {"id": str(report.id), "status": report.status}


@router.get("/admin")
async def list_reports(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    open_first = case((ContentReport.status == "received", 0), else_=1)
    rows = (await db.execute(
        select(ContentReport, Property.title, Property.status)
        .join(Property, Property.id == ContentReport.property_id)
        .order_by(open_first, ContentReport.created_at.desc())
        .limit(200)
    )).all()
    return [
        {
            "id": str(r.id),
            "property_id": str(r.property_id),
            "property_title": title,
            "property_status": prop_status,
            "reason": r.reason,
            "explanation": r.explanation,
            "notifier_name": r.notifier_name,
            "notifier_email": r.notifier_email,
            "status": r.status,
            "ground": r.ground,
            "decision_reason": r.decision_reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "decided_at": r.decided_at.isoformat() if r.decided_at else None,
        }
        for r, title, prop_status in rows
    ]


@router.post("/admin/{report_id}/decision")
async def decide_report(
    report_id: UUID,
    body: Decision,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if body.decision == "upheld" and body.ground is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="An upheld report needs a ground: illegal or terms.",
        )
    report = (await db.execute(
        select(ContentReport).where(ContentReport.id == report_id).with_for_update()
    )).scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    allowed_from = "upheld" if body.decision == "reversed" else "received"
    if report.status != allowed_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A report that is {report.status} cannot be {body.decision}.",
        )

    prop = await db.get(Property, report.property_id)
    owner = await db.get(User, prop.landlord_id)
    notifier_email = report.notifier_email

    report.status = body.decision
    report.decision_reason = body.reason.strip()
    report.decided_at = naive_utcnow()
    report.decided_by = admin.id
    if body.decision == "upheld":
        report.ground = body.ground
        if prop.status == "active":
            prop.status = "inactive"
    # The reporter's details only serve to send the decision.
    report.notifier_name = None
    report.notifier_email = None
    await db.commit()

    if body.decision in ("upheld", "rejected") and notifier_email:
        outcome_fr = ("L'annonce a été retirée." if body.decision == "upheld"
                      else "L'annonce reste en ligne.")
        outcome_en = ("The listing has been taken down." if body.decision == "upheld"
                      else "The listing stays online.")
        await _send(
            notifier_email,
            "Décision sur votre signalement / Decision on your report — Roomivo",
            f"Votre signalement concernant l'annonce « {prop.title} » a été examiné par une personne. "
            f"{outcome_fr}\n\nMotif : {report.decision_reason}\n\n"
            f"Your report about the listing \"{prop.title}\" was reviewed by a person. {outcome_en}\n\n"
            f"Reason: {report.decision_reason}\n\n"
            "Vous pouvez aussi saisir la justice. / You may also go to court.\n\n"
            f"Référence / Reference: {report.id}",
        )

    if body.decision == "upheld" and owner:
        ground_fr = ("contenu illégal" if report.ground == "illegal"
                     else "contenu contraire aux conditions d'utilisation de Roomivo")
        ground_en = ("illegal content" if report.ground == "illegal"
                     else "content that breaks Roomivo's terms of use")
        await _send(
            owner.email,
            "Votre annonce a été retirée / Your listing was taken down — Roomivo",
            f"Votre annonce « {prop.title} » a été retirée de Roomivo à la suite d'un signalement "
            f"(motif : {_reason_label(report.reason)}). La décision a été prise par une personne, "
            f"sans outil automatisé, au motif de : {ground_fr}.\n\n"
            f"Faits retenus : {report.decision_reason}\n\n"
            "Vous ne pourrez pas la republier tant que cette décision est en vigueur. Pour la contester, "
            "répondez à cet e-mail ou écrivez à contact@roomivo.eu en citant la référence ci-dessous ; "
            "une personne réexaminera la décision. Vous pouvez aussi saisir la justice.\n\n"
            f"Your listing \"{prop.title}\" was taken down from Roomivo after a report "
            f"(reason: {REASON_LABELS[report.reason][1]}). A person took this decision, without an "
            f"automated tool, on the ground of: {ground_en}.\n\n"
            f"Facts: {report.decision_reason}\n\n"
            "You cannot republish it while this decision stands. To contest it, reply to this email or "
            "write to contact@roomivo.eu quoting the reference below; a person will review the decision "
            "again. You may also go to court.\n\n"
            f"Référence / Reference: {report.id}",
        )

    if body.decision == "reversed" and owner:
        await _send(
            owner.email,
            "Décision annulée / Decision reversed — Roomivo",
            f"Après réexamen, la décision de retirer votre annonce « {prop.title} » est annulée : "
            f"{report.decision_reason}\n\nVous pouvez la republier depuis votre tableau de bord.\n\n"
            f"After review, the decision to take down your listing \"{prop.title}\" is reversed: "
            f"{report.decision_reason}\n\nYou can republish it from your dashboard.\n\n"
            f"Référence / Reference: {report.id}",
        )

    return {"id": str(report.id), "status": report.status}


async def listing_is_taken_down(db: AsyncSession, property_id) -> bool:
    """True while an upheld report on this listing stands."""
    found = await db.execute(
        select(ContentReport.id)
        .where(ContentReport.property_id == property_id, ContentReport.status == "upheld")
        .limit(1)
    )
    return found.first() is not None
