/**
 * Search API functions
 * These functions call the /search endpoint which returns Profile, Product, or Rental types
 */

import { apiGet } from './client';
import type { Profile, Product, Rental, PaginatedResponse, SearchParams } from './types';

export interface SearchResults {
  masters?: PaginatedResponse<Profile>;
  products?: PaginatedResponse<Product>;
  rentals?: PaginatedResponse<Rental>;
}

/**
 * Unified search across masters, products, and rentals
 */
export async function searchAll(params: SearchParams): Promise<SearchResults> {
  const { q, ...restParams } = params;
  return apiGet<SearchResults>('/search', {
    scope: 'all',
    q,
    ...restParams,
  });
}

/**
 * Search masters only
 */
export async function searchMasters(params: SearchParams): Promise<PaginatedResponse<Profile>> {
  const { q, ...restParams } = params;
  return apiGet<PaginatedResponse<Profile>>('/search', {
    scope: 'masters',
    q,
    ...restParams,
  });
}

/**
 * Search products only
 */
export async function searchProducts(params: SearchParams): Promise<PaginatedResponse<Product>> {
  const { q, ...restParams } = params;
  return apiGet<PaginatedResponse<Product>>('/search', {
    scope: 'products',
    q,
    ...restParams,
  });
}

/**
 * Search rentals only
 */
export async function searchRentals(params: SearchParams): Promise<PaginatedResponse<Rental>> {
  const { q, ...restParams } = params;
  return apiGet<PaginatedResponse<Rental>>('/search', {
    scope: 'rentals',
    q,
    ...restParams,
  });
}

