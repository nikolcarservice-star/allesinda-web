/**
 * Promotions API functions
 */

import { apiGet, apiPost, apiDelete } from './client';
import type { Promotion, PromotionInput, PaginatedResponse } from './types';

/**
 * Create promotion
 */
export async function createPromotion(data: PromotionInput): Promise<Promotion> {
  return apiPost<Promotion>('/masters/me/promotions', data);
}

/**
 * Get current user's promotions
 */
export async function getMyPromotions(): Promise<Promotion[]> {
  const response = await apiGet<PaginatedResponse<Promotion>>('/masters/me/promotions');
  return response.items || [];
}

/**
 * Delete promotion
 */
export async function deletePromotion(promotionId: number): Promise<void> {
  return apiDelete<void>(`/masters/me/promotions/${promotionId}`);
}

