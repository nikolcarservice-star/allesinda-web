from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..security import get_current_user
from ..models import User, Order, OrderStatus
from ..schemas import CheckoutSessionCreate, CheckoutSessionOut
from ..config import settings
from ..database import get_db
from ..helpers import calculate_commission
import stripe
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

# Initialize Stripe if secret key is provided
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/checkout/session", response_model=CheckoutSessionOut)
def create_checkout_session(
    data: CheckoutSessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe Checkout Session for an order"""
    # Get order
    order = db.get(Order, data.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order.status != OrderStatus.created:
        raise HTTPException(status_code=400, detail="Order already processed")
    
    if not settings.STRIPE_SECRET_KEY:
        # Demo mode - return mock session
        return {
            "id": "cs_demo_123",
            "url": "https://example.com/checkout-demo"
        }
    
    try:
        # Use FRONTEND_URL from settings instead of hardcoded URL
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        
        # Create Stripe Checkout Session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Order #{order.id}",
                        "description": f"{order.order_type.value} order"
                    },
                    "unit_amount": int(order.amount * 100)  # Convert to cents
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{frontend_url}/orders/{order.id}/success",
            cancel_url=f"{frontend_url}/orders/{order.id}/cancel",
            metadata={
                "order_id": str(order.id),
                "buyer_id": str(order.buyer_id),
                "seller_id": str(order.seller_id),
                "commission": str(order.commission)
            }
        )
        
        # Store session ID in order
        order.payment_intent_id = session.id
        db.commit()
        
        logger.info(f"Created checkout session {session.id} for order {order.id}")
        
        return {
            "id": session.id,
            "url": session.url
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")

def process_seller_payout(order: Order, db: Session):
    """Process seller payout after payment is received
    
    This function handles transferring funds to the seller minus the commission.
    For a marketplace, you would typically use Stripe Connect to transfer funds
    directly to the seller's connected account. For MVP, we'll simulate this.
    
    In production with Stripe Connect:
    1. Seller would have a connected Stripe account (stripe_account_id in Order model)
    2. Use stripe.Transfer.create() to transfer (amount - commission) to seller
    3. Platform keeps the commission
    """
    try:
        seller = db.get(User, order.seller_id)
        if not seller:
            logger.error(f"Seller {order.seller_id} not found for order {order.id}")
            return False
        
        # Calculate seller payout amount (order amount minus commission)
        seller_amount = order.amount - order.commission
        
        # In production with Stripe Connect:
        # if seller.stripe_account_id:
        #     transfer = stripe.Transfer.create(
        #         amount=int(seller_amount * 100),  # Convert to cents
        #         currency="eur",
        #         destination=seller.stripe_account_id,
        #         metadata={
        #             "order_id": str(order.id),
        #             "type": "seller_payout"
        #         }
        #     )
        #     logger.info(f"Transferred {seller_amount} EUR to seller {seller.id} for order {order.id}")
        # else:
        #     logger.warning(f"Seller {seller.id} has no Stripe account connected")
        
        # For MVP/demo: Just log the payout
        logger.info(
            f"Order {order.id}: Total={order.amount} EUR, "
            f"Commission={order.commission} EUR, "
            f"Seller Payout={seller_amount} EUR"
        )
        
        # TODO: In production, create a Payout record to track transfers
        # This would allow sellers to see their earnings and pending payouts
        
        return True
    except Exception as e:
        logger.error(f"Error processing seller payout for order {order.id}: {e}")
        return False

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks for payment events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not settings.STRIPE_WEBHOOK_SECRET:
        # Demo mode - accept without verification (NOT for production!)
        logger.warning("Stripe webhook secret not configured - accepting without verification")
        try:
            import json
            event = json.loads(payload)
        except:
            return {"ok": True}
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    logger.info(f"Received Stripe webhook event: {event_type}")
    
    try:
        # Handle checkout.session.completed - payment successful
        if event_type == "checkout.session.completed":
            session = event["data"]["object"]
            order_id = session.get("metadata", {}).get("order_id")
            
            if order_id:
                order = db.get(Order, int(order_id))
                if order:
                    # Update order status to paid
                    order.status = OrderStatus.paid
                    order.payment_intent_id = session.get("payment_intent") or session.get("id")
                    
                    # Process seller payout (transfer funds minus commission)
                    process_seller_payout(order, db)
                    
                    db.commit()
                    logger.info(f"Order {order.id} marked as paid via checkout session")
                else:
                    logger.warning(f"Order {order_id} not found for checkout session")
        
        # Handle payment_intent.succeeded - payment confirmed
        elif event_type == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            
            if order_id:
                order = db.get(Order, int(order_id))
                if order and order.status == OrderStatus.created:
                    order.status = OrderStatus.paid
                    order.payment_intent_id = payment_intent.get("id")
                    
                    # Process seller payout
                    process_seller_payout(order, db)
                    
                    db.commit()
                    logger.info(f"Order {order.id} marked as paid via payment intent")
        
        # Handle payment_intent.payment_failed - payment failed
        elif event_type == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            
            if order_id:
                order = db.get(Order, int(order_id))
                if order:
                    # Log payment failure but don't change order status
                    # Order remains in "created" status, buyer can retry
                    logger.warning(
                        f"Payment failed for order {order.id}: "
                        f"{payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')}"
                    )
                    # TODO: Send notification to buyer about payment failure
        
        # Handle charge.refunded - refund processed
        elif event_type == "charge.refunded":
            charge = event["data"]["object"]
            order_id = charge.get("metadata", {}).get("order_id")
            
            if order_id:
                order = db.get(Order, int(order_id))
                if order:
                    # Mark order as canceled if refunded
                    order.status = OrderStatus.canceled
                    db.commit()
                    logger.info(f"Order {order.id} refunded and marked as canceled")
        
        return {"ok": True}
    
    except Exception as e:
        logger.error(f"Error processing webhook event {event_type}: {e}", exc_info=True)
        # Return 200 to prevent Stripe from retrying
        return {"ok": True, "error": str(e)}
