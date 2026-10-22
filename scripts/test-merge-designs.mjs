#!/usr/bin/env node
/**
 * Lightweight unit tests for src/services/designs/mergeDesigns.ts.
 *
 * This project has no Jest/RN test environment configured, so this script
 * transpiles just that one dependency-free module with the `typescript`
 * package (already a devDependency) and exercises it with plain Node
 * `assert` calls. Run with: node scripts/test-merge-designs.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/services/designs/mergeDesigns.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const tmpPath = path.join(__dirname, '.mergeDesigns.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const {
  emptyPersistedState,
  mergeDesigns,
  toggleFavoriteInState,
  removeDesignFromState,
  addCreatedDesign,
} = mod;

function design(id, overrides = {}) {
  return {
    id,
    name: id,
    date: 'Just now',
    format: 'DST',
    status: 'completed',
    favorite: false,
    category: 'other',
    thumbnail: { uri: `data:fake/${id}` },
    stitches: 100,
    colors: 2,
    sizeMm: { width: 10, height: 10 },
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

console.log('mergeDesigns.ts');

test('empty state + seed returns seed unchanged', () => {
  const seed = [design('s1'), design('s2')];
  const merged = mergeDesigns(seed, emptyPersistedState());
  assert.deepEqual(merged.map((d) => d.id), ['s1', 's2']);
});

test('created designs appear before seed designs', () => {
  const seed = [design('s1')];
  let state = emptyPersistedState();
  state = addCreatedDesign(state, design('c1'));
  const merged = mergeDesigns(seed, state);
  assert.deepEqual(merged.map((d) => d.id), ['c1', 's1']);
});

test('newest created design is first', () => {
  let state = emptyPersistedState();
  state = addCreatedDesign(state, design('c1'));
  state = addCreatedDesign(state, design('c2'));
  const merged = mergeDesigns([], state);
  assert.deepEqual(merged.map((d) => d.id), ['c2', 'c1']);
});

test('toggling favorite overrides a seed design without mutating the seed array', () => {
  const seed = [design('s1', { favorite: false })];
  let state = emptyPersistedState();
  state = toggleFavoriteInState(state, 's1', false);
  const merged = mergeDesigns(seed, state);
  assert.equal(merged[0].favorite, true);
  assert.equal(seed[0].favorite, false, 'seed array itself must stay untouched');
});

test('toggling favorite twice returns to the original value', () => {
  let state = emptyPersistedState();
  state = toggleFavoriteInState(state, 's1', false);
  state = toggleFavoriteInState(state, 's1', true);
  const merged = mergeDesigns([design('s1', { favorite: false })], state);
  assert.equal(merged[0].favorite, false);
});

test('removing a seed design tombstones it instead of deleting it', () => {
  const seed = [design('s1'), design('s2')];
  let state = emptyPersistedState();
  state = removeDesignFromState(state, 's1');
  assert.deepEqual(state.deletedSeedIds, ['s1']);
  const merged = mergeDesigns(seed, state);
  assert.deepEqual(merged.map((d) => d.id), ['s2']);
});

test('removing a created design drops it outright, no tombstone', () => {
  let state = emptyPersistedState();
  state = addCreatedDesign(state, design('c1'));
  state = removeDesignFromState(state, 'c1');
  assert.deepEqual(state.created, []);
  assert.deepEqual(state.deletedSeedIds, []);
});

test('removing the same seed id twice does not duplicate the tombstone', () => {
  let state = emptyPersistedState();
  state = removeDesignFromState(state, 's1');
  state = removeDesignFromState(state, 's1');
  assert.deepEqual(state.deletedSeedIds, ['s1']);
});

test('favorite override applies to a created design too', () => {
  let state = emptyPersistedState();
  state = addCreatedDesign(state, design('c1', { favorite: false }));
  state = toggleFavoriteInState(state, 'c1', false);
  const merged = mergeDesigns([], state);
  assert.equal(merged[0].favorite, true);
});

console.log(`\n${passed} passed`);
