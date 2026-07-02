"""
Path A lease generation — fill the OFFICIAL model's blanks with validated values.

⏳ GATED: the underlying model wording is pending lawyer sign-off (see
`lease_models/`), so this must not be exposed in production until the texts are
verbatim-verified. Status: v0.1 — `vide` core fields.

Safety design (why this can't produce an illegal/altered lease):
1. It NEVER edits standardized clause text — it only substitutes `{{token}}` blanks
   in the tokenized fillable template, whose non-blank text is byte-identical to the
   verbatim Décret model (enforced by `test_lease_generation`).
2. It runs the LG-1..LG-6 finalisation gate (`lease_rules`) BEFORE filling; a blocking
   violation returns no text.
3. It refuses to mark a lease `finalisable` while ANY blank remains (unfilled `{{token}}`
   or descriptive `[…]`) — no lease is emitted with dangling blanks.
"""

import re
from dataclasses import dataclass, field

from app.services import lease_rules
from app.services.lease_models import registry

_TOKEN_RE = re.compile(r"\{\{(\w+)\}\}")
_BLANK_RE = re.compile(r"\[[^\]]*\]")


@dataclass
class GenerationResult:
    ok: bool                                    # passed the LG-1..LG-6 gate
    template_version: str
    text: str | None = None                     # filled lease text (None if blocked)
    blocking: list[str] = field(default_factory=list)          # LG violations
    advisory: list[str] = field(default_factory=list)          # LG advisory flags
    remaining_blanks: list[str] = field(default_factory=list)  # unfilled tokens + [...]
    finalisable: bool = False                   # ok AND no remaining blanks

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "template_version": self.template_version,
            "finalisable": self.finalisable,
            "blocking": self.blocking,
            "advisory": self.advisory,
            "remaining_blanks": self.remaining_blanks,
            "text": self.text,
        }


def _fill(template: str, values: dict[str, str]) -> str:
    """Substitute {{token}} → value; leave unknown tokens intact (reported later)."""
    return _TOKEN_RE.sub(lambda m: values.get(m.group(1), m.group(0)), template)


def generate(
    *,
    lease_type: str,
    fields: dict[str, str],
    deposit: float,
    monthly_rent_hc: float,
    version: str = registry.CURRENT_TEMPLATE_VERSION,
    furnished_items=None,
    present_annexes=None,
    in_zone_tendue: bool = False,
    complement_de_loyer: float = 0.0,
    complement_justification: str | None = None,
    custom_clauses=None,
) -> GenerationResult:
    """
    Validate (LG-1..LG-6) then fill the official model for `lease_type`.

    `fields` maps template token names (e.g. "loyer_mensuel") to values. Returns a
    GenerationResult; `text` is filled only when the LG gate passes, and `finalisable`
    is True only when no blank remains.
    """
    rules = lease_rules.validate_lease_finalisation(
        lease_type=lease_type,
        deposit=deposit,
        monthly_rent_hc=monthly_rent_hc,
        furnished_items=furnished_items,
        present_annexes=present_annexes,
        in_zone_tendue=in_zone_tendue,
        complement_de_loyer=complement_de_loyer,
        complement_justification=complement_justification,
        custom_clauses=custom_clauses,
    )
    if not rules.ok:
        return GenerationResult(
            ok=False, template_version=version,
            blocking=rules.blocking, advisory=rules.advisory,
        )

    template = registry.load_fill_model(lease_type, version)
    text = _fill(template, {k: str(v) for k, v in fields.items()})

    remaining = [f"{{{{{t}}}}}" for t in sorted(set(_TOKEN_RE.findall(text)))]
    remaining += _BLANK_RE.findall(text)
    return GenerationResult(
        ok=True, template_version=version, text=text,
        advisory=rules.advisory, remaining_blanks=remaining,
        finalisable=not remaining,
    )
