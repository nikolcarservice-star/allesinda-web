"""SMS utility functions for sending SMS notifications"""
from typing import Optional
from ..config import settings
import logging
import httpx

logger = logging.getLogger(__name__)

def send_sms(to_phone: str, message: str) -> bool:
    """Send SMS notification
    
    Supports multiple providers:
    - Twilio (recommended)
    - Local SMS gateway
    - Other SMS providers
    
    Args:
        to_phone: Phone number in E.164 format (e.g., +1234567890)
        message: SMS message text (max 1600 characters recommended)
    
    Returns:
        True if SMS sent successfully, False otherwise
    """
    if not settings.SMS_ENABLED or not settings.SMS_PROVIDER:
        logger.warning("SMS not configured. SMS not sent. (This is OK for development)")
        logger.info(f"Would send SMS to {to_phone}: {message[:50]}...")
        return False
    
    if not to_phone:
        logger.error("Phone number is required for SMS")
        return False
    
    if len(message) > 1600:
        logger.warning(f"SMS message too long ({len(message)} chars), truncating to 1600")
        message = message[:1600]
    
    try:
        if settings.SMS_PROVIDER.lower() == "twilio":
            return _send_sms_twilio(to_phone, message)
        elif settings.SMS_PROVIDER.lower() == "local":
            return _send_sms_local(to_phone, message)
        else:
            logger.error(f"Unsupported SMS provider: {settings.SMS_PROVIDER}")
            return False
    except Exception as e:
        logger.error(f"Failed to send SMS to {to_phone}: {e}")
        return False

def _send_sms_twilio(to_phone: str, message: str) -> bool:
    """Send SMS using Twilio"""
    try:
        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_FROM_NUMBER
        
        if not all([account_sid, auth_token, from_number]):
            logger.error("Twilio credentials not configured")
            return False
        
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        
        # Use sync requests for Twilio API
        try:
            import requests
            response = requests.post(
                url,
                auth=(account_sid, auth_token),
                data={
                    "From": from_number,
                    "To": to_phone,
                    "Body": message
                },
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"SMS sent successfully to {to_phone} via Twilio")
            return True
        except ImportError:
            # Fallback to httpx if requests not available
            async def send():
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        url,
                        auth=(account_sid, auth_token),
                        data={
                            "From": from_number,
                            "To": to_phone,
                            "Body": message
                        }
                    )
                    response.raise_for_status()
                    return True
            
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                return loop.run_until_complete(send())
            except RuntimeError:
                return asyncio.run(send())
            
    except Exception as e:
        logger.error(f"Twilio SMS error: {e}")
        return False

def _send_sms_local(to_phone: str, message: str) -> bool:
    """Send SMS using local SMS gateway (for development/testing)"""
    logger.info(f"Local SMS gateway: Sending to {to_phone}: {message[:50]}...")
    # In development, just log the SMS
    # In production, integrate with your local SMS gateway API
    return True

def send_order_notification_sms(phone: str, order_id: int, order_type: str, message: str = None):
    """Send SMS notification for order updates"""
    if not message:
        message = f"New {order_type} order #{order_id} received on Allesinda. Check your dashboard for details."
    
    return send_sms(phone, message)

def send_message_notification_sms(phone: str, sender_name: str):
    """Send SMS notification for new messages"""
    message = f"You have a new message from {sender_name} on Allesinda. Check your inbox."
    return send_sms(phone, message)

def send_review_notification_sms(phone: str, rating: int):
    """Send SMS notification for new reviews"""
    message = f"You received a {rating}-star review on Allesinda. Check your profile to see it."
    return send_sms(phone, message)

