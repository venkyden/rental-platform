"""
Tests for app.core.config — Settings validation.
"""

import pytest
from pydantic import ValidationError


class TestSettings:
    """Test the Settings class validation rules."""

    def test_secret_key_too_short_raises(self):
        """SECRET_KEY under 32 chars must be rejected."""
        from app.core.config import Settings

        with pytest.raises(ValidationError) as exc_info:
            Settings(
                DATABASE_URL="sqlite:///test.db",
                SECRET_KEY="short",
            )
        assert "SECRET_KEY must be at least 32 characters" in str(exc_info.value)

    def test_secret_key_valid_length(self):
        """SECRET_KEY of exactly 32 chars passes validation."""
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="sqlite:///test.db",
            SECRET_KEY="a" * 32,
        )
        assert len(s.SECRET_KEY) == 32

    def test_secret_key_long(self):
        """Longer SECRET_KEYs are valid too."""
        from app.core.config import Settings

        s = Settings(
            DATABASE_URL="sqlite:///test.db",
            SECRET_KEY="x" * 64,
        )
        assert len(s.SECRET_KEY) == 64

    def test_defaults(self):
        """Verify sensible defaults for optional fields."""
        from app.core.config import Settings

        # Check class-level field defaults (not instantiating,
        # since Settings reads from .env at instantiation)
        fields = Settings.model_fields
        assert fields['ALGORITHM'].default == 'HS256'
        assert fields['ACCESS_TOKEN_EXPIRE_MINUTES'].default == 30
        assert fields['FRONTEND_URL'].default == 'http://localhost:3000'
        assert fields['ENVIRONMENT'].default == 'development'
        assert fields['SENTRY_DSN'].default is None
        assert fields['ANTHROPIC_API_KEY'].default is None
