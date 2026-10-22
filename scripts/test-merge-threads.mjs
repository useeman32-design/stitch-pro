#!/usr/bin/env node
/**
 * Lightweight unit tests for src/services/threads/mergeThreads.ts.
 * Run with: node scripts/test-merge-threads.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/services/threads/mergeThreads.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const tmpPath = path.join(__dirname, '.mergeThreads.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const { emptyThreadsState, mergeThreads, addCreatedThread } = mod;

function thread(id) {
  return { id, brand: 'Madeira', code: '0001', name: id, hex: '#000000' };
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

console.log('mergeThreads.ts');

test('empty state + seed returns seed unchanged', () => {
  const seed = [thread('t1'), thread('t2')];
  const merged = mergeThreads(seed, emptyThreadsState());
  assert.deepEqual(merged.map((t) => t.id), ['t1', 't2']);
});

test('created threads appear before seed threads, newest first', () => {
  let state = emptyThreadsState();
  state = addCreatedThread(state, thread('c1'));
  state = addCreatedThread(state, thread('c2'));
  const merged = mergeThreads([thread('s1')], state);
  assert.deepEqual(merged.map((t) => t.id), ['c2', 'c1', 's1']);
});

console.log(`\n${passed} passed`);
