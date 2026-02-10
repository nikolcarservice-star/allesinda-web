/**
 * Payments API functions
 */

import { apiPost } from './client';
import type { CheckoutSessionCreate, CheckoutSession } from './types';

/**
 * Create Stripe Checkout Session for an order
 */
export async function createCheckoutSession(data: CheckoutSessionCreate): Promise<CheckoutSession> {
  return apiPost<CheckoutSession>('/payments/checkout/session', data);
}

