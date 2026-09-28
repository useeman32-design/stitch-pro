/**
 * Machines service — mock implementation.
 * Used by the Machine Center (upcoming iteration).
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
  },
];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const machinesService = {
  async list(): Promise<Machine[]> {
    return delay(mockMachines);
  },
  async get(id: string): Promise<Machine | undefined> {
    return delay(mockMachines.find((m) => m.id === id));
  },
};
