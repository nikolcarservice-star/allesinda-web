from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv
import os
from typing import Optional

load_dotenv()

# Check if we're in production
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"

class Settings(BaseModel):
    ENVIRONMENT: str = Field(default=ENVIRONMENT, description="Environment: development, staging, production")
    IS_PRODUCTION: bool = Field(default=IS_PRODUCTION, description="Whether running in production environment")
    
    SECRET_KEY: str = Field(default=os.getenv("SECRET_KEY"), description="JWT secret key")
    
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: Optional[str]) -> str:
        # Use the global IS_PRODUCTION check (validated before Settings instance is created)
        if not v:
            if IS_PRODUCTION:
                raise ValueError("SECRET_KEY is required in production environment")
            return "dev-secret-key-change-in-production"
        if IS_PRODUCTION and len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long in production")
        return v
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")), description="JWT token expiration in minutes")
    DATABASE_URL: str = Field(default=os.getenv("DATABASE_URL", "sqlite:///./allesinda.db"), description="Database connection URL")
    
    # Stripe Configuration
    STRIPE_SECRET_KEY: Optional[str] = Field(default=os.getenv("STRIPE_SECRET_KEY"), description="Stripe secret key")
    STRIPE_PUBLISHABLE_KEY: Optional[str] = Field(default=os.getenv("STRIPE_PUBLISHABLE_KEY"), description="Stripe publishable key")
    STRIPE_WEBHOOK_SECRET: Optional[str] = Field(default=os.getenv("STRIPE_WEBHOOK_SECRET"), description="Stripe webhook secret")
    STRIPE_COMMISSION_RATE: float = Field(default=float(os.getenv("STRIPE_COMMISSION_RATE", "0.10")), description="Platform commission rate (0.10 = 10%)")
    
    # File Storage
    UPLOAD_FOLDER: str = Field(default=os.getenv("UPLOAD_FOLDER", "uploads"), description="Local folder path for storing uploaded media files")
    MEDIA_URL_PREFIX: str = Field(default=os.getenv("MEDIA_URL_PREFIX", "/media/files"), description="URL prefix for serving uploaded media files")
    BASE_URL: Optional[str] = Field(default=os.getenv("BASE_URL"), description="Canonical API URL (e.g., https://api.allesinda.de). Used for media URLs and production host redirects.")
    S3_BUCKET_NAME: Optional[str] = Field(default=os.getenv("S3_BUCKET_NAME"), description="S3 bucket name for media storage")
    S3_REGION: Optional[str] = Field(default=os.getenv("S3_REGION", "us-east-1"), description="S3 region")
    CDN_URL: Optional[str] = Field(default=os.getenv("CDN_URL"), description="CDN URL for media delivery")
    
    # Email/SMS (optional for MVP)
    SMTP_HOST: Optional[str] = Field(default=os.getenv("SMTP_HOST"), description="SMTP server host")
    SMTP_PORT: int = Field(default=int(os.getenv("SMTP_PORT", "587")), description="SMTP server port")
    SMTP_USER: Optional[str] = Field(default=os.getenv("SMTP_USER"), description="SMTP username")
    SMTP_PASSWORD: Optional[str] = Field(default=os.getenv("SMTP_PASSWORD"), description="SMTP password")
    
    # SMS Configuration
    SMS_ENABLED: bool = Field(default=os.getenv("SMS_ENABLED", "false").lower() == "true", description="Enable SMS notifications")
    SMS_PROVIDER: Optional[str] = Field(default=os.getenv("SMS_PROVIDER"), description="SMS provider: twilio, local, etc.")
    TWILIO_ACCOUNT_SID: Optional[str] = Field(default=os.getenv("TWILIO_ACCOUNT_SID"), description="Twilio account SID")
    TWILIO_AUTH_TOKEN: Optional[str] = Field(default=os.getenv("TWILIO_AUTH_TOKEN"), description="Twilio auth token")
    TWILIO_FROM_NUMBER: Optional[str] = Field(default=os.getenv("TWILIO_FROM_NUMBER"), description="Twilio from phone number")
    
    # CORS
    @staticmethod
    def _parse_cors_origins(value: Optional[str]) -> list[str]:
        """Parse CORS origins from environment variable, handling whitespace and development defaults"""
        if not value:
            # In development, allow all common localhost ports
            if not IS_PRODUCTION:
                return [
                    "http://localhost:3000",
                    "http://localhost:3001",
                    "http://localhost:5173",  # Vite default
                    "http://localhost:5174",
                    "http://localhost:8080",
                    "http://127.0.0.1:3000",
                    "http://127.0.0.1:3001",
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:8080",
                ]
            return ["http://localhost:3000"]
        
        # Split by comma and strip whitespace
        origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        
        # In development, always include common localhost origins
        if not IS_PRODUCTION:
            default_origins = [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:8080",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:8080",
            ]
            # Merge and deduplicate
            all_origins = list(set(origins + default_origins))
            return all_origins
        
        return origins
    
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: Settings._parse_cors_origins(os.getenv("CORS_ORIGINS")),
        description="Allowed CORS origins"
    )
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = Field(default=int(os.getenv("DEFAULT_PAGE_SIZE", "20")), description="Default pagination page size")
    MAX_PAGE_SIZE: int = Field(default=int(os.getenv("MAX_PAGE_SIZE", "100")), description="Maximum pagination page size")
    
    # Geo-location
    ENABLE_POSTGIS: bool = Field(default=os.getenv("ENABLE_POSTGIS", "false").lower() == "true", description="Enable PostGIS for geo-location features")
    
    # Search alerts
    ENABLE_SEARCH_ALERTS: bool = Field(
        default=os.getenv("ENABLE_SEARCH_ALERTS", "true").lower() == "true",
        description="Send alerts to nearby craftsmen when clients perform localized searches"
    )
    SEARCH_ALERT_COOLDOWN_MINUTES: int = Field(
        default=int(os.getenv("SEARCH_ALERT_COOLDOWN_MINUTES", "60")),
        description="Minimum minutes between search alerts delivered to the same craftsman"
    )
    SEARCH_ALERT_MAX_RECIPIENTS: int = Field(
        default=int(os.getenv("SEARCH_ALERT_MAX_RECIPIENTS", "25")),
        description="Maximum number of craftsmen to notify per localized search"
    )
    
    # OAuth/Social Login
    GOOGLE_CLIENT_ID: Optional[str] = Field(default=os.getenv("GOOGLE_CLIENT_ID"), description="Google OAuth client ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default=os.getenv("GOOGLE_CLIENT_SECRET"), description="Google OAuth client secret")
    FACEBOOK_CLIENT_ID: Optional[str] = Field(default=os.getenv("FACEBOOK_CLIENT_ID"), description="Facebook OAuth client ID")
    FACEBOOK_CLIENT_SECRET: Optional[str] = Field(default=os.getenv("FACEBOOK_CLIENT_SECRET"), description="Facebook OAuth client secret")
    
    # Frontend URL for email verification and password reset links
    FRONTEND_URL: str = Field(default=os.getenv("FRONTEND_URL", "http://localhost:3000"), description="Frontend URL for email links")

    # Complaints / trust team inbox
    TRUST_EMAIL: str = Field(
        default=os.getenv("TRUST_EMAIL", "trust@allesinda.de"),
        description="Email address for user complaints and trust reports",
    )

    # Web Push (optional, for PWA push when app is closed)
    VAPID_PUBLIC_KEY: Optional[str] = Field(default=os.getenv("VAPID_PUBLIC_KEY"), description="VAPID public key for Web Push")
    VAPID_PRIVATE_KEY: Optional[str] = Field(default=os.getenv("VAPID_PRIVATE_KEY"), description="VAPID private key for Web Push")
    
    # Email verification token expiration (hours)
    VERIFICATION_TOKEN_EXPIRE_HOURS: int = Field(default=int(os.getenv("VERIFICATION_TOKEN_EXPIRE_HOURS", "24")), description="Email verification token expiration in hours")
    
    # Password reset token expiration (hours)
    RESET_TOKEN_EXPIRE_HOURS: int = Field(default=int(os.getenv("RESET_TOKEN_EXPIRE_HOURS", "1")), description="Password reset token expiration in hours")
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = Field(default=os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true", description="Enable rate limiting")
    RATE_LIMIT_PER_MINUTE: int = Field(default=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")), description="Requests per minute per IP")
    RATE_LIMIT_PER_HOUR: int = Field(default=int(os.getenv("RATE_LIMIT_PER_HOUR", "1000")), description="Requests per hour per IP")
    
    # Logging
    LOG_LEVEL: str = Field(default=os.getenv("LOG_LEVEL", "INFO").upper(), description="Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    
    # Database Seeding
    SEED_DB_ON_START: bool = Field(default=os.getenv("SEED_DB_ON_START", "false").lower() == "true", description="Seed database with sample data on startup (resets database first if enabled, development only)")
    SEED_CREATE_MEDIA_FILES: bool = Field(default=os.getenv("SEED_CREATE_MEDIA_FILES", "false").lower() == "true", description="Create actual placeholder image files when seeding (requires Pillow)")

settings = Settings()
