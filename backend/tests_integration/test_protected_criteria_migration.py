"""
Migration f4b6d8e0a2c3 removes stored nationality preferences and "family" from
accepted tenant types, on listings and in landlords' preferences (flat or per role).
"""

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.models.property import Property
from app.models.user import User
from tests_integration.conftest import make_property, make_user

BACKEND = Path(__file__).resolve().parents[1]
MIGRATION = BACKEND / "alembic" / "versions" / "f4b6d8e0a2c3_remove_protected_ground_criteria.py"


def _migration():
    spec = importlib.util.spec_from_file_location("protected_criteria_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_clean_preferences_per_role_and_flat():
    clean = _migration().clean_preferences
    assert clean({"landlord": {"nationality_preference": "french", "accepted_tenant_types": ["student", "family"],
                               "house_rules": ["no_pets"]},
                  "tenant": {"budget": 600, "nationality": "british", "gender": "female"}}) == {
        "landlord": {"accepted_tenant_types": ["student"], "house_rules": ["no_pets"]},
        "tenant": {"budget": 600},
    }
    assert clean({"nationality_preference": "international", "accepted_tenant_types": ["family"]}) == {
        "accepted_tenant_types": [],
    }
    assert clean(None) is None


def _alembic(*args):
    result = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND, env={**os.environ},
                            capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stderr[-2000:]


@pytest.mark.asyncio
async def test_migration_cleans_stored_rows(sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord)
    async with sessionmaker_() as s:
        (await s.get(Property, prop.id)).accepted_tenant_types = ["student", "family"]
        (await s.get(User, landlord.id)).preferences = {
            "landlord": {"nationality_preference": "french", "accepted_tenant_types": ["family", "employee"]},
            "tenant": {"nationality": "german", "gender": "male", "budget": 500},
        }
        await s.commit()

    _alembic("downgrade", "e3a5c7d9f1b2")
    _alembic("upgrade", "head")

    async with sessionmaker_() as s:
        assert (await s.get(Property, prop.id)).accepted_tenant_types == ["student"]
        assert (await s.get(User, landlord.id)).preferences == {
            "landlord": {"accepted_tenant_types": ["employee"]},
            "tenant": {"budget": 500},
        }
