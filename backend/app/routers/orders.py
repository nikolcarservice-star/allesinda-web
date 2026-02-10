from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import logging
from ..database import get_db
from datetime import datetime, timezone
from ..models import Order, OrderStatus, OrderType, User, Service, Product, Rental
from ..schemas import OrderIn, OrderOut, OrderUpdate, PaginationParams
from ..security import get_current_user
from ..helpers import paginate_query, create_paginated_response, calculate_commission
from ..utils.notifications import create_order_notification
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])

def load_order_relations(order: Order, db: Session):
    """Load related data for an order"""
    if order.service_id:
        service = db.query(Service).options(joinedload(Service.profile)).filter(Service.id == order.service_id).first()
        if service:
            order.service = service
    if order.product_id:
        product = db.get(Product, order.product_id)
        if product:
            order.product = product
    if order.rental_id:
        rental = db.get(Rental, order.rental_id)
        if rental:
            order.rental = rental
    return order

@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    data: OrderIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new order"""
    # Validate seller exists
    seller = db.get(User, data.seller_id)
    if not seller or not seller.is_active:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Validate order type specific entity exists
    if data.order_type == OrderType.service:
        if not data.service_id:
            raise HTTPException(status_code=400, detail="service_id required for service orders")
        service = db.get(Service, data.service_id)
        if not service or service.profile.user_id != data.seller_id:
            raise HTTPException(status_code=404, detail="Service not found or doesn't belong to seller")
        amount = service.price_from
    elif data.order_type == OrderType.product:
        if not data.product_id:
            raise HTTPException(status_code=400, detail="product_id required for product orders")
        product = db.get(Product, data.product_id)
        if not product or product.seller_id != data.seller_id:
            raise HTTPException(status_code=404, detail="Product not found or doesn't belong to seller")
        if product.stock < 1:
            raise HTTPException(status_code=400, detail="Product out of stock")
        amount = product.price
    elif data.order_type == OrderType.rental:
        if not data.rental_id:
            raise HTTPException(status_code=400, detail="rental_id required for rental orders")
        rental = db.get(Rental, data.rental_id)
        if not rental or rental.seller_id != data.seller_id:
            raise HTTPException(status_code=404, detail="Rental not found or doesn't belong to seller")
        if rental.stock < 1 or not rental.available:
            raise HTTPException(status_code=400, detail="Rental out of stock")
        amount = rental.price_per_day
    
    # Use provided amount or calculated amount
    if data.amount:
        amount = data.amount
    
    # Calculate commission
    commission = calculate_commission(amount)
    
    # Decrement stock for product orders
    if data.order_type == OrderType.product and product:
        product.stock -= 1
        if product.stock < 0:
            product.stock = 0
    
    if data.order_type == OrderType.rental and rental:
        rental.stock -= 1
        if rental.stock < 0:
            rental.stock = 0
        if rental.stock == 0:
            rental.available = False
    
    # Create order
    order = Order(
        buyer_id=user.id,
        seller_id=data.seller_id,
        service_id=data.service_id,
        product_id=data.product_id,
        rental_id=data.rental_id,
        amount=amount,
        commission=commission,
        order_type=data.order_type,
        scheduled_date=data.scheduled_date,
        location=data.location,
        notes=data.notes,
        status=OrderStatus.created
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Create notification for seller
    try:
        create_order_notification(
            db=db,
            user_id=data.seller_id,
            order_id=order.id,
            message=f"New {data.order_type.value} order from {user.name}",
            order_type=data.order_type.value
        )
    except Exception as e:
        # Don't fail order creation if notification fails
        pass
    
    # Load related data
    load_order_relations(order, db)
    
    return order

@router.get("", response_model=dict)
def my_orders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[OrderStatus] = None,
    order_type: Optional[OrderType] = None
):
    """Get user's orders (as buyer or seller)"""
    from sqlalchemy.orm import joinedload
    
    query = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(
        (Order.buyer_id == user.id) | (Order.seller_id == user.id)
    )
    
    if status:
        query = query.filter(Order.status == status)
    
    if order_type:
        query = query.filter(Order.order_type == order_type)
    
    query = query.order_by(Order.created_at.desc())
    
    items, total = paginate_query(query, page, page_size)
    
    # Load related service/product/rental data
    for order in items:
        load_order_relations(order, db)
    
    # Serialize orders to dictionaries with ISO format datetimes
    results = []
    for order in items:
        try:
            order_dict = {
                "id": order.id,
                "buyer_id": order.buyer_id,
                "seller_id": order.seller_id,
                "service_id": order.service_id,
                "product_id": order.product_id,
                "rental_id": order.rental_id,
                "amount": float(order.amount) if order.amount else 0.0,
                "commission": float(order.commission) if order.commission else 0.0,
                "order_type": order.order_type.value if hasattr(order.order_type, 'value') else str(order.order_type) if order.order_type else None,
                "status": order.status.value if hasattr(order.status, 'value') else str(order.status) if order.status else None,
                "payment_intent_id": order.payment_intent_id,
                "scheduled_date": order.scheduled_date.isoformat() if order.scheduled_date else None,
                "location": order.location,
                "notes": order.notes,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "updated_at": order.updated_at.isoformat() if order.updated_at else None,
                "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            }
            
            # Include related data
            if hasattr(order, 'seller') and order.seller:
                order_dict["seller"] = {
                    "id": order.seller.id,
                    "name": order.seller.name,
                    "email": order.seller.email,
                }
            if hasattr(order, 'buyer') and order.buyer:
                order_dict["buyer"] = {
                    "id": order.buyer.id,
                    "name": order.buyer.name,
                    "email": order.buyer.email,
                }
            if hasattr(order, 'service') and order.service:
                order_dict["service"] = {
                    "id": order.service.id,
                    "title": getattr(order.service, 'title', None),
                    "description": getattr(order.service, 'description', None),
                    "price_from": float(order.service.price_from) if hasattr(order.service, 'price_from') and order.service.price_from else 0.0,
                }
            if hasattr(order, 'product') and order.product:
                order_dict["product"] = {
                    "id": order.product.id,
                    "title": getattr(order.product, 'title', None),
                    "price": float(order.product.price) if hasattr(order.product, 'price') and order.product.price else 0.0,
                }
            if hasattr(order, 'rental') and order.rental:
                order_dict["rental"] = {
                    "id": order.rental.id,
                    "title": getattr(order.rental, 'title', None),
                    "price_per_day": float(order.rental.price_per_day) if hasattr(order.rental, 'price_per_day') and order.rental.price_per_day else 0.0,
                }
            
            results.append(order_dict)
        except Exception as e:
            # Log error but continue processing other orders
            logger.error(f"Error serializing order {order.id}: {str(e)}", exc_info=True)
            continue
    
    return create_paginated_response(results, total, page, page_size)

@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get order by ID"""
    from sqlalchemy.orm import joinedload
    
    order = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check user has access to this order
    if order.buyer_id != user.id and order.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Load related data
    load_order_relations(order, db)
    
    return order

@router.patch("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    data: OrderUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update order (only seller can update status)"""
    order = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only seller can update order status
    if order.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Only seller can update order")
    
    update_data = data.dict(exclude_unset=True)
    new_status = update_data.pop("status", None)

    for key, value in update_data.items():
        setattr(order, key, value)

    previous_status = order.status

    if new_status:
        if new_status == OrderStatus.completed:
            if previous_status != OrderStatus.paid:
                raise HTTPException(status_code=400, detail="Order must be paid before completion")

            order.status = OrderStatus.completed
            if not order.completed_at:
                order.completed_at = datetime.now(timezone.utc)

            # Update seller profile stats
            if order.seller_id:
                from ..models import Profile
                profile = db.query(Profile).filter(Profile.user_id == order.seller_id).first()
                if profile:
                    profile.completed_jobs += 1

        elif new_status == OrderStatus.canceled:
            if previous_status in (OrderStatus.completed, OrderStatus.canceled):
                raise HTTPException(status_code=400, detail="Completed or canceled orders cannot be canceled again")

            order.status = OrderStatus.canceled

            if order.order_type == OrderType.product and order.product_id:
                product = db.get(Product, order.product_id)
                if product:
                    product.stock += 1
            if order.order_type == OrderType.rental and order.rental_id:
                rental = db.get(Rental, order.rental_id)
                if rental:
                    rental.stock += 1
                    if rental.stock > 0 and not rental.available:
                        rental.available = True

        else:
            order.status = new_status
    
    db.commit()
    db.refresh(order)
    
    # Load related data
    load_order_relations(order, db)
    
    return order

@router.post("/{order_id}/complete", response_model=OrderOut)
def complete_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete an order (buyer or seller can complete)"""
    order = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.buyer_id != user.id and order.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order.status != OrderStatus.paid:
        raise HTTPException(status_code=400, detail="Order must be paid before completion")
    
    from datetime import datetime, timezone
    order.status = OrderStatus.completed
    order.completed_at = datetime.now(timezone.utc)
    
    # Update seller profile stats
    if order.seller_id:
        from ..models import Profile
        profile = db.query(Profile).filter(Profile.user_id == order.seller_id).first()
        if profile:
            profile.completed_jobs += 1
    
    db.commit()
    db.refresh(order)
    
    # Load related data
    load_order_relations(order, db)
    
    return order

@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel an order"""
    order = db.query(Order).options(
        joinedload(Order.seller),
        joinedload(Order.buyer)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.buyer_id != user.id and order.seller_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order.status in [OrderStatus.completed, OrderStatus.canceled]:
        raise HTTPException(status_code=400, detail="Order cannot be canceled")
    
    order.status = OrderStatus.canceled
    
    # Restore product stock if applicable
    if order.order_type == OrderType.product and order.product_id:
        product = db.get(Product, order.product_id)
        if product:
            product.stock += 1
    
    if order.order_type == OrderType.rental and order.rental_id:
        rental = db.get(Rental, order.rental_id)
        if rental:
            rental.stock += 1
            if rental.stock > 0 and not rental.available:
                rental.available = True
    
    db.commit()
    db.refresh(order)
    
    # Load related data
    load_order_relations(order, db)
    
    return order
