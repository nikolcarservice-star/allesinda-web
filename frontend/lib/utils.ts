import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { COLOR_MAP } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: string | number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount));
}

export function createUrl(pathname: string, params: URLSearchParams | string) {
  const paramsString = params?.toString();
  const queryString = `${paramsString.length ? '?' : ''}${paramsString}`;

  return `${pathname}${queryString}`;
}

export function getColorHex(colorName: string): string | [string, string] {
  const lowerColorName = colorName.toLowerCase();

  // Check for exact match first
  if (COLOR_MAP[lowerColorName]) {
    return COLOR_MAP[lowerColorName];
  }

  // Check for partial matches (for cases where color name might have extra text)
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (lowerColorName.includes(key) || key.includes(lowerColorName)) {
      return value;
    }
  }

  // Return a default color if no match found
  return '#666666';
}

export const getLabelPosition = (index: number): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' => {
  const positions = ['top-left', 'bottom-right', 'top-right', 'bottom-left'] as const;
  return positions[index % positions.length];
};

/**
 * Normalizes image URLs by replacing Windows-style backslashes with forward slashes.
 * This is necessary because Next.js image optimization doesn't handle backslashes correctly.
 * Also strips placeholder CDN URLs and converts them to local paths.
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return '';

  let normalized = url.replace(/\\/g, '/').trim();

  if (!normalized) {
    return '';
  }

  // Strip placeholder CDN URLs (convert to local paths)
  if (normalized.includes('your-cdn-url.com')) {
    try {
      const urlObj = new URL(normalized);
      // Extract the path from the placeholder URL
      normalized = urlObj.pathname + (urlObj.search || '');
      // Ensure it starts with /media/files if it's a media path
      if (!normalized.startsWith('/media/files') && !normalized.startsWith('/media/')) {
        // Try to preserve the path structure
        if (normalized.startsWith('/')) {
          // Already a path, keep it
        } else {
          normalized = `/${normalized}`;
        }
      }
    } catch {
      // If URL parsing fails, try to extract path manually
      const match = normalized.match(/your-cdn-url\.com([^?]*)/);
      if (match) {
        normalized = match[1] || '/media/files';
      }
    }
  }

  // Allow data URLs through unchanged
  if (normalized.startsWith('data:')) {
    return normalized;
  }

  // Handle real external URLs (not placeholders)
  if (/^https?:\/\//i.test(normalized)) {
    // Only return external URLs if they're not placeholders
    if (!normalized.includes('your-cdn-url.com')) {
      return normalized;
    }
    // If it's a placeholder, fall through to convert to local path
  }

  // Handle protocol-relative URLs (e.g. //cdn.example.com/image.jpg)
  if (normalized.startsWith('//')) {
    // Only if not a placeholder
    if (!normalized.includes('your-cdn-url.com')) {
      return `https:${normalized}`;
    }
    // Strip protocol-relative placeholder
    normalized = normalized.replace(/^\/\//, '/');
  }

  // Ensure leading slash for relative media paths so Next.js rewrites apply
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

/**
 * Image optimization presets for different use cases
 */
export type ImageOptimizationPreset = 
  | 'thumbnail'    // 300x300, quality 80 - for small thumbnails
  | 'card'         // 800x600, quality 85 - for product/master cards
  | 'gallery'      // 1200x800, quality 85 - for gallery views
  | 'full'         // 1920px max, quality 85 - for full-size images
  | 'original';    // No optimization

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  preset?: ImageOptimizationPreset;
}

/**
 * Generates an optimized image URL with query parameters for backend optimization.
 * Only applies optimization to backend media URLs (those starting with /media/files).
 * 
 * In production/server-side contexts, converts local paths to absolute URLs using API URL
 * so Next.js image optimization can fetch them correctly.
 * 
 * @param url - The original image URL
 * @param options - Optimization options (width, height, quality, or preset)
 * @returns Optimized image URL with query parameters
 */
export function optimizeImageUrl(
  url: string | undefined | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!url) return '';

  // Normalize the URL first
  let normalized = normalizeImageUrl(url);

  // Don't optimize data URLs, external URLs, or URLs that already have query params
  if (
    normalized.startsWith('data:') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.includes('?')
  ) {
    return normalized;
  }

  // Only optimize backend media URLs
  if (!normalized.startsWith('/media/files')) {
    return normalized;
  }

  // Convert local paths to absolute URLs using API URL
  // This is needed because:
  // 1. Next.js image optimization happens server-side and needs absolute URLs to fetch images
  //    (rewrite rules don't apply to server-side requests)
  // 2. In production on VPS, the Next.js server needs to fetch from the backend API
  // We do this for both client and server to avoid hydration mismatches
  if (process.env.NEXT_PUBLIC_API_URL) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      // Remove trailing slash from API URL if present
      const baseUrl = apiUrl.replace(/\/$/, '');
      // Ensure normalized path starts with /
      const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
      normalized = `${baseUrl}${path}`;
    } catch (error) {
      // If URL construction fails, continue with relative URL
      // (might fail in production, but better than breaking)
    }
  }

  // Apply preset if provided
  let width: number | undefined;
  let height: number | undefined;
  let quality: number | undefined;

  if (options.preset) {
    switch (options.preset) {
      case 'thumbnail':
        width = 300;
        height = 300;
        quality = 80;
        break;
      case 'card':
        width = 800;
        height = 600;
        quality = 85;
        break;
      case 'gallery':
        width = 1200;
        height = 800;
        quality = 85;
        break;
      case 'full':
        width = 1920;
        quality = 85;
        break;
      case 'original':
        return normalized; // No optimization
    }
  }

  // Override with explicit options if provided
  width = options.width ?? width;
  height = options.height ?? height;
  quality = options.quality ?? quality;

  // Build query parameters
  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality) params.set('q', quality.toString());

  // Return URL with query parameters
  return params.toString() ? `${normalized}?${params.toString()}` : normalized;
}

/**
 * Convenience function to get optimized image URL with preset.
 * This is the recommended way to use image optimization.
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  preset: ImageOptimizationPreset = 'card'
): string {
  return optimizeImageUrl(url, { preset });
}

/**
 * Checks if a URL is an external URL (CDN or external domain).
 * External URLs should use unoptimized prop in Next.js Image component
 * since they're already optimized by the backend/CDN.
 */
export function isExternalUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const normalized = normalizeImageUrl(url);
  return normalized.startsWith('http://') || normalized.startsWith('https://');
}

/**
 * Checks if a URL should use unoptimized prop in Next.js Image.
 * Returns true for:
 * - External URLs (CDN) since backend already optimizes them
 * 
 * Note: Local paths (like /media/files/...) should NOT use unoptimized,
 * even if they have query parameters, because Next.js needs to process them
 * through its optimization service to apply rewrites correctly.
 */
export function shouldUseUnoptimized(url: string | undefined | null): boolean {
  if (!url) return false;
  
  // Only external URLs (CDN) should use unoptimized
  // Local paths need Next.js optimization to apply rewrites correctly
  return isExternalUrl(url);
}
