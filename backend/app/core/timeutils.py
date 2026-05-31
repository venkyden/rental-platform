"""
Central UTC time helpers.

`datetime.utcnow()` is deprecated in Python 3.12 and returns a *naive* value.
Most of Roomivo's timestamp columns are still timezone-naive (`TIMESTAMP` /
`DateTime` without `timezone=True`), so `naive_utcnow()` is the behaviour-
preserving, non-deprecated drop-in for those. Use `utcnow()` (timezone-aware)
for standalone values and for the timezone-aware columns (visits/leases).

Migrating the remaining naive columns to `DateTime(timezone=True)` and then
switching their call sites to `utcnow()` is the documented follow-up.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Timezone-aware current time in UTC."""
    return datetime.now(timezone.utc)


def naive_utcnow() -> datetime:
    """Naive UTC time — drop-in replacement for the deprecated
    ``datetime.utcnow()``; use against timezone-naive DB columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
