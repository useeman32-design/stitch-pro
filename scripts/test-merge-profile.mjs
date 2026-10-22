#!/usr/bin/env node
/**
 * Lightweight unit tests for src/services/auth/mergeProfile.ts.
 * Run with: node scripts/test-merge-profile.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/services/auth/mergeProfile.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const tmpPath = path.join(__dirname, '.mergeProfile.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const { applyProfileOverrides, mergePreferences, defaultPreferences } = mod;

const baseUser = {
  id: 'u1',
  name: 'Original Name',
  email: 'original@example.com',
  plan: 'Pro Plan',
  creditsUsed: 1,
  creditsTotal: 100,
};

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

console.log('mergeProfile.ts');

test('no overrides returns the base user unchanged', () => {
  const result = applyProfileOverrides(baseUser, {});
  assert.deepEqual(result, baseUser);
});

test('overrides replace name/email but nothing else', () => {
  const result = applyProfileOverrides(baseUser, { name: 'New Name', email: 'new@example.com' });
  assert.equal(result.name, 'New Name');
  assert.equal(result.email, 'new@example.com');
  assert.equal(result.plan, 'Pro Plan');
  assert.equal(baseUser.name, 'Original Name', 'base user object must stay untouched');
});

test('null stored preferences fall back to defaults entirely', () => {
  const result = mergePreferences(null);
  assert.deepEqual(result, defaultPreferences);
});

test('partial stored preferences merge on top of defaults', () => {
  const result = mergePreferences({ unit: 'in', notifyWeekly: true });
  assert.equal(result.unit, 'in');
  assert.equal(result.notifyWeekly, true);
  assert.equal(result.defaultFormat, defaultPreferences.defaultFormat);
  assert.equal(result.notifyJobs, defaultPreferences.notifyJobs);
});

console.log(`\n${passed} passed`);
