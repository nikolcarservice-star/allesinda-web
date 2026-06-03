from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, Float, Boolean, Text, Enum, DateTime, func, Numeric, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
import enum
from typing import Optional, List
from .database import Base
from sqlalchemy import UniqueConstraint

class Role(str, enum.Enum):
    client = "client"
    master = "master"
    seller = "seller"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Nullable for social login
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.client, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    suspended_until: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True, deferred=True
    )

    # Email verification
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    verification_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    verification_token_expires: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Password reset
    reset_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    reset_token_expires: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Two-factor authentication
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    two_factor_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    backup_codes: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)  # JSON array of codes
    
    # Social login
    social_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)  # google, facebook, etc.
    social_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    
    # Soft-delete: deferred so legacy DBs without this column can still log in / list profiles
    deletion_requested_at: Mapped[Optional[DateTime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True, deferred=True
    )

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    profile: Mapped[Optional["Profile"]] = relationship(back_populates="user", uselist=False)
    orders_as_buyer: Mapped[List["Order"]] = relationship("Order", foreign_keys="Order.buyer_id", back_populates="buyer")
    orders_as_seller: Mapped[List["Order"]] = relationship("Order", foreign_keys="Order.seller_id", back_populates="seller")
    products: Mapped[List["Product"]] = relationship(back_populates="seller")
    rentals: Mapped[List["Rental"]] = relationship(back_populates="lessor")
    media: Mapped[List["Media"]] = relationship(back_populates="owner")
    recently_viewed_items: Mapped[List["RecentlyViewedItem"]] = relationship(
        "RecentlyViewedItem",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    conversations_as_buyer: Mapped[List["Conversation"]] = relationship("Conversation", foreign_keys="Conversation.buyer_id", back_populates="buyer")
    conversations_as_seller: Mapped[List["Conversation"]] = relationship("Conversation", foreign_keys="Conversation.seller_id", back_populates="seller")

class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    # Normalized city reference
    city_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cities.id"), nullable=True, index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(11, 8), nullable=True)
    about: Mapped[Optional[str]] = mapped_column(Text())
    image_url: Mapped[Optional[str]] = mapped_column(String(1024))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)  # Category ID (foreign key)
    # Optional free-form keywords to improve search and discovery (e.g. "Elektriker, Notdienst, Berlin")
    keywords: Mapped[Optional[str]] = mapped_column(Text())
    # Free-text profession label shown on profile (e.g. Elektriker, Schneider)
    profession: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    response_time_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="profile")
    city_ref: Mapped[Optional["City"]] = relationship("City")
    category_ref: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[category_id])
    services: Mapped[List["Service"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    availability_slots: Mapped[List["AvailabilitySlot"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    promotions: Mapped[List["Promotion"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_profile_location', 'latitude', 'longitude'),
    )

class Service(Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text())
    price_from: Mapped[float] = mapped_column(Float, default=0.0)
    approved: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Profile] = relationship(back_populates="services")

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text())
    price: Mapped[float] = mapped_column(Float)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    # Normalized city reference
    city_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cities.id"), nullable=True, index=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1024))
    brand: Mapped[Optional[str]] = mapped_column(String(100))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)  # Category ID (foreign key)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    approved: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    seller: Mapped[User] = relationship(back_populates="products")
    city_ref: Mapped[Optional["City"]] = relationship("City")
    category_ref: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[category_id])
    media: Mapped[List["Media"]] = relationship("Media", foreign_keys="Media.product_id", back_populates="product", cascade="all, delete-orphan", order_by="Media.sort_order")

class Rental(Base):
    __tablename__ = "rentals"
    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text())
    price_per_day: Mapped[float] = mapped_column(Float)
    stock: Mapped[int] = mapped_column(Integer, default=1)
    available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # Normalized city reference
    city_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cities.id"), nullable=True, index=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1024))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)  # Category ID (foreign key)
    approved: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lessor: Mapped[User] = relationship(back_populates="rentals")
    city_ref: Mapped[Optional["City"]] = relationship("City")
    category_ref: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[category_id])
    media: Mapped[List["Media"]] = relationship("Media", foreign_keys="Media.rental_id", back_populates="rental", cascade="all, delete-orphan", order_by="Media.sort_order")

class MediaStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class Media(Base):
    __tablename__ = "media"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    profile_id: Mapped[Optional[int]] = mapped_column(ForeignKey("profiles.id"), nullable=True, index=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    rental_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rentals.id"), nullable=True, index=True)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"), nullable=True)
    url: Mapped[str] = mapped_column(String(1024))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1024))
    media_type: Mapped[str] = mapped_column(String(50), index=True)  # photo or video
    status: Mapped[MediaStatus] = mapped_column(Enum(MediaStatus), default=MediaStatus.approved, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text())
    # Before/After support for work gallery
    before_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # Before photo URL
    after_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # After photo URL
    is_before_after: Mapped[bool] = mapped_column(Boolean, default=False, index=True)  # True if this is a before/after pair
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)  # Category ID (foreign key)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)  # For ordering multiple media items
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped[User] = relationship(back_populates="media")
    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id], back_populates="media")
    rental: Mapped[Optional["Rental"]] = relationship("Rental", foreign_keys=[rental_id], back_populates="media")
    category_ref: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[category_id])

class OrderType(str, enum.Enum):
    service = "service"
    product = "product"
    rental = "rental"

class OrderStatus(str, enum.Enum):
    created = "created"
    paid = "paid"
    completed = "completed"
    canceled = "canceled"

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("services.id"), nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    rental_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rentals.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    commission: Mapped[float] = mapped_column(Float, default=0.0)
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType), index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.created, index=True)
    payment_intent_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_account_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    scheduled_date: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(500))
    notes: Mapped[Optional[str]] = mapped_column(Text())
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

    buyer: Mapped[User] = relationship("User", foreign_keys=[buyer_id], back_populates="orders_as_buyer")
    seller: Mapped[User] = relationship("User", foreign_keys=[seller_id], back_populates="orders_as_seller")
    review: Mapped[Optional["Review"]] = relationship(back_populates="order", uselist=False)

class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True, index=True)
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    text: Mapped[Optional[str]] = mapped_column(Text())
    master_response: Mapped[Optional[str]] = mapped_column(Text())
    report_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    report_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    reported_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    reported_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="review")

class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"), nullable=True, index=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    last_message_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    buyer: Mapped[User] = relationship("User", foreign_keys=[buyer_id], back_populates="conversations_as_buyer")
    seller: Mapped[User] = relationship("User", foreign_keys=[seller_id], back_populates="conversations_as_seller")
    messages: Mapped[List["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text())
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    attachments: Mapped[List["MessageAttachment"]] = relationship(
        "MessageAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageAttachment.created_at"
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id"), index=True)
    file_url: Mapped[str] = mapped_column(String(1024))
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    message: Mapped[Message] = relationship("Message", back_populates="attachments")

# New models for missing features

class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    start_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Profile] = relationship(back_populates="availability_slots")

class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    start_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), index=True)
    end_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), index=True)
    payment_intent_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Profile] = relationship(back_populates="promotions")

class Favorite(Base):
    __tablename__ = "favorites"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Type of favorite: profile, product, or rental
    favorite_type: Mapped[str] = mapped_column(String(50), index=True)  # "profile", "product", "rental"
    favorite_id: Mapped[int] = mapped_column(Integer, index=True)  # ID of the favorited item
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_favorite_unique', 'user_id', 'favorite_type', 'favorite_id', unique=True),
    )

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(50), index=True)  # "order", "message", "review", "system"
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text())
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    related_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)  # ID of related order, message, etc.
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    __table_args__ = (
        Index('idx_notification_user_unread', 'user_id', 'is_read', 'created_at'),
    )


class PushSubscription(Base):
    """Web Push subscription for PWA (e.g. Add to Home Screen) – server sends push when user gets new message."""
    __tablename__ = "push_subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(String(2048), unique=True, index=True)
    p256dh: Mapped[str] = mapped_column(String(512))
    auth: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_push_subscriptions_user_id", "user_id"),)


class UserReport(Base):
    """User complaint / report (e.g. from chat)."""
    __tablename__ = "user_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    reported_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    conversation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("conversations.id"), nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(64), index=True)
    details: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="in_review", index=True)
    violation_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    action_taken: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    admin_note: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    resolved_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class BlockedUser(Base):
    __tablename__ = "blocked_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    blocker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    blocked_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    blocker: Mapped[User] = relationship("User", foreign_keys=[blocker_id])
    blocked: Mapped[User] = relationship("User", foreign_keys=[blocked_id])

    __table_args__ = (
        UniqueConstraint('blocker_id', 'blocked_id', name='uq_blocked_user_pair'),
    )

class CategoryType(str, enum.Enum):
    master = "master"
    product = "product"
    rental = "rental"

class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)  # Not globally unique - can be same across types
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)  # URL-friendly identifier
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), index=True)  # master, product, or rental
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # Category image URL
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)  # For ordering categories
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent: Mapped[Optional["Category"]] = relationship(
        "Category",
        remote_side=lambda: Category.id,
        back_populates="children",
    )
    children: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Category.sort_order",
        foreign_keys="Category.parent_id",
    )
    
    __table_args__ = (
        Index('idx_category_type_active', 'type', 'is_active', 'sort_order'),
        Index('idx_category_parent', 'parent_id', 'sort_order'),
        # Unique constraint: name must be unique within the same type and parent
        # This allows same subcategory names across different types (e.g., "Drills" in Product and Master)
        UniqueConstraint('name', 'type', 'parent_id', name='uq_category_name_type_parent'),
    )


class ItemRelationship(Base):
    __tablename__ = "item_relationships"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), index=True)
    source_id: Mapped[int] = mapped_column(Integer, index=True)
    target_type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), index=True)
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "source_id",
            "target_type",
            "target_id",
            name="uq_item_relationship_pair",
        ),
        Index("ix_item_relationship_source", "source_type", "source_id"),
        Index("ix_item_relationship_target", "target_type", "target_id"),
    )


class RecentlyViewedItem(Base):
    __tablename__ = "recently_viewed_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), index=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    viewed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped["User"] = relationship("User", back_populates="recently_viewed_items")

    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_recently_viewed_unique"),
        Index("ix_recently_viewed_item", "item_type", "item_id", "viewed_at"),
    )


class FeaturedItem(Base):
    __tablename__ = "featured_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_type: Mapped[CategoryType] = mapped_column(Enum(CategoryType), index=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("item_type", "item_id", name="uq_featured_item_unique"),
        Index("ix_featured_item_priority", "item_type", "is_active", "priority"),
    )


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Official city name (UTF-8, includes diacritics)
    name: Mapped[str] = mapped_column(String(150), index=True)
    # Optional admin division (Bundesland)
    state: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 8))
    longitude: Mapped[float] = mapped_column(Numeric(11, 8))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("name", "state", name="uq_city_name_state"),
        Index("ix_city_name", "name"),
    )
