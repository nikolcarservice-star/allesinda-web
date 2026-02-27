/**
 * Web Push API – VAPID public key and subscription registration for PWA push notifications
 */

import { apiGet, apiPost } from './client';

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

/**
 * Get VAPID public key from backend (used by service worker to subscribe)
 */
export async function getVapidPublicKey(): Promise<{ publicKey: string }> {
  return apiGet<{ publicKey: string }>('/push/vapid-public-key');
}

/**
 * Register push subscription for the current user so server can send push when new message arrives
 */
export async function registerPushSubscription(subscription: PushSubscriptionPayload): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/push/subscribe', subscription);
}
