/**
 * Media API functions
 */

import { apiGet, apiPost, apiDelete, getApiBaseUrl } from './client';
import type { Media, PaginatedResponse } from './types';

/**
 * Upload media for work gallery, products, or rentals
 */
export async function uploadMedia(
  file: File,
  data: {
    media_type: string;
    title?: string;
    description?: string;
    profile_id?: number;
    product_id?: number;
    rental_id?: number;
    before_url?: string;
    after_url?: string;
    is_before_after?: boolean;
    category_id?: number; // Category ID (preferred)
    category?: string; // Category slug (deprecated, for backward compatibility)
    sort_order?: number;
    order_id?: number;
  }
): Promise<Media> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('media_type', data.media_type);
  if (data.title) formData.append('title', data.title);
  if (data.description) formData.append('description', data.description);
  if (data.profile_id) formData.append('profile_id', String(data.profile_id));
  if (data.product_id) formData.append('product_id', String(data.product_id));
  if (data.rental_id) formData.append('rental_id', String(data.rental_id));
  if (data.before_url) formData.append('before_url', data.before_url);
  if (data.after_url) formData.append('after_url', data.after_url);
  if (data.is_before_after !== undefined) formData.append('is_before_after', String(data.is_before_after));
  if (data.category_id !== undefined) formData.append('category_id', String(data.category_id));
  if (data.category) formData.append('category', data.category); // Deprecated, kept for backward compatibility
  if (data.sort_order !== undefined) formData.append('sort_order', String(data.sort_order));
  if (data.order_id) formData.append('order_id', String(data.order_id));

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData - browser will set it with boundary

  const response = await fetch(`${getApiBaseUrl()}/media/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Upload failed');
  }

  return response.json();
}

/**
 * Upload multiple media files for products or rentals (batch upload)
 */
export async function uploadMediaBatch(
  files: File[],
  data: {
    media_type: string;
    product_id?: number;
    rental_id?: number;
  }
): Promise<Media[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('media_type', data.media_type);
  if (data.product_id) formData.append('product_id', String(data.product_id));
  if (data.rental_id) formData.append('rental_id', String(data.rental_id));

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/media/upload/batch`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Upload failed');
  }

  return response.json();
}

/**
 * List media with pagination
 */
export async function getMedia(params?: {
  page?: number;
  page_size?: number;
  status?: 'pending' | 'approved' | 'rejected';
  profile_id?: number;
  product_id?: number;
  rental_id?: number;
  user_id?: number;
}): Promise<PaginatedResponse<Media>> {
  return apiGet<PaginatedResponse<Media>>('/media', params);
}

/**
 * Get current user's media
 */
export async function getMyMedia(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<Media>> {
  return apiGet<PaginatedResponse<Media>>('/media/me', params);
}

/**
 * Delete media
 */
export async function deleteMedia(mediaId: number): Promise<void> {
  return apiDelete<void>(`/media/me/${mediaId}`);
}

