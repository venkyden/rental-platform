"""
Bail mobilité generation block (art. 25-13 loi 89-462).

Legacy free-form generator emits none of the mandatory mobilité mentions
(bail-mobilité statement, motif 8°, no-deposit mention 11°) — output would
requalify as ordinary meublé. Blocked in both entry points until the
schema-driven path wires mobilité; registry already keeps it reference-only.
"""

import pytest

from app.services.lease_generator import lease_generator


class TestMobiliteBlocked:
    def test_generate_pdf_rejects_mobilite(self):
        with pytest.raises(ValueError, match="art. 25-13"):
            lease_generator.generate_pdf(
                property=None, landlord=None, tenant=None,
                start_date="2026-09-01", rent=700.0,
                output_path="/dev/null", lease_type="mobilite",
            )

    def test_generate_html_rejects_mobilite(self):
        with pytest.raises(ValueError, match="art. 25-13"):
            lease_generator.generate_html(
                property=None, landlord=None, tenant=None,
                start_date="2026-09-01", rent=700.0, lease_type="mobilite",
            )


def test_official_model_assets_free_of_transcription_typo():
    """'pou le compte' → 'pour le compte' (recurring transcription error)."""
    from pathlib import Path

    assets = Path("app/services/lease_models/2025-01-01")
    for f in assets.glob("annexe*.md"):
        assert "pou le compte" not in f.read_text(), f.name
