/**
 * Thin typed JSON wrapper around AsyncStorage.
 *
 * Why this exists: every mock service in `src/services/*` keeps its data in
 * a plain in-memory array, which means anything a user creates (a digitized
 * design, a production job, a toggled favorite, a deleted item) silently
 * vanishes on the next page refresh / app relaunch — there was no real
 * persistence anywhere in the app. `@react-native-async-storage/async-
 * storage` already ships as a dependency and works on both web (backed by
 * localStorage/IndexedDB) and native (backed by SQLite/a native KV store),
 * so it's the natural place to add real, zero-backend persistence without
 * waiting on a hosted database.
 *
 * Kept intentionally dumb: get/set/remove of a JSON-serializable value under
 * a namespaced key, with every method failing soft (returns the provided
 * fallback / resolves silently) so a storage error (quota exceeded, private
 * browsing restrictions, etc.) never crashes a screen — the app just behaves
 * as if nothing was persisted yet.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const NAMESPACE = 'stitchpro';

function namespacedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export const localStore = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(namespacedKey(key));
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(namespacedKey(key), JSON.stringify(value));
    } catch {
      // Best-effort persistence only — a write failure (e.g. storage quota)
      // should never break the in-memory flow that already happened.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(namespacedKey(key));
    } catch {
      // ignore
    }
  },
};
