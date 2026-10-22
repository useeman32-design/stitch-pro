/**
 * Pure logic for layering persisted profile edits + preferences on top of
 * the hardcoded mock user/defaults. See ../designs/mergeDesigns.ts for the
 * fuller pattern this family of modules follows; kept free of React
 * Native/AsyncStorage imports so it's unit-testable with plain Node.
 */

import type { User, UserPreferences } from '../types';

export interface ProfileOverrides {
  name?: string;
  email?: string;
}

export const defaultPreferences: UserPreferences = {
  defaultFormat: 'DST',
  defaultHoop: '100x100',
  unit: 'mm',
  notifyJobs: true,
  notifyDesigns: true,
  notifyWeekly: false,
};

export function applyProfileOverrides(user: User, overrides: ProfileOverrides): User {
  return {
    ...user,
    name: overrides.name ?? user.name,
    email: overrides.email ?? user.email,
  };
}

export function mergePreferences(
  stored: Partial<UserPreferences> | null
): UserPreferences {
  return { ...defaultPreferences, ...(stored ?? {}) };
}
