import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (create_access_token, get_password_hash,
                               verify_password, verify_token)
from app.models.schemas import (ForgotPasswordRequest, GoogleAuthRequest,
                                ResetPasswordRequest, Token, UserLogin,
                                UserRegister, UserResponse)
from app.models.user import User
from app.services.email import email_service

# Set up audit logger
audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)
if not audit_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - AUDIT - %(message)s"))
    audit_logger.addHandler(handler)

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


# Optional auth scheme — does not raise 401 when no token is present
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user_optional(
    token: str = Depends(oauth2_scheme_optional), db: AsyncSession = Depends(get_db)
) -> User | None:
    """Get current user if authenticated, otherwise return None."""
    if not token:
        return None
    payload = verify_token(token)
    if payload is None:
        return None
    email: str = payload.get("sub")
    if email is None:
        return None
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("3/minute")  # Rate limit: 3 registrations per minute per IP
async def register(
    request: Request, user_data: UserRegister, db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    audit_logger.info(
        f"REGISTER_ATTEMPT email={user_data.email} ip={request.client.host}"
    )
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        marketing_consent=user_data.marketing_consent,
        marketing_consent_at=datetime.utcnow() if user_data.marketing_consent else None,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Send verification email
    verification_token = create_access_token(
        data={"sub": new_user.email, "type": "email_verification"},
        expires_delta=timedelta(hours=24),
    )
    await email_service.send_verification_email(
        to_email=new_user.email,
        token=verification_token,
        full_name=new_user.full_name or "User",
    )

    audit_logger.info(f"REGISTER_SUCCESS email={new_user.email}")
    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # Rate limit: 5 login attempts per minute per IP
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login and get JWT token"""
    audit_logger.info(
        f"LOGIN_ATTEMPT email={form_data.username} ip={request.client.host}"
    )
    # Find user
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        audit_logger.warning(
            f"LOGIN_FAILED email={form_data.username} ip={request.client.host}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=access_token_expires,
    )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Get segment-based redirect
    from app.core.segment_routing import get_redirect_path, get_segment_config

    redirect_path = get_redirect_path(
        user.segment, user.role.value if hasattr(user.role, "value") else user.role
    )
    segment_config = get_segment_config(user.segment)

    # Redirect users who haven't completed onboarding
    if not user.onboarding_completed:
        redirect_path = "/onboarding"

    audit_logger.info(f"LOGIN_SUCCESS email={user.email} segment={user.segment}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "redirect_path": redirect_path,
        "segment": user.segment,
        "segment_name": segment_config.segment_name if segment_config else None,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user


@router.post("/google", response_model=Token)
async def google_auth(
    request: Request, auth_data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)
):
    """Authenticate with Google. Verifies Google ID token, finds or creates user."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Sign-In is not configured",
        )

    # Verify the Google ID token
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.credential}"
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token",
                )
            google_data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google token",
        )

    # Validate the token was issued for our app
    if google_data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token was not issued for this application",
        )

    google_id = google_data.get("sub")
    email = google_data.get("email")
    full_name = google_data.get("name")
    email_verified = google_data.get("email_verified", "false") == "true"

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account missing email or ID",
        )

    # Check if user exists by google_id or email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        # Check by email (existing user linking Google account)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            # Link Google account to existing user
            user.google_id = google_id
            if email_verified:
                user.email_verified = True
            audit_logger.info(f"GOOGLE_LINK email={email}")
        else:
            # Create new user
            role = auth_data.role or "tenant"  # Default to tenant
            user = User(
                email=email,
                google_id=google_id,
                full_name=full_name,
                role=role,
                email_verified=email_verified,
                hashed_password=None,  # No password for Google-only accounts
            )
            db.add(user)
            audit_logger.info(f"GOOGLE_REGISTER email={email} role={role}")

    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=access_token_expires,
    )

    # Get segment-based redirect
    from app.core.segment_routing import get_redirect_path, get_segment_config

    redirect_path = get_redirect_path(
        user.segment, user.role.value if hasattr(user.role, "value") else user.role
    )
    segment_config = get_segment_config(user.segment)

    # Redirect users who haven't completed onboarding
    if not user.onboarding_completed:
        redirect_path = "/onboarding"

    audit_logger.info(f"GOOGLE_LOGIN_SUCCESS email={user.email} segment={user.segment}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "redirect_path": redirect_path,
        "segment": user.segment,
        "segment_name": segment_config.segment_name if segment_config else None,
    }


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Send password reset email"""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # Always return success (don't reveal if email exists)
    if user:
        # Create reset token (valid for 1 hour)
        reset_token = create_access_token(
            data={"sub": user.email, "type": "password_reset"},
            expires_delta=timedelta(hours=1),
        )

        # Send password reset email
        await email_service.send_password_reset_email(
            to_email=user.email, token=reset_token, full_name=user.full_name or "User"
        )

    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Reset password using token"""
    payload = verify_token(request.token)

    if payload is None or payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Update password
    user.hashed_password = get_password_hash(request.new_password)
    await db.commit()

    return {"message": "Password reset successful"}


from datetime import datetime


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify email address using token"""
    payload = verify_token(token)

    if payload is None or payload.get("type") != "email_verification":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.email_verified:
        return {"message": "Email already verified"}

    # Verify email
    user.email_verified = True
    await db.commit()

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Resend verification email to current user"""
    if current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified"
        )

    # Create new verification token
    verification_token = create_access_token(
        data={"sub": current_user.email, "type": "email_verification"},
        expires_delta=timedelta(hours=24),
    )

    # Send verification email
    await email_service.send_verification_email(
        to_email=current_user.email,
        token=verification_token,
        full_name=current_user.full_name or "User",
    )

    return {"message": "Verification email sent"}


@router.get("/me/segment-config")
async def get_my_segment_config(current_user: User = Depends(get_current_user)):
    """Get the current user's segment configuration with features and quick actions"""
    from app.core.segment_routing import (COMMON_FEATURES, get_all_features,
                                          get_redirect_path,
                                          get_segment_config)

    config = get_segment_config(current_user.segment)
    redirect_path = get_redirect_path(
        current_user.segment,
        (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else current_user.role
        ),
    )

    return {
        "segment": config.segment,
        "segment_name": config.segment_name,
        "segment_type": config.segment_type,
        "dashboard_path": redirect_path,
        # Feature sets
        "common_features": COMMON_FEATURES,
        "segment_features": config.features,
        "all_features": get_all_features(current_user.segment),
        # UI config
        "quick_actions": config.quick_actions,
        "settings": config.settings,
        # User verification status (for common features)
        "verification_status": {
            "id_verified": current_user.identity_verified,
            "email_verified": current_user.email_verified,
            "employment_verified": current_user.employment_verified,
            "onboarding_completed": current_user.onboarding_completed,
        },
    }
