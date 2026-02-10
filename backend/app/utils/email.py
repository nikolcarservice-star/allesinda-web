"""Email utility functions for sending verification and password reset emails"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import settings
import logging

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, html_body: str, text_body: str = None):
    """Send an email using SMTP
    
    Supports both TLS (port 587) and SSL (port 465) connections.
    For Gmail, you must use an App Password instead of your regular password.
    See: https://support.google.com/accounts/answer/185833
    
    In development, if SMTP is not configured, this will log a warning and return False
    without raising errors.
    """
    # Check if SMTP is configured - need host, user, and password
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        if not settings.IS_PRODUCTION:
            logger.debug(f"SMTP not configured. Email not sent to {to_email}. (This is OK for development)")
            logger.debug(f"Would send email with subject: {subject}")
        else:
            logger.warning(f"SMTP not configured. Email not sent to {to_email}.")
        return False
    
    # Detect Gmail
    is_gmail = 'gmail.com' in settings.SMTP_HOST.lower()
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.SMTP_USER
        msg['To'] = to_email
        
        if text_body:
            text_part = MIMEText(text_body, 'plain')
            msg.attach(text_part)
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        # Use SSL for port 465, TLS for port 587
        if settings.SMTP_PORT == 465:
            # SSL connection
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            # TLS connection (default for port 587)
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
        
        # Login and send
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        # In development, treat authentication errors as warnings (likely misconfigured)
        if not settings.IS_PRODUCTION:
            logger.warning(f"SMTP authentication failed for {to_email}. Email not sent. (This is OK for development)")
            if is_gmail:
                logger.debug("Gmail requires an App Password. See: https://myaccount.google.com/apppasswords")
        else:
            error_msg = f"SMTP authentication failed for {to_email}"
            if is_gmail:
                error_msg += (
                    "\nGmail requires an App Password instead of your regular password. "
                    "If you have 2-Step Verification enabled, you must create an App Password at: "
                    "https://myaccount.google.com/apppasswords"
                )
            logger.error(f"{error_msg}: {e}")
        return False
    except Exception as e:
        # In development, log as warning; in production, log as error
        if not settings.IS_PRODUCTION:
            logger.warning(f"Failed to send email to {to_email} (SMTP may be misconfigured): {e}")
        else:
            logger.error(f"Failed to send email to {to_email}: {e}")
        return False

def send_verification_email(email: str, name: str, token: str):
    """Send email verification email"""
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    
    subject = "Verify your Allesinda account"
    html_body = f"""
    <html>
      <body>
        <h2>Welcome to Allesinda, {name}!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="{verification_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>{verification_url}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </body>
    </html>
    """
    text_body = f"""
    Welcome to Allesinda, {name}!
    
    Please verify your email address by visiting:
    {verification_url}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, please ignore this email.
    """
    
    return send_email(email, subject, html_body, text_body)

def send_password_reset_email(email: str, name: str, token: str):
    """Send password reset email"""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    subject = "Reset your Allesinda password"
    html_body = f"""
    <html>
      <body>
        <h2>Password Reset Request</h2>
        <p>Hello {name},</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <p><a href="{reset_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>{reset_url}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
      </body>
    </html>
    """
    text_body = f"""
    Password Reset Request
    
    Hello {name},
    
    We received a request to reset your password. Visit this link to reset it:
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, please ignore this email.
    """
    
    return send_email(email, subject, html_body, text_body)

