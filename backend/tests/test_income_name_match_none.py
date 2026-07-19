"""
Regression: income verification 500'd with "'NoneType' object has no attribute
'lower'" when the account has no full_name (nullable — e.g. Google sign-in) or
the AI returns an explicit null employee_name. identity.py's _fuzzy_name_match
already guards None; employment.py's copy did not.
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("SECRET_KEY", "mock-secret-key-for-test-purposes")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://mockuser:mockpass@localhost/mock_db")

from app.services.employment import EmploymentData, employment_service


def _data(employee_name):
    return EmploymentData(
        employer_name="ACME SARL",
        employee_name=employee_name,
        gross_salary=Decimal("2500"),
        net_salary=Decimal("1950"),
        pay_period="2026-06",
        employment_type="CDI",
        siret=None,
        job_title=None,
        confidence_score=0.9,
    )


def test_fuzzy_name_match_none_inputs_return_zero():
    assert employment_service._fuzzy_name_match(None, "Jane Doe") == 0.0
    assert employment_service._fuzzy_name_match("Jane Doe", None) == 0.0
    assert employment_service._fuzzy_name_match(None, None) == 0.0
    assert employment_service._fuzzy_name_match("", "Jane Doe") == 0.0


def test_validate_with_none_expected_name_fails_closed():
    checks = employment_service._validate_employment_data(_data("Jane Doe"), None)
    name_check = next(c for c in checks if c["name"] == "name_match")
    assert name_check["passed"] is False


def test_validate_with_none_employee_name_fails_closed():
    checks = employment_service._validate_employment_data(_data(None), "Jane Doe")
    name_check = next(c for c in checks if c["name"] == "name_match")
    assert name_check["passed"] is False


def test_validate_matching_names_still_passes():
    checks = employment_service._validate_employment_data(_data("Jane Doe"), "Jane DOE")
    name_check = next(c for c in checks if c["name"] == "name_match")
    assert name_check["passed"] is True
