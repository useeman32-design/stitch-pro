/**
 * Auth service — mock implementation.
 * Replace with real session/token handling when a backend is connected.
 */

import type { User } from '../types';

const mockUser: User = {
  id: 'usr_tunde',
  name: 'Tunde Adeyemi',
  email: 'tunde@stitchpro.app',
  plan: 'Pro Plan',
  creditsUsed: 72,
  creditsTotal: 100,
};

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const authService = {
  async getCurrentUser(): Promise<User> {
    return delay(mockUser);
  },
};
