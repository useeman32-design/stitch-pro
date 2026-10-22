/**
 * Pure logic for combining the hardcoded seed thread library with
 * persisted user-added threads. Threads have no update/delete UI today
 * (only "add a custom thread"), so this is intentionally the simplest of
 * the three merge modules -- see ../designs/mergeDesigns.ts for the fuller
 * pattern this family of modules follows.
 */

import type { ThreadColor } from '../types';

export interface ThreadsPersistedState {
  created: ThreadColor[];
}

export function emptyThreadsState(): ThreadsPersistedState {
  return { created: [] };
}

export function mergeThreads(seed: ThreadColor[], state: ThreadsPersistedState): ThreadColor[] {
  return [...state.created, ...seed];
}

export function addCreatedThread(
  state: ThreadsPersistedState,
  thread: ThreadColor
): ThreadsPersistedState {
  return { created: [thread, ...state.created] };
}
