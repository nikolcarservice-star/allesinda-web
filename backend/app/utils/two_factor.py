"""Two-factor authentication utilities"""
import pyotp
import qrcode
import io
import base64
import secrets
import json
from typing import List

def generate_secret() -> str:
    """Generate a TOTP secret"""
    return pyotp.random_base32()

def get_qr_code_url(email: str, secret: str, issuer: str = "Allesinda") -> str:
    """Generate QR code URL for TOTP setup"""
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=issuer
    )
    return totp_uri

def generate_qr_code_image(qr_code_url: str) -> str:
    """Generate QR code image as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_code_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Allow 1 time step (30 seconds) tolerance

def generate_backup_codes(count: int = 10) -> List[str]:
    """Generate backup codes for 2FA"""
    codes = []
    for _ in range(count):
        # Generate 8-digit backup code
        code = ''.join([str(secrets.randbelow(10)) for _ in range(8)])
        codes.append(code)
    return codes

def backup_codes_to_json(codes: List[str]) -> str:
    """Convert backup codes list to JSON string"""
    return json.dumps(codes)

def backup_codes_from_json(json_str: str) -> List[str]:
    """Parse backup codes from JSON string"""
    return json.loads(json_str)

