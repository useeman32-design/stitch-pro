/**
 * Jobs service — mock implementation.
 * Used by the Production Jobs board.
 */

import type { JobStatus, ProductionJob } from '../types';

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
  {
    id: 'job_3',
    customer: 'Chinedu Eze',
    design: 'Monogram M',
    quantity: '50 Towels',
    dueDate: 'Apr 30, 2026',
    machine: 'Brother PR1055X',
    status: 'Stitching',
  },
  {
    id: 'job_4',
    customer: 'Bola Adeniran',
    design: 'Floral Design',
    quantity: '6 Jackets',
    dueDate: 'Apr 22, 2026',
    machine: 'Tajima TMAR-KC',
    status: 'Completed',
  },
  {
    id: 'job_5',
    customer: 'Grace Nnamdi',
    design: 'Cap Logo',
    quantity: '100 Caps',
    dueDate: 'May 12, 2026',
    machine: 'Ricoma MT-1501',
    status: 'Pending',
  },
  {
    id: 'job_6',
    customer: 'Ibrahim Sani',
    design: 'Company Logo',
    quantity: '15 Hoodies',
    dueDate: 'Apr 26, 2026',
    machine: 'Brother PR1055X',
    status: 'Completed',
  },
];

const statusFlow: JobStatus[] = ['Pending', 'Digitized', 'Stitching', 'Completed'];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextJobSeq = 1;

export const jobsService = {
  statusFlow,

  async list(): Promise<ProductionJob[]> {
    return delay(mockJobs);
  },

  async create(input: {
    customer: string;
    design: string;
    quantity: string;
    dueDate: string;
    machine: string;
  }): Promise<ProductionJob> {
    const job: ProductionJob = {
      id: `job_new_${nextJobSeq++}`,
      customer: input.customer,
      design: input.design,
      quantity: input.quantity,
      dueDate: input.dueDate,
      machine: input.machine,
      status: 'Pending',
    };
    mockJobs.unshift(job);
    return delay(job, 250);
  },

  /** Advances a job to the next stage in the production workflow. */
  async advanceStatus(id: string): Promise<ProductionJob | undefined> {
    const job = mockJobs.find((j) => j.id === id);
    if (job) {
      const idx = statusFlow.indexOf(job.status);
      if (idx >= 0 && idx < statusFlow.length - 1) {
        job.status = statusFlow[idx + 1];
      }
    }
    return delay(job, 200);
  },

  async setStatus(id: string, status: JobStatus): Promise<ProductionJob | undefined> {
    const job = mockJobs.find((j) => j.id === id);
    if (job) job.status = status;
    return delay(job, 200);
  },
};
