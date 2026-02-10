/**
 * TypeScript types matching FastAPI backend schemas
 */

// User types
export type Role = 'client' | 'master' | 'seller' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  is_active: boolean;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
}

export interface UserCreate {
  email: string;
  password: string;
  name: string;
  role: Role;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  two_factor_code?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface TwoFactorSetup {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorDisableRequest {
  password: string;
  code: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'facebook';
  access_token: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// Profile types
export interface Profile {
  id: number;
  user_id: number;
  city_id?: number | null;
  city_name?: string | null;
  latitude?: number;
  longitude?: number;
  about?: string;
  image_url?: string | null; // Profile image URL (stored in uploads/profiles/)
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  verified: boolean;
  rating: number;
  total_reviews: number;
  completed_jobs: number;
  response_time_hours?: number;
  created_at: string;
  updated_at: string;
  distance_km?: number; // Calculated distance in search results
  user_name?: string; // User name included in list responses
  contact_phone?: string;
  contact_email?: string;
  can_chat?: boolean;
  profile_id?: number;
  likes_count?: number;
}

export interface ProfileInput {
  // Preferred
  city_id?: number;
  latitude?: number;
  longitude?: number;
  about?: string;
  image_url?: string; // Profile image URL
  category_id?: number; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  response_time_hours?: number;
}

export interface ProfileDetailed extends Profile {
  user: User;
  services: Service[];
}

// Service types
export interface Service {
  id: number;
  profile_id: number;
  title: string;
  description?: string;
  price_from: number;
  created_at: string;
  profile?: Profile;
}

export interface ServiceInput {
  title: string;
  description?: string;
  price_from: number;
}

// Product types
export interface Product {
  id: number;
  seller_id: number;
  title: string;
  description?: string;
  price: number;
  stock: number;
  city_id?: number | null;
  city_name?: string | null;
  image_url?: string;
  brand?: string;
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  media?: Media[]; // Multiple images/videos
  seller_name?: string; // Seller name if included in API response
  seller?: User; // Full seller info if included in API response
  likes_count?: number;
}

export interface ProductInput {
  title: string;
  description?: string;
  price: number;
  stock: number;
  // Preferred
  city_id?: number;
  image_url?: string;
  brand?: string;
  category_id?: number; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
}

// Rental types
export interface Rental {
  id: number;
  seller_id: number;
  title: string;
  description?: string;
  price_per_day: number;
  stock: number;
  available_stock?: number | null;
  available: boolean;
  city_id?: number | null;
  city_name?: string | null;
  image_url?: string;
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  created_at: string;
  updated_at: string;
  media?: Media[]; // Multiple images/videos
  owner_name?: string; // Owner name if included in API response
  seller?: User; // Full seller/owner info if included in API response
  likes_count?: number;
}

export interface RentalInput {
  title: string;
  description?: string;
  price_per_day: number;
  stock: number;
  available: boolean;
  // Preferred
  city_id?: number;
  image_url?: string;
  category_id?: number; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
}

// Order types
export type OrderType = 'service' | 'product' | 'rental';
export type OrderStatus = 'created' | 'paid' | 'completed' | 'canceled';

export interface Order {
  id: number;
  buyer_id: number;
  seller_id: number;
  service_id?: number;
  product_id?: number;
  rental_id?: number;
  amount: number;
  commission: number;
  order_type: OrderType;
  status: OrderStatus;
  payment_intent_id?: string;
  scheduled_date?: string;
  location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Related data
  buyer?: User;
  seller?: User;
  service?: Service;
  product?: Product;
  rental?: Rental;
}

export interface OrderInput {
  seller_id: number;
  service_id?: number;
  product_id?: number;
  rental_id?: number;
  amount: number;
  order_type: OrderType;
  scheduled_date?: string;
  location?: string;
  notes?: string;
}

export interface OrderUpdate {
  status?: OrderStatus;
  scheduled_date?: string;
  location?: string;
  notes?: string;
}

// Review types
export interface Review {
  id: number;
  order_id: number;
  rating: number;
  text?: string;
  created_at: string;
}

export interface ReviewInput {
  order_id: number;
  rating: number;
  text?: string;
}

// Conversation types
export interface Conversation {
  id: number;
  order_id?: number;
  buyer_id: number;
  seller_id: number;
  last_message_at?: string;
  created_at: string;
  // Enhanced fields from ConversationDetailOut
  name?: string;
  avatar?: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  online?: boolean;
  profession?: string;
  lastMessageRead?: boolean;
  lastMessageSenderId?: number;
  other_user_id?: number;
  other_user_email?: string;
  other_user_phone?: string;
  other_user_role?: string;
  other_profile_id?: number;
  is_blocked?: boolean;
  blocked_by_user_id?: number | null;
}

// Message types
export interface MessageAttachment {
  id: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number | null;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  is_read: boolean;
  created_at: string;
  attachments?: MessageAttachment[];
}

export interface MessageInput {
  body: string;
}

export interface MessageDetail {
  id: number;
  sender: 'me' | 'them';
  content: string;
  timestamp: string;
  conversation_id: number;
  sender_id: number;
  is_read: boolean;
  created_at: string;
  attachments: MessageAttachment[];
}

// Media types
export type MediaStatus = 'pending' | 'approved' | 'rejected';

export interface Media {
  id: number;
  owner_id: number;
  profile_id?: number;
  product_id?: number;
  rental_id?: number;
  order_id?: number;
  url: string;
  thumbnail_url?: string;
  media_type: string;
  status: MediaStatus;
  title?: string;
  description?: string;
  before_url?: string;
  after_url?: string;
  is_before_after: boolean;
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  sort_order?: number;
  created_at: string;
  reviewed_at?: string;
  // Extended fields from gallery API
  master_name?: string;
  master_profile_id?: number;
  master_verified?: boolean;
}

// Availability Slot types
export interface AvailabilitySlot {
  id: number;
  profile_id: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export interface AvailabilitySlotInput {
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

// Promotion types
export interface Promotion {
  id: number;
  profile_id: number;
  start_date: string;
  end_date: string;
  payment_intent_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface PromotionInput {
  start_date: string;
  end_date: string;
}

// Search parameters
export interface SearchParams {
  q?: string;
  city?: string; // City name (deprecated, for backward compatibility)
  city_id?: number; // City ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  category_id?: number; // Category ID (preferred)
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  verified_only?: boolean;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  sort_by?: 'rating' | 'price' | 'reviews' | 'distance' | 'created_at' | string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// Stripe types
export interface CheckoutSessionCreate {
  order_id: number;
}

// Favorite types
export type FavoriteType = 'profile' | 'product' | 'rental';

export interface Favorite {
  id: number;
  user_id: number;
  favorite_type: FavoriteType;
  favorite_id: number;
  created_at: string;
  item?: {
    id: number;
    name?: string;
    title?: string;
    price?: number;
    price_per_day?: number;
    image_url?: string;
    city_name?: string | null;
    rating?: number;
    total_reviews?: number;
  };
}

export interface FavoriteInput {
  favorite_type: FavoriteType;
  favorite_id: number;
}

export interface FavoriteCheck {
  is_favorited: boolean;
  favorite_id: number | null;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

// Notification types
export interface Notification {
  id: number;
  user_id: number;
  type: 'order' | 'message' | 'review' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  related_id?: number;
  created_at: string;
}

// Category types
export type CategoryType = 'master' | 'product' | 'rental';

export interface Category {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  description?: string;
  image_url?: string;
  parent_id?: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryInput {
  name: string;
  slug: string;
  type: CategoryType;
  description?: string;
  image_url?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  description?: string;
  image_url?: string;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
}

// Item relationships
export interface ItemRelationshipInput {
  source_type: CategoryType;
  source_id: number;
  target_type: CategoryType;
  target_id: number;
}

export interface ItemRelationship extends ItemRelationshipInput {
  id: number;
  created_by?: number | null;
  created_at: string;
}

export interface RelatedItemSummary {
  relationship_id: number;
  id: number;
  type: CategoryType;
  title: string;
  image_url?: string | null;
}

export interface FeaturedItem {
  id: number;
  type: CategoryType;
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string | null;
  rating?: number | null;
  total_reviews?: number | null;
  price?: number | null;
  price_per_day?: number | null;
  city_id?: number | null;
  city_name?: string | null;
  category_id?: number | null; // Category ID (preferred)
  category?: string | null; // Category slug (deprecated, for backward compatibility)
  created_at?: string | null;
  stock?: number | null;
  available_stock?: number | null;
  available?: boolean | null;
  relationships?: RelatedItemSummary[];
  likes_count?: number | null;
}

export interface FeaturedDetail extends FeaturedItem {
  brand?: string | null;
  available?: boolean | null;
  services?: Service[];
  portfolio?: Media[];
  media?: Media[];
  extra?: Record<string, unknown>;
}

export interface HomeContent {
  featured_subcategories: Category[];
  work_gallery: Media[];
  recently_viewed: FeaturedItem[];
}

export interface TrendingItem {
  id: number;
  type: CategoryType;
  title: string;
  subtitle?: string;
  image_url?: string;
  rating?: number;
  total_reviews?: number;
  price?: number;
  price_per_day?: number;
  likes_count: number;
  sold_count: number;
  stock?: number | null;
  available_stock?: number | null;
  available?: boolean | null;
  city_id?: number | null;
  city_name?: string | null;
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  completed_jobs?: number;
}

export interface FeaturedSelection {
  id: number;
  item_type: CategoryType;
  item_id: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item?: FeaturedItem | null;
}

// Pagination types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

