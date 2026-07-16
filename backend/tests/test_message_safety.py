"""Unit tests for the anti-scam message advisory scanner (domain audit #5)."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://m:m@localhost/m")

from app.services.message_safety import scan_message


def test_deposit_before_visit_via_untraceable_rail_flags_both():
    codes = scan_message("Please send the caution by Western Union before the visit.")
    assert "off_platform_payment" in codes
    assert "pay_before_visit" in codes


def test_french_deposit_before_visit():
    codes = scan_message("Envoyez le dépôt de garantie avant la visite, s'il vous plaît.")
    assert "pay_before_visit" in codes


def test_crypto_rail_flagged():
    assert "off_platform_payment" in scan_message("I only accept the deposit in bitcoin")


def test_off_platform_contact_flagged():
    assert scan_message("Let's continue on WhatsApp") == ["off_platform_contact"]


def test_normal_enquiry_has_no_advisories():
    assert scan_message("Hi, is the apartment still available for a viewing next week?") == []


def test_money_without_before_visit_is_not_pay_before_visit():
    # Discussing the deposit normally (at/after a visit) must not false-positive.
    codes = scan_message("The deposit is one month's rent, payable at lease signing.")
    assert "pay_before_visit" not in codes


def test_empty_and_none_safe():
    assert scan_message("") == []
    assert scan_message(None) == []  # type: ignore[arg-type]


def test_advisories_deduped_and_stable_order():
    codes = scan_message(
        "Pay the deposit by Western Union before visiting, then message me on Telegram"
    )
    assert codes == ["off_platform_payment", "pay_before_visit", "off_platform_contact"]


# ── False-positive regressions (self-review of PR #56) ────────────────────────

def test_pcs_as_pieces_is_not_a_payment_rail():
    """'pcs' = pièces/pieces in listing copy — must not flag a scam rail."""
    assert scan_message("Nice flat, 4 pcs, available from June.") == []


def test_pcs_card_still_flagged():
    assert "off_platform_payment" in scan_message("Pay with a PCS card please")


def test_signal_as_ordinary_word_is_not_off_platform_contact():
    """'signal' is far too common in ordinary chat to be a usable signal."""
    assert scan_message("Just signal me when you arrive at the building.") == []
    assert scan_message("Merci de me signaler tout problème.") == []
