/**
 * Auth service — real local persistence for profile edits + preferences on
 * top of a mock session user. There's no real login/backend yet, but the
 * Settings screen's "Save Changes" used to be entirely fake -- it ran a
 * 400ms timeout and showed a success toast without storing anything at
 * all, so every field (name, email, default format/hoop, units,
 * notification toggles) silently reverted on the next reload. This wires
 * it up to real AsyncStorage-backed storage, same pattern as the other
 * services in src/services/*.
 */

import type { User, UserPreferences } from '../types';
import { localStore } from '../storage/localStore';
import { applyProfileOverrides, mergePreferences, type ProfileOverrides } from './mergeProfile';

const PROFILE_KEY = 'auth.profile.v1';
const PREFERENCES_KEY = 'auth.preferences.v1';

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
    const overrides = await localStore.get<ProfileOverrides>(PROFILE_KEY, {});
    return delay(applyProfileOverrides(mockUser, overrides));
  },

  async updateProfile(input: { name: string; email: string }): Promise<User> {
    await localStore.set<ProfileOverrides>(PROFILE_KEY, input);
    return delay(applyProfileOverrides(mockUser, input), 300);
  },

  async getPreferences(): Promise<UserPreferences> {
    const stored = await localStore.get<Partial<UserPreferences> | null>(PREFERENCES_KEY, null);
    return delay(mergePreferences(stored));
  },

  async updatePreferences(input: UserPreferences): Promise<UserPreferences> {
    await localStore.set<UserPreferences>(PREFERENCES_KEY, input);
    return delay(input, 300);
  },
};
