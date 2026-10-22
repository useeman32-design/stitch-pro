/**
 * Pure logic for combining the hardcoded seed production jobs with
 * persisted changes (new jobs, status advances). Mirrors
 * ../designs/mergeDesigns.ts's approach, but jobs have no asset/thumbnail
 * durability concern, so this is simpler: every seed job's current status
 * can just be overridden directly, no tombstone/require() handling needed.
 *
 * Deliberately free of AsyncStorage/React Native imports so it can be
 * unit-tested with plain Node (see scripts/test-merge-jobs.mjs).
 */

import type { JobStatus, ProductionJob } from '../types';

export interface JobsPersistedState {
  /** User-created jobs, newest first. */
  created: ProductionJob[];
  /** Status overrides for seed jobs, keyed by job id. */
  statusOverrides: Record<string, JobStatus>;
  /** Ids of seed jobs the user deleted. */
  deletedSeedIds: string[];
}

export function emptyJobsState(): JobsPersistedState {
  return { created: [], statusOverrides: {}, deletedSeedIds: [] };
}

export function mergeJobs(seed: ProductionJob[], state: JobsPersistedState): ProductionJob[] {
  const created = state.created.map((j) => applyStatusOverride(j, state.statusOverrides));
  const remainingSeed = seed
    .filter((j) => !state.deletedSeedIds.includes(j.id))
    .map((j) => applyStatusOverride(j, state.statusOverrides));
  return [...created, ...remainingSeed];
}

function applyStatusOverride(
  job: ProductionJob,
  overrides: Record<string, JobStatus>
): ProductionJob {
  if (!(job.id in overrides)) return job;
  return { ...job, status: overrides[job.id] };
}

export function setJobStatusInState(
  state: JobsPersistedState,
  id: string,
  isCreated: boolean,
  status: JobStatus
): JobsPersistedState {
  if (isCreated) {
    return {
      ...state,
      created: state.created.map((j) => (j.id === id ? { ...j, status } : j)),
    };
  }
  return { ...state, statusOverrides: { ...state.statusOverrides, [id]: status } };
}

export function addCreatedJob(state: JobsPersistedState, job: ProductionJob): JobsPersistedState {
  return { ...state, created: [job, ...state.created] };
}

export function removeJobFromState(state: JobsPersistedState, id: string): JobsPersistedState {
  const wasCreated = state.created.some((j) => j.id === id);
  if (wasCreated) {
    return { ...state, created: state.created.filter((j) => j.id !== id) };
  }
  if (state.deletedSeedIds.includes(id)) return state;
  return { ...state, deletedSeedIds: [...state.deletedSeedIds, id] };
}
