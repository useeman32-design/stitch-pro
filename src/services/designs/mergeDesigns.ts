/**
 * Pure logic for combining the app's hardcoded seed designs (bundled via
 * `require()`, so their thumbnails are only ever valid as static source-code
 * references — never something we can serialize into AsyncStorage) with
 * whatever the user has actually created/favorited/deleted, which *is*
 * persisted.
 *
 * Deliberately kept free of AsyncStorage/React Native imports so it can be
 * unit-tested with plain Node (see scripts/test-merge-designs.mjs) without
 * needing a RN/Jest test environment, which this project doesn't otherwise
 * have set up.
 */

import type { Design } from '../types';

export interface DesignsPersistedState {
  /** User-created designs, newest first. Always have a durable (data: URI
   * or remote http(s)) thumbnail — never a bundler `require()` id, since
   * those aren't stable to serialize. */
  created: Design[];
  /** Favorite flag overrides, keyed by design id. Applies to both seed and
   * created designs so toggling a favorite on a built-in sample design
   * persists too. */
  favorites: Record<string, boolean>;
  /** Ids of seed designs the user deleted. Seed designs are hardcoded
   * source, so "deleting" one is a tombstone rather than a real removal. */
  deletedSeedIds: string[];
}

export function emptyPersistedState(): DesignsPersistedState {
  return { created: [], favorites: {}, deletedSeedIds: [] };
}

/**
 * Combines the hardcoded seed list with persisted state into the final
 * array screens should render: created designs first (most recent work at
 * the top, matching the existing `unshift`-on-create behavior), then
 * non-deleted seed designs in their original order, with favorite overrides
 * applied to both.
 */
export function mergeDesigns(seed: Design[], state: DesignsPersistedState): Design[] {
  const created = state.created.map((d) => applyFavoriteOverride(d, state.favorites));
  const remainingSeed = seed
    .filter((d) => !state.deletedSeedIds.includes(d.id))
    .map((d) => applyFavoriteOverride(d, state.favorites));
  return [...created, ...remainingSeed];
}

function applyFavoriteOverride(design: Design, favorites: Record<string, boolean>): Design {
  if (!(design.id in favorites)) return design;
  return { ...design, favorite: favorites[design.id] };
}

/** Returns a new state with `id`'s favorite flag flipped relative to its
 * current effective value in `currentDesigns` (the already-merged list). */
export function toggleFavoriteInState(
  state: DesignsPersistedState,
  id: string,
  currentlyFavorite: boolean
): DesignsPersistedState {
  return {
    ...state,
    favorites: { ...state.favorites, [id]: !currentlyFavorite },
  };
}

/** Removes a design by id: drops it outright if it's a user-created design,
 * otherwise tombstones it as a deleted seed id. */
export function removeDesignFromState(
  state: DesignsPersistedState,
  id: string
): DesignsPersistedState {
  const wasCreated = state.created.some((d) => d.id === id);
  if (wasCreated) {
    return { ...state, created: state.created.filter((d) => d.id !== id) };
  }
  if (state.deletedSeedIds.includes(id)) return state;
  return { ...state, deletedSeedIds: [...state.deletedSeedIds, id] };
}

export function addCreatedDesign(
  state: DesignsPersistedState,
  design: Design
): DesignsPersistedState {
  return { ...state, created: [design, ...state.created] };
}
