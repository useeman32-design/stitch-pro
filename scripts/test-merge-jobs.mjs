#!/usr/bin/env node
/**
 * Lightweight unit tests for src/services/jobs/mergeJobs.ts.
 * Run with: node scripts/test-merge-jobs.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/services/jobs/mergeJobs.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const tmpPath = path.join(__dirname, '.mergeJobs.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const {
  emptyJobsState,
  mergeJobs,
  setJobStatusInState,
  addCreatedJob,
  removeJobFromState,
} = mod;

function job(id, overrides = {}) {
  return {
    id,
    customer: 'Someone',
    design: 'Some Design',
    quantity: '1 Cap',
    dueDate: 'Jan 1, 2026',
    machine: 'Test Machine',
    status: 'Pending',
    ...overrides,
  };
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    throw e;
  }
}

console.log('mergeJobs.ts');

test('empty state + seed returns seed unchanged', () => {
  const seed = [job('j1'), job('j2')];
  const merged = mergeJobs(seed, emptyJobsState());
  assert.deepEqual(merged.map((j) => j.id), ['j1', 'j2']);
});

test('created jobs appear before seed jobs, newest first', () => {
  let state = emptyJobsState();
  state = addCreatedJob(state, job('c1'));
  state = addCreatedJob(state, job('c2'));
  const merged = mergeJobs([job('s1')], state);
  assert.deepEqual(merged.map((j) => j.id), ['c2', 'c1', 's1']);
});

test('status override changes a seed job without mutating the seed array', () => {
  const seed = [job('s1', { status: 'Pending' })];
  let state = emptyJobsState();
  state = setJobStatusInState(state, 's1', false, 'Digitized');
  const merged = mergeJobs(seed, state);
  assert.equal(merged[0].status, 'Digitized');
  assert.equal(seed[0].status, 'Pending', 'seed array itself must stay untouched');
});

test('status update on a created job mutates the created record directly', () => {
  let state = emptyJobsState();
  state = addCreatedJob(state, job('c1', { status: 'Pending' }));
  state = setJobStatusInState(state, 'c1', true, 'Stitching');
  const merged = mergeJobs([], state);
  assert.equal(merged[0].status, 'Stitching');
  assert.deepEqual(state.statusOverrides, {}, 'created jobs should not use the override map');
});

test('removing a seed job tombstones it', () => {
  const seed = [job('s1'), job('s2')];
  let state = emptyJobsState();
  state = removeJobFromState(state, 's1');
  const merged = mergeJobs(seed, state);
  assert.deepEqual(merged.map((j) => j.id), ['s2']);
});

test('removing a created job drops it outright', () => {
  let state = emptyJobsState();
  state = addCreatedJob(state, job('c1'));
  state = removeJobFromState(state, 'c1');
  assert.deepEqual(state.created, []);
  assert.deepEqual(state.deletedSeedIds, []);
});

console.log(`\n${passed} passed`);
