"""
Input sanitization utilities for XSS prevention.
OWASP recommended practices.
"""

import html
import re
from typing import Optional


def sanitize_html(text: Optional[str]) -> Optional[str]:
    """
    Remove HTML tags and escape special characters to prevent XSS.
    Used for user-provided text fields like names, descriptions, etc.
    """
    if text is None:
        return None

    # Strip all HTML tags
    clean = re.sub(r"<[^>]+>", "", str(text))

    # Escape remaining HTML entities
    clean = html.escape(clean)

    # Remove common XSS vectors
    clean = re.sub(r"javascript:", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"on\w+\s*=", "", clean, flags=re.IGNORECASE)

    return clean.strip()


def sanitize_dict(data: dict, fields: list) -> dict:
    """
    Sanitize specific fields in a dictionary.
    """
    sanitized = data.copy()
    for field in fields:
        if field in sanitized and isinstance(sanitized[field], str):
            sanitized[field] = sanitize_html(sanitized[field])
    return sanitized
