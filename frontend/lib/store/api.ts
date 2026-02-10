/**
 * @deprecated This file contains Shopify-specific API code.
 * Use `lib/api/*` instead for the Allesinda marketplace API.
 * 
 * This file is kept for backward compatibility but should be replaced
 * with the new marketplace API client in `lib/api/`.
 */

// Re-export marketplace API for backward compatibility
export * from '../api';

// Legacy Shopify types and functions below
// These should be removed once all components are migrated to the new API

import { ProductCollectionSortKey, ProductSortKey, StoreCart, StoreCollection, StoreProduct } from './types';
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_KEY } from './constants';
import { logger } from '@/lib/logger';
import { DEFAULT_PRODUCTS, DEFAULT_COLLECTIONS } from './default-data';

// Legacy API functions - DEPRECATED
// These functions use default data since the Shopify API no longer exists
// Migrate to lib/api/* for the new marketplace API

export async function getProducts({
  first = DEFAULT_PAGE_SIZE,
  sortKey = DEFAULT_SORT_KEY,
  reverse = false,
  query: searchQuery,
}: {
  first?: number;
  sortKey?: ProductSortKey;
  reverse?: boolean;
  query?: string;
}): Promise<StoreProduct[]> {
  // Always use default data for legacy compatibility
  logger.warn('getProducts: Using legacy API with default data. Migrate to lib/api/products.ts');
  
  let products = DEFAULT_PRODUCTS;
  
  // Filter by search query if provided
  if (searchQuery) {
    const queryLower = searchQuery.toLowerCase();
    products = DEFAULT_PRODUCTS.filter(
      p =>
        p.title.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower)
    );
  }
  
  // Apply sorting
  if (sortKey === 'PRICE') {
    products = [...products].sort((a, b) => {
      const priceA = parseFloat(a.priceRange.minVariantPrice.amount);
      const priceB = parseFloat(b.priceRange.minVariantPrice.amount);
      return reverse ? priceB - priceA : priceA - priceB;
    });
  }
  
  return products.slice(0, first);
}

export async function getProduct(handle: string): Promise<StoreProduct | null> {
  logger.warn('getProduct: Using legacy API with default data. Migrate to lib/api/products.ts');
  
  // Find product by handle in default data
  const product = DEFAULT_PRODUCTS.find(p => p.handle === handle);
  return product || DEFAULT_PRODUCTS[0] || null;
}

export async function getCollections(first = 10): Promise<StoreCollection[]> {
  logger.warn('getCollections: Legacy function with default data. No equivalent in marketplace API.');
  return DEFAULT_COLLECTIONS.slice(0, first);
}

export async function getCollectionProducts({
  collection,
  limit = DEFAULT_PAGE_SIZE,
  sortKey = DEFAULT_SORT_KEY,
  query: searchQuery,
  reverse = false,
}: {
  collection: string;
  limit?: number;
  sortKey?: ProductCollectionSortKey;
  query?: string;
  reverse?: boolean;
}): Promise<StoreProduct[]> {
  logger.warn('getCollectionProducts: Legacy function with default data. Use lib/api/products.ts with category filter.');
  
  let products = DEFAULT_PRODUCTS;
  
  // Filter by search query if provided
  if (searchQuery) {
    const queryLower = searchQuery.toLowerCase();
    products = DEFAULT_PRODUCTS.filter(
      p =>
        p.title.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower)
    );
  }
  
  return products.slice(0, limit);
}

// Cart functions - these should be migrated to orders API
// For now, return empty/mock cart to prevent errors
export async function createCart(): Promise<StoreCart> {
  logger.warn('createCart: Legacy function. Use lib/api/orders.ts instead.');
  // Return empty cart structure to prevent errors
  return {
    id: 'legacy-cart',
    lines: { edges: [] },
    cost: {
      totalAmount: { amount: '0', currencyCode: 'EUR' },
      subtotalAmount: { amount: '0', currencyCode: 'EUR' },
      totalTaxAmount: { amount: '0', currencyCode: 'EUR' },
    },
    checkoutUrl: '',
  };
}

export async function addCartLines(
  cartId: string,
  lines: Array<{ merchandiseId: string; quantity: number }>
): Promise<StoreCart> {
  logger.warn('addCartLines: Legacy function. Use lib/api/orders.ts instead.');
  return createCart();
}

export async function updateCartLines(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
): Promise<StoreCart> {
  logger.warn('updateCartLines: Legacy function. Use lib/api/orders.ts instead.');
  return createCart();
}

export async function removeCartLines(cartId: string, lineIds: string[]): Promise<StoreCart> {
  logger.warn('removeCartLines: Legacy function. Use lib/api/orders.ts instead.');
  return createCart();
}

export async function getCart(cartId: string): Promise<StoreCart | null> {
  logger.warn('getCart: Legacy function. Use lib/api/orders.ts instead.');
  return createCart();
}
