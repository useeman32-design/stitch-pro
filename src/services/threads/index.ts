/**
 * Threads service — mock implementation.
 * Used by the Thread Library (upcoming iteration).
 */

import type { ThreadColor } from '../types';

const mockThreads: ThreadColor[] = [
  { id: 'thr_1', brand: 'Madeira', code: '1147', name: 'Indigo Blue', hex: '#5B4FE8' },
  { id: 'thr_2', brand: 'Madeira', code: '1000', name: 'White', hex: '#FFFFFF' },
  { id: 'thr_3', brand: 'Isacord', code: '0900', name: 'Black', hex: '#181B26' },
  { id: 'thr_4', brand: 'Isacord', code: '0210', name: 'Gold', hex: '#D9A441' },
  { id: 'thr_5', brand: 'Madeira', code: '1213', name: 'Sky Blue', hex: '#3E7BFA' },
];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const threadsService = {
  async list(): Promise<ThreadColor[]> {
    return delay(mockThreads);
  },
};
