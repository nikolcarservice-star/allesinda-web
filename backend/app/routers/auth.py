from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import secrets
import string
from ..database import get_db
from ..models import User, Role, Profile
from ..schemas import (
    UserCreate, UserOut, LoginIn, Token,
    ForgotPasswordIn, ResetPasswordIn, ChangePasswordIn,
    VerifyEmailIn, ResendVerificationIn,
    TwoFactorSetupOut, TwoFactorVerifyIn, TwoFactorDisableIn,
    SocialLoginIn
)
from ..security import get_password_hash, verify_password, create_access_token, get_current_user
from ..utils.email import send_verification_email, send_password_reset_email
from ..utils.two_factor import (
    generate_secret, get_qr_code_url, generate_qr_code_image,
    verify_totp, generate_backup_codes, backup_codes_to_json, backup_codes_from_json
)
from ..utils.social_auth import verify_social_token
from ..config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

def generate_token(length: int = 32) -> str:
    """Generate a secure random token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@router.post("/register", response_model=UserOut)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate verification token
    verification_token = generate_token()
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    
    user = User(
        email=data.email,
        name=data.name,
        role=data.role,
        hashed_password=get_password_hash(data.password),
        verification_token=verification_token,
        verification_token_expires=verification_expires,
        email_verified=False,
        phone=data.phone
    )
    db.add(user)
    db.flush()
    # Create empty profile; for masters allow setting category_id/keywords during registration
    profile_kwargs = {}
    if data.role == Role.master:
        if getattr(data, "category_id", None):
            profile_kwargs["category_id"] = data.category_id
        if getattr(data, "keywords", None):
            profile_kwargs["keywords"] = data.keywords
    db.add(Profile(user_id=user.id, **profile_kwargs))
    db.commit()
    db.refresh(user)
    
    # Send verification email
    send_verification_email(user.email, user.name, verification_token)
    
    return user

@router.post("/login", response_model=Token)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Login with email and password"""
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has password (social login users might not have password)
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="Please use social login or set a password")
    
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    # Check if 2FA is enabled
    if user.two_factor_enabled:
        if not data.two_factor_code:
            from fastapi import Response
            # Return 200 with requires_2fa flag instead of error
            return Response(
                status_code=200,
                content='{"requires_2fa": true, "message": "2FA code required"}',
                media_type="application/json"
            )
        
        # Verify 2FA code
        if not user.two_factor_secret:
            raise HTTPException(status_code=400, detail="2FA is enabled but no secret found")
        
        code_valid = verify_totp(user.two_factor_secret, data.two_factor_code)
        
        if not code_valid:
            # Try backup codes
            backup_codes = backup_codes_from_json(user.backup_codes) if user.backup_codes else []
            if data.two_factor_code not in backup_codes:
                raise HTTPException(status_code=401, detail="Invalid 2FA code")
            
            # Remove used backup code
            backup_codes.remove(data.two_factor_code)
            user.backup_codes = backup_codes_to_json(backup_codes) if backup_codes else None
            db.commit()
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Request password reset"""
    user = db.query(User).filter(User.email == data.email).first()
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a password reset link has been sent"}
    
    # Generate reset token
    reset_token = generate_token()
    reset_expires = datetime.now(timezone.utc) + timedelta(hours=settings.RESET_TOKEN_EXPIRE_HOURS)
    
    user.reset_token = reset_token
    user.reset_token_expires = reset_expires
    db.commit()
    
    # Send reset email
    send_password_reset_email(user.email, user.name, reset_token)
    
    return {"message": "If the email exists, a password reset link has been sent"}

@router.post("/reset-password")
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    """Reset password using token"""
    user = db.query(User).filter(User.reset_token == data.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    if not user.reset_token_expires or user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Update password
    user.hashed_password = get_password_hash(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password reset successfully"}

@router.post("/change-password")
def change_password(data: ChangePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Change password for authenticated user"""
    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="User has no password set")
    
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

@router.post("/verify-email")
def verify_email(data: VerifyEmailIn, db: Session = Depends(get_db)):
    """Verify email address using token"""
    user = db.query(User).filter(User.verification_token == data.token).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    if not user.verification_token_expires or user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token has expired")
    
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    
    return {"message": "Email verified successfully"}

@router.post("/resend-verification")
def resend_verification(data: ResendVerificationIn, db: Session = Depends(get_db)):
    """Resend email verification"""
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user:
        # Always return success to prevent email enumeration
        return {"message": "If the email exists and is not verified, a verification email has been sent"}
    
    if user.email_verified:
        return {"message": "Email is already verified"}
    
    # Generate new verification token
    verification_token = generate_token()
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRE_HOURS)
    
    user.verification_token = verification_token
    user.verification_token_expires = verification_expires
    db.commit()
    
    # Send verification email
    send_verification_email(user.email, user.name, verification_token)
    
    return {"message": "If the email exists and is not verified, a verification email has been sent"}

@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
def setup_2fa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Setup two-factor authentication"""
    if user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    # Generate secret
    secret = generate_secret()
    qr_code_url = get_qr_code_url(user.email, secret)
    qr_code_image = generate_qr_code_image(qr_code_url)
    backup_codes = generate_backup_codes(10)
    
    # Store secret temporarily (user needs to verify before enabling)
    user.two_factor_secret = secret
    user.backup_codes = backup_codes_to_json(backup_codes)
    db.commit()
    
    return {
        "secret": secret,
        "qr_code_url": qr_code_image,
        "backup_codes": backup_codes
    }

@router.post("/2fa/verify")
def verify_2fa(data: TwoFactorVerifyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Verify and enable 2FA"""
    if not user.two_factor_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated")
    
    if not verify_totp(user.two_factor_secret, data.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    user.two_factor_enabled = True
    db.commit()
    
    return {"message": "2FA enabled successfully"}

@router.post("/2fa/disable")
def disable_2fa(data: TwoFactorDisableIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Disable two-factor authentication"""
    if not user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    # Verify password
    if not user.hashed_password or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Verify 2FA code or backup code
    if not user.two_factor_secret:
        raise HTTPException(status_code=400, detail="2FA secret not found")
    
    if not verify_totp(user.two_factor_secret, data.code):
        # Try backup codes
        backup_codes = backup_codes_from_json(user.backup_codes) if user.backup_codes else []
        if data.code not in backup_codes:
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
        
        # Remove used backup code
        backup_codes.remove(data.code)
        user.backup_codes = backup_codes_to_json(backup_codes) if backup_codes else None
    
    # Disable 2FA
    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.backup_codes = None
    db.commit()
    
    return {"message": "2FA disabled successfully"}

@router.post("/social-login", response_model=Token)
async def social_login(data: SocialLoginIn, db: Session = Depends(get_db)):
    """Login with social provider (Google, Facebook, etc.)"""
    # Verify token with provider
    social_user = await verify_social_token(data.provider, data.access_token)
    
    if not social_user:
        raise HTTPException(status_code=401, detail="Invalid social token")
    
    # Find or create user
    user = db.query(User).filter(
        User.social_provider == data.provider,
        User.social_id == social_user["id"]
    ).first()
    
    if not user:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == social_user["email"]).first()
        if existing_user:
            # Link social account to existing user
            existing_user.social_provider = data.provider
            existing_user.social_id = social_user["id"]
            db.commit()
            user = existing_user
        else:
            # Create new user
            user = User(
                email=social_user["email"],
                name=social_user["name"],
                role=Role.client,  # Default role
                social_provider=data.provider,
                social_id=social_user["id"],
                email_verified=social_user.get("verified", False),
                hashed_password=None  # No password for social login
            )
            db.add(user)
            db.flush()
            
            # Create profile
            profile = Profile(user_id=user.id)
            db.add(profile)
            db.commit()
            db.refresh(user)
    else:
        # Update user info
        user.name = social_user["name"]
        db.commit()
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user
