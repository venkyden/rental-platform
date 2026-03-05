import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str
    role: str = Field(pattern="^(tenant|landlord|property_manager)$")
    marketing_consent: bool = False

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


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: str
    email_verified: bool
    identity_verified: bool
    employment_verified: bool
    trust_score: int
    segment: Optional[str] = None
    onboarding_completed: bool = False
    marketing_consent: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)

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


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from frontend
    role: Optional[str] = Field(
        default=None, pattern="^(tenant|landlord|property_manager)$"
    )


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class ApplicationCreate(BaseModel):
    property_id: UUID
    cover_letter: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: UUID
    property_id: UUID
    tenant_id: UUID
    status: str
    cover_letter: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
