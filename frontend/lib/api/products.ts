/**
 * Products API functions
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Product, ProductInput, PaginatedResponse, SearchParams } from './types';

/**
 * List products with pagination and filtering
 */
export async function getProducts(params?: SearchParams): Promise<PaginatedResponse<Product>> {
  return apiGet<PaginatedResponse<Product>>('/products', params);
}

/**
 * Get product by ID
 */
export async function getProduct(productId: number): Promise<Product> {
  return apiGet<Product>(`/products/${productId}`);
}

/**
 * Create a new product (seller only)
 */
export async function createProduct(data: ProductInput): Promise<Product> {
  return apiPost<Product>('/products', data);
}

/**
 * Update a product (seller only)
 */
export async function updateProduct(productId: number, data: ProductInput): Promise<Product> {
  return apiPatch<Product>(`/products/${productId}`, data);
}

/**
 * Delete a product (seller only)
 */
export async function deleteProduct(productId: number): Promise<void> {
  return apiDelete<void>(`/products/${productId}`);
}

/**
 * Get current user's products (seller only)
 */
export async function getMyProducts(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Product>> {
  return apiGet<PaginatedResponse<Product>>('/products/seller/me', params);
}

