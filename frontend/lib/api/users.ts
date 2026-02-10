/**
 * Users API functions
 */

import { apiGet } from './client';
import type { User } from './types';

/**
 * Get user by ID
 * Note: This assumes the backend has an endpoint like /users/{id} or /auth/users/{id}
 * If the endpoint doesn't exist, this will need to be implemented on the backend
 */
export async function getUser(userId: number): Promise<User> {
  try {
    // Try /users/{id} first
    return await apiGet<User>(`/users/${userId}`);
  } catch (error: any) {
    // If that fails, try /auth/users/{id}
    if (error?.statusCode === 404) {
      try {
        return await apiGet<User>(`/auth/users/${userId}`);
      } catch {
        throw error;
      }
    }
    throw error;
  }
}

