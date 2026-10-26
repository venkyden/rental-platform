"""
The question box, step 1, against real rows: a signed-in student asks the owner
about a published listing; the question starts or continues their private
conversation and the owner is notified. A question about who may rent is never
stored or sent. Nothing is published.
"""

import pytest
from sqlalchemy import select

from app.services.notification_delivery import NotificationDelivery

from app.models.messages import Conversation, Message
from app.models.notification import Notification
from tests_integration.conftest import auth, make_property, make_user


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Emails the route sends to owners, as (to, subject, body)."""
    sent: list[tuple[str, str, str]] = []

    async def _send_email(self, to, subject, body, html=None):
        sent.append((to, subject, body))
        return True

    monkeypatch.setattr(NotificationDelivery, "send_email", _send_email)
    return sent


async def _ask(client, prop, user, question="Is there a dishwasher in the kitchen?"):
    return await client.post(f"/properties/{prop.id}/questions", json={"question": question}, headers=auth(user))


async def _rows(sm, model, **where):
    async with sm() as s:
        stmt = select(model)
        for key, value in where.items():
            stmt = stmt.where(getattr(model, key) == value)
        return (await s.execute(stmt)).scalars().all()


@pytest.mark.asyncio
async def test_a_question_starts_a_private_conversation_and_notifies_the_owner(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")

    r = await _ask(client, prop, student)
    assert r.status_code == 201, r.text
    conv_id = r.json()["conversation_id"]

    [conv] = await _rows(sessionmaker_, Conversation, property_id=prop.id)
    assert str(conv.id) == conv_id
    assert (conv.landlord_id, conv.tenant_id) == (landlord.id, student.id)
    assert conv.unread_count_landlord == 1
    [msg] = await _rows(sessionmaker_, Message, conversation_id=conv.id)
    assert (msg.sender_id, msg.message_type, msg.content) == (
        student.id, "listing_question", "Is there a dishwasher in the kitchen?")
    [note] = await _rows(sessionmaker_, Notification, user_id=landlord.id)
    assert note.action_url == f"/inbox?conversation={conv_id}"


@pytest.mark.asyncio
async def test_a_second_question_continues_the_same_conversation(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")

    first = (await _ask(client, prop, student)).json()["conversation_id"]
    second = (await _ask(client, prop, student, "Does the washing machine work?")).json()["conversation_id"]

    assert first == second
    [conv] = await _rows(sessionmaker_, Conversation, property_id=prop.id)
    assert conv.unread_count_landlord == 2


@pytest.mark.asyncio
async def test_the_student_can_read_the_conversation(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")
    conv_id = (await _ask(client, prop, student)).json()["conversation_id"]

    r = await client.get(f"/conversations/{conv_id}", headers=auth(student))
    assert r.status_code == 200, r.text
    r = await client.get(f"/conversations/{conv_id}", headers=auth(landlord))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
@pytest.mark.parametrize("question", ["Do you accept foreigners?", "Acceptez-vous les familles avec enfants ?"])
async def test_a_question_about_who_may_rent_is_not_sent(client, sessionmaker_, question):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")

    r = await _ask(client, prop, student, question)
    assert r.status_code == 422 and r.json()["detail"] == "who_may_rent", r.text
    assert await _rows(sessionmaker_, Conversation, property_id=prop.id) == []
    assert await _rows(sessionmaker_, Notification, user_id=landlord.id) == []


@pytest.mark.asyncio
async def test_only_published_listings_take_questions(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    draft = await make_property(sessionmaker_, landlord)
    assert (await _ask(client, draft, student)).status_code == 404


@pytest.mark.asyncio
async def test_the_owner_cannot_ask_their_own_listing(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord, status="active")
    assert (await _ask(client, prop, landlord)).status_code == 400


@pytest.mark.asyncio
async def test_asking_needs_an_account(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord, status="active")
    r = await client.post(f"/properties/{prop.id}/questions", json={"question": "Is there a dishwasher?"})
    assert r.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("question", ["hey", "x" * 501])
async def test_too_short_or_too_long_is_refused(client, sessionmaker_, question):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")
    assert (await _ask(client, prop, student, question)).status_code == 422


@pytest.mark.asyncio
async def test_five_questions_a_day_per_listing(client, sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")

    for n in range(5):
        assert (await _ask(client, prop, student, f"Question number {n} about the flat?")).status_code == 201
    r = await _ask(client, prop, student, "One question too many about the flat?")
    assert r.status_code == 429 and r.json()["detail"] == "too_many_questions"


@pytest.mark.asyncio
async def test_the_owner_is_emailed_unless_they_turned_emails_off(client, sessionmaker_, outbox):
    from app.models.user import User

    landlord = await make_user(sessionmaker_, role="landlord")
    quiet = await make_user(sessionmaker_, role="landlord")
    async with sessionmaker_() as s:
        (await s.get(User, quiet.id)).contact_preferences = {"email_notifications": False}
        await s.commit()
    student = await make_user(sessionmaker_, role="tenant")
    prop = await make_property(sessionmaker_, landlord, status="active")
    quiet_prop = await make_property(sessionmaker_, quiet, status="active")

    await _ask(client, prop, student)
    await _ask(client, quiet_prop, student)

    assert [to for to, _, _ in outbox] == [landlord.email]
    assert "Is there a dishwasher in the kitchen?" in outbox[0][2]
    assert "/inbox?conversation=" in outbox[0][2]
