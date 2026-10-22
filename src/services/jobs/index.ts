/**
 * Jobs service — real local persistence on top of a hardcoded seed board.
 * Used by the Production Jobs board. See designs/index.ts's docstring for
 * why this pattern exists (previously everything reverted on refresh).
 */

import type { JobStatus, ProductionJob } from '../types';
import { localStore } from '../storage/localStore';
import {
  addCreatedJob,
  emptyJobsState,
  mergeJobs,
  removeJobFromState,
  setJobStatusInState,
  type JobsPersistedState,
} from './mergeJobs';

const STATE_KEY = 'jobs.state.v1';

const seedJobs: ProductionJob[] = [
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

async function loadState(): Promise<JobsPersistedState> {
  return localStore.get<JobsPersistedState>(STATE_KEY, emptyJobsState());
}

async function saveState(state: JobsPersistedState): Promise<void> {
  await localStore.set(STATE_KEY, state);
}

export const jobsService = {
  statusFlow,

  async list(): Promise<ProductionJob[]> {
    const state = await loadState();
    return delay(mergeJobs(seedJobs, state));
  },

  async create(input: {
    customer: string;
    design: string;
    quantity: string;
    dueDate: string;
    machine: string;
  }): Promise<ProductionJob> {
    const job: ProductionJob = {
      id: `job_new_${Date.now()}_${nextJobSeq++}`,
      customer: input.customer,
      design: input.design,
      quantity: input.quantity,
      dueDate: input.dueDate,
      machine: input.machine,
      status: 'Pending',
    };
    const state = await loadState();
    await saveState(addCreatedJob(state, job));
    return delay(job, 250);
  },

  /** Advances a job to the next stage in the production workflow. */
  async advanceStatus(id: string): Promise<ProductionJob | undefined> {
    const state = await loadState();
    const current = mergeJobs(seedJobs, state).find((j) => j.id === id);
    if (!current) return delay(undefined, 200);
    const idx = statusFlow.indexOf(current.status);
    if (idx < 0 || idx >= statusFlow.length - 1) return delay(current, 200);
    const nextStatus = statusFlow[idx + 1];
    const isCreated = state.created.some((j) => j.id === id);
    await saveState(setJobStatusInState(state, id, isCreated, nextStatus));
    return delay({ ...current, status: nextStatus }, 200);
  },

  async setStatus(id: string, status: JobStatus): Promise<ProductionJob | undefined> {
    const state = await loadState();
    const current = mergeJobs(seedJobs, state).find((j) => j.id === id);
    if (!current) return delay(undefined, 200);
    const isCreated = state.created.some((j) => j.id === id);
    await saveState(setJobStatusInState(state, id, isCreated, status));
    return delay({ ...current, status }, 200);
  },

  async remove(id: string): Promise<void> {
    const state = await loadState();
    await saveState(removeJobFromState(state, id));
    return delay(undefined, 150);
  },
};
