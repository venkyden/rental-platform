"""
Reporting a listing (DSA art. 16) and the decision on it (art. 17), against
real rows: anyone can report a published listing, the reporter is told the
report arrived and what was decided, an upheld report takes the listing offline
with reasons sent to the owner, and the listing cannot be republished until the
decision is reversed. The reporter's contact details are erased once decided.
"""

import pytest

from app.models.content_report import ContentReport
from app.models.property import Property
from tests_integration.conftest import auth, make_property, make_user

VALID = {
    "reason": "discrimination",
    "explanation": "The description says the room is not for foreign students.",
    "notifier_name": "Alex Martin",
    "notifier_email": "alex@example.com",
    "good_faith": True,
}


@pytest.fixture
def sent(monkeypatch):
    """Every email the report routes send, as (to, subject, text)."""
    from app.routers import reports

    outbox: list[tuple[str, str, str]] = []

    async def _send(to_email, subject, html_content, text_content=None):
        outbox.append((to_email, subject, text_content or html_content))
        return True

    monkeypatch.setattr(reports.email_service, "send_email", _send)
    return outbox


async def _report(client, prop, **overrides) -> dict:
    r = await client.post("/reports", json={**VALID, "property_id": str(prop.id), **overrides})
    assert r.status_code == 201, r.text
    return r.json()


async def _decide(client, admin, report_id, decision, **extra):
    body = {"decision": decision, "reason": "The description refuses applicants because of their nationality.",
            "ground": "illegal", **extra}
    return await client.post(f"/reports/admin/{report_id}/decision", json=body, headers=auth(admin))


@pytest.mark.asyncio
async def test_report_is_stored_and_acknowledged(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord, status="active")

    body = await _report(client, prop)

    async with sessionmaker_() as s:
        row = await s.get(ContentReport, body["id"])
    assert row.status == "received"
    assert row.reason == "discrimination"
    assert row.notifier_email == "alex@example.com"
    assert [to for to, _, _ in sent] == ["alex@example.com"]


@pytest.mark.asyncio
@pytest.mark.parametrize("override", [
    {"reason": "not_a_reason"},
    {"good_faith": False},
    {"explanation": "bad"},
    {"notifier_email": "not-an-email"},
    {"notifier_name": ""},
])
async def test_incomplete_or_invalid_reports_are_refused(client, sessionmaker_, sent, override):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord, status="active")

    r = await client.post("/reports", json={**VALID, "property_id": str(prop.id), **override})

    assert r.status_code == 422, r.text
    assert sent == []


@pytest.mark.asyncio
async def test_only_published_listings_can_be_reported(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    draft = await make_property(sessionmaker_, landlord)

    r = await client.post("/reports", json={**VALID, "property_id": str(draft.id)})
    assert r.status_code == 404
    r = await client.post("/reports", json={**VALID, "property_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_queue_is_for_admins_only(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)

    r = await client.get("/reports/admin", headers=auth(landlord))
    assert r.status_code == 403
    r = await _decide(client, landlord, report["id"], "upheld")
    assert r.status_code == 403

    r = await client.get("/reports/admin", headers=auth(admin))
    assert r.status_code == 200
    item = next(i for i in r.json() if i["id"] == report["id"])
    assert item["property_title"] == "Test Flat"
    assert item["status"] == "received"
    assert item["notifier_email"] == "alex@example.com"


@pytest.mark.asyncio
async def test_upheld_report_takes_listing_offline_and_tells_both_sides(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)
    sent.clear()

    r = await _decide(client, admin, report["id"], "upheld")
    assert r.status_code == 200, r.text

    async with sessionmaker_() as s:
        listing = await s.get(Property, prop.id)
        row = await s.get(ContentReport, report["id"])
    assert listing.status == "inactive"
    assert row.status == "upheld"
    assert row.decided_at is not None and row.decided_by == admin.id
    assert row.notifier_name is None and row.notifier_email is None

    recipients = sorted(to for to, _, _ in sent)
    assert recipients == sorted(["alex@example.com", landlord.email])
    owner_text = next(text for to, _, text in sent if to == landlord.email)
    assert "refuses applicants because of their nationality" in owner_text
    assert "Alex" not in owner_text and "alex@example.com" not in owner_text


@pytest.mark.asyncio
async def test_rejected_report_leaves_listing_and_owner_alone(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)
    sent.clear()

    r = await _decide(client, admin, report["id"], "rejected", ground=None)
    assert r.status_code == 200, r.text

    async with sessionmaker_() as s:
        listing = await s.get(Property, prop.id)
        row = await s.get(ContentReport, report["id"])
    assert listing.status == "active"
    assert row.status == "rejected"
    assert row.notifier_email is None
    assert [to for to, _, _ in sent] == ["alex@example.com"]


@pytest.mark.asyncio
async def test_upheld_needs_a_ground_and_a_reason(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)

    r = await _decide(client, admin, report["id"], "upheld", ground=None)
    assert r.status_code == 422
    r = await _decide(client, admin, report["id"], "upheld", reason="short")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_a_decided_report_cannot_be_decided_again(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)
    await _decide(client, admin, report["id"], "rejected", ground=None)

    r = await _decide(client, admin, report["id"], "upheld")
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_upheld_listing_cannot_be_republished_until_reversed(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)
    await _decide(client, admin, report["id"], "upheld")

    r = await client.post(f"/properties/{prop.id}/publish", headers=auth(landlord))
    assert r.status_code == 409, r.text

    sent.clear()
    r = await _decide(client, admin, report["id"], "reversed",
                      reason="The owner showed the sentence had been removed before the report.", ground=None)
    assert r.status_code == 200, r.text
    async with sessionmaker_() as s:
        row = await s.get(ContentReport, report["id"])
    assert row.status == "reversed"
    assert [to for to, _, _ in sent] == [landlord.email]

    r = await client.post(f"/properties/{prop.id}/publish", headers=auth(landlord))
    assert r.status_code != 409, r.text


@pytest.mark.asyncio
async def test_only_an_upheld_report_can_be_reversed(client, sessionmaker_, sent):
    landlord = await make_user(sessionmaker_, role="landlord")
    admin = await make_user(sessionmaker_, role="admin")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop)

    r = await _decide(client, admin, report["id"], "reversed", ground=None)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_deleting_an_account_erases_its_contact_from_open_reports(client, sessionmaker_, sent, monkeypatch):
    from app.services.storage import storage

    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr(storage, "delete_files_by_prefix", _noop)
    monkeypatch.setattr(storage, "delete_file", _noop)
    landlord = await make_user(sessionmaker_, role="landlord")
    reporter = await make_user(sessionmaker_, role="tenant", email="Reporter.Case@Example.com")
    prop = await make_property(sessionmaker_, landlord, status="active")
    report = await _report(client, prop, notifier_email="reporter.case@example.com")

    r = await client.delete("/gdpr/delete", headers=auth(reporter))
    assert r.status_code == 200, r.text

    async with sessionmaker_() as s:
        row = await s.get(ContentReport, report["id"])
    assert row.notifier_name is None and row.notifier_email is None
    assert row.status == "received"
