/**
 * Parses various store URL formats and returns the correct store domain
 * Handles:
 * - your-store.domain.com (correct format)
 * - https://your-store.domain.com (with protocol)
 * - https://admin.domain.com/store/store-id/ (admin URL)
 * - store-id (just the store identifier)
 */
export function parseStoreDomain(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Clean up the input
  const cleanInput = input.trim();

  // Case 1: Full URL with protocol - https://your-store.domain.com
  const fullUrlMatch = cleanInput.match(/https?:\/\/([^/]+)/i);
  if (fullUrlMatch) {
    return fullUrlMatch[1];
  }

  // Case 2: Already correct format - your-store.domain.com
  if (cleanInput.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)) {
    return cleanInput.toLowerCase();
  }

  // If none of the patterns match, return null
  return null;
}


