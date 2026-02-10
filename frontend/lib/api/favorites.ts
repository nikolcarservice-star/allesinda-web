/**
 * Favorites API functions
 */

import { apiGet, apiPost, apiDelete } from './client';
import type { Favorite, FavoriteInput, FavoriteCheck, PaginatedResponse } from './types';

/**
 * Add item to favorites
 */
export async function addFavorite(data: FavoriteInput): Promise<Favorite> {
  return apiPost<Favorite>('/favorites', data);
}

/**
 * Remove item from favorites
 */
export async function removeFavorite(favoriteId: number): Promise<void> {
  return apiDelete<void>(`/favorites/${favoriteId}`);
}

/**
 * List user's favorites with pagination
 */
export async function getFavorites(params?: {
  page?: number;
  page_size?: number;
  favorite_type?: 'profile' | 'product' | 'rental';
}): Promise<PaginatedResponse<Favorite>> {
  return apiGet<PaginatedResponse<Favorite>>('/favorites', params);
}

/**
 * Check if item is favorited by user
 */
export async function checkFavorite(
  favorite_type: 'profile' | 'product' | 'rental',
  favorite_id: number
): Promise<FavoriteCheck> {
  return apiGet<FavoriteCheck>('/favorites/check', {
    favorite_type,
    favorite_id,
  });
}

