/**
 * Authentication API functions
 */

import { apiPost, apiGet, apiPatch, setAuthToken, removeAuthToken, ApiClientError } from './client';
import type { User, UserCreate, LoginRequest, Token, UserSelfUpdate } from './types';

export interface AccountDeletionResponse {
  message: string;
  recovery_until: string;
}

type PendingDeletionDetail = {
  code?: string;
  message?: string;
  recovery_until?: string;
};

export function isPendingDeletionError(err: unknown): boolean {
  if (!(err instanceof ApiClientError) || err.statusCode !== 403) return false;
  const detail = err.errors;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return (detail as PendingDeletionDetail).code === 'account_pending_deletion';
  }
  return false;
}

export function getPendingDeletionMessage(err: unknown): string {
  const detail = err instanceof ApiClientError ? err.errors : null;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const message = (detail as PendingDeletionDetail).message;
    if (message) return message;
  }
  return 'Ihr Konto wurde zur Löschung vorgemerkt.';
}

export function getPendingDeletionRecoveryUntil(err: unknown): string | null {
  const detail = err instanceof ApiClientError ? err.errors : null;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return (detail as PendingDeletionDetail).recovery_until ?? null;
  }
  return null;
}

/**
 * Register a new user
 */
export async function register(data: UserCreate): Promise<User> {
  const response = await apiPost<User>('/auth/register', data);
  return response;
}

/**
 * Login and get access token
 */
export async function login(data: LoginRequest): Promise<Token> {
  const response = await apiPost<Token>('/auth/login', data);
  
  // Store token
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

/**
 * Logout (clear token)
 */
export function logout(): void {
  removeAuthToken();
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiGet<User>('/auth/me');
  return response;
}

/**
 * Update current user's account fields (name, phone)
 */
export async function updateCurrentUser(data: UserSelfUpdate): Promise<User> {
  return apiPatch<User>('/auth/me', data);
}

/**
 * Schedule account deletion (14-day recovery period)
 */
export async function requestAccountDeletion(
  password: string,
  confirmation: string,
): Promise<AccountDeletionResponse> {
  return apiPost<AccountDeletionResponse>('/auth/me/request-deletion', {
    password,
    confirmation,
  });
}

/**
 * Restore account within the 14-day grace period
 */
export async function restoreAccount(data: LoginRequest): Promise<Token> {
  const response = await apiPost<Token>('/auth/me/restore', data);
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  return response;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}

/**
 * Forgot password
 */
export async function forgotPassword(data: { email: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/forgot-password', data);
}

/**
 * Reset password
 */
export async function resetPassword(data: { token: string; new_password: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/reset-password', data);
}

/**
 * Change password
 */
export async function changePassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/change-password', data);
}

/**
 * Verify email
 */
export async function verifyEmail(data: { token: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/verify-email', data);
}

/**
 * Resend verification email
 */
export async function resendVerification(data: { email: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/resend-verification', data);
}

/**
 * Setup 2FA
 */
export async function setup2FA(): Promise<{ secret: string; qr_code_url: string; backup_codes: string[] }> {
  return apiPost<{ secret: string; qr_code_url: string; backup_codes: string[] }>('/auth/2fa/setup', {});
}

/**
 * Verify and enable 2FA
 */
export async function verify2FA(data: { code: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/2fa/verify', data);
}

/**
 * Disable 2FA
 */
export async function disable2FA(data: { password: string; code: string }): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/2fa/disable', data);
}

/**
 * Social login
 */
export async function socialLogin(data: { provider: 'google' | 'facebook'; access_token: string }): Promise<Token> {
  const response = await apiPost<Token>('/auth/social-login', data);
  
  // Store token
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

