/**
 * Admin API functions
 */

import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  FeaturedSelection,
  CategoryType,
  PaginatedResponse,
  Order,
  OrderStatus,
  OrderType,
} from './types';

/**
 * Get admin overview statistics
 */
export async function getAdminOverview(): Promise<{
  total_users: number;
  total_masters: number;
  total_sellers: number;
  total_clients: number;
  media_pending: number;
  media_approved?: number;
  media_rejected?: number;
  profiles_unverified: number;
  profiles_verified?: number;
  total_products: number;
  products_approved?: number;
  products_unapproved?: number;
  total_rentals: number;
  rentals_approved?: number;
  rentals_unapproved?: number;
  total_orders: number;
  total_orders_pending: number;
  total_orders_completed: number;
  total_orders_canceled?: number;
  total_services?: number;
  services_approved?: number;
  total_services_unapproved?: number;
}> {
  return apiGet('/admin/overview');
}

/**
 * Get profiles for moderation with pagination (masters and sellers)
 */
export async function getModerationProfiles(params?: {
  verified_only?: boolean;
  unverified_only?: boolean;
  role?: 'master' | 'seller';
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<{
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  image_url?: string;
  city_name?: string | null;
  verified: boolean;
  rating: number;
  total_reviews: number;
  created_at: string;
}>> {
  return apiGet('/admin/moderation/profiles', params);
}

/**
 * Verify a master profile
 */
export async function verifyProfile(profileId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/moderation/profiles/${profileId}/verify`);
}

/**
 * Reject/unverify a master profile
 */
export async function rejectProfile(profileId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/moderation/profiles/${profileId}/reject`);
}

/**
 * Get media for moderation with pagination (excludes admin-uploaded media)
 */
export async function getModerationMedia(params?: {
  status?: 'pending' | 'approved' | 'rejected';
  media_type?: 'photo' | 'video';
  category?: string;
  owner_role?: 'master' | 'seller' | 'client';
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<{
  id: number;
  owner_id: number;
  owner_name: string;
  owner_role: string;
  url: string;
  thumbnail_url?: string;
  type: string;
  title?: string;
  category?: string;
  is_before_after?: boolean;
  before_url?: string;
  after_url?: string;
  status: string;
  created_at: string;
}>> {
  return apiGet('/admin/moderation/media', params);
}

/**
 * Approve media
 */
export async function approveMedia(mediaId: number): Promise<{ ok: boolean }> {
  return apiPost(`/admin/moderation/media/${mediaId}/approve`);
}

/**
 * Reject media
 */
export async function rejectMedia(mediaId: number): Promise<{ ok: boolean }> {
  return apiPost(`/admin/moderation/media/${mediaId}/reject`);
}

/**
 * Delete media permanently (admin only)
 */
export async function deleteMediaAdmin(mediaId: number): Promise<{ ok: boolean; message?: string }> {
  return apiDelete(`/admin/moderation/media/${mediaId}`);
}

/**
 * Get order by ID (admin only)
 */
export async function getOrderAdmin(orderId: number): Promise<Order> {
  return apiGet(`/admin/orders/${orderId}`);
}

/**
 * Get all orders (admin only)
 */
export async function getAllOrders(params?: {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  order_type?: OrderType;
  q?: string;
}): Promise<PaginatedResponse<Order>> {
  return apiGet<PaginatedResponse<Order>>('/admin/orders', params);
}

export async function getFeaturedSelections(params?: {
  item_type?: CategoryType;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<FeaturedSelection>> {
  return apiGet('/admin/featured', params);
}

export async function upsertFeaturedSelection(payload: {
  item_type: CategoryType;
  item_id: number;
  priority?: number;
  is_active?: boolean;
}): Promise<FeaturedSelection> {
  return apiPost('/admin/featured', payload);
}

export async function updateFeaturedSelection(
  selectionId: number,
  payload: {
    priority?: number;
    is_active?: boolean;
  }
): Promise<FeaturedSelection> {
  return apiPatch(`/admin/featured/${selectionId}`, payload);
}

export async function deleteFeaturedSelection(selectionId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/admin/featured/${selectionId}`);
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(params?: {
  page?: number;
  page_size?: number;
  role?: 'client' | 'master' | 'seller' | 'admin';
  is_active?: boolean;
  q?: string;
}): Promise<PaginatedResponse<{
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  email_verified: boolean;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}>> {
  return apiGet('/admin/users', params);
}

/**
 * Update user (admin only)
 */
export async function updateUser(userId: number, data: {
  role?: 'client' | 'master' | 'seller' | 'admin';
  is_active?: boolean;
  phone?: string;
}): Promise<{
  id: number;
  email: string;
  name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  email_verified: boolean;
  updated_at?: string;
}> {
  return apiPatch(`/admin/users/${userId}`, data);
}

/**
 * Reset user password to default (admin only)
 */
export async function resetUserPassword(userId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/users/${userId}/reset-password`);
}

/**
 * Get all products (admin only)
 */
export async function getAllProducts(params?: {
  page?: number;
  page_size?: number;
  q?: string;
  category?: string;
  min_stock?: number;
  include_out_of_stock?: boolean;
}): Promise<PaginatedResponse<{
  id: number;
  seller_id: number;
  seller_name?: string;
  title: string;
  description?: string;
  price: number;
  stock: number;
  city_id?: number | null;
  city_name?: string | null;
  image_url?: string;
  brand?: string;
  category?: string;
  rating: number;
  total_reviews: number;
  approved: boolean;
  created_at: string;
  updated_at?: string;
}>> {
  return apiGet('/admin/products', params);
}

/**
 * Get all rentals (admin only)
 */
export async function getAllRentals(params?: {
  page?: number;
  page_size?: number;
  q?: string;
  category?: string;
  available_only?: boolean;
}): Promise<PaginatedResponse<{
  id: number;
  seller_id: number;
  owner_name?: string;
  title: string;
  description?: string;
  price_per_day: number;
  stock: number;
  available: boolean;
  city_id?: number | null;
  city_name?: string | null;
  image_url?: string;
  category?: string;
  approved: boolean;
  created_at: string;
  updated_at?: string;
}>> {
  return apiGet('/admin/rentals', params);
}

/**
 * Update order status (admin only)
 */
export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus
): Promise<Order> {
  return apiPatch(`/admin/orders/${orderId}/status?status=${status}`, {});
}

/**
 * Get all reviews (admin only)
 */
export async function getAllReviews(params?: {
  page?: number;
  page_size?: number;
  seller_id?: number;
  min_rating?: number;
  max_rating?: number;
}): Promise<PaginatedResponse<{
  id: number;
  order_id: number;
  rating: number;
  text?: string;
  created_at: string;
  buyer_id?: number;
  buyer_name?: string;
  seller_id?: number;
  seller_name?: string;
  order_type?: string;
  order_amount?: number;
  category?: string;
  subcategory?: string;
  report_reason?: string | null;
  report_status?: "in_review" | "removed" | "rejected" | string | null;
  reported_at?: string | null;
  master_response?: string | null;
}>> {
  return apiGet('/admin/reviews', params);
}

/**
 * Delete a review (admin only)
 */
export async function deleteReview(reviewId: number): Promise<{ ok: boolean; message: string }> {
  return apiDelete(`/admin/reviews/${reviewId}`);
}

export async function moderateReviewReport(
  reviewId: number,
  status: "removed" | "rejected"
): Promise<{ ok: boolean; review_id: number; report_status: string }> {
  return apiPatch(`/admin/reviews/${reviewId}/report-status`, { status });
}

/**
 * Get all services (admin only)
 */
export async function getAllServices(params?: {
  page?: number;
  page_size?: number;
  q?: string;
  approved_only?: boolean;
  unapproved_only?: boolean;
}): Promise<PaginatedResponse<{
  id: number;
  profile_id: number;
  master_name?: string;
  master_id?: number;
  master_image_url?: string;
  title: string;
  description?: string;
  price_from: number;
  approved: boolean;
  created_at: string;
}>> {
  return apiGet('/admin/services', params);
}

/**
 * Approve a service
 */
export async function approveService(serviceId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/services/${serviceId}/approve`);
}

/**
 * Reject a service
 */
export async function rejectService(serviceId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/services/${serviceId}/reject`);
}

/**
 * Approve a product
 */
export async function approveProduct(productId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/products/${productId}/approve`);
}

/**
 * Reject a product
 */
export async function rejectProduct(productId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/products/${productId}/reject`);
}

/**
 * Approve a rental
 */
export async function approveRental(rentalId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/rentals/${rentalId}/approve`);
}

/**
 * Reject a rental
 */
export async function rejectRental(rentalId: number): Promise<{ ok: boolean; message: string }> {
  return apiPost(`/admin/rentals/${rentalId}/reject`);
}

/**
 * Preview master profile (admin only, shows unapproved items and all media)
 */
export async function previewMaster(profileId: number): Promise<{
  profile: {
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    city_id?: number | null;
    city_name?: string | null;
    about?: string;
    image_url?: string;
    category?: string;
    verified: boolean;
    rating: number;
    total_reviews: number;
    created_at: string;
  };
  services: Array<{
    id: number;
    title: string;
    description?: string;
    price_from: number;
    approved: boolean;
    created_at: string;
  }>;
  media: Array<{
    id: number;
    url: string;
    thumbnail_url?: string;
    type: string;
    status: string;
    created_at: string;
  }>;
}> {
  return apiGet(`/admin/preview/master/${profileId}`);
}

/**
 * Preview product (admin only, shows unapproved items and all media)
 */
export async function previewProduct(productId: number): Promise<{
  product: {
    id: number;
    seller_id: number;
    seller_name?: string;
    title: string;
    description?: string;
    price: number;
    stock: number;
    city_id?: number | null;
    city_name?: string | null;
    image_url?: string;
    brand?: string;
    category?: string;
    rating: number;
    total_reviews: number;
    approved: boolean;
    created_at: string;
    updated_at?: string;
  };
  media: Array<{
    id: number;
    url: string;
    thumbnail_url?: string;
    type: string;
    status: string;
    created_at: string;
  }>;
}> {
  return apiGet(`/admin/preview/product/${productId}`);
}

/**
 * Preview rental (admin only, shows unapproved items and all media)
 */
export async function previewRental(rentalId: number): Promise<{
  rental: {
    id: number;
    seller_id: number;
    owner_name?: string;
    title: string;
    description?: string;
    price_per_day: number;
    stock: number;
    available: boolean;
    city_id?: number | null;
    city_name?: string | null;
    image_url?: string;
    category?: string;
    approved: boolean;
    created_at: string;
    updated_at?: string;
  };
  media: Array<{
    id: number;
    url: string;
    thumbnail_url?: string;
    type: string;
    status: string;
    created_at: string;
  }>;
}> {
  return apiGet(`/admin/preview/rental/${rentalId}`);
}

