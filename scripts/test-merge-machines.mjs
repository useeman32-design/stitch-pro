#!/usr/bin/env node
/**
 * Lightweight unit tests for src/services/machines/mergeMachines.ts.
 * Run with: node scripts/test-merge-machines.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/services/machines/mergeMachines.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const tmpPath = path.join(__dirname, '.mergeMachines.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const {
  emptyMachinesState,
  mergeMachines,
  addCreatedMachine,
  setMachineStatusInState,
  removeMachineFromState,
} = mod;

function machine(id, overrides = {}) {
  return {
    id,
    name: id,
    brand: 'TestBrand',
    model: 'X1',
    status: 'active',
    defaultFormat: 'DST',
    hoopSizes: ['100x100'],
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

console.log('mergeMachines.ts');

test('empty state + seed returns seed unchanged', () => {
  const seed = [machine('m1'), machine('m2')];
  const merged = mergeMachines(seed, emptyMachinesState());
  assert.deepEqual(merged.map((m) => m.id), ['m1', 'm2']);
});

test('created machines appear after seed machines (append, matches push semantics)', () => {
  let state = emptyMachinesState();
  state = addCreatedMachine(state, machine('c1'));
  const merged = mergeMachines([machine('s1')], state);
  assert.deepEqual(merged.map((m) => m.id), ['s1', 'c1']);
});

test('status override toggles a seed machine without mutating the seed array', () => {
  const seed = [machine('s1', { status: 'active' })];
  let state = emptyMachinesState();
  state = setMachineStatusInState(state, 's1', false, 'offline');
  const merged = mergeMachines(seed, state);
  assert.equal(merged[0].status, 'offline');
  assert.equal(seed[0].status, 'active', 'seed array itself must stay untouched');
});

test('status update on a created machine mutates the created record directly', () => {
  let state = emptyMachinesState();
  state = addCreatedMachine(state, machine('c1', { status: 'active' }));
  state = setMachineStatusInState(state, 'c1', true, 'offline');
  const merged = mergeMachines([], state);
  assert.equal(merged[0].status, 'offline');
  assert.deepEqual(state.statusOverrides, {});
});

test('removing a seed machine tombstones it', () => {
  const seed = [machine('s1'), machine('s2')];
  let state = emptyMachinesState();
  state = removeMachineFromState(state, 's1');
  const merged = mergeMachines(seed, state);
  assert.deepEqual(merged.map((m) => m.id), ['s2']);
});

test('removing a created machine drops it outright', () => {
  let state = emptyMachinesState();
  state = addCreatedMachine(state, machine('c1'));
  state = removeMachineFromState(state, 'c1');
  assert.deepEqual(state.created, []);
  assert.deepEqual(state.deletedSeedIds, []);
});

console.log(`\n${passed} passed`);
