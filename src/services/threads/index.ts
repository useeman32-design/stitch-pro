/**
 * Threads service — mock implementation.
 * Used by the Thread Library.
 */

import type { ThreadColor } from '../types';

const mockThreads: ThreadColor[] = [
  { id: 'thr_1', brand: 'Madeira', code: '1147', name: 'Indigo Blue', hex: '#5B4FE8' },
  { id: 'thr_2', brand: 'Madeira', code: '1000', name: 'White', hex: '#FFFFFF' },
  { id: 'thr_3', brand: 'Isacord', code: '0900', name: 'Black', hex: '#181B26' },
  { id: 'thr_4', brand: 'Isacord', code: '0210', name: 'Gold', hex: '#D9A441' },
  { id: 'thr_5', brand: 'Madeira', code: '1213', name: 'Sky Blue', hex: '#3E7BFA' },
  { id: 'thr_6', brand: 'Isacord', code: '2500', name: 'Deep Red', hex: '#C23B3B' },
  { id: 'thr_7', brand: 'Robison-Anton', code: '2585', name: 'Forest Green', hex: '#2C6B47' },
  { id: 'thr_8', brand: 'Madeira', code: '1145', name: 'Royal Purple', hex: '#6A3FA0' },
  { id: 'thr_9', brand: 'Isacord', code: '0310', name: 'Sunflower Yellow', hex: '#F0C23A' },
  { id: 'thr_10', brand: 'Sulky', code: '1171', name: 'Tangerine', hex: '#E8792D' },
  { id: 'thr_11', brand: 'Robison-Anton', code: '2296', name: 'Hot Pink', hex: '#E24E96' },
  { id: 'thr_12', brand: 'Madeira', code: '1103', name: 'Silver Grey', hex: '#B7BAC4' },
  { id: 'thr_13', brand: 'Isacord', code: '0410', name: 'Chocolate Brown', hex: '#5A3A28' },
  { id: 'thr_14', brand: 'Sulky', code: '1090', name: 'Teal', hex: '#2C8C8C' },
  { id: 'thr_15', brand: 'Robison-Anton', code: '2251', name: 'Navy', hex: '#1B2140' },
  { id: 'thr_16', brand: 'Madeira', code: '1078', name: 'Blush Pink', hex: '#E9AFC0' },
  { id: 'thr_17', brand: 'Isacord', code: '0110', name: 'Lime Green', hex: '#8FC93A' },
  { id: 'thr_18', brand: 'Sulky', code: '1206', name: 'Copper', hex: '#B5651D' },
];

export const threadBrands = ['Madeira', 'Isacord', 'Robison-Anton', 'Sulky'] as const;

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextThreadSeq = 1;

export const threadsService = {
  async list(): Promise<ThreadColor[]> {
    return delay(mockThreads);
  },
  async create(input: { brand: string; code: string; name: string; hex: string }): Promise<ThreadColor> {
    const thread: ThreadColor = {
      id: `thr_new_${nextThreadSeq++}`,
      brand: input.brand,
      code: input.code,
      name: input.name,
      hex: input.hex,
    };
    mockThreads.unshift(thread);
    return delay(thread, 200);
  },
};
