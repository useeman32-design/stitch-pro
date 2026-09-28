/**
 * Jobs service — mock implementation.
 * Used by the Production Jobs screen (upcoming iteration).
 */

import type { ProductionJob } from '../types';

const mockJobs: ProductionJob[] = [
  {
    id: 'job_1',
    customer: 'Musa Garba',
    design: 'Company Logo',
    quantity: '25 Polo Shirts',
    dueDate: 'May 3, 2026',
    machine: 'Ricoma MT-1501',
    status: 'Digitized',
  },
  {
    id: 'job_2',
    customer: 'Amaka Obi',
    design: 'Lion Logo',
    quantity: '10 Caps',
    dueDate: 'May 6, 2026',
    machine: 'Ricoma MT-1501',
    status: 'Pending',
  },
];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const jobsService = {
  async list(): Promise<ProductionJob[]> {
    return delay(mockJobs);
  },
};
