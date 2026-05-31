/**
 * Authentication API functions
 */

import { apiPost, apiGet, apiPatch, setAuthToken, removeAuthToken } from './client';
import type { User, UserCreate, LoginRequest, Token, UserSelfUpdate } from './types';

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

