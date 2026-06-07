"""
Avis d'imposition 2D-Doc pipeline — unit + integration (DOSSIER §5.3 SV-1, §5.1 C-1..C-8).
"""
import pytest
from app.services import fr_2ddoc


# ── name matching ───────────────────────────────────────────────────────────

def test_name_match_exact():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Jean Dupont"]) is True


def test_name_match_reordered_and_case():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["DUPONT JEAN"]) is True


def test_name_match_accents_stripped():
    assert fr_2ddoc.name_matches_any("Helene Cesar", ["Hélène César"]) is True


def test_name_match_against_declarant2():
    # ID holder is the spouse (second declarant on a couple's avis).
    assert fr_2ddoc.name_matches_any("Marie Martin", ["Jean Dupont", "Marie Martin"]) is True


def test_name_mismatch():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Paul Durand"]) is False


def test_name_match_empty_inputs():
    assert fr_2ddoc.name_matches_any("", ["Jean Dupont"]) is False
    assert fr_2ddoc.name_matches_any("Jean Dupont", []) is False


# ── decode/parse error mapping (libs mocked) ────────────────────────────────

def test_decode_raises_barcode_unreadable_when_no_barcode(monkeypatch):
    monkeypatch.setattr(fr_2ddoc, "_to_images", lambda c, t: ["img"])
    import pylibdmtx.pylibdmtx as dmtx
    monkeypatch.setattr(dmtx, "decode", lambda img: [])
    with pytest.raises(fr_2ddoc.BarcodeUnreadable):
        fr_2ddoc.decode_2ddoc(b"x", "image/png")
