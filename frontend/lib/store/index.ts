import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from 'next/cache';
import { TAGS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { DEFAULT_COLLECTIONS, DEFAULT_PRODUCTS, shouldUseDefaultData } from './default-data';
import { DEFAULT_PAGE_SIZE } from './constants';
import {
  getCollections as getStoreCollections,
  getProducts as getStoreProducts,
  getCollectionProducts as getStoreCollectionProducts,
  getProduct as getStoreProduct,
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
} from './api';
import { thumbhashToDataURL } from './utils';
import type {
  StoreProduct,
  StoreCollection,
  Product,
  Collection,
  Cart,
  ProductOption,
  ProductVariant,
  Money,
  ProductCollectionSortKey,
  ProductSortKey,
} from './types';

// Utility function to extract the first sentence from a description
function getFirstSentence(text: string): string {
  if (!text) return '';

  const cleaned = text.trim();
  const match = cleaned.match(/^[^.!?]*[.!?]/);

  if (match) {
    return match[0].trim();
  }

  if (cleaned.length > 100) {
    return cleaned.substring(0, 100).trim() + '...';
  }

  return cleaned;
}

// Helper functions for consistent data transformation

function transformStoreMoney(storeMoney: { amount: string; currencyCode: string } | undefined): Money {
  return {
    amount: storeMoney?.amount || '0',
    currencyCode: storeMoney?.currencyCode || 'EUR',
  };
}

function transformStoreOptions(
  storeOptions: Array<{ id?: string; name: string; values: string[] }>
): ProductOption[] {
  return storeOptions.map(option => ({
    id: option.id || option.name.toLowerCase().replace(/\s+/g, '-'),
    name: option.name,
    values: option.values.map(value => ({
      id: value.toLowerCase().replace(/\s+/g, '-'),
      name: value,
    })),
  }));
}

function transformStoreVariants(storeVariants: { edges: Array<{ node: any }> } | undefined): ProductVariant[] {
  if (!Array.isArray(storeVariants?.edges)) return [];

  return storeVariants.edges.map(edge => ({
    id: edge.node.id,
    title: edge.node.title || '',
    availableForSale: edge.node.availableForSale !== false,
    price: transformStoreMoney(edge.node.price),
    selectedOptions: edge.node.selectedOptions || [],
  }));
}

// Main adapter functions
function adaptStoreCollection(storeCollection: StoreCollection): Collection {
  return {
    ...storeCollection,
    seo: {
      title: storeCollection.title,
      description: storeCollection.description || '',
    },
    parentCategoryTree: [],
    updatedAt: new Date().toISOString(),
    path: `/shop/${storeCollection.handle}`,
  };
}

function adaptStoreProduct(storeProduct: StoreProduct): Product {
  const firstImage = storeProduct.images?.edges?.[0]?.node;
  const description = getFirstSentence(storeProduct.description || '');

  return {
    ...storeProduct,
    description,
    categoryId: storeProduct.productType || storeProduct.category?.name,
    tags: [],
    availableForSale: true,
    currencyCode: storeProduct.priceRange?.minVariantPrice?.currencyCode || 'EUR',
    featuredImage: firstImage
      ? {
          ...firstImage,
          altText: firstImage.altText || storeProduct.title || '',
          height: 600,
          width: 600,
          thumbhash: firstImage.thumbhash ? thumbhashToDataURL(firstImage.thumbhash) : undefined,
        }
      : { url: '', altText: '', height: 0, width: 0 },
    seo: {
      title: storeProduct.title || '',
      description,
    },
    priceRange: {
      minVariantPrice: transformStoreMoney(storeProduct.priceRange?.minVariantPrice),
      maxVariantPrice: transformStoreMoney(storeProduct.priceRange?.minVariantPrice),
    },
    compareAtPrice:
      storeProduct.compareAtPriceRange?.minVariantPrice &&
      parseFloat(storeProduct.compareAtPriceRange.minVariantPrice.amount) >
        parseFloat(storeProduct.priceRange?.minVariantPrice?.amount || '0')
        ? transformStoreMoney(storeProduct.compareAtPriceRange.minVariantPrice)
        : undefined,
    images:
      storeProduct.images?.edges?.map(edge => ({
        ...edge.node,
        altText: edge.node.altText || storeProduct.title || '',
        height: 600,
        width: 600,
        thumbhash: edge.node.thumbhash ? thumbhashToDataURL(edge.node.thumbhash) : undefined,
      })) || [],
    options: transformStoreOptions(storeProduct.options || []),
    variants: transformStoreVariants(storeProduct.variants),
  };
}

// Cart adapting happens in server actions to avoid cyclic deps

// Public API functions
export async function getCollections(): Promise<Collection[]> {
  'use cache';
  cacheTag(TAGS.collections);
  cacheLife('minutes');

  try {
    const storeCollections = await getStoreCollections();
    return storeCollections.map(adaptStoreCollection);
  } catch (error) {
    if (shouldUseDefaultData(error)) {
      logger.warn('API unreachable, using default collections');
      return DEFAULT_COLLECTIONS.map(adaptStoreCollection);
    }
    logger.error('Error fetching collections:', error);
    return [];
  }
}

export async function getCollection(handle: string): Promise<Collection | null> {
  'use cache';
  cacheTag(TAGS.collections);
  cacheLife('minutes');

  try {
    const collections = await getStoreCollections();
    const collection = collections.find(collection => collection.handle === handle);
    return collection ? adaptStoreCollection(collection) : null;
  } catch (error) {
    if (shouldUseDefaultData(error)) {
      logger.warn('API unreachable, using default collection');
      const defaultCollection = DEFAULT_COLLECTIONS.find(c => c.handle === handle);
      return defaultCollection ? adaptStoreCollection(defaultCollection) : (DEFAULT_COLLECTIONS[0] ? adaptStoreCollection(DEFAULT_COLLECTIONS[0]) : null);
    }
    logger.error('Error fetching collection:', error);
    return null;
  }
}

export async function getProduct(handle: string): Promise<Product | null> {
  'use cache';
  cacheTag(TAGS.products);
  cacheLife('minutes');

  try {
    const storeProduct = await getStoreProduct(handle);
    return storeProduct ? adaptStoreProduct(storeProduct) : null;
  } catch (error) {
    if (shouldUseDefaultData(error)) {
      logger.warn('API unreachable, using default product');
      const defaultProduct = DEFAULT_PRODUCTS.find(p => p.handle === handle);
      if (defaultProduct) {
        return adaptStoreProduct(defaultProduct);
      }
      // Return first default product if handle doesn't match
      if (DEFAULT_PRODUCTS[0]) {
        return adaptStoreProduct(DEFAULT_PRODUCTS[0]);
      }
    }
    logger.error('Error fetching product:', error);
    return null;
  }
}

export async function getProducts(params: {
  limit?: number;
  sortKey?: ProductSortKey;
  reverse?: boolean;
  query?: string;
}): Promise<Product[]> {
  'use cache';
  cacheTag(TAGS.products);
  cacheLife('minutes');

  try {
    // Map limit to first for legacy API
    const first = params.limit || DEFAULT_PAGE_SIZE;
    const storeProducts = await getStoreProducts({
      first,
      sortKey: params.sortKey,
      reverse: params.reverse,
      query: params.query,
    });
    return storeProducts.map(adaptStoreProduct);
  } catch (error) {
    if (shouldUseDefaultData(error)) {
      logger.warn('API unreachable, using default products');
      // Filter default products if search query is provided
      let defaultProducts = DEFAULT_PRODUCTS;
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        defaultProducts = DEFAULT_PRODUCTS.filter(
          p =>
            p.title.toLowerCase().includes(queryLower) ||
            p.description.toLowerCase().includes(queryLower)
        );
      }
      return defaultProducts.slice(0, params.limit || DEFAULT_PAGE_SIZE).map(adaptStoreProduct);
    }
    logger.error('Error fetching products:', error);
    return [];
  }
}

export async function getCollectionProducts(params: {
  collection: string;
  limit?: number;
  sortKey?: ProductCollectionSortKey;
  reverse?: boolean;
  query?: string;
}): Promise<Product[]> {
  'use cache';
  cacheTag(TAGS.collectionProducts);
  cacheLife('minutes');

  try {
    const storeProducts = await getStoreCollectionProducts(params);
    return storeProducts.map(adaptStoreProduct);
  } catch (error) {
    if (shouldUseDefaultData(error)) {
      logger.warn('API unreachable, using default products for collection');
      // Filter default products if search query is provided
      let defaultProducts = DEFAULT_PRODUCTS;
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        defaultProducts = DEFAULT_PRODUCTS.filter(
          p =>
            p.title.toLowerCase().includes(queryLower) ||
            p.description.toLowerCase().includes(queryLower)
        );
      }
      return defaultProducts.slice(0, params.limit || DEFAULT_PAGE_SIZE).map(adaptStoreProduct);
    }
    logger.error('Error fetching collection products:', error);
    return [];
  }
}

export async function getCart(): Promise<Cart | null> {
  try {
    const { getCart: getCartAction } = await import('@/components/cart/actions');
    return await getCartAction();
  } catch (error) {
    logger.error('Error fetching cart:', error);
    return null;
  }
}

// Re-export cart mutation functions (these are properly typed in api.ts)
export { createCart, addCartLines, updateCartLines, removeCartLines };


