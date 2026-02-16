/**
 * Chat API functions
 */

import { apiDelete, apiGet, apiPost, getApiBaseUrl } from './client';
import type {
  Conversation,
  Message,
  MessageDetail,
  MessageInput,
  PaginatedResponse,
} from './types';

/**
 * Get total unread messages count (for header badge). Lightweight, like notifications count.
 */
export async function getUnreadMessagesCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>('/chat/unread/count');
}

/**
 * List user's conversations
 */
export async function getConversations(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<Conversation>> {
  return apiGet<PaginatedResponse<Conversation>>('/chat/conversations', params);
}

/**
 * Create or get existing conversation
 */
export async function createConversation(sellerId: number, orderId?: number): Promise<Conversation> {
  // FastAPI expects these as query parameters when not using a Pydantic model
  // Build query string
  const params = new URLSearchParams();
  params.append('seller_id', sellerId.toString());
  if (orderId !== undefined && orderId !== null) {
    params.append('order_id', orderId.toString());
  }
  const endpoint = `/chat/conversations?${params.toString()}`;
  // Send POST with empty body, parameters in query string
  return apiPost<Conversation>(endpoint, undefined);
}

/**
 * Get conversation by ID
 */
export async function getConversation(conversationId: number): Promise<Conversation> {
  return apiGet<Conversation>(`/chat/conversations/${conversationId}`);
}

/**
 * List messages in a conversation
 */
export async function getMessages(
  conversationId: number,
  params?: { page?: number; page_size?: number }
): Promise<PaginatedResponse<MessageDetail>> {
  return apiGet<PaginatedResponse<MessageDetail>>(`/chat/conversations/${conversationId}/messages`, params);
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(conversationId: number, data: MessageInput): Promise<Message> {
  return apiPost<Message>(`/chat/conversations/${conversationId}/messages`, data);
}

/**
 * Mark all received messages in a conversation as read
 */
export async function markConversationRead(
  conversationId: number
): Promise<{ ok: boolean; updated: number }> {
  return apiPost<{ ok: boolean; updated: number }>(`/chat/conversations/${conversationId}/read`, {});
}

/**
 * Get WebSocket URL for real-time chat
 */
export function getWebSocketUrl(conversationId: number, token?: string): string {
  const apiUrl = getApiBaseUrl();
  const wsUrl = apiUrl.replace(/^http/, 'ws');
  const tokenParam = token ? `?token=${token}` : '';
  return `${wsUrl}/chat/ws/${conversationId}${tokenParam}`;
}

/**
 * Upload an attachment to a conversation
 */
export async function uploadAttachment(
  conversationId: number,
  file: File,
  caption?: string
): Promise<MessageDetail> {
  const formData = new FormData();
  formData.append('file', file);
  if (caption) {
    formData.append('caption', caption);
  }

  const apiUrl = getApiBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${apiUrl}/chat/conversations/${conversationId}/attachments`,
    {
      method: 'POST',
      headers,
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
    const detail = errorData?.detail ?? 'Upload failed';
    throw new Error(typeof detail === 'string' ? detail : 'Upload failed');
  }

  return response.json();
}

/**
 * Block the other participant in a conversation
 */
export async function blockConversation(
  conversationId: number
): Promise<{ ok: boolean; blocked: boolean; blocked_by_user_id: number | null }> {
  return apiPost<{ ok: boolean; blocked: boolean; blocked_by_user_id: number | null }>(
    `/chat/conversations/${conversationId}/block`,
    {}
  );
}

/**
 * Unblock the other participant in a conversation
 */
export async function unblockConversation(
  conversationId: number
): Promise<{ ok: boolean; blocked: boolean; blocked_by_user_id: number | null }> {
  return apiPost<{ ok: boolean; blocked: boolean; blocked_by_user_id: number | null }>(
    `/chat/conversations/${conversationId}/unblock`,
    {}
  );
}

/**
 * Delete a conversation and all of its messages
 */
export async function deleteConversation(conversationId: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/chat/conversations/${conversationId}`);
}

