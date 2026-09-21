"""WP5 — CORSSafetyNet must not crash on its own error path.

Found in the docker API logs while stress-probing: when a downstream error
fired *after* the response had already started, the net still tried to send a
503, which raised

    RuntimeError: Unexpected ASGI message 'http.response.start' sent,
                  after response already completed

masking the real error and dropping the CORS headers the net exists to add.
"""

import pytest

from app.main import CORSSafetyNet


def _scope():
    return {"type": "http", "headers": [(b"origin", b"http://localhost:3000")]}


@pytest.mark.asyncio
async def test_sends_503_when_response_has_not_started():
    """The normal path still works: error before any output -> clean 503."""
    async def failing_app(scope, receive, send):
        raise RuntimeError("boom before any output")

    sent = []

    async def send(message):
        sent.append(message)

    await CORSSafetyNet(failing_app)(_scope(), None, send)

    start = next(m for m in sent if m["type"] == "http.response.start")
    assert start["status"] == 503
    header_names = [h[0] for h in start["headers"]]
    assert b"access-control-allow-origin" in header_names


@pytest.mark.asyncio
async def test_reraises_instead_of_double_starting_response():
    """Error after response start: re-raise the original, never a second start."""
    async def failing_app(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        raise RuntimeError("boom after output began")

    sent = []

    async def send(message):
        sent.append(message)

    with pytest.raises(RuntimeError, match="boom after output began"):
        await CORSSafetyNet(failing_app)(_scope(), None, send)

    # Exactly one response.start reached the server — no ASGI protocol violation.
    assert sum(1 for m in sent if m["type"] == "http.response.start") == 1


@pytest.mark.asyncio
async def test_non_http_scope_passes_through():
    seen = {}

    async def app(scope, receive, send):
        seen["called"] = True

    await CORSSafetyNet(app)({"type": "lifespan"}, None, None)
    assert seen["called"] is True
