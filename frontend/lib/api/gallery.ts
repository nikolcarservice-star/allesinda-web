/**
 * Gallery API functions
 */

import { apiGet } from './client';
import type { Media, PaginatedResponse } from './types';

/**
 * Get work gallery feed - aggregated before/after photos and videos from all masters
 */
export async function getWorkGallery(params?: {
  page?: number;
  page_size?: number;
  category?: string; // Category slug or ID (deprecated, for backward compatibility)
  category_id?: number; // Category ID (preferred)
  profile_id?: number;
  approved_only?: boolean;
  show_before_after_only?: boolean;
  photos_only?: boolean;
  videos_only?: boolean;
}): Promise<PaginatedResponse<Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean; master_image_url?: string | null }>> {
  return apiGet<PaginatedResponse<Media & { master_name?: string; master_profile_id?: number; master_verified?: boolean; master_image_url?: string | null }>>(
    '/gallery/work',
    params
  );
}

/**
 * Get work gallery for a specific master profile
 */
export async function getProfileGallery(
  profileId: number,
  params?: {
    page?: number;
    page_size?: number;
    approved_only?: boolean;
  }
): Promise<PaginatedResponse<Media>> {
  return apiGet<PaginatedResponse<Media>>(`/gallery/profile/${profileId}`, params);
}

