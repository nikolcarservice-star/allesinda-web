import type { CategoryType, FeaturedItem } from '@/lib/api/types';
import { formatPrice, getOptimizedImageUrl } from '@/lib/utils';

export type RecentlyViewedItem = {
  id: number;
  title: string;
  subtitle?: string;
  image?: string;
  rating?: number;
  priceLabel?: string;
  href: string;
  itemType: CategoryType;
  soldCount?: number;
  city_name?: string | null;
  category_id?: number | null; // Category ID (preferred)
  category?: string; // Category slug (deprecated, for backward compatibility)
  price?: number;
  pricePerDay?: number;
  totalReviews?: number;
};

const STORAGE_KEY = 'allesinda-recently-viewed-items';
export const RECENTLY_VIEWED_EVENT = 'allesinda:recently-viewed-updated';
export const RECENTLY_VIEWED_FILTER_EVENT = 'allesinda:recently-viewed-filter-changed';
export const RECENTLY_VIEWED_FILTER_KEY = 'allesinda-recently-viewed-filter';
const MAX_ITEMS_PER_TYPE = 10;

type RecentlyViewedItemsByType = {
  master: RecentlyViewedItem[];
  product: RecentlyViewedItem[];
  rental: RecentlyViewedItem[];
};

function deriveItemType(item: RecentlyViewedItem): CategoryType {
  if (item.itemType && ['master', 'product', 'rental'].includes(item.itemType)) {
    return item.itemType
  }

  if (typeof item.href === 'string') {
    const match = item.href.match(/\/detailed\/(master|product|rental)\//i)
    if (match && ['master', 'product', 'rental'].includes(match[1])) {
      return match[1] as CategoryType
    }
  }

  return 'product'
}

function normalizeItem(item: RecentlyViewedItem): RecentlyViewedItem {
  const itemType = deriveItemType(item)
  const parsedPrice = typeof item.price === 'number' ? item.price : parsePriceLabel(item.priceLabel)
  const parsedPerDay =
    typeof item.pricePerDay === 'number'
      ? item.pricePerDay
      : itemType === 'rental'
        ? parsePriceLabel(item.priceLabel)
        : undefined

  // Backward compatibility: derive city_name from legacy fields if missing
  const legacyCity = (item as unknown as { city?: string }).city
  const derivedCityName =
    (item as unknown as { city_name?: string | null }).city_name ??
    (legacyCity && legacyCity.trim().length > 0 ? legacyCity : null) ??
    null

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    image: item.image,
    rating: typeof item.rating === 'number' ? item.rating : undefined,
    priceLabel: item.priceLabel,
    href: item.href,
    itemType,
    soldCount: typeof item.soldCount === 'number' ? item.soldCount : undefined,
    city_name: derivedCityName,
    category_id: (item as unknown as { category_id?: number | null }).category_id ?? null,
    category: item.category, // Keep for backward compatibility
    price: parsedPrice,
    pricePerDay: parsedPerDay,
    totalReviews: typeof item.totalReviews === 'number' ? item.totalReviews : undefined,
  };
}

export function parsePriceLabel(priceLabel?: string | null): number | undefined {
  if (!priceLabel) return undefined;
  const trimmed = priceLabel.trim();
  if (!trimmed) return undefined;

  const digitsOnly = trimmed.replace(/[^0-9.,-]+/g, "");
  if (!digitsOnly) return undefined;

  const lastComma = digitsOnly.lastIndexOf(",");
  const lastDot = digitsOnly.lastIndexOf(".");
  let normalized: string;

  if (lastComma > lastDot) {
    normalized = digitsOnly.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = digitsOnly.replace(/,/g, "");
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function readRecentlyViewedItemsByType(): RecentlyViewedItemsByType {
  if (typeof window === 'undefined') {
    return { master: [], product: [], rental: [] };
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { master: [], product: [], rental: [] };
    
    const parsed = JSON.parse(stored);
    
    // Handle backward compatibility: if it's an array (old format), migrate it
    if (Array.isArray(parsed)) {
      const itemsByType: RecentlyViewedItemsByType = { master: [], product: [], rental: [] };
      const normalized = parsed
        .filter((entry) => entry && typeof entry === 'object' && entry.href)
        .map((entry) => normalizeItem(entry as RecentlyViewedItem));
      
      normalized.forEach((item) => {
        const type = item.itemType;
        if (type === 'master' || type === 'product' || type === 'rental') {
          itemsByType[type].push(item);
        }
      });
      
      // Limit each type to MAX_ITEMS_PER_TYPE
      itemsByType.master = itemsByType.master.slice(0, MAX_ITEMS_PER_TYPE);
      itemsByType.product = itemsByType.product.slice(0, MAX_ITEMS_PER_TYPE);
      itemsByType.rental = itemsByType.rental.slice(0, MAX_ITEMS_PER_TYPE);
      
      // Save in new format
      writeRecentlyViewedItemsByType(itemsByType);
      return itemsByType;
    }
    
    // New format: object with separate arrays per type
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        master: (parsed.master || [])
          .filter((entry: unknown) => entry && typeof entry === 'object' && (entry as RecentlyViewedItem).href)
          .map((entry: unknown) => normalizeItem(entry as RecentlyViewedItem))
          .slice(0, MAX_ITEMS_PER_TYPE),
        product: (parsed.product || [])
          .filter((entry: unknown) => entry && typeof entry === 'object' && (entry as RecentlyViewedItem).href)
          .map((entry: unknown) => normalizeItem(entry as RecentlyViewedItem))
          .slice(0, MAX_ITEMS_PER_TYPE),
        rental: (parsed.rental || [])
          .filter((entry: unknown) => entry && typeof entry === 'object' && (entry as RecentlyViewedItem).href)
          .map((entry: unknown) => normalizeItem(entry as RecentlyViewedItem))
          .slice(0, MAX_ITEMS_PER_TYPE),
      };
    }
    
    return { master: [], product: [], rental: [] };
  } catch (error) {
    console.error('Failed to read recently viewed items:', error);
    return { master: [], product: [], rental: [] };
  }
}

export function readRecentlyViewedItems(): RecentlyViewedItem[] {
  const itemsByType = readRecentlyViewedItemsByType();
  return [...itemsByType.master, ...itemsByType.product, ...itemsByType.rental];
}

function writeRecentlyViewedItemsByType(itemsByType: RecentlyViewedItemsByType): void {
  if (typeof window === 'undefined') return;
  try {
    // Ensure each type is limited to MAX_ITEMS_PER_TYPE
    const limited: RecentlyViewedItemsByType = {
      master: itemsByType.master.slice(0, MAX_ITEMS_PER_TYPE),
      product: itemsByType.product.slice(0, MAX_ITEMS_PER_TYPE),
      rental: itemsByType.rental.slice(0, MAX_ITEMS_PER_TYPE),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    window.dispatchEvent(new CustomEvent(RECENTLY_VIEWED_EVENT));
  } catch (error) {
    console.error('Failed to write recently viewed items:', error);
  }
}

export function addRecentlyViewedItem(item: RecentlyViewedItem): RecentlyViewedItem[] {
  if (typeof window === 'undefined' || !item?.href) return [];
  const normalized = normalizeItem(item);
  const itemType = normalized.itemType;
  
  if (itemType !== 'master' && itemType !== 'product' && itemType !== 'rental') {
    return readRecentlyViewedItems();
  }
  
  const itemsByType = readRecentlyViewedItemsByType();
  
  // Remove the item if it already exists (from any type)
  const allTypes: CategoryType[] = ['master', 'product', 'rental'];
  allTypes.forEach((type) => {
    itemsByType[type] = itemsByType[type].filter((existing) => existing.href !== normalized.href);
  });
  
  // Add to the beginning of the specific type's array
  itemsByType[itemType] = [normalized, ...itemsByType[itemType]];
  
  // Limit each type to MAX_ITEMS_PER_TYPE
  itemsByType[itemType] = itemsByType[itemType].slice(0, MAX_ITEMS_PER_TYPE);
  
  writeRecentlyViewedItemsByType(itemsByType);
  return readRecentlyViewedItems();
}

export function upsertRecentlyViewedItem(item: RecentlyViewedItem): RecentlyViewedItem[] {
  if (typeof window === 'undefined' || !item?.href) return [];
  const normalized = normalizeItem(item);
  const itemType = normalized.itemType;
  
  if (itemType !== 'master' && itemType !== 'product' && itemType !== 'rental') {
    return readRecentlyViewedItems();
  }
  
  const itemsByType = readRecentlyViewedItemsByType();
  
  // Check if item exists in any type
  let foundInType: CategoryType | null = null;
  let foundIndex = -1;
  
  const allTypes: CategoryType[] = ['master', 'product', 'rental'];
  for (const type of allTypes) {
    const index = itemsByType[type].findIndex((existing) => existing.href === normalized.href);
    if (index !== -1) {
      foundInType = type;
      foundIndex = index;
      break;
    }
  }
  
  // Remove from all types first (in case it was in a different type)
  allTypes.forEach((type) => {
    itemsByType[type] = itemsByType[type].filter((existing) => existing.href !== normalized.href);
  });
  
  if (foundInType === itemType && foundIndex !== -1) {
    // Update existing item in the same type, but move it to the top
    itemsByType[itemType] = [normalized, ...itemsByType[itemType]];
  } else {
    // Add new item to the beginning of the specific type's array
    itemsByType[itemType] = [normalized, ...itemsByType[itemType]];
  }
  
  // Limit each type to MAX_ITEMS_PER_TYPE
  itemsByType[itemType] = itemsByType[itemType].slice(0, MAX_ITEMS_PER_TYPE);
  
  writeRecentlyViewedItemsByType(itemsByType);
  return readRecentlyViewedItems();
}

export function removeRecentlyViewedFallback(): void {
  if (typeof window === 'undefined') return;
  writeRecentlyViewedItemsByType({ master: [], product: [], rental: [] });
}

export function mergeRecentlyViewedItems(
  stored: RecentlyViewedItem[],
  fallback: RecentlyViewedItem[] = [],
): RecentlyViewedItem[] {
  const itemsByType: RecentlyViewedItemsByType = { master: [], product: [], rental: [] };
  const seen = new Set<string>();

  // Process stored items
  const normalizedStored = stored.map(normalizeItem);
  for (const item of normalizedStored) {
    const key = item.href ?? `${item.itemType}-${item.id}`;
    if (seen.has(key)) continue;
    const type = item.itemType;
    if (type === 'master' || type === 'product' || type === 'rental') {
      if (itemsByType[type].length < MAX_ITEMS_PER_TYPE) {
        seen.add(key);
        itemsByType[type].push(item);
      }
    }
  }

  // Process fallback items
  for (const entry of fallback) {
    const normalized = normalizeItem(entry);
    const key = normalized.href ?? `${normalized.itemType}-${normalized.id}`;
    if (seen.has(key)) continue;
    const type = normalized.itemType;
    if (type === 'master' || type === 'product' || type === 'rental') {
      if (itemsByType[type].length < MAX_ITEMS_PER_TYPE) {
        seen.add(key);
        itemsByType[type].push(normalized);
      }
    }
  }

  // Save merged items
  writeRecentlyViewedItemsByType(itemsByType);
  return readRecentlyViewedItems();
}

export function mapFeaturedItemToRecentlyViewed(item: FeaturedItem): RecentlyViewedItem {
  const href = `/detailed/${item.type}/${item.id}`;
  // Use 'original' preset to get absolute URL without optimization params (for storage)
  const normalizedImage = item.image_url ? getOptimizedImageUrl(item.image_url, 'original') : "";
  const image = normalizedImage && normalizedImage.trim().length > 0 ? normalizedImage : undefined;

  let priceLabel: string | undefined;
  let price: number | undefined;
  let pricePerDay: number | undefined;

  if (item.type === 'master' && typeof item.price === 'number') {
    priceLabel = formatPrice(item.price, 'EUR');
    price = item.price;
  } else if (item.type === 'product' && typeof item.price === 'number') {
    priceLabel = formatPrice(item.price, 'EUR');
    price = item.price;
  } else if (item.type === 'rental' && typeof item.price_per_day === 'number') {
    priceLabel = `${formatPrice(item.price_per_day, 'EUR')} / day`;
    pricePerDay = item.price_per_day;
  }

  return normalizeItem({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle ?? undefined,
    image,
    rating: item.rating ?? undefined,
    priceLabel,
    href,
    itemType: item.type,
    city_name: item.city_name ?? null,
    category_id: item.category_id ?? null,
    category: item.category ?? undefined, // Keep for backward compatibility
    price,
    pricePerDay,
    totalReviews: item.total_reviews ?? undefined,
  });
}

export function clearRecentlyViewedItems(): void {
  if (typeof window === 'undefined') return;
  try {
    writeRecentlyViewedItemsByType({ master: [], product: [], rental: [] });
  } catch (error) {
    console.error('Failed to clear recently viewed items:', error);
  }
}

export function removeRecentlyViewedItem(targetHref: string): RecentlyViewedItem[] {
  if (typeof window === 'undefined' || !targetHref) return [];
  try {
    const itemsByType = readRecentlyViewedItemsByType();
    
    // Remove from all types
    itemsByType.master = itemsByType.master.filter((item) => item.href !== targetHref);
    itemsByType.product = itemsByType.product.filter((item) => item.href !== targetHref);
    itemsByType.rental = itemsByType.rental.filter((item) => item.href !== targetHref);
    
    writeRecentlyViewedItemsByType(itemsByType);
    return readRecentlyViewedItems();
  } catch (error) {
    console.error('Failed to remove recently viewed item:', error);
    return readRecentlyViewedItems();
  }
}

export function setRecentlyViewedFilter(type: CategoryType) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENTLY_VIEWED_FILTER_KEY, type);
    window.dispatchEvent(
      new CustomEvent(RECENTLY_VIEWED_FILTER_EVENT, {
        detail: { type },
      })
    );
  } catch (error) {
    console.error('Failed to set recently viewed filter:', error);
  }
}

export function getRecentlyViewedFilter(): CategoryType | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(RECENTLY_VIEWED_FILTER_KEY);
    if (stored && ['master', 'product', 'rental'].includes(stored)) {
      return stored as CategoryType;
    }
  } catch (error) {
    console.error('Failed to read recently viewed filter:', error);
  }
  return null;
}

export function clearRecentlyViewedItemsByType(type: CategoryType): void {
  if (typeof window === 'undefined') return;
  try {
    const itemsByType = readRecentlyViewedItemsByType();
    itemsByType[type] = [];
    writeRecentlyViewedItemsByType(itemsByType);
  } catch (error) {
    console.error('Failed to clear recently viewed items by type:', error);
  }
}


