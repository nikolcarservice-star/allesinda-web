from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Literal, Any, Dict
from datetime import datetime
from .models import Role, OrderType, OrderStatus, MediaStatus, CategoryType
from pydantic import condecimal

# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    name: str = Field(..., min_length=2, max_length=255)
    role: Role
    phone: Optional[str] = Field(None, max_length=20)
    # Optional master profile fields (used when role == master)
    category_id: Optional[int] = Field(None, ge=1, description="Master category_id (optional)")
    keywords: Optional[str] = Field(None, description="Optional comma-separated keywords for master")

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: Role
    phone: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None

class UserSelfUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)

class AccountDeletionIn(BaseModel):
    password: str = Field(..., min_length=1)
    confirmation: str = Field(..., description="Type LÖSCHEN to confirm")

class AccountDeletionOut(BaseModel):
    message: str
    recovery_until: datetime

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    two_factor_code: Optional[str] = Field(None, max_length=6, description="2FA code if 2FA is enabled")

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

class VerifyEmailIn(BaseModel):
    token: str

class ResendVerificationIn(BaseModel):
    email: EmailStr

class TwoFactorSetupOut(BaseModel):
    secret: str
    qr_code_url: str
    backup_codes: List[str]

class TwoFactorVerifyIn(BaseModel):
    code: str = Field(..., max_length=6, description="2FA verification code")

class TwoFactorDisableIn(BaseModel):
    password: str
    code: str = Field(..., max_length=6)

class SocialLoginIn(BaseModel):
    provider: str = Field(..., description="Social provider: google, facebook, etc.")
    access_token: str = Field(..., description="OAuth access token from provider")

# Profile Schemas
class ProfileIn(BaseModel):
    city_id: Optional[int] = Field(None, ge=1)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    about: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=1024)
    category_id: Optional[int] = Field(None, ge=1, description="Category ID (foreign key)")
    keywords: Optional[str] = Field(None, description="Optional comma-separated keywords describing the master")
    profession: Optional[str] = Field(None, max_length=255, description="Profession label, e.g. Elektriker")
    response_time_hours: Optional[int] = Field(None, ge=0, le=168)

class ProfileOut(ProfileIn):
    id: int
    user_id: int
    verified: bool
    rating: float
    total_reviews: int
    completed_jobs: int
    created_at: datetime
    updated_at: datetime
    city_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class MasterCabinetIn(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    city_id: Optional[int] = Field(None, ge=1)
    about: Optional[str] = None
    category_id: Optional[int] = Field(None, ge=1)
    keywords: Optional[str] = None
    profession: Optional[str] = Field(None, max_length=255)
    price_from: Optional[float] = Field(None, ge=0)

class MasterCabinetOut(BaseModel):
    user: UserOut
    profile: ProfileOut
    price_from: Optional[float] = None

class ProfileDetailedOut(ProfileOut):
    user: UserOut
    services: List["ServiceOut"]
    
    class Config:
        from_attributes = True

# Service Schemas
class ServiceIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price_from: float = Field(..., ge=0)

class ServiceOut(ServiceIn):
    id: int
    profile_id: int
    created_at: datetime
    profile: Optional[ProfileOut] = None  # Include profile for image_url
    
    class Config:
        from_attributes = True

# Product Schemas
class ProductIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, description="Product description is required")
    price: float = Field(..., ge=0)
    stock: int = Field(0, ge=0)
    city_id: Optional[int] = Field(None, ge=1)
    image_url: Optional[str] = Field(None, max_length=1024)
    brand: Optional[str] = Field(None, max_length=100)
    category_id: int = Field(..., ge=1, description="Category ID (foreign key) - required")

class ProductOut(ProductIn):
    id: int
    seller_id: int
    rating: float
    total_reviews: int
    created_at: datetime
    updated_at: datetime
    media: Optional[List["MediaOut"]] = None  # Multiple images/videos
    
    class Config:
        from_attributes = True

# Rental Schemas
class RentalIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, description="Rental description is required")
    price_per_day: float = Field(..., ge=0)
    stock: int = Field(1, ge=0)
    available: bool = True
    city_id: Optional[int] = Field(None, ge=1)
    image_url: Optional[str] = Field(None, max_length=1024)
    category_id: int = Field(..., ge=1, description="Category ID (foreign key) - required")

class RentalOut(RentalIn):
    id: int
    seller_id: int
    created_at: datetime
    updated_at: datetime
    media: Optional[List["MediaOut"]] = None  # Multiple images/videos
    
    class Config:
        from_attributes = True

# Trending Schemas
class TrendingItemOut(BaseModel):
    id: int
    type: CategoryType
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    rating: Optional[float] = None
    total_reviews: Optional[int] = None
    price: Optional[float] = None
    price_per_day: Optional[float] = None
    likes_count: int = 0
    sold_count: int = 0
    city_id: Optional[int] = None
    city_name: Optional[str] = None
    category_id: Optional[int] = None
    completed_jobs: Optional[int] = None

    class Config:
        from_attributes = True

# Media Schemas
class MediaIn(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    profile_id: Optional[int] = None
    product_id: Optional[int] = None
    rental_id: Optional[int] = None
    order_id: Optional[int] = None
    before_url: Optional[str] = Field(None, max_length=1024, description="Before photo URL for before/after pairs")
    after_url: Optional[str] = Field(None, max_length=1024, description="After photo URL for before/after pairs")
    is_before_after: bool = Field(False, description="True if this is a before/after pair")
    category_id: Optional[int] = Field(None, ge=1, description="Category ID (foreign key)")
    sort_order: int = Field(0, ge=0, description="Order for sorting multiple media items")

class MediaOut(BaseModel):
    id: int
    owner_id: int
    profile_id: Optional[int]
    product_id: Optional[int]
    rental_id: Optional[int]
    order_id: Optional[int]
    url: str
    thumbnail_url: Optional[str]
    media_type: str
    status: MediaStatus
    title: Optional[str]
    description: Optional[str]
    before_url: Optional[str]
    after_url: Optional[str]
    is_before_after: bool
    category_id: Optional[int]
    sort_order: int
    created_at: datetime
    reviewed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Featured Schemas
class RelatedItemSummary(BaseModel):
    relationship_id: int
    id: int
    type: CategoryType
    title: str
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class FeaturedItemOut(BaseModel):
    id: int
    type: CategoryType
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    rating: Optional[float] = None
    total_reviews: Optional[int] = None
    price: Optional[float] = None
    price_per_day: Optional[float] = None
    likes_count: Optional[int] = 0
    city_id: Optional[int] = None
    city_name: Optional[str] = None
    category_id: Optional[int] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None
    relationships: List[RelatedItemSummary] = Field(default_factory=list)

    class Config:
        from_attributes = True


class FeaturedDetailOut(FeaturedItemOut):
    services: List["ServiceOut"] = Field(default_factory=list)
    portfolio: List["MediaOut"] = Field(default_factory=list)
    media: List["MediaOut"] = Field(default_factory=list)
    stock: Optional[int] = None
    brand: Optional[str] = None
    available: Optional[bool] = None
    extra: Optional[Dict[str, Any]] = None


class FeaturedSelectionBase(BaseModel):
    item_type: CategoryType
    item_id: int = Field(..., ge=1)
    priority: int = Field(0, ge=0, description="Higher numbers appear first")
    is_active: bool = True


class FeaturedSelectionCreate(FeaturedSelectionBase):
    pass


class FeaturedSelectionUpdate(BaseModel):
    priority: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class FeaturedSelectionOut(FeaturedSelectionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    item: Optional[FeaturedItemOut] = None

    class Config:
        from_attributes = True


class HomeContentOut(BaseModel):
    featured_subcategories: List["CategoryOut"] = Field(default_factory=list)
    work_gallery: List["MediaOut"] = Field(default_factory=list)
    recently_viewed: List[FeaturedItemOut] = Field(default_factory=list)


class ItemRelationshipIn(BaseModel):
    source_type: CategoryType
    source_id: int
    target_type: CategoryType
    target_id: int

    @validator("target_id")
    def validate_distinct_items(cls, v, values):
        source_type = values.get("source_type")
        source_id = values.get("source_id")
        target_type = values.get("target_type")
        if source_type is not None and source_id is not None and target_type is not None:
            if source_type == target_type and source_id == v:
                raise ValueError("source and target cannot reference the same item")
        return v


class ItemRelationshipOut(BaseModel):
    id: int
    source_type: CategoryType
    source_id: int
    target_type: CategoryType
    target_id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Order Schemas
class OrderIn(BaseModel):
    seller_id: int
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    rental_id: Optional[int] = None
    amount: float = Field(..., ge=0)
    order_type: OrderType
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = None
    
    @validator('service_id', 'product_id', 'rental_id')
    def validate_order_type(cls, v, values):
        order_type = values.get('order_type')
        if order_type == OrderType.service and not values.get('service_id'):
            raise ValueError('service_id is required for service orders')
        if order_type == OrderType.product and not values.get('product_id'):
            raise ValueError('product_id is required for product orders')
        if order_type == OrderType.rental and not values.get('rental_id'):
            raise ValueError('rental_id is required for rental orders')
        return v

class OrderOut(BaseModel):
    id: int
    buyer_id: int
    seller_id: int
    service_id: Optional[int]
    product_id: Optional[int]
    rental_id: Optional[int]
    amount: float
    commission: float
    order_type: OrderType
    status: OrderStatus
    payment_intent_id: Optional[str]
    scheduled_date: Optional[datetime]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    # Related data for bookings display
    seller: Optional[UserOut] = None
    service: Optional[ServiceOut] = None
    product: Optional[ProductOut] = None
    rental: Optional[RentalOut] = None
    
    class Config:
        from_attributes = True

class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None

# Review Schemas
class ReviewIn(BaseModel):
    order_id: int
    rating: int = Field(..., ge=1, le=5)
    text: Optional[str] = None

class ReviewOut(ReviewIn):
    id: int
    master_response: Optional[str] = None
    report_reason: Optional[str] = None
    report_status: Optional[str] = None
    reported_by_id: Optional[int] = None
    reported_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReviewReplyIn(BaseModel):
    response: str = Field(..., min_length=1, max_length=1000)

class ReviewReportIn(BaseModel):
    reason: Literal["Falsche Angaben", "Beleidigung", "Spam"]

class ReviewReportStatusIn(BaseModel):
    status: Literal["removed", "rejected"]

class UserReportIn(BaseModel):
    reason: Literal["Belästigung", "Betrug", "Spam", "Unangemessene Inhalte", "Sonstiges"]
    details: Optional[str] = Field(None, max_length=2000)

class UserReportOut(BaseModel):
    id: int
    reporter_id: int
    reported_user_id: int
    conversation_id: Optional[int] = None
    reason: str
    details: Optional[str] = None
    status: str
    violation_type: Optional[str] = None
    action_taken: Optional[str] = None
    admin_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    prior_reports_count: Optional[int] = None
    created_at: datetime
    reporter_name: Optional[str] = None
    reported_user_name: Optional[str] = None

    class Config:
        from_attributes = True


class UserReportResolveIn(BaseModel):
    violation_type: Literal["first_minor", "repeated", "fraud", "threats"]
    action: Literal["warning", "block_7d", "block_permanent", "block_immediate", "rejected"]
    admin_note: Optional[str] = Field(None, max_length=2000)

class ReviewListOut(ReviewOut):
    buyer_name: Optional[str] = None

class ReviewDetailedOut(ReviewOut):
    order: OrderOut
    
    class Config:
        from_attributes = True

# Conversation Schemas
class ConversationOut(BaseModel):
    id: int
    order_id: Optional[int]
    buyer_id: int
    seller_id: int
    last_message_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Enhanced Conversation Schema for frontend
class ConversationDetailOut(BaseModel):
    id: int
    name: str
    avatar: Optional[str]
    lastMessage: str
    timestamp: str
    unread: int
    online: bool
    profession: str
    buyer_id: int
    seller_id: int
    order_id: Optional[int]
    created_at: datetime
    lastMessageRead: Optional[bool] = True
    lastMessageSenderId: Optional[int] = None
    other_user_id: int
    other_user_email: Optional[str] = None
    other_user_phone: Optional[str] = None
    other_user_role: str
    other_profile_id: Optional[int] = None
    is_blocked: bool = False
    blocked_by_user_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class MessageAttachmentOut(BaseModel):
    id: int
    file_url: str
    file_name: str
    file_type: str
    file_size: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True

class MessageIn(BaseModel):
    body: str = Field(..., min_length=1)

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    body: str
    is_read: bool
    created_at: datetime
    attachments: List[MessageAttachmentOut] = []
    
    class Config:
        from_attributes = True

# Enhanced Message Schema for frontend
class MessageDetailOut(BaseModel):
    id: int
    sender: Literal["me", "them"]
    content: str
    timestamp: str
    conversation_id: int
    sender_id: int
    is_read: bool
    created_at: datetime
    attachments: List[MessageAttachmentOut] = []
    
    class Config:
        from_attributes = True

# Availability Slot Schemas
class AvailabilitySlotIn(BaseModel):
    start_time: datetime
    end_time: datetime
    is_available: bool = True
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

class AvailabilitySlotOut(AvailabilitySlotIn):
    id: int
    profile_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Promotion Schemas
class PromotionIn(BaseModel):
    start_date: datetime
    end_date: datetime
    
    @validator('end_date')
    def validate_date_range(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v

class PromotionOut(PromotionIn):
    id: int
    profile_id: int
    payment_intent_id: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Pagination Schemas
class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    
class PaginatedResponse(BaseModel):
    items: List[BaseModel]
    total: int
    page: int
    page_size: int
    total_pages: int
    
    @classmethod
    def create(cls, items: List[BaseModel], total: int, page: int, page_size: int):
        total_pages = (total + page_size - 1) // page_size
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

# Search Schemas
class SearchParams(BaseModel):
    q: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None  # Deprecated: category slug (for backward compatibility)
    category_id: Optional[int] = Field(None, ge=1, description="Category ID (preferred)")
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    verified_only: Optional[bool] = False
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, ge=0)
    sort_by: Optional[str] = Field("rating", pattern="^(rating|price|reviews|distance|created_at)$")
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$")

# Stripe Schemas
class CheckoutSessionCreate(BaseModel):
    order_id: int

class CheckoutSessionOut(BaseModel):
    id: str
    url: str

# Error Schemas
class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str

class ErrorResponse(BaseModel):
    detail: str | List[ErrorDetail]
    status_code: int

# Favorite Schemas
class FavoriteIn(BaseModel):
    favorite_type: str = Field(..., pattern="^(profile|product|rental)$", description="Type of favorite")
    favorite_id: int = Field(..., ge=1, description="ID of the favorited item")

class FavoriteOut(BaseModel):
    id: int
    user_id: int
    favorite_type: str
    favorite_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Notification Schemas
class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: str  # "order", "message", "review", "system"
    title: str
    message: str
    is_read: bool
    related_id: Optional[int] = None  # ID of related order, message, etc.
    created_at: datetime
    
    class Config:
        from_attributes = True

# Category Schemas
class CategoryIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly identifier")
    type: CategoryType = Field(..., description="Category type: master, product, or rental")
    description: Optional[str] = Field(None, description="Category description")
    image_url: Optional[str] = Field(None, max_length=1024, description="Category image URL")
    parent_id: Optional[int] = Field(None, description="Parent category ID for subcategories")
    sort_order: int = Field(0, ge=0, description="Order for sorting categories")
    is_active: bool = Field(True, description="Whether the category is active")

class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    type: CategoryType
    description: Optional[str]
    image_url: Optional[str]
    parent_id: Optional[int]
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=1024)
    parent_id: Optional[int] = Field(None, description="Parent category ID for subcategories")
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CategoryTreeOut(CategoryOut):
    children: List["CategoryTreeOut"] = Field(default_factory=list)

#
# City Schemas
#
class CityIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    state: Optional[str] = Field(None, max_length=150)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    is_active: bool = True

class CityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    state: Optional[str] = Field(None, max_length=150)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    is_active: Optional[bool] = None

class CityOut(BaseModel):
    id: int
    name: str
    state: Optional[str]
    latitude: float
    longitude: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

