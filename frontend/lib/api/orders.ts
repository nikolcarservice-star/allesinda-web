/**
 * Orders API functions
 */

import { apiGet, apiPost, apiPatch } from './client';
import type { Order, OrderInput, OrderUpdate, PaginatedResponse, OrderStatus, OrderType } from './types';

/**
 * Create a new order
 */
export async function createOrder(data: OrderInput): Promise<Order> {
  return apiPost<Order>('/orders', data);
}

/**
 * Get user's orders with pagination
 */
export async function getMyOrders(params?: {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  order_type?: OrderType;
}): Promise<PaginatedResponse<Order>> {
  return apiGet<PaginatedResponse<Order>>('/orders', params);
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: number): Promise<Order> {
  return apiGet<Order>(`/orders/${orderId}`);
}

/**
 * Update order (seller only)
 */
export async function updateOrder(orderId: number, data: OrderUpdate): Promise<Order> {
  return apiPatch<Order>(`/orders/${orderId}`, data);
}

/**
 * Complete an order
 */
export async function completeOrder(orderId: number): Promise<Order> {
  return apiPost<Order>(`/orders/${orderId}/complete`);
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: number): Promise<Order> {
  return apiPost<Order>(`/orders/${orderId}/cancel`);
}

