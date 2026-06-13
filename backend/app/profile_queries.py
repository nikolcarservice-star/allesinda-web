"""Profile query helpers for legacy databases missing newer User columns."""

from sqlalchemy.orm import Query, Session, contains_eager, joinedload, load_only

from .models import Category, Profile, User

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
