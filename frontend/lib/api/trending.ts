import { apiGet } from './client';
import type { CategoryType, PaginatedResponse, TrendingItem } from './types';

export interface TrendingRequestParams {
  type: CategoryType;
  page?: number;
  page_size?: number;
}

export function getTrendingItems(params: TrendingRequestParams): Promise<PaginatedResponse<TrendingItem>> {
  return apiGet<PaginatedResponse<TrendingItem>>('/trending', params);
}

