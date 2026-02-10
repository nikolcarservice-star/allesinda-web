import type { StoreProduct, StoreCollection, Product, Collection } from './types';

// Default sample products for offline/fallback mode
export const DEFAULT_PRODUCTS: StoreProduct[] = [
  {
    id: 'gid://default/Product/1',
    title: 'Premium Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation and long battery life. Perfect for music lovers and professionals.',
    descriptionHtml: '<p>High-quality wireless headphones with noise cancellation and long battery life. Perfect for music lovers and professionals.</p>',
    handle: 'premium-wireless-headphones',
    productType: 'Electronics',
    options: [
      {
        id: 'color',
        name: 'Color',
        values: ['Black', 'White', 'Silver'],
      },
      {
        id: 'size',
        name: 'Size',
        values: ['Standard'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Premium Wireless Headphones',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '99.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '129.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/1',
            title: 'Black / Standard',
            price: {
              amount: '99.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [
              { name: 'Color', value: 'Black' },
              { name: 'Size', value: 'Standard' },
            ],
          },
        },
      ],
    },
  },
  {
    id: 'gid://default/Product/2',
    title: 'Smart Watch Pro',
    description: 'Feature-rich smartwatch with fitness tracking, heart rate monitor, and smartphone connectivity.',
    descriptionHtml: '<p>Feature-rich smartwatch with fitness tracking, heart rate monitor, and smartphone connectivity.</p>',
    handle: 'smart-watch-pro',
    productType: 'Electronics',
    options: [
      {
        id: 'color',
        name: 'Color',
        values: ['Black', 'Silver', 'Gold'],
      },
      {
        id: 'size',
        name: 'Band Size',
        values: ['Small', 'Medium', 'Large'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Smart Watch Pro',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '199.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '249.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/2',
            title: 'Black / Medium',
            price: {
              amount: '199.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [
              { name: 'Color', value: 'Black' },
              { name: 'Band Size', value: 'Medium' },
            ],
          },
        },
      ],
    },
  },
  {
    id: 'gid://default/Product/3',
    title: 'Leather Wallet',
    description: 'Genuine leather wallet with multiple card slots and cash compartments. Elegant and durable design.',
    descriptionHtml: '<p>Genuine leather wallet with multiple card slots and cash compartments. Elegant and durable design.</p>',
    handle: 'leather-wallet',
    productType: 'Accessories',
    options: [
      {
        id: 'color',
        name: 'Color',
        values: ['Brown', 'Black'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Leather Wallet',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '49.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '69.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/3',
            title: 'Brown',
            price: {
              amount: '49.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [{ name: 'Color', value: 'Brown' }],
          },
        },
      ],
    },
  },
  {
    id: 'gid://default/Product/4',
    title: 'Coffee Maker Deluxe',
    description: 'Professional-grade coffee maker with programmable settings and thermal carafe. Perfect for coffee enthusiasts.',
    descriptionHtml: '<p>Professional-grade coffee maker with programmable settings and thermal carafe. Perfect for coffee enthusiasts.</p>',
    handle: 'coffee-maker-deluxe',
    productType: 'Appliances',
    options: [
      {
        id: 'color',
        name: 'Color',
        values: ['Black', 'Silver', 'White'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Coffee Maker Deluxe',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '89.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '119.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/4',
            title: 'Black',
            price: {
              amount: '89.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [{ name: 'Color', value: 'Black' }],
          },
        },
      ],
    },
  },
  {
    id: 'gid://default/Product/5',
    title: 'Running Shoes',
    description: 'Comfortable and lightweight running shoes with advanced cushioning technology. Ideal for daily workouts and long runs.',
    descriptionHtml: '<p>Comfortable and lightweight running shoes with advanced cushioning technology. Ideal for daily workouts and long runs.</p>',
    handle: 'running-shoes',
    productType: 'Footwear',
    options: [
      {
        id: 'color',
        name: 'Color',
        values: ['Black', 'White', 'Blue'],
      },
      {
        id: 'size',
        name: 'Size',
        values: ['7', '8', '9', '10', '11', '12'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Running Shoes',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '79.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '99.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/5',
            title: 'Black / 9',
            price: {
              amount: '79.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [
              { name: 'Color', value: 'Black' },
              { name: 'Size', value: '9' },
            ],
          },
        },
      ],
    },
  },
  {
    id: 'gid://default/Product/6',
    title: 'Portable Power Bank',
    description: 'High-capacity portable power bank with fast charging support. Keep your devices powered on the go.',
    descriptionHtml: '<p>High-capacity portable power bank with fast charging support. Keep your devices powered on the go.</p>',
    handle: 'portable-power-bank',
    productType: 'Electronics',
    options: [
      {
        id: 'capacity',
        name: 'Capacity',
        values: ['10000mAh', '20000mAh'],
      },
      {
        id: 'color',
        name: 'Color',
        values: ['Black', 'White'],
      },
    ],
    images: {
      edges: [
        {
          node: {
            url: '/placeholder.jpg',
            altText: 'Portable Power Bank',
            thumbhash: undefined,
          },
        },
      ],
    },
    priceRange: {
      minVariantPrice: {
        amount: '29.99',
        currencyCode: 'USD',
      },
    },
    compareAtPriceRange: {
      minVariantPrice: {
        amount: '39.99',
        currencyCode: 'USD',
      },
    },
    variants: {
      edges: [
        {
          node: {
            id: 'gid://default/ProductVariant/6',
            title: '10000mAh / Black',
            price: {
              amount: '29.99',
              currencyCode: 'USD',
            },
            availableForSale: true,
            selectedOptions: [
              { name: 'Capacity', value: '10000mAh' },
              { name: 'Color', value: 'Black' },
            ],
          },
        },
      ],
    },
  },
];

// Default sample collections for offline/fallback mode
export const DEFAULT_COLLECTIONS: StoreCollection[] = [
  {
    id: 'gid://default/Collection/1',
    title: 'Featured',
    handle: 'featured',
    description: 'Featured products collection',
    image: {
      url: '/placeholder.jpg',
      altText: 'Featured Collection',
    },
  },
  {
    id: 'gid://default/Collection/2',
    title: 'New Arrivals',
    handle: 'new-arrivals',
    description: 'Latest products in our store',
    image: {
      url: '/placeholder.jpg',
      altText: 'New Arrivals',
    },
  },
];

// Helper to check if we should use default data (when API is unreachable)
export function shouldUseDefaultData(error: unknown): boolean {
  if (!error) return false;
  
  // Check for network errors
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    if (message.includes('fetch') || message.includes('network')) {
      return true;
    }
  }
  
  // Check for connection errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('refused') ||
      message.includes('aborted') ||
      message.includes('abort') ||
      message.includes('unreachable') ||
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      message.includes('request timeout')
    );
  }
  
  return false;
}

