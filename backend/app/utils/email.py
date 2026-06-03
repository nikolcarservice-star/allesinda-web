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
        logger.warning(
            f"SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing). "
            f"Email not sent to {to_email}, subject: {subject}"
        )
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

def send_message_notification_email(email: str, recipient_name: str, sender_name: str, conversation_id: int):
    """Send email notification for a new chat message."""
    messages_url = f"{settings.FRONTEND_URL}/messages?conversation_id={conversation_id}"
    subject = "New message on Allesinda"
    html_body = f"""
    <html>
      <body>
        <h2>New message</h2>
        <p>Hello {recipient_name},</p>
        <p>You have a new message from <strong>{sender_name}</strong>.</p>
        <p>
          <a href="{messages_url}" style="background-color:#4CAF50;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">
            Open messages
          </a>
        </p>
        <p>Or copy and paste this URL into your browser:</p>
        <p>{messages_url}</p>
      </body>
    </html>
    """
    text_body = f"""New message

Hello {recipient_name},

You have a new message from {sender_name}.

Open messages: {messages_url}
"""
    return send_email(email, subject, html_body, text_body)


def send_user_report_email(
    to_email: str,
    reporter_name: str,
    reported_name: str,
    reason: str,
    details: str | None,
    source_label: str,
    profile_url: str | None,
    admin_url: str,
    report_id: int,
) -> bool:
    """Notify the trust team about a new user complaint."""
    profile_block = (
        f'<p><strong>Profil:</strong> <a href="{profile_url}">{profile_url}</a></p>'
        if profile_url
        else ""
    )
    details_block = f"<p><strong>Details:</strong><br>{details}</p>" if details else ""
    subject = f"[Allesinda] Neue Meldung #{report_id}: {reason}"
    html_body = f"""
    <html>
      <body>
        <h2>Neue Meldung</h2>
        <p><strong>Quelle:</strong> {source_label}</p>
        <p><strong>Melder:</strong> {reporter_name}</p>
        <p><strong>Gemeldeter Nutzer:</strong> {reported_name}</p>
        <p><strong>Grund:</strong> {reason}</p>
        {details_block}
        {profile_block}
        <p>
          <a href="{admin_url}" style="background-color:#059669;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">
            Im Admin-Panel öffnen
          </a>
        </p>
        <p>Bitte innerhalb von 24 Stunden prüfen.</p>
      </body>
    </html>
    """
    text_body = f"""Neue Meldung #{report_id}

Quelle: {source_label}
Melder: {reporter_name}
Gemeldeter Nutzer: {reported_name}
Grund: {reason}
"""
    if details:
        text_body += f"\nDetails:\n{details}\n"
    if profile_url:
        text_body += f"\nProfil: {profile_url}\n"
    text_body += f"\nAdmin: {admin_url}\n"
    return send_email(to_email, subject, html_body, text_body)


def send_report_resolved_reporter_email(
    to_email: str,
    recipient_name: str,
    reported_name: str,
    report_id: int,
) -> bool:
    """Notify the client that their complaint was reviewed."""
    subject = f"Ihre Meldung #{report_id} wurde bearbeitet"
    html_body = f"""
    <html>
      <body>
        <h2>Meldung bearbeitet</h2>
        <p>Hallo {recipient_name},</p>
        <p>
          Vielen Dank für Ihre Meldung zu <strong>{reported_name}</strong>.
          Unser Trust-Team hat den Fall geprüft und die Meldung als bearbeitet markiert.
        </p>
        <p>Bei weiteren Fragen erreichen Sie uns unter
          <a href="mailto:{settings.TRUST_EMAIL}">{settings.TRUST_EMAIL}</a>.
        </p>
      </body>
    </html>
    """
    text_body = f"""Meldung bearbeitet

Hallo {recipient_name},

Ihre Meldung zu {reported_name} wurde von unserem Trust-Team bearbeitet.

Kontakt: {settings.TRUST_EMAIL}
"""
    return send_email(to_email, subject, html_body, text_body)


def send_report_resolved_reported_email(
    to_email: str,
    recipient_name: str,
    action_label: str,
    violation_label: str,
    admin_note: str | None,
) -> bool:
    """Notify the master about moderation outcome (Step 4) and appeal window (Step 5)."""
    note_block = f"<p><strong>Hinweis vom Team:</strong> {admin_note}</p>" if admin_note else ""
    subject = "Entscheidung zu Ihrer Meldung auf Allesinda"
    html_body = f"""
    <html>
      <body>
        <h2>Entscheidung zu Ihrer Meldung</h2>
        <p>Hallo {recipient_name},</p>
        <p>Es liegt eine Meldung zu Ihrem Profil vor. Nach Prüfung haben wir folgende Entscheidung getroffen:</p>
        <ul>
          <li><strong>Verstoß:</strong> {violation_label}</li>
          <li><strong>Maßnahme:</strong> {action_label}</li>
        </ul>
        {note_block}
        <p>
          Sie können diese Entscheidung innerhalb von <strong>7 Tagen</strong> schriftlich an
          <a href="mailto:{settings.TRUST_EMAIL}">{settings.TRUST_EMAIL}</a> anfechten (Einspruch).
        </p>
      </body>
    </html>
    """
    text_body = f"""Entscheidung zu Ihrer Meldung

Hallo {recipient_name},

Verstoß: {violation_label}
Maßnahme: {action_label}
"""
    if admin_note:
        text_body += f"\nHinweis: {admin_note}\n"
    text_body += f"\nEinspruch innerhalb von 7 Tagen an {settings.TRUST_EMAIL}\n"
    return send_email(to_email, subject, html_body, text_body)

