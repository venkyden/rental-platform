import re
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(pattern="^(tenant|landlord|property_manager)$")
    marketing_consent: bool = False

    @field_validator("full_name")
    @classmethod
    def validate_full_name_no_xss(cls, v: str) -> str:
        """Prevent basic XSS payloads in full_name"""
        if "<" in v or ">" in v or "script" in v.lower():
            raise ValueError("Invalid characters in full_name")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Enforce password complexity: uppercase, lowercase, digit, special char"""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    redirect_path: Optional[str] = None
    segment: Optional[str] = None
    segment_name: Optional[str] = None
    available_roles: list[str] = []


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    first_name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: str
    email_verified: bool = False
    identity_verified: bool = False
    employment_verified: bool = False
    income_verified: bool = False
    solvency_verified: bool = False
    income_status: Optional[str] = "unverified"
    ownership_verified: Optional[bool] = False
    kbis_verified: Optional[bool] = False
    carte_g_verified: Optional[bool] = False
    guarantor_type: Optional[str] = None
    guarantor_status: Optional[str] = "unverified"
    trust_score: int = 0
    segment: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    available_roles: list[str] = ["tenant"]
    onboarding_status: dict = {}
    onboarding_completed: bool = False
    marketing_consent: bool = False
    contact_preferences: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def compute_onboarding(self) -> 'UserResponse':
        role_str = self.role.value if hasattr(self.role, "value") else str(self.role)
        if self.onboarding_status is not None:
            # Override onboarding_completed based on active role
            self.onboarding_completed = self.onboarding_status.get(role_str, False)
        return self

class SwitchRoleRequest(BaseModel):
    role: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    first_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v: Optional[str]) -> Optional[str]:
        """40–300 chars when set; no contact details (anti-bypass of the platform
        + GDPR minimization). Empty string clears the bio."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return ""
        if len(v) < 40 or len(v) > 300:
            raise ValueError("bio must be between 40 and 300 characters")
        import re
        if re.search(r"\S+@\S+\.\S+", v):
            raise ValueError("bio must not contain contact details")
        if re.search(r"\+?\d[\d .\-]{8,}", v):
            raise ValueError("bio must not contain contact details")
        return v


class ContactPreferencesUpdate(BaseModel):
    contact_preferences: Dict[str, Any]

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Enforce password complexity"""
        import re
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v

class RequestEmailChangeRequest(BaseModel):
    new_email: EmailStr
    password: str

class ConfirmEmailChangeRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotEmailRequest(BaseModel):
    full_name: str
    phone: str


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from frontend
    role: Optional[str] = Field(
        default=None, pattern="^(tenant|landlord|property_manager)$"
    )


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Enforce the same complexity as registration / change-password."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class ApplicationCreate(BaseModel):
    property_id: UUID
    cover_letter: Optional[str] = None


class TenantSummary(BaseModel):
    """Minimal tenant profile exposed in application responses."""
    id: UUID
    full_name: Optional[str] = None
    bio: Optional[str] = None
    email: str
    profile_picture_url: Optional[str] = None
    trust_score: int = 0
    identity_verified: bool = False
    employment_verified: bool = False
    income_verified: bool = False
    solvency_verified: bool = False
    guarantor_type: Optional[str] = None

    class Config:
        from_attributes = True


class PropertySummary(BaseModel):
    """Minimal property info exposed in application responses."""
    id: UUID
    title: str
    city: str
    address_line1: Optional[str] = None
    monthly_rent: Optional[float] = None
    charges: Optional[float] = None
    deposit: Optional[float] = None
    property_type: Optional[str] = None
    furnished: Optional[bool] = None
    surface_area: Optional[float] = None

    class Config:
        from_attributes = True


class ApplicationResponse(BaseModel):
    id: UUID
    property_id: UUID
    tenant_id: UUID
    status: str
    cover_letter: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Enriched relational data (populated when joined)
    tenant: Optional[TenantSummary] = None
    property: Optional[PropertySummary] = None

    class Config:
        from_attributes = True
