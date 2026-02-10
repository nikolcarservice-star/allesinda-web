/**
 * Sellers API functions
 */

import { apiGet, apiPost, apiPatch } from './client';
import type { Profile, ProfileInput } from './types';

/**
 * Get current user's seller profile
 */
export async function getMySellerProfile(): Promise<Profile> {
  return apiGet<Profile>('/sellers/me');
}

/**
 * Update current user's seller profile
 */
export async function updateMySellerProfile(data: ProfileInput): Promise<Profile> {
  return apiPatch<Profile>('/sellers/me', data);
}

