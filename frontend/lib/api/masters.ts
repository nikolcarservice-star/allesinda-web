/**
 * Masters API functions
 */

import { apiGet, apiPost, apiPatch, apiDelete, getApiBaseUrl } from './client';
import type { Profile, ProfileInput, ProfileDetailed, Service, ServiceInput, PaginatedResponse, SearchParams } from './types';

/**
 * List masters with pagination and filtering
 */
export async function getMasters(params?: SearchParams): Promise<PaginatedResponse<Profile>> {
  return apiGet<PaginatedResponse<Profile>>('/masters', params);
}

/**
 * Get master profile by ID
 */
export async function getMaster(profileId: number): Promise<ProfileDetailed> {
  return apiGet<ProfileDetailed>(`/masters/${profileId}`);
}

/**
 * Get current user's master profile
 */
export async function getMyProfile(): Promise<Profile> {
  return apiGet<Profile>('/masters/me');
}

/**
 * Update current user's master profile
 */
export async function updateMyProfile(data: ProfileInput): Promise<Profile> {
  return apiPatch<Profile>('/masters/me', data);
}

/**
 * Add service to master profile
 */
export async function addService(data: ServiceInput): Promise<Service> {
  return apiPost<Service>('/masters/me/services', data);
}

/**
 * List current user's services
 */
export async function getMyServices(): Promise<Service[]> {
  const response = await apiGet<PaginatedResponse<Service>>('/masters/me/services');
  return response.items || [];
}

/**
 * List services for a master profile
 */
export async function getMasterServices(profileId: number): Promise<Service[]> {
  const response = await apiGet<PaginatedResponse<Service>>(`/masters/${profileId}/services`);
  return response.items || [];
}

/**
 * Update a service
 */
export async function updateService(serviceId: number, data: ServiceInput): Promise<Service> {
  return apiPatch<Service>(`/masters/me/services/${serviceId}`, data);
}

/**
 * Delete a service
 */
export async function deleteService(serviceId: number): Promise<void> {
  return apiDelete<void>(`/masters/me/services/${serviceId}`);
}

/**
 * Upload profile image for master
 */
export async function uploadProfileImage(file: File): Promise<Profile> {
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/masters/me/profile-image`, {
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
 * Delete profile image for master
 */
export async function deleteProfileImage(): Promise<Profile> {
  return apiDelete<Profile>('/masters/me/profile-image');
}

/**
 * Get list of German cities (from backend)
 */
export async function getGermanCities(params?: { q?: string; st?: string; limit?: number }): Promise<{ items: Array<{ name: string; latitude: number; longitude: number }>; total: number }> {
  return apiGet<{ items: Array<{ name: string; latitude: number; longitude: number }>; total: number }>('/masters/cities', params);
}

