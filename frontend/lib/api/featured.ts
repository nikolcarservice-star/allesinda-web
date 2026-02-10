import { apiGet, apiPost } from './client';
import type {
  CategoryType,
  FeaturedDetail,
  FeaturedItem,
  HomeContent,
  PaginatedResponse,
} from './types';

export interface FeaturedQueryParams {
  types?: CategoryType[];
  category?: string; // Category slug or ID (deprecated, backend accepts numeric string for ID)
  category_id?: number; // Category ID (preferred, but backend currently uses category param)
  city_id?: number;
  q?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  sort_by?: 'rating' | 'price' | 'created_at' | 'likes';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
  curated?: boolean;
}

function serializeArrayParam(value?: string[]): string | undefined {
  if (!value || value.length === 0) return undefined;
  return value.join(',');
}

export async function getFeaturedItems(
  params: FeaturedQueryParams = {}
): Promise<PaginatedResponse<FeaturedItem>> {
  const query: Record<string, string | number | undefined> = {
    category: params.category,
    city_id: params.city_id,
    q: params.q,
    min_price: params.min_price,
    max_price: params.max_price,
    min_rating: params.min_rating,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
    page: params.page,
    page_size: params.page_size,
    curated: params.curated ? 'true' : undefined,
  };

  const types = serializeArrayParam(params.types);
  if (types) {
    query['types'] = types;
  }

  return apiGet<PaginatedResponse<FeaturedItem>>('/featured', query);
}

export async function getFeaturedDetail(
  type: CategoryType,
  id: number
): Promise<FeaturedDetail> {
  return apiGet<FeaturedDetail>(`/featured/${type}/${id}`);
}

export async function trackFeaturedView(type: CategoryType, id: number): Promise<void> {
  await apiPost(`/featured/${type}/${id}/view`);
}

export async function getHomeContent(): Promise<HomeContent> {
  return apiGet<HomeContent>('/featured/home');
}

export async function getCuratedFeaturedItems(
  params: Pick<FeaturedQueryParams, 'types' | 'page' | 'page_size'> = {}
): Promise<PaginatedResponse<FeaturedItem & { priority?: number; featured_id?: number }>> {
  const query: Record<string, string | number | undefined> = {
    page: params.page,
    page_size: params.page_size,
  };

  const types = serializeArrayParam(params.types);
  if (types) {
    query['types'] = types;
  }

  return apiGet('/featured/curated', query);
}
