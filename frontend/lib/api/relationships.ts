import { apiDelete, apiGet, apiPost } from './client';
import type {
  CategoryType,
  ItemRelationship,
  ItemRelationshipInput,
  PaginatedResponse,
} from './types';

export interface SearchItemResult {
  id: number;
  type: CategoryType;
  title: string;
  subtitle?: string;
  image_url?: string;
}

export async function listRelationships(
  itemType: CategoryType,
  itemId: number
): Promise<ItemRelationship[]> {
  const response = await apiGet<PaginatedResponse<ItemRelationship>>(`/relationships/${itemType}/${itemId}`);
  return response.items || [];
}

export async function searchItemsForLinking(
  itemType: CategoryType,
  query: string,
  limit: number = 20
): Promise<SearchItemResult[]> {
  return apiGet<SearchItemResult[]>(`/relationships/search/${itemType}`, {
    q: query,
    limit,
  });
}

export async function createRelationship(
  data: ItemRelationshipInput
): Promise<ItemRelationship> {
  return apiPost<ItemRelationship>('/relationships', data);
}

export async function deleteRelationship(relationshipId: number): Promise<void> {
  await apiDelete(`/relationships/${relationshipId}`);
}
