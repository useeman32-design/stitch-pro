/**
 * Machines service — real local persistence on top of a hardcoded seed
 * fleet. Used by the Machine Center. See designs/index.ts's docstring for
 * why this pattern exists (previously everything reverted on refresh).
 */

import type { Machine } from '../types';
import { localStore } from '../storage/localStore';
import {
  addCreatedMachine,
  emptyMachinesState,
  mergeMachines,
  removeMachineFromState,
  setMachineStatusInState,
  type MachinesPersistedState,
} from './mergeMachines';

const STATE_KEY = 'machines.state.v1';

const seedMachines: Machine[] = [
  {
    id: 'mch_ricoma',
    name: 'Ricoma MT-1501',
    brand: 'Ricoma',
    model: 'MT-1501',
    status: 'active',
    defaultFormat: 'DST',
    hoopSizes: ['100x100', '120x180', '300x200'],
    needleCount: 15,
    notes: 'Primary production machine — left chest & cap runs.',
  },
  {
    id: 'mch_tajima',
    name: 'Tajima TMAR-KC',
    brand: 'Tajima',
    model: 'TMAR-KC',
    status: 'offline',
    defaultFormat: 'DST',
    hoopSizes: ['140x200', '360x200'],
    needleCount: 12,
    notes: 'Awaiting a bobbin-case service before its next job.',
  },
  {
    id: 'mch_brother',
    name: 'Brother PR1055X',
    brand: 'Brother',
    model: 'PR1055X',
    status: 'active',
    defaultFormat: 'PES',
    hoopSizes: ['100x100', '130x180'],
    needleCount: 10,
    notes: 'Small-run and sample machine near the front desk.',
  },
];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextMachineSeq = 1;

async function loadState(): Promise<MachinesPersistedState> {
  return localStore.get<MachinesPersistedState>(STATE_KEY, emptyMachinesState());
}

async function saveState(state: MachinesPersistedState): Promise<void> {
  await localStore.set(STATE_KEY, state);
}

export const machinesService = {
  async list(): Promise<Machine[]> {
    const state = await loadState();
    return delay(mergeMachines(seedMachines, state));
  },

  async get(id: string): Promise<Machine | undefined> {
    const state = await loadState();
    return delay(mergeMachines(seedMachines, state).find((m) => m.id === id));
  },

  async create(input: {
    name: string;
    brand: string;
    model: string;
    defaultFormat: Machine['defaultFormat'];
    hoopSizes: string[];
    needleCount?: number;
  }): Promise<Machine> {
    const machine: Machine = {
      id: `mch_new_${Date.now()}_${nextMachineSeq++}`,
      name: input.name,
      brand: input.brand,
      model: input.model,
      status: 'active',
      defaultFormat: input.defaultFormat,
      hoopSizes: input.hoopSizes,
      needleCount: input.needleCount,
    };
    const state = await loadState();
    await saveState(addCreatedMachine(state, machine));
    return delay(machine, 250);
  },

  async toggleStatus(id: string): Promise<Machine | undefined> {
    const state = await loadState();
    const current = mergeMachines(seedMachines, state).find((m) => m.id === id);
    if (!current) return delay(undefined, 200);
    const nextStatus = current.status === 'active' ? 'offline' : 'active';
    const isCreated = state.created.some((m) => m.id === id);
    await saveState(setMachineStatusInState(state, id, isCreated, nextStatus));
    return delay({ ...current, status: nextStatus }, 200);
  },

  async remove(id: string): Promise<void> {
    const state = await loadState();
    await saveState(removeMachineFromState(state, id));
    return delay(undefined, 200);
  },
};
