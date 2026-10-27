"""
One address, whatever its case. Accounts are looked up and stored by the
lowercase form, and the database refuses anything else (migration a7c9e1b3d5f7).
"""

from typing import Annotated

from pydantic import AfterValidator, EmailStr


def normalize_email(value: str) -> str:
    return value.strip().lower()


# For request fields: a valid address, stored and compared in lowercase.
NormalizedEmail = Annotated[EmailStr, AfterValidator(normalize_email)]
# For fields that were plain strings: lowercased, not validated as addresses.
LowercaseEmailText = Annotated[str, AfterValidator(normalize_email)]
