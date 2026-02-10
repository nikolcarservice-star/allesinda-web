/**
 * Categories API functions
 */

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Category, CategoryInput, CategoryTree, CategoryUpdate, CategoryType, PaginatedResponse } from './types';

/**
 * List categories with pagination
 */
export async function getCategories(params?: {
  page?: number;
  page_size?: number;
  type?: CategoryType;
  active_only?: boolean;
  parent_id?: number | null;
  root_only?: boolean;
}): Promise<PaginatedResponse<Category>> {
  return apiGet<PaginatedResponse<Category>>('/categories', params);
}

/**
 * Get category by ID
 */
export async function getCategory(categoryId: number): Promise<Category> {
  return apiGet<Category>(`/categories/${categoryId}`);
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<Category> {
  return apiGet<Category>(`/categories/slug/${slug}`);
}

/**
 * Get categories by type
 */
export async function getCategoriesByType(
  type: CategoryType,
  options: {
    activeOnly?: boolean;
    parentId?: number | null;
    rootOnly?: boolean;
  } = {}
): Promise<Category[]> {
  const params: Record<string, any> = {};
  const { activeOnly = true, parentId, rootOnly } = options;

  if (activeOnly !== undefined) {
    params.active_only = activeOnly;
  }

  if (parentId !== undefined) {
    params.parent_id = parentId;
  }

  if (rootOnly !== undefined) {
    params.root_only = rootOnly;
  }

  return apiGet<Category[]>(`/categories/type/${type}`, params);
}

/**
 * Get hierarchical category tree by type
 */
export async function getCategoryTreeByType(
  type: CategoryType,
  activeOnly: boolean = true
): Promise<CategoryTree[]> {
  return apiGet<CategoryTree[]>(`/categories/type/${type}/tree`, { active_only: activeOnly });
}

/**
 * Create a new category (admin only)
 */
export async function createCategory(data: CategoryInput): Promise<Category> {
  return apiPost<Category>('/categories', data);
}

/**
 * Update a category (admin only)
 */
export async function updateCategory(categoryId: number, data: CategoryUpdate): Promise<Category> {
  return apiPatch<Category>(`/categories/${categoryId}`, data);
}

/**
 * Delete a category (admin only)
 */
export async function deleteCategory(categoryId: number): Promise<void> {
  return apiDelete<void>(`/categories/${categoryId}`);
}

