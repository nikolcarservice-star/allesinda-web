'use server';

import { TAGS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import {
  createCart as createStoreCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  getCart as getStoreCart,
} from '@/lib/store/api';
import type { Cart, CartItem, StoreCart, StoreCartLine } from '@/lib/store/types';

// Local adapter utilities to return FE Cart (avoid cyclic deps)
function adaptCartLine(storeLine: StoreCartLine): CartItem {
  const merchandise = storeLine.merchandise;
  const product = merchandise.product;

  return {
    id: storeLine.id,
    quantity: storeLine.quantity,
    cost: {
      totalAmount: {
        amount: (parseFloat(merchandise.price.amount) * storeLine.quantity).toString(),
        currencyCode: merchandise.price.currencyCode,
      },
    },
    merchandise: {
      id: merchandise.id,
      title: merchandise.title,
      selectedOptions: merchandise.selectedOptions || [],
      product: {
        id: product.title,
        title: product.title,
        handle: product.handle,
        categoryId: undefined,
        description: '',
        descriptionHtml: '',
        featuredImage: product.images?.edges?.[0]?.node
          ? {
              ...product.images.edges[0].node,
              altText: product.images.edges[0].node.altText || product.title,
              height: 600,
              width: 600,
              thumbhash: product.images.edges[0].node.thumbhash || undefined,
            }
          : { url: '', altText: '', height: 0, width: 0 },
        currencyCode: merchandise.price.currencyCode,
        priceRange: {
          minVariantPrice: merchandise.price,
          maxVariantPrice: merchandise.price,
        },
        compareAtPrice: undefined,
        seo: { title: product.title, description: '' },
        options: [],
        tags: [],
        variants: [],
        images:
          product.images?.edges?.map((edge: any) => ({
            ...edge.node,
            altText: edge.node.altText || product.title,
            height: 600,
            width: 600,
          })) || [],
        availableForSale: true,
      },
    },
  } satisfies CartItem;
}

function adaptCart(storeCart: StoreCart | null): Cart | null {
  if (!storeCart) return null;

  const lines = storeCart.lines?.edges?.map((edge: any) => adaptCartLine(edge.node)) || [];

  return {
    id: storeCart.id,
    checkoutUrl: storeCart.checkoutUrl,
    cost: {
      subtotalAmount: storeCart.cost.subtotalAmount,
      totalAmount: storeCart.cost.totalAmount,
      totalTaxAmount: storeCart.cost.totalTaxAmount,
    },
    totalQuantity: lines.reduce((sum: number, line: CartItem) => sum + line.quantity, 0),
    lines,
  } satisfies Cart;
}

async function getOrCreateCartId(): Promise<string> {
  let cartId = (await cookies()).get('cartId')?.value;
  if (!cartId) {
    const newCart = await createStoreCart();
    cartId = newCart.id;
    (await cookies()).set('cartId', cartId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return cartId;
}

// Add item server action: returns adapted Cart
export async function addItem(variantId: string | undefined): Promise<Cart | null> {
  if (!variantId) return null;
  try {
    const cartId = await getOrCreateCartId();
    await addCartLines(cartId, [{ merchandiseId: variantId, quantity: 1 }]);
    const fresh = await getStoreCart(cartId);
    revalidateTag(TAGS.cart);
    return adaptCart(fresh);
  } catch (error) {
    logger.error('Error adding item to cart:', error);
    return null;
  }
}

// Update item server action (quantity 0 removes): returns adapted Cart
export async function updateItem({ lineId, quantity }: { lineId: string; quantity: number }): Promise<Cart | null> {
  try {
    const cartId = (await cookies()).get('cartId')?.value;
    if (!cartId) return null;

    if (quantity === 0) {
      await removeCartLines(cartId, [lineId]);
    } else {
      await updateCartLines(cartId, [{ id: lineId, quantity }]);
    }

    const fresh = await getStoreCart(cartId);
    revalidateTag(TAGS.cart);
    return adaptCart(fresh);
  } catch (error) {
    logger.error('Error updating item:', error);
    return null;
  }
}

export async function createCartAndSetCookie() {
  try {
    const newCart = await createStoreCart();

    (await cookies()).set('cartId', newCart.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return newCart;
  } catch (error) {
    logger.error('Error creating cart:', error);
    return null;
  }
}

export async function getCart(): Promise<Cart | null> {
  try {
    const cartId = (await cookies()).get('cartId')?.value;

    if (!cartId) {
      return null;
    }
    const fresh = await getStoreCart(cartId);
    return adaptCart(fresh);
  } catch (error) {
    logger.error('Error fetching cart:', error);
    return null;
  }
}
