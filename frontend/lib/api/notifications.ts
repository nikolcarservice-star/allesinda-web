/**
 * Notifications API functions
 */

import { apiGet, apiPost, apiDelete } from './client';
import type { Notification, PaginatedResponse } from './types';

/**
 * List user's notifications
 */
export async function getNotifications(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}): Promise<PaginatedResponse<Notification>> {
  return apiGet<PaginatedResponse<Notification>>('/notifications', params);
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>('/notifications/unread/count');
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: number): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/notifications/${notificationId}/read`);
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/notifications/read-all');
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/notifications/${notificationId}`);
}

