"""Social authentication utilities for Google and Facebook OAuth"""
import httpx
from typing import Optional, Dict
from ..config import settings
import logging

logger = logging.getLogger(__name__)

async def verify_google_token(access_token: str) -> Optional[Dict]:
    """Verify Google OAuth token and get user info"""
    try:
        async with httpx.AsyncClient() as client:
            # First verify the token
            verify_response = await client.get(
                f"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={access_token}"
            )
            if verify_response.status_code != 200:
                return None
            
            token_info = verify_response.json()
            
            # Get user info
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if user_response.status_code != 200:
                return None
            
            user_info = user_response.json()
            return {
                "id": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
                "verified": user_info.get("verified_email", False)
            }
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
        return None

async def verify_facebook_token(access_token: str) -> Optional[Dict]:
    """Verify Facebook OAuth token and get user info"""
    try:
        async with httpx.AsyncClient() as client:
            # Verify token and get user info in one call
            response = await client.get(
                f"https://graph.facebook.com/me",
                params={
                    "access_token": access_token,
                    "fields": "id,name,email,picture"
                }
            )
            if response.status_code != 200:
                return None
            
            user_info = response.json()
            picture_url = None
            if "picture" in user_info and "data" in user_info["picture"]:
                picture_url = user_info["picture"]["data"].get("url")
            
            return {
                "id": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": picture_url,
                "verified": True  # Facebook emails are generally verified
            }
    except Exception as e:
        logger.error(f"Error verifying Facebook token: {e}")
        return None

async def verify_social_token(provider: str, access_token: str) -> Optional[Dict]:
    """Verify social token based on provider"""
    if provider == "google":
        return await verify_google_token(access_token)
    elif provider == "facebook":
        return await verify_facebook_token(access_token)
    else:
        logger.error(f"Unsupported social provider: {provider}")
        return None

