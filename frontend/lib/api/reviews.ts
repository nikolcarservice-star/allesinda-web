/**
 * Reviews API functions
 */

import { apiGet, apiPost } from './client';
import type { Review, ReviewInput, PaginatedResponse } from './types';

/**
 * Create a review for a completed order
 */
export async function createReview(data: ReviewInput): Promise<Review> {
  return apiPost<Review>('/reviews', data);
}

/**
 * List reviews with pagination
 */
export async function getReviews(params?: {
  page?: number;
  page_size?: number;
  seller_id?: number;
  order_id?: number;
}): Promise<PaginatedResponse<Review>> {
  return apiGet<PaginatedResponse<Review>>('/reviews', params);
}

/**
 * Get current user's (buyer) reviews
 */
export async function getMyReviews(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<Review>> {
  return apiGet<PaginatedResponse<Review>>('/reviews/my', params);
}

/**
 * Get review by ID
 */
export async function getReview(reviewId: number): Promise<Review> {
  return apiGet<Review>(`/reviews/${reviewId}`);
}

/**
 * Get all reviews for a seller
 */
export async function getSellerReviews(
  sellerId: number,
  params?: { page?: number; page_size?: number }
): Promise<PaginatedResponse<Review>> {
  return apiGet<PaginatedResponse<Review>>(`/reviews/seller/${sellerId}`, params);
}

export async function replyToReview(reviewId: number, response: string): Promise<Review> {
  return apiPost<Review>(`/reviews/${reviewId}/reply`, { response });
}

export async function reportReview(
  reviewId: number,
  reason: "Falsche Angaben" | "Beleidigung" | "Spam"
): Promise<Review> {
  return apiPost<Review>(`/reviews/${reviewId}/report`, { reason });
}

