"""SSRF guard on ERP webhook URLs (policy 6.1, CWE-918).

The URL is checked when a subscription is created AND updated, every resolved
address must be public, and delivery connects to the address it checked so a
DNS answer that changes after validation (rebinding) cannot reach the inside.
"""

import socket
import types

import httpx
import pytest
from pydantic import ValidationError

from app.routers import erp_webhooks
from app.routers.erp_webhooks import (CreateSubscriptionRequest,
                                      UpdateSubscriptionRequest,
                                      send_webhook, validate_webhook_url)


def _infos(*ips):
    return [
        (socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))
        for ip in ips
    ]


@pytest.fixture
def resolve(monkeypatch):
    """Point every hostname at the given addresses (sync and async lookups)."""
    def _set(*ips):
        def fake(host, port, *a, **kw):
            if not ips:
                raise socket.gaierror("no such host")
            return _infos(*ips)

        async def fake_async(host, port, *a, **kw):
            return fake(host, port)

        monkeypatch.setattr(erp_webhooks.socket, "getaddrinfo", fake)
        monkeypatch.setattr(erp_webhooks, "_getaddrinfo_async", fake_async)
    return _set


@pytest.mark.parametrize("ip", [
    "127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1",
    "::ffff:127.0.0.1", "64:ff9b::7f00:1", "::127.0.0.1", "fec0::1",
])
def test_rejects_non_public_addresses(resolve, ip):
    resolve(ip)
    with pytest.raises(ValueError):
        validate_webhook_url("https://hooks.example.com/x")


def test_rejects_when_any_resolved_address_is_internal(resolve):
    resolve("93.184.216.34", "10.0.0.1")
    with pytest.raises(ValueError):
        validate_webhook_url("https://hooks.example.com/x")


def test_rejects_unresolvable_host(resolve):
    resolve()
    with pytest.raises(ValueError):
        validate_webhook_url("https://does-not-resolve.example/x")


def test_rejects_non_http_scheme(resolve):
    resolve("93.184.216.34")
    with pytest.raises(ValueError):
        validate_webhook_url("file:///etc/passwd")


def test_accepts_public_address(resolve):
    resolve("93.184.216.34")
    assert validate_webhook_url("https://hooks.example.com/x") == "https://hooks.example.com/x"


def test_create_and_update_both_validate(resolve):
    resolve("127.0.0.1")
    with pytest.raises(ValidationError):
        CreateSubscriptionRequest(name="n", url="http://internal/x", events=[])
    with pytest.raises(ValidationError):
        UpdateSubscriptionRequest(url="http://internal/x")
    assert UpdateSubscriptionRequest(name="only-name").url is None


class _FakeDB:
    def add(self, obj):
        self.added = obj

    async def commit(self):
        pass


def _subscription(url):
    return types.SimpleNamespace(
        id="sub-1", url=url, secret="s3cret", failure_count="0", last_triggered_at=None,
        is_active=True,
    )


@pytest.fixture
def posts(monkeypatch):
    calls = []

    async def fake_post(self, url, **kw):
        calls.append({"url": url, **kw})
        return httpx.Response(200, text="ok")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return calls


@pytest.mark.asyncio
async def test_delivery_blocked_when_host_now_resolves_inside(resolve, posts):
    # Saved while public; the DNS answer has since changed (rebinding).
    resolve("169.254.169.254")
    sub = _subscription("https://hooks.example.com/x")
    result = await send_webhook(sub, "test", {"a": 1}, _FakeDB())
    assert result["success"] is False
    assert posts == []
    assert sub.failure_count == "1"
    assert sub.is_active is False  # stop delivering until the landlord re-saves


@pytest.mark.asyncio
async def test_delivery_connects_to_the_checked_address(resolve, posts):
    resolve("93.184.216.34")
    sub = _subscription("https://hooks.example.com:8443/x?y=1")
    result = await send_webhook(sub, "test", {"a": 1}, _FakeDB())
    assert result["success"] is True
    [call] = posts
    assert call["url"] == "https://93.184.216.34:8443/x?y=1"
    assert call["headers"]["Host"] == "hooks.example.com:8443"
    assert call["extensions"] == {"sni_hostname": "hooks.example.com"}


@pytest.mark.asyncio
async def test_delivery_pins_ipv6_with_brackets(resolve, posts):
    resolve("2606:2800:220:1:248:1893:25c8:1946")
    await send_webhook(_subscription("http://hooks.example.com/x"), "test", {}, _FakeDB())
    [call] = posts
    assert call["url"] == "http://[2606:2800:220:1:248:1893:25c8:1946]/x"
    assert call["headers"]["Host"] == "hooks.example.com"
