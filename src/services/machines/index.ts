/**
 * Machines service — mock implementation.
 * Used by the Machine Center.
 */

import type { Machine } from '../types';

const mockMachines: Machine[] = [
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

export const machinesService = {
  async list(): Promise<Machine[]> {
    return delay(mockMachines);
  },
  async get(id: string): Promise<Machine | undefined> {
    return delay(mockMachines.find((m) => m.id === id));
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
      id: `mch_new_${nextMachineSeq++}`,
      name: input.name,
      brand: input.brand,
      model: input.model,
      status: 'active',
      defaultFormat: input.defaultFormat,
      hoopSizes: input.hoopSizes,
      needleCount: input.needleCount,
    };
    mockMachines.push(machine);
    return delay(machine, 250);
  },
  async toggleStatus(id: string): Promise<Machine | undefined> {
    const machine = mockMachines.find((m) => m.id === id);
    if (machine) machine.status = machine.status === 'active' ? 'offline' : 'active';
    return delay(machine, 200);
  },
  async remove(id: string): Promise<void> {
    const idx = mockMachines.findIndex((m) => m.id === id);
    if (idx >= 0) mockMachines.splice(idx, 1);
    return delay(undefined, 200);
  },
};
