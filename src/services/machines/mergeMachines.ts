/**
 * Pure logic for combining the hardcoded seed machine fleet with persisted
 * user changes (added machines, status toggles, deletions). See
 * ../designs/mergeDesigns.ts for the fuller pattern this family of modules
 * follows; kept free of React Native/AsyncStorage imports so it's
 * unit-testable with plain Node.
 */

import type { Machine } from '../types';

export interface MachinesPersistedState {
  created: Machine[];
  statusOverrides: Record<string, Machine['status']>;
  deletedSeedIds: string[];
}

export function emptyMachinesState(): MachinesPersistedState {
  return { created: [], statusOverrides: {}, deletedSeedIds: [] };
}

export function mergeMachines(seed: Machine[], state: MachinesPersistedState): Machine[] {
  const remainingSeed = seed
    .filter((m) => !state.deletedSeedIds.includes(m.id))
    .map((m) => applyStatusOverride(m, state.statusOverrides));
  const created = state.created.map((m) => applyStatusOverride(m, state.statusOverrides));
  return [...remainingSeed, ...created];
}

function applyStatusOverride(
  machine: Machine,
  overrides: Record<string, Machine['status']>
): Machine {
  if (!(machine.id in overrides)) return machine;
  return { ...machine, status: overrides[machine.id] };
}

export function addCreatedMachine(
  state: MachinesPersistedState,
  machine: Machine
): MachinesPersistedState {
  return { ...state, created: [...state.created, machine] };
}

export function setMachineStatusInState(
  state: MachinesPersistedState,
  id: string,
  isCreated: boolean,
  status: Machine['status']
): MachinesPersistedState {
  if (isCreated) {
    return {
      ...state,
      created: state.created.map((m) => (m.id === id ? { ...m, status } : m)),
    };
  }
  return { ...state, statusOverrides: { ...state.statusOverrides, [id]: status } };
}

export function removeMachineFromState(
  state: MachinesPersistedState,
  id: string
): MachinesPersistedState {
  const wasCreated = state.created.some((m) => m.id === id);
  if (wasCreated) {
    return { ...state, created: state.created.filter((m) => m.id !== id) };
  }
  if (state.deletedSeedIds.includes(id)) return state;
  return { ...state, deletedSeedIds: [...state.deletedSeedIds, id] };
}
