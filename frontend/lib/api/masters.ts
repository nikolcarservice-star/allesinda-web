/**
 * Masters API functions
 */

import { apiGet, apiPost, apiPatch, apiDelete, getApiBaseUrl, ApiClientError } from './client';
import { getCurrentUser, updateCurrentUser } from './auth';
import type { Profile, ProfileInput, ProfileDetailed, Service, ServiceInput, PaginatedResponse, SearchParams, MasterCabinetInput, MasterCabinetResponse, User } from './types';

function getDisplayPriceFromServices(services: Service[]): number | null {
  const prices = services
    .map((service) => service.price_from)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : null;
}

async function loadMasterCabinetLegacy(): Promise<MasterCabinetResponse> {
  const [user, profile, services] = await Promise.all([
    getCurrentUser(),
    getMyProfile(),
    getMyServices().catch(() => [] as Service[]),
  ]);
  return {
    user,
    profile,
    price_from: getDisplayPriceFromServices(services),
  };
}

async function upsertDisplayPriceLegacy(priceFrom: number, defaultTitle: string): Promise<number> {
  const services = await getMyServices().catch(() => [] as Service[]);
  const title = (defaultTitle || "Service").trim().slice(0, 255) || "Service";

  if (services.length > 0) {
    const positive = services.filter((service) => service.price_from > 0);
    const primary = positive.length
      ? positive.reduce((min, service) => (service.price_from < min.price_from ? service : min))
      : services[0];
    await updateService(primary.id, {
      title: primary.title,
      description: primary.description,
      price_from: priceFrom,
    });
    return priceFrom;
  }

  await addService({ title, price_from: priceFrom });
  return priceFrom;
}

async function saveMasterCabinetLegacy(data: MasterCabinetInput): Promise<MasterCabinetResponse> {
  let user: User = await getCurrentUser();

  if (data.name !== undefined || data.phone !== undefined) {
    try {
      user = await updateCurrentUser({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? undefined } : {}),
      });
    } catch (err) {
      if (!(err instanceof ApiClientError && (err.statusCode === 404 || err.statusCode === 405))) {
        throw err;
      }
    }
  }

  const profilePayload: ProfileInput = {};
  if (data.about !== undefined) profilePayload.about = data.about;
  if (data.category_id !== undefined) profilePayload.category_id = data.category_id;
  if (data.keywords !== undefined) profilePayload.keywords = data.keywords;
  if (data.city_id !== undefined) profilePayload.city_id = data.city_id;
  if (data.profession !== undefined) profilePayload.profession = data.profession ?? undefined;

  const profile = Object.keys(profilePayload).length
    ? await updateMyProfile(profilePayload)
    : await getMyProfile();

  let priceFrom: number | null = null;
  if (data.price_from !== undefined && data.price_from !== null) {
    priceFrom = await upsertDisplayPriceLegacy(
      data.price_from,
      data.profession || data.name || user.name || "Service",
    );
  } else {
    const services = await getMyServices().catch(() => [] as Service[]);
    priceFrom = getDisplayPriceFromServices(services);
  }

  return { user, profile, price_from: priceFrom };
}

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
 * Load master cabinet (account + profile + display price)
 */
export async function getMasterCabinet(): Promise<MasterCabinetResponse> {
  try {
    return await apiGet<MasterCabinetResponse>('/masters/me/cabinet');
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 404) {
      return loadMasterCabinetLegacy();
    }
    throw err;
  }
}

/**
 * Update master cabinet (account + profile) in one request
 */
export async function updateMasterCabinet(data: MasterCabinetInput): Promise<MasterCabinetResponse> {
  try {
    return await apiPatch<MasterCabinetResponse>('/masters/me/cabinet', data);
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 404) {
      return saveMasterCabinetLegacy(data);
    }
    throw err;
  }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/masters/me/profile-image`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload hat zu lange gedauert');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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

