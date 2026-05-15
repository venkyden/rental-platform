import logging
import httpx
import html
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (create_access_token, create_refresh_token, get_password_hash,
                               verify_password, verify_token)
from app.models.schemas import (ForgotPasswordRequest, ForgotEmailRequest, GoogleAuthRequest,
                                ResetPasswordRequest, Token, UserLogin,
                                UserRegister, UserResponse, UserUpdate,
                                ChangePasswordRequest, RequestEmailChangeRequest,
                                ConfirmEmailChangeRequest, ContactPreferencesUpdate,
                                SwitchRoleRequest)
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
    try:
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
    except Exception:
        # Absolutely never raise 401 here
        return None


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")  # Rate limit: 20 registrations per minute per IP
async def register(
    request: Request, user_data: UserRegister, db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    client_host = request.client.host if request.client else "unknown"
    audit_logger.info(
        f"REGISTER_ATTEMPT email={user_data.email} ip={client_host}"
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
        id=uuid.uuid4(),
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=html.escape(user_data.full_name.strip()) if user_data.full_name else None,
        phone=user_data.phone.strip() if user_data.phone else None,
        role=user_data.role,
        available_roles=[user_data.role],
        marketing_consent=user_data.marketing_consent,
        marketing_consent_at=datetime.utcnow() if user_data.marketing_consent else None,
        email_verified=False,
        identity_verified=False,
        employment_verified=False,
        trust_score=0,
        onboarding_status={},
        onboarding_completed=False,
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
@limiter.limit("50/minute")  # Rate limit: 50 login attempts per minute per IP
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login and get JWT token"""
    client_host = request.client.host if request.client else "unknown"
    audit_logger.info(
        f"LOGIN_ATTEMPT email={form_data.username} ip={client_host}"
    )
    # Find user
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        audit_logger.warning(
            f"LOGIN_FAILED email={form_data.username} ip={client_host}"
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

    # Create refresh token
    refresh_token = create_refresh_token(
        data={"sub": user.email, "version": user.refresh_token_version}
    )

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        domain=settings.COOKIE_DOMAIN if settings.ENVIRONMENT == "production" else None,
    )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Get segment-based redirect
    from app.core.segment_routing import get_redirect_path, get_segment_config

    role_value = user.role.value if hasattr(user.role, "value") else user.role
    redirect_path = get_redirect_path(user.segment, role_value)
    segment_config = get_segment_config(user.segment, role=role_value)

    # Redirect users who haven't completed onboarding for their active role
    onboarding_status = user.onboarding_status or {}
    role_onboarded = onboarding_status.get(role_value, False)
    if not role_onboarded:
        redirect_path = "/onboarding"

    audit_logger.info(f"LOGIN_SUCCESS email={user.email} segment={user.segment}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "redirect_path": redirect_path,
        "segment": user.segment,
        "segment_name": segment_config.segment_name if segment_config else None,
        "available_roles": user.available_roles or [role_value],
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Refresh JWT access token using refresh token cookie"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    payload = verify_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    email = payload.get("sub")
    version = payload.get("version")
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active or user.refresh_token_version != version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found, inactive, or session revoked",
        )

    # Issue new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id)},
        expires_delta=access_token_expires,
    )
    
    # Issue new refresh token (rotation)
    new_refresh_token = create_refresh_token(
        data={"sub": user.email, "version": user.refresh_token_version}
    )

    # Set new refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        domain=settings.COOKIE_DOMAIN if settings.ENVIRONMENT == "production" else None,
    )
    
    from app.core.segment_routing import get_redirect_path, get_segment_config
    role_value = user.role.value if hasattr(user.role, "value") else user.role
    redirect_path = get_redirect_path(user.segment, role_value)
    segment_config = get_segment_config(user.segment, role=role_value)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "redirect_path": redirect_path,
        "segment": user.segment,
        "segment_name": segment_config.segment_name if segment_config else None,
        "available_roles": user.available_roles or [role_value],
    }


@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Logout user and revoke sessions"""
    if current_user:
        # Increment version to invalidate all current refresh tokens
        current_user.refresh_token_version += 1
        await db.commit()
        audit_logger.info(f"LOGOUT_SUCCESS email={current_user.email}")
    
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        domain=settings.COOKIE_DOMAIN if settings.ENVIRONMENT == "production" else None,
    )
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user profile (name, bio)"""
    if user_update.full_name is not None:
        current_user.full_name = html.escape(user_update.full_name)
    if user_update.bio is not None:
        current_user.bio = user_update.bio
        
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.patch("/me/preferences")
async def update_contact_preferences(
    data: ContactPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update notification and contact preferences"""
    current_user.contact_preferences = data.contact_preferences
    await db.commit()
    return {"status": "ok", "contact_preferences": current_user.contact_preferences}


from fastapi import UploadFile, File
from app.services.storage import storage
import os
import secrets
from io import BytesIO

@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload and set profile picture"""
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image type")

    content = await file.read()
    file_obj = BytesIO(content)
    safe_filename = f"avatar_{current_user.id}_{secrets.token_hex(4)}{file_ext}"

    result = await storage.upload_file(
        file_data=file_obj,
        filename=safe_filename,
        content_type=file.content_type,
        folder="avatars",
    )

    current_user.profile_picture_url = result["url"]
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change password for an authenticated user"""
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Cannot change password for a Google-only account. Try resetting it instead if needed."
        )

    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )

    current_user.hashed_password = get_password_hash(request.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}

@router.post("/request-email-change")
async def request_email_change(
    request: RequestEmailChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Request to change the account email. Sends a validation link to the new email."""
    if current_user.hashed_password and not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect password")
        
    # Check if new email is already taken
    result = await db.execute(select(User).where(User.email == request.new_email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    # Generate token with new email embedded
    change_token = create_access_token(
        data={"sub": current_user.email, "type": "email_change", "new_email": request.new_email},
        expires_delta=timedelta(hours=1),
    )

    # Send confirmation email to the NEW email address
    await email_service.send_email_change_verification(
        to_email=request.new_email,
        token=change_token,
        full_name=current_user.full_name or "User"
    )

    return {"message": f"Verification link sent to {request.new_email}"}

@router.post("/confirm-email-change")
async def confirm_email_change(
    request: ConfirmEmailChangeRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify link and update the user's email"""
    payload = verify_token(request.token)

    if payload is None or payload.get("type") != "email_change":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token",
        )

    old_email = payload.get("sub")
    new_email = payload.get("new_email")
    
    if not new_email:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token missing new email data")

    result = await db.execute(select(User).where(User.email == old_email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Ensure another user hasn't claimed it in the meantime
    check_result = await db.execute(select(User).where(User.email == new_email))
    if check_result.scalar_one_or_none():
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is now already in use")

    user.email = new_email
    user.email_verified = True  # Implicitly verified since they clicked the link
    await db.commit()

    return {"message": "Email address updated successfully"}


@router.post("/google", response_model=Token)
async def google_auth(
    request: Request,
    response: Response,
    auth_data: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate with Google. Verifies Google ID token, finds or creates user."""
    import asyncio
    import traceback

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Sign-In is not configured on the server",
        )

    # ---- Step 1: Verify Google ID token ----
    def _verify_google_token(credential: str, client_id: str):
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        transport = google_requests.Request()
        return google_id_token.verify_oauth2_token(
            credential, transport, client_id
        )

    try:
        google_data = await asyncio.to_thread(
            _verify_google_token, auth_data.credential, settings.GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        audit_logger.warning(f"GOOGLE_AUTH_INVALID_TOKEN error={e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token. Please try signing in again.",
        )
    except Exception as e:
        audit_logger.error(f"GOOGLE_AUTH_VERIFY_ERROR error={e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not verify Google token. Please try again later.",
        )

    google_id = google_data.get("sub")
    email = google_data.get("email")

    email_verified_raw = google_data.get("email_verified", False)
    email_verified = (
        str(email_verified_raw).lower() == "true"
        if isinstance(email_verified_raw, str)
        else bool(email_verified_raw)
    )

    if not email or not google_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account missing email or ID",
        )

    # ---- Step 2: Find or create user ----
    try:
        from app.models.user import UserRole
        role_str = auth_data.role or "tenant"
        try:
            role_enum = UserRole(role_str)
        except ValueError:
            role_enum = UserRole.TENANT

        result = await db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()

        if not user:
            # Check by email
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

        if user:
            if not user.google_id:
                user.google_id = google_id
                audit_logger.info(f"GOOGLE_LINK email={email}")
            if email_verified:
                user.email_verified = True
            
            requested_role_str = role_enum.value
            current_roles = user.available_roles or ["tenant"]
            
            if requested_role_str not in current_roles:
                current_roles.append(requested_role_str)
                user.available_roles = list(current_roles)
                audit_logger.info(f"ROLE_UNLOCKED email={email} new_role={requested_role_str}")
            
            user.role = role_enum
        else:
            # Create new user
            user = User(
                email=email,
                google_id=google_id,
                full_name=None,
                role=role_enum,
                available_roles=[role_enum.value],
                email_verified=email_verified,
                hashed_password=None,
            )
            db.add(user)
            audit_logger.info(f"GOOGLE_REGISTER email={email} role={role_str}")

        if user.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
            )

        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        audit_logger.error(f"GOOGLE_AUTH_DB_ERROR email={email} google_id={google_id} error={type(e).__name__}: {str(e)}\n{tb}")
        try:
            await db.rollback()
        except Exception:
            pass
            
        # Distinguish between schema issues and other errors
        error_msg = "Account setup failed. Please try again."
        if "column" in str(e).lower() or "relation" in str(e).lower():
            error_msg = "Database schema mismatch. Please run migrations (alembic upgrade head)."
            
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg,
        )

    # ---- Step 3: Create tokens and return ----
    try:
        audit_logger.info(f"GOOGLE_LOGIN_SUCCESS email={user.email} segment={user.segment}")
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "user_id": str(user.id)},
            expires_delta=access_token_expires,
        )

        # Create refresh token
        refresh_token = create_refresh_token(
            data={"sub": user.email, "version": user.refresh_token_version}
        )

        # Set refresh token cookie
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
            expires=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
            samesite="lax",
            secure=settings.ENVIRONMENT == "production",
            domain=settings.COOKIE_DOMAIN if settings.ENVIRONMENT == "production" else None,
        )

        # Get segment-based redirect
        from app.core.segment_routing import get_redirect_path, get_segment_config

        role_value = user.role.value if hasattr(user.role, "value") else user.role
        redirect_path = get_redirect_path(user.segment, role_value)
        segment_config = get_segment_config(user.segment, role=role_value)

        # Redirect users who haven't completed onboarding for their active role
        onboarding_status = user.onboarding_status or {}
        role_onboarded = onboarding_status.get(role_value, False)
        if not role_onboarded:
            redirect_path = "/onboarding"

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "redirect_path": redirect_path,
            "segment": user.segment,
            "segment_name": segment_config.segment_name if segment_config else None,
            "available_roles": user.available_roles or [role_value],
        }
    except Exception as e:
        tb = traceback.format_exc()
        audit_logger.error(f"GOOGLE_AUTH_TOKEN_ERROR email={email} error={e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again.",
        )


@router.post("/forgot-email", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def forgot_email(
    request: Request,
    payload: ForgotEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recover an email address using full name and phone number.
    Returns a masked version of the email to protect privacy.
    """
    # Case-insensitive search using ilike
    query = select(User).where(
        User.full_name.ilike(payload.full_name.strip()),
        User.phone == payload.phone.strip()
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        # Generic error message to prevent enumeration
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found matching this name and phone number."
        )

    # Mask the email
    email_parts = user.email.split("@")
    if len(email_parts) == 2:
        username, domain = email_parts
        if len(username) > 2:
            masked_username = username[0] + "*" * (len(username) - 2) + username[-1]
        elif len(username) == 2:
            masked_username = username[0] + "*"
        else:
            masked_username = username
        masked_email = f"{masked_username}@{domain}"
    else:
        masked_email = user.email

    # Send email reminder
    await email_service.send_forgot_email_reminder(
        to_email=user.email,
        full_name=user.full_name or "User"
    )

    client_host = request.client.host if request.client else "unknown"
    audit_logger.info(f"FORGOT_EMAIL_SUCCESS masked_email={masked_email} ip={client_host}")

    return {"message": "Account found and email reminder sent", "masked_email": masked_email}


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

    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    config = get_segment_config(current_user.segment, role=role_value)
    redirect_path = get_redirect_path(current_user.segment, role_value)

    return {
        "segment": config.segment,
        "segment_name": config.segment_name,
        "segment_type": config.segment_type,
        "dashboard_path": redirect_path,
        # Feature sets
        "common_features": COMMON_FEATURES,
        "segment_features": config.features,
        "all_features": get_all_features(current_user.segment, role=role_value),
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


@router.post("/switch-role")
async def switch_role(
    request: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch the active role for a multi-role user.
    Returns a fresh access token bound to the new role context."""
    from app.models.user import UserRole
    from app.core.segment_routing import get_redirect_path, get_segment_config

    target_role_str = request.role
    current_roles = current_user.available_roles or []

    # Validate the role exists and is unlocked
    try:
        target_role_enum = UserRole(target_role_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {target_role_str}",
        )

    if target_role_str not in current_roles:
        # Auto-unlock standard roles for existing users
        if target_role_str in ["tenant", "landlord", "property_manager"]:
            current_roles.append(target_role_str)
            current_user.available_roles = current_roles
            # We don't commit yet, we'll commit below
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{target_role_str}' is restricted and cannot be auto-unlocked.",
            )

    # Switch the active role
    current_user.role = target_role_enum
    await db.commit()
    await db.refresh(current_user)

    # Generate a fresh JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.email, "user_id": str(current_user.id)},
        expires_delta=access_token_expires,
    )

    # Compute redirect path based on onboarding status for the new role
    onboarding_status = current_user.onboarding_status or {}
    role_onboarded = onboarding_status.get(target_role_str, False)

    if not role_onboarded:
        redirect_path = "/onboarding"
    else:
        role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
        redirect_path = get_redirect_path(current_user.segment, role_value)

    segment_config = get_segment_config(current_user.segment, role=target_role_str)

    audit_logger.info(f"ROLE_SWITCH email={current_user.email} new_role={target_role_str}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "redirect_path": redirect_path,
        "active_role": target_role_str,
        "available_roles": current_roles,
        "segment": current_user.segment,
        "segment_name": segment_config.segment_name if segment_config else None,
    }
