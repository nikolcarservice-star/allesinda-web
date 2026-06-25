"""Profile query helpers for legacy databases missing newer User columns."""

from typing import Optional

from sqlalchemy.orm import Query, Session, contains_eager, joinedload, load_only

from .models import Category, Profile, Role, User

# Columns required by listing/detail serializers; omit deletion_requested_at for old DBs.
USER_COLUMNS_FOR_LISTING = (
    User.id,
    User.email,
    User.phone,
    User.name,
    User.role,
    User.is_active,
)


def profile_query_with_user(
    db: Session,
    *,
    with_city: bool = True,
    with_category: bool = False,
) -> Query:
    """Join users once and load only columns that exist on all deployed databases."""
    query = db.query(Profile).join(Profile.user).options(
        contains_eager(Profile.user).load_only(*USER_COLUMNS_FOR_LISTING),
    )
    if with_city:
        query = query.options(joinedload(Profile.city_ref))
    if with_category:
        query = query.options(
            joinedload(Profile.category_ref).joinedload(Category.parent),
        )
    return query


def apply_public_master_filters(query: Query) -> Query:
    """Restrict to profiles owned by active master users (exclude clients/sellers/admins)."""
    return query.filter(
        User.role == Role.master,
        User.is_active.is_(True),
    )


def public_master_profile_query(
    db: Session,
    *,
    with_city: bool = True,
    with_category: bool = False,
) -> Query:
    """Profile query for public master listings and detail pages."""
    return apply_public_master_filters(
        profile_query_with_user(db, with_city=with_city, with_category=with_category)
    )


def get_public_master_profile(
    db: Session,
    profile_id: int,
    *,
    with_category: bool = False,
) -> Optional[Profile]:
    """Load a single profile only if it belongs to an active master."""
    return (
        public_master_profile_query(db, with_category=with_category)
        .filter(Profile.id == profile_id)
        .first()
    )


def is_public_master_profile(profile: Optional[Profile]) -> bool:
    """True when profile belongs to an active master account."""
    if profile is None:
        return False
    user = getattr(profile, "user", None)
    if user is None:
        return False
    return user.role == Role.master and bool(user.is_active)
