"""
Anti-scam message advisories (domain audit #5, 2026-07-05).

Deterministic, zero-OPEX, NON-BLOCKING scan of message content for the
deposit-theft patterns Roomivo exists to stop (CLAUDE.md scam taxonomy). It
never blocks or edits a message — it returns advisory codes the frontend can
surface to the READER ("Roomivo states facts, the human decides"; DSA-minimum
reasonable measure, no third party, no AI).

Codes (stable API strings; frontend maps to FR/EN copy):
- off_platform_payment  : untraceable / off-platform money rail requested
- pay_before_visit      : money asked for before any viewing (the core scam)
- off_platform_contact  : pushing the exchange to WhatsApp/Telegram etc.
"""
import re

# Untraceable / high-risk money rails (deposit-theft loves these).
_PAYMENT_RAIL = re.compile(
    # Prepaid brands only match as "<brand> card" / "carte <brand>": a bare
    # \bpcs\b collides with "pcs" = pièces/pieces in listing copy ("4 pcs").
    r"\b(western\s?union|moneygram|mandat\s?cash|(pcs|paysafe|transcash|neosurf)\s?card|"
    r"carte\s?(pcs|paysafe|transcash|neosurf)|gift\s?card|carte\s?cadeau|bitcoin|crypto|"
    r"usdt|ethereum|paypal\s?friends)\b",
    re.IGNORECASE,
)
# Deposit / money terms.
_MONEY = re.compile(
    r"\b(deposit|caution|dépôt|depot|arrhes|acompte|loyer|rent|virement|wire|transfer|"
    r"iban|western\s?union)\b",
    re.IGNORECASE,
)
# "before you visit / without visiting" — the deposit-before-viewing tell.
_BEFORE_VISIT = re.compile(
    r"(avant\s+(la\s+|de\s+|toute\s+)?(visite|visiter)|sans\s+visite|before\s+(the\s+|you\s+|any\s+)?"
    r"(visit|viewing|seeing)|without\s+(a\s+)?(visit|viewing)|reserve\s+before|réserver\s+avant)",
    re.IGNORECASE,
)
# Pushing off-platform. "signal" deliberately excluded: as a bare word it is far
# too common in ordinary rental chat ("signal me when you arrive", FR "signaler")
# to be a usable signal — the false positives would drown the real ones.
_OFF_PLATFORM = re.compile(r"\b(whatsapp|telegram|viber)\b", re.IGNORECASE)


def scan_message(content: str) -> list[str]:
    """Return advisory codes for a message body. Empty list = no signal.

    Order is stable and de-duplicated; safe on any input (never raises)."""
    if not content:
        return []
    text = content

    advisories: list[str] = []
    has_money = bool(_MONEY.search(text))

    if _PAYMENT_RAIL.search(text):
        advisories.append("off_platform_payment")
    if has_money and _BEFORE_VISIT.search(text):
        advisories.append("pay_before_visit")
    if _OFF_PLATFORM.search(text):
        advisories.append("off_platform_contact")

    return advisories
