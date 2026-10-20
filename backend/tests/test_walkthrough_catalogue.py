"""The walk-through tap list: catalogue integrity and answer validation."""

import re
from pathlib import Path

import pytest

from app.services.lease_rules import FURNISHED_REQUIRED_ITEMS
from app.services.walkthrough_catalogue import (CATALOGUE, SPACES, STATES, bedroom_count,
                                                clean_flatmates, clean_space_answers,
                                                furnished_gaps, merge_space)

NOW = "2026-10-13T10:00:00Z"
LATER = "2026-10-14T10:00:00Z"


class TestCatalogue:
    def test_keys_are_unique(self):
        keys = [item.key for item in CATALOGUE]
        assert len(keys) == len(set(keys))

    def test_every_item_has_a_known_space_and_kind(self):
        for item in CATALOGUE:
            assert item.space in SPACES
            assert item.kind in STATES

    def test_every_legal_key_exists_in_the_decree_list(self):
        for item in CATALOGUE:
            if item.legal_key:
                assert item.legal_key in FURNISHED_REQUIRED_ITEMS, item.key

    def test_all_eleven_decree_categories_are_covered(self):
        covered = {item.legal_key for item in CATALOGUE if item.legal_key}
        assert covered == set(FURNISHED_REQUIRED_ITEMS)

    def test_oven_and_microwave_share_one_decree_category(self):
        by_key = {item.key: item for item in CATALOGUE}
        assert by_key["oven"].legal_key == by_key["microwave"].legal_key == "four_ou_micro_ondes"

    def test_the_pages_copy_matches_this_catalogue(self):
        # frontend/lib/walkthrough.ts lists the same items so the pages can lay them out.
        page_copy = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "walkthrough.ts"
        if not page_copy.exists():
            pytest.skip("frontend sources are not present in this checkout")
        found = re.findall(r"\{ key: '(\w+)', space: '(\w+)', kind: '(\w+)' \}", page_copy.read_text(encoding="utf-8"))
        assert found == [(item.key, item.space, item.kind) for item in CATALOGUE]

    def test_every_item_has_a_label_in_both_languages(self):
        dictionary = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "i18n.ts"
        if not dictionary.exists():
            pytest.skip("frontend sources are not present in this checkout")
        text = dictionary.read_text(encoding="utf-8")
        # Only the items block of each language's walkthrough section: the same words
        # ("desk", "tv") appear elsewhere in the dictionary.
        blocks = re.findall(r"\n        walkthrough: \{.*?\n            items: \{(.*?)\n            \},", text, re.S)
        assert len(blocks) == 2, "expected one walkthrough.items block per language"
        for block in blocks:
            labelled = set(re.findall(r"^\s+(\w+): \"[^\"]+\",$", block, re.M))
            assert labelled == {item.key for item in CATALOGUE}


class TestBedroomCount:
    def test_a_studio_without_a_room_list_still_has_one(self):
        assert bedroom_count(None) == 1
        assert bedroom_count([]) == 1

    def test_follows_the_room_list_and_is_capped(self):
        assert bedroom_count([{}, {}, {}]) == 3
        assert bedroom_count([{}] * 500) == 20


class TestCleanSpaceAnswers:
    def test_accepts_known_items_and_states(self):
        assert clean_space_answers("kitchen", {"hob": "working", "plates_glasses": "absent"}, 1) == {
            "hob": "working", "plates_glasses": "absent"}

    def test_an_empty_list_is_valid(self):
        assert clean_space_answers("home", {}, 1) == {}

    def test_bedrooms_are_addressed_by_index(self):
        assert clean_space_answers("bedroom:1", {"desk": "present"}, 2) == {"desk": "present"}

    @pytest.mark.parametrize("space", [
        "bedroom:2", "bedroom:-1", "bedroom:", "bedroom", "bedroom:1.0", "bedroom:01x", "bedroom:999",
        "bedroom:٣", "bedroom:00", "bedroom:01", "garage", "", "kitchen:0", "KITCHEN", None, 3, ["kitchen"],
        "kitchen\x00",
    ])
    def test_rejects_a_space_the_listing_does_not_have(self, space):
        with pytest.raises(ValueError):
            clean_space_answers(space, {}, 2)

    def test_rejects_an_item_from_another_space(self):
        with pytest.raises(ValueError, match="Unknown item"):
            clean_space_answers("kitchen", {"sofa": "present"}, 1)

    def test_rejects_a_state_of_the_wrong_kind(self):
        # A thing cannot be "working"; an appliance cannot be merely "present".
        with pytest.raises(ValueError, match="Unknown answer"):
            clean_space_answers("kitchen", {"plates_glasses": "working"}, 1)
        with pytest.raises(ValueError, match="Unknown answer"):
            clean_space_answers("kitchen", {"oven": "present"}, 1)

    @pytest.mark.parametrize("answers", [
        None, [], "hob", 5, {"hob": None}, {"hob": True}, {"hob": {"state": "working"}},
        {"hob": "<script>"}, {1: "working"}, {"__proto__": "working"},
    ])
    def test_rejects_malformed_answers(self, answers):
        with pytest.raises(ValueError):
            clean_space_answers("kitchen", answers, 1)

    @pytest.mark.parametrize("space, answers", [
        ("kitchen", {"x" * 5000: "working"}),
        ("kitchen", {"<img src=x onerror=alert(1)>": "working"}),
        ("kitchen", {"hob": "<script>alert(1)</script>"}),
        ("<b>garage</b>", {}),
    ])
    def test_a_refused_value_is_never_echoed_back(self, space, answers):
        with pytest.raises(ValueError) as exc:
            clean_space_answers(space, answers, 1)
        assert "<" not in str(exc.value) and "xxxx" not in str(exc.value)
        assert len(str(exc.value)) < 80


class TestMergeSpace:
    def test_a_new_answer_is_dated(self):
        merged = merge_space(None, "kitchen", {"hob": "working"}, NOW)
        assert merged == {"kitchen": {"hob": {"state": "working", "answered_at": NOW}}}

    def test_an_unchanged_answer_keeps_its_date_and_a_changed_one_is_redated(self):
        first = merge_space(None, "kitchen", {"hob": "working", "oven": "working"}, NOW)
        second = merge_space(first, "kitchen", {"hob": "working", "oven": "not_working"}, LATER)
        assert second["kitchen"]["hob"]["answered_at"] == NOW
        assert second["kitchen"]["oven"] == {"state": "not_working", "answered_at": LATER}

    def test_saving_a_space_replaces_it_and_leaves_the_others(self):
        first = merge_space(None, "kitchen", {"hob": "working", "oven": "working"}, NOW)
        first = merge_space(first, "home", {"internet": "present"}, NOW)
        second = merge_space(first, "kitchen", {"oven": "working"}, LATER)
        assert set(second["kitchen"]) == {"oven"}
        assert second["home"] == first["home"]

    def test_clearing_a_space_removes_it(self):
        first = merge_space(None, "kitchen", {"hob": "working"}, NOW)
        assert merge_space(first, "kitchen", {}, LATER) == {}

    def test_does_not_mutate_what_it_was_given(self):
        first = merge_space(None, "kitchen", {"hob": "working"}, NOW)
        snapshot = {"kitchen": dict(first["kitchen"])}
        merge_space(first, "kitchen", {}, LATER)
        assert first == snapshot

    @pytest.mark.parametrize("existing", ["junk", 5, [], {"kitchen": "junk"}, {"kitchen": {"hob": "junk"}}])
    def test_survives_a_corrupt_stored_value(self, existing):
        merged = merge_space(existing, "kitchen", {"hob": "working"}, NOW)
        assert merged["kitchen"]["hob"] == {"state": "working", "answered_at": NOW}


class TestCleanFlatmates:
    def test_a_full_card(self):
        assert clean_flatmates({"count": 3, "occupation": "both", "smoking": False, "pets": True}, NOW) == {
            "count": 3, "occupation": "both", "smoking": False, "pets": True, "answered_at": NOW}

    def test_every_field_is_optional_and_an_empty_card_is_no_card(self):
        assert clean_flatmates({"count": 0}, NOW) == {"count": 0, "answered_at": NOW}
        assert clean_flatmates({}, NOW) is None
        assert clean_flatmates(None, NOW) is None

    @pytest.mark.parametrize("field", ["name", "names", "gender", "age", "nationality", "origin", "religion", "notes"])
    def test_nothing_about_a_person_is_accepted(self, field):
        with pytest.raises(ValueError, match="Unknown flatmates field"):
            clean_flatmates({"count": 2, field: "x"}, NOW)

    @pytest.mark.parametrize("data", [
        {"count": -1}, {"count": 21}, {"count": 2.5}, {"count": "2"}, {"count": True},
        {"occupation": "men"}, {"occupation": 1}, {"smoking": "yes"}, {"pets": 1}, "junk", [],
    ])
    def test_rejects_malformed_values(self, data):
        with pytest.raises(ValueError):
            clean_flatmates(data, NOW)


class TestFurnishedGaps:
    """The decree categories the owner's own answers leave open."""

    @staticmethod
    def _all_present(bedrooms=1, **overrides):
        answers = {
            "kitchen": {"hob": {"state": "working"}, "oven": {"state": "working"}, "microwave": {"state": "absent"},
                        "fridge_freezer": {"state": "working"}, "plates_glasses": {"state": "present"},
                        "pans_utensils": {"state": "present"}},
            "living": {"table_chairs": {"state": "present"}},
            "home": {"lights": {"state": "present"}, "storage_shelves": {"state": "present"},
                     "cleaning_equipment": {"state": "present"}},
        }
        for i in range(bedrooms):
            answers[f"bedroom:{i}"] = {"bed_bedding": {"state": "present"}, "curtains_shutters": {"state": "present"}}
        for space, items in overrides.items():
            answers.setdefault(space.replace("_", ":") if space.startswith("bedroom") else space, {}).update(items)
        return answers

    def test_nothing_open_when_every_category_is_there(self):
        assert furnished_gaps(self._all_present(), 1) == {"missing": [], "unanswered": []}

    def test_no_answers_at_all_leaves_every_category_unanswered_not_missing(self):
        gaps = furnished_gaps(None, 1)
        assert gaps["missing"] == []
        assert gaps["unanswered"] == list(FURNISHED_REQUIRED_ITEMS)

    def test_an_appliance_that_does_not_work_is_missing(self):
        answers = self._all_present()
        answers["kitchen"]["hob"] = {"state": "not_working"}
        assert furnished_gaps(answers, 1)["missing"] == ["plaques_cuisson"]

    def test_oven_or_microwave_one_working_is_enough(self):
        answers = self._all_present()
        answers["kitchen"]["oven"] = {"state": "absent"}
        answers["kitchen"]["microwave"] = {"state": "working"}
        assert furnished_gaps(answers, 1) == {"missing": [], "unanswered": []}

    def test_oven_or_microwave_missing_only_when_neither_works(self):
        answers = self._all_present()
        answers["kitchen"]["oven"] = {"state": "not_working"}
        answers["kitchen"]["microwave"] = {"state": "absent"}
        assert furnished_gaps(answers, 1)["missing"] == ["four_ou_micro_ondes"]
        del answers["kitchen"]["microwave"]
        gaps = furnished_gaps(answers, 1)
        assert gaps["missing"] == [] and gaps["unanswered"] == ["four_ou_micro_ondes"]

    def test_every_bedroom_needs_bedding_and_curtains(self):
        answers = self._all_present(bedrooms=2)
        answers["bedroom:1"]["curtains_shutters"] = {"state": "absent"}
        assert furnished_gaps(answers, 2)["missing"] == ["occultation_chambres"]
        del answers["bedroom:1"]
        gaps = furnished_gaps(answers, 2)
        assert gaps["missing"] == [] and gaps["unanswered"] == ["literie", "occultation_chambres"]

    def test_a_bedroom_the_listing_no_longer_has_does_not_count(self):
        answers = self._all_present()
        answers["bedroom:3"] = {"bed_bedding": {"state": "absent"}}
        assert furnished_gaps(answers, 1) == {"missing": [], "unanswered": []}

    def test_items_outside_the_decree_never_count(self):
        answers = self._all_present()
        answers["kitchen"]["dishwasher"] = {"state": "absent"}
        answers["home"]["internet"] = {"state": "absent"}
        assert furnished_gaps(answers, 1) == {"missing": [], "unanswered": []}

    @pytest.mark.parametrize("junk", ["x", 5, [], {"kitchen": "x"}, {"kitchen": {"hob": "working"}},
                                      {"kitchen": {"hob": {"state": "broken"}}}])
    def test_a_malformed_stored_value_reads_as_unanswered(self, junk):
        gaps = furnished_gaps(junk, 1)
        assert gaps["missing"] == []
        assert "plaques_cuisson" in gaps["unanswered"]
