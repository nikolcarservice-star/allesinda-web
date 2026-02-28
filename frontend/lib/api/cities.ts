/**
 * Cities API: fetch German cities from backend.
 * Fallback to static list from @/lib/cities when API is unavailable.
 */

import { apiGet } from './client';
import { GERMAN_CITIES, type City } from '@/lib/cities';

export type { City } from '@/lib/cities';

/**
 * Fetch cities from API. Returns the 80 German cities.
 * On failure (e.g. offline), returns the static GERMAN_CITIES list.
 */
export async function getCities(): Promise<City[]> {
  try {
    const list = await apiGet<City[]>('/cities');
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  } catch {
    // API down or not available: use static list
  }
  return GERMAN_CITIES;
}

/**
 * Get city by id from API. Falls back to static lookup.
 */
export async function getCityById(id: number): Promise<City | null> {
  try {
    const city = await apiGet<City>(`/cities/${id}`);
    return city ?? null;
  } catch {
    const name = GERMAN_CITIES.find((c) => c.id === id)?.name;
    return name ? { id, name } : null;
  }
}
