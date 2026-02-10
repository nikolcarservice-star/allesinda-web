/**
 * Availability Slots API functions
 */

import { apiGet, apiPost, apiDelete } from './client';
import type { AvailabilitySlot, AvailabilitySlotInput, PaginatedResponse } from './types';

/**
 * Add availability slot
 */
export async function addAvailabilitySlot(data: AvailabilitySlotInput): Promise<AvailabilitySlot> {
  return apiPost<AvailabilitySlot>('/masters/me/availability', data);
}

/**
 * Get current user's availability slots
 */
export async function getMyAvailabilitySlots(): Promise<AvailabilitySlot[]> {
  const response = await apiGet<PaginatedResponse<AvailabilitySlot>>('/masters/me/availability');
  return response.items || [];
}

/**
 * Delete availability slot
 */
export async function deleteAvailabilitySlot(slotId: number): Promise<void> {
  return apiDelete<void>(`/masters/me/availability/${slotId}`);
}

