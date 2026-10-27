"""
Screen for questions about who may rent (Code pénal 225-1, loi 89-462 art. 1).

"Do you accept foreigners?" asks the landlord to state a criterion the law
forbids; Roomivo does not forward it and shows a fixed notice instead (council
legal review 2026-10-20, §2). Questions about the home itself ("is it wheelchair
accessible?", "can I get a visa certificate?") are not caught. Deterministic,
English and French, no AI.
"""

import re
import unicodedata

# Asking whether someone is accepted, allowed or welcome.
_ACCEPT = (
    r"(accept(s|ed|ing)?|take|rent(ing)? to|let(ting)? to|ok(ay)? (with|for)|fine with|allow(s|ed)?|"
    r"welcome|open to|mind|problem with|consider|"
    r"accept(ez|e|es|ent|er)?|prenez|prends|prend|louez|louer a|loue a|ouvert(e|s)? (a|aux)|"
    r"d'accord (avec|pour)|ok pour|probleme avec|admis|admettez|refusez)"
)

# Protected grounds: origin, nationality, religion, sex, family situation,
# sexual orientation, disability, age, residence status.
_GROUND = (
    r"(foreign(er|ers)?|international(s| students)?|non[- ]?(french|europeans?|eu)|immigrants?|refugees?|"
    r"nationalit(y|ies)|africans?|arabs?|asians?|indians?|chinese|black (people|students|tenants)|muslims?|jews?|"
    r"jewish|christians?|hindus?|religio(n|us)|gays?|lesbians?|lgbt\w*|trans(gender)?|couples?|famil(y|ies)|"
    r"child(ren)?|kids?|bab(y|ies)|pregnant|women|woman|girls?|men|boys?|single (mothers?|fathers?|parents?)|"
    r"disabled( people| tenants)?|disabilit(y|ies)|wheelchair users?|elderly|older (people|tenants)|"
    r"(people|students|tenants) on (a )?visa|visa holders?|"
    r"etrangers?|etrangeres?|nationalite|immigres?|refugies?|africains?|arabes?|maghrebins?|asiatiques?|"
    r"noirs?|musulman(e|s|es)?|juif(s|ve|ves)?|chretien(s|ne|nes)?|homosexuel(le|s|les)?|"
    r"famille(s)?|enfants?|bebes?|enceinte|femmes?|filles?|hommes?|garcons?|handicape(e|s|es)?|"
    r"personnes? (handicapees?|agees?)|titre de sejour)"
)

_ASKS_WHO_MAY_RENT = re.compile(
    rf"\b{_ACCEPT}\b.{{0,40}}?\b{_GROUND}\b"
    rf"|\b(only|uniquement|seulement|reserve(e)? (a|aux))\b.{{0,20}}?\b{_GROUND}\b"
    rf"|\b{_GROUND}\b.{{0,15}}?\b(only|uniquement|seulement|welcome|bienvenu(e|s|es)?|accepte(e|s|es)?)\b",
    re.IGNORECASE,
)


def _fold(text: str) -> str:
    """Lowercase without accents, so the patterns match French with or without them."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold().replace("’", "'")


def asks_who_may_rent(text: str) -> bool:
    """True when the question asks whether a protected group may rent."""
    return bool(_ASKS_WHO_MAY_RENT.search(_fold(text)))
