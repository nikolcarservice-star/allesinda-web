from fastapi import APIRouter, Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models import User, Role
from ..schemas import UserOut

router = APIRouter(prefix="/users", tags=["users"])

# Use HTTPBearer for optional authentication
security = HTTPBearer(auto_error=False)

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    try:
        from jose import jwt, JWTError
        from ..config import settings
        
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: int | None = payload.get("sub")
        if user_id is None:
            return None
        user = db.get(User, int(user_id))
        return user if user and user.is_active else None
    except Exception:
        return None

@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Get user by ID.
    
    Returns user information including name, email, role, etc.
    Authentication is optional - public endpoint for fetching user names.
    This allows the frontend to display owner/seller names without requiring login.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # Optional: Add privacy controls - users can only see their own info or admins can see all
    # For now, allow public access to user names (needed for displaying owner/seller names)
    # Uncomment below if you want to restrict to self or admin only:
    # if current_user and current_user.id != user_id and current_user.role != Role.admin:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized to view this user"
    #     )
    
    return user

