/**
 * Rentals API functions
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Rental, RentalInput, PaginatedResponse, SearchParams } from './types';

/**
 * List rentals with pagination and filtering
 */
export async function getRentals(params?: SearchParams): Promise<PaginatedResponse<Rental>> {
  return apiGet<PaginatedResponse<Rental>>('/rentals', params);
}

/**
 * Get rental by ID
 */
export async function getRental(rentalId: number): Promise<Rental> {
  return apiGet<Rental>(`/rentals/${rentalId}`);
}

/**
 * Create a new rental (seller only)
 */
export async function createRental(data: RentalInput): Promise<Rental> {
  return apiPost<Rental>('/rentals', data);
}

/**
 * Update a rental (seller only)
 */
export async function updateRental(rentalId: number, data: RentalInput): Promise<Rental> {
  return apiPatch<Rental>(`/rentals/${rentalId}`, data);
}

/**
 * Delete a rental (seller only)
 */
export async function deleteRental(rentalId: number): Promise<void> {
  return apiDelete<void>(`/rentals/${rentalId}`);
}

/**
 * Get current user's rentals (seller only)
 */
export async function getMyRentals(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Rental>> {
  return apiGet<PaginatedResponse<Rental>>('/rentals/seller/me', params);
}

