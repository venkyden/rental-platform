"""The questions a landlord answers during the phone walk-through.

Students abroad ask the same things about every listing (is there internet,
does the oven work, who lives there). The landlord answers a short tap list
once, space by space, and the listing page shows the answers.

The answers are the landlord's own statements: nothing here infers or checks
them. Items that map to the eleven categories of Décret n°2015-981 carry the
matching key from ``lease_rules.FURNISHED_REQUIRED_ITEMS``.

Stored on ``properties.walkthrough_answers`` as
``{space_key: {item_key: {"state": ..., "answered_at": ...}}}`` where
``space_key`` is ``kitchen``, ``bathroom``, ``living``, ``home`` or
``bedroom:<index>``.
"""

import re
from dataclasses import dataclass
from typing import Optional

SPACES = ("kitchen", "bedroom", "living", "bathroom", "home")

# An appliance can be there and broken; a thing is either there or not.
STATES = {
    "appliance": ("working", "not_working", "absent"),
    "thing": ("present", "absent"),
}

MAX_BEDROOMS = 20
_PLAIN_KEY = re.compile(r"[a-z_]{1,40}(:\d{1,2})?")


def _named(value) -> str:
    """A key to quote in an error message, or nothing: a refused value is never echoed back."""
    return f": {value}" if isinstance(value, str) and _PLAIN_KEY.fullmatch(value) else ""
FLATMATE_OCCUPATIONS = ("students", "working", "both")


@dataclass(frozen=True)
class Item:
    key: str
    space: str
    kind: str
    legal_key: Optional[str] = None


# The capture and listing pages keep their own copy in frontend/lib/walkthrough.ts;
# tests/test_walkthrough_catalogue.py fails if the two drift apart.
CATALOGUE: tuple[Item, ...] = (
    Item("hob", "kitchen", "appliance", "plaques_cuisson"),
    Item("oven", "kitchen", "appliance", "four_ou_micro_ondes"),
    Item("microwave", "kitchen", "appliance", "four_ou_micro_ondes"),
    Item("fridge_freezer", "kitchen", "appliance", "refrigerateur_congelateur"),
    Item("plates_glasses", "kitchen", "thing", "vaisselle"),
    Item("pans_utensils", "kitchen", "thing", "ustensiles_cuisine"),
    Item("dishwasher", "kitchen", "appliance"),
    Item("bed_bedding", "bedroom", "thing", "literie"),
    Item("curtains_shutters", "bedroom", "thing", "occultation_chambres"),
    Item("desk", "bedroom", "thing"),
    Item("wardrobe", "bedroom", "thing"),
    Item("table_chairs", "living", "thing", "table_et_sieges"),
    Item("sofa", "living", "thing"),
    Item("tv", "living", "appliance"),
    Item("shower_bath", "bathroom", "thing"),
    Item("washing_machine", "bathroom", "appliance"),
    Item("internet", "home", "thing"),
    Item("lights", "home", "thing", "luminaires"),
    Item("storage_shelves", "home", "thing", "etageres_rangement"),
    Item("cleaning_equipment", "home", "thing", "materiel_entretien"),
)

_BY_SPACE: dict[str, dict[str, Item]] = {
    space: {item.key: item for item in CATALOGUE if item.space == space} for space in SPACES
}


def bedroom_count(room_details) -> int:
    """Bedrooms a listing can answer for. A studio has no room list but still has a bed."""
    return max(1, min(MAX_BEDROOMS, len(room_details or [])))


def _base_space(space_key, bedrooms: int) -> str:
    """``kitchen`` for "kitchen", ``bedroom`` for "bedroom:1". Raises on anything else."""
    if not isinstance(space_key, str):
        raise ValueError("Unknown space")
    if space_key in _BY_SPACE and space_key != "bedroom":
        return space_key
    name, _, index = space_key.partition(":")
    # One spelling per bedroom: "bedroom:1", never "bedroom:01".
    if name == "bedroom" and index.isascii() and index.isdigit() and str(int(index)) == index and int(index) < bedrooms:
        return "bedroom"
    raise ValueError(f"Unknown space{_named(space_key)}")


def clean_space_answers(space_key, answers, bedrooms: int) -> dict[str, str]:
    """``{item_key: state}`` for one space, or ValueError naming what is wrong."""
    items = _BY_SPACE[_base_space(space_key, bedrooms)]
    if not isinstance(answers, dict):
        raise ValueError("Answers must be an object")
    cleaned: dict[str, str] = {}
    for key, state in answers.items():
        item = items.get(key) if isinstance(key, str) else None
        if item is None:
            raise ValueError(f"Unknown item for this space{_named(key)}")
        if state not in STATES[item.kind]:
            raise ValueError(f"Unknown answer for {key}")
        cleaned[key] = state
    return cleaned


def merge_space(existing, space_key: str, cleaned: dict[str, str], now: str) -> dict:
    """All answers with one space replaced. An unchanged answer keeps its date."""
    merged = dict(existing) if isinstance(existing, dict) else {}
    before = merged.get(space_key) if isinstance(merged.get(space_key), dict) else {}
    space: dict[str, dict] = {}
    for key, state in cleaned.items():
        previous = before.get(key)
        unchanged = isinstance(previous, dict) and previous.get("state") == state
        space[key] = previous if unchanged else {"state": state, "answered_at": now}
    if space:
        merged[space_key] = space
    else:
        merged.pop(space_key, None)
    return merged


def clean_flatmates(data, now: str) -> Optional[dict]:
    """The household card for a shared home. It describes the household, never a person:
    no name, age, gender or nationality is accepted here."""
    if data is None:
        return None
    if not isinstance(data, dict):
        raise ValueError("Flatmates must be an object")
    unknown = set(data) - {"count", "occupation", "smoking", "pets"}
    if unknown:
        raise ValueError(f"Unknown flatmates field{_named(sorted(map(str, unknown))[0])}")
    cleaned: dict = {}
    count = data.get("count")
    if count is not None:
        if isinstance(count, bool) or not isinstance(count, int) or not 0 <= count <= MAX_BEDROOMS:
            raise ValueError("Flatmates count must be a whole number from 0 to 20")
        cleaned["count"] = count
    occupation = data.get("occupation")
    if occupation is not None:
        if occupation not in FLATMATE_OCCUPATIONS:
            raise ValueError("Unknown flatmates occupation")
        cleaned["occupation"] = occupation
    for field in ("smoking", "pets"):
        value = data.get(field)
        if value is not None:
            if not isinstance(value, bool):
                raise ValueError(f"Flatmates {field} must be true or false")
            cleaned[field] = value
    if not cleaned:
        return None
    cleaned["answered_at"] = now
    return cleaned
