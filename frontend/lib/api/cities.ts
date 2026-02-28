/**
 * Cities: always use the full list of 80 German cities from static data.
 * API is not used for the list so the UI never gets a truncated (e.g. 20) list.
 */

import { apiGet } from './client';
import { GERMAN_CITIES, type City } from '@/lib/cities';

export type { City } from '@/lib/cities';

/** Re-export so components can use the full list directly (e.g. for dropdowns). */
export { GERMAN_CITIES };

/**
 * Returns all 80 German cities. Uses static list only (no API call)
 * so the dropdown always shows all 80, regardless of backend.
 */
export async function getCities(): Promise<City[]> {
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
