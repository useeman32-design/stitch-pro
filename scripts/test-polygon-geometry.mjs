#!/usr/bin/env node
/**
 * Lightweight unit tests for src/utils/polygonGeometry.ts (the vector
 * region editor's freehand-redraw simplify/area helpers).
 *
 * This project has no Jest/RN test environment configured, so this script
 * transpiles just that one dependency-free module with the `typescript`
 * package (already a devDependency) and exercises it with plain Node
 * `assert` calls. Run with: node scripts/test-polygon-geometry.mjs
 */

import assert from 'node:assert/strict';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(__dirname, '../src/utils/polygonGeometry.ts');

const source = await fs.readFile(srcPath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const tmpPath = path.join(__dirname, '.polygonGeometry.generated.mjs');
await fs.writeFile(tmpPath, outputText);
const mod = await import(`${tmpPath}?t=${Date.now()}`);
await fs.unlink(tmpPath);

const { simplifyPolyline, shouldAppendPoint, polygonArea } = mod;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

console.log('polygonGeometry.ts');

test('simplifyPolyline keeps a short polyline untouched', () => {
  const pts = [
    [0, 0],
    [1, 1],
    [2, 0],
  ];
  const out = simplifyPolyline(pts, 0.5);
  assert.deepEqual(out, pts);
});

test('simplifyPolyline drops near-collinear interior points', () => {
  // A straight line with 20 interior points all within epsilon of the
  // first-last line -- should collapse to just the two endpoints.
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push([i, 0]);
  const out = simplifyPolyline(pts, 0.01);
  assert.deepEqual(out, [
    [0, 0],
    [20, 0],
  ]);
});

test('simplifyPolyline preserves a real corner beyond epsilon', () => {
  // An L-shape: (0,0) -> (10,0) -> (10,10), with a bunch of redundant
  // points along each straight leg. The sharp corner at (10,0) must
  // survive simplification even at a generous epsilon.
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push([i, 0]);
  for (let i = 1; i <= 10; i++) pts.push([10, i]);
  const out = simplifyPolyline(pts, 0.5);
  assert.ok(out.some(([x, y]) => x === 10 && y === 0), 'corner point should survive');
  assert.ok(out.length < pts.length, 'should have actually simplified something');
  assert.ok(out.length >= 3, 'should keep at least start, corner, end');
});

test('simplifyPolyline is a no-op for epsilon <= 0', () => {
  const pts = [
    [0, 0],
    [1, 0.001],
    [2, 0],
  ];
  assert.deepEqual(simplifyPolyline(pts, 0), pts);
});

test('shouldAppendPoint rejects points closer than minDist', () => {
  const pts = [[0, 0]];
  assert.equal(shouldAppendPoint(pts, [0.01, 0], 0.1), false);
  assert.equal(shouldAppendPoint(pts, [0.5, 0], 0.1), true);
});

test('shouldAppendPoint always accepts the first point', () => {
  assert.equal(shouldAppendPoint([], [5, 5], 100), true);
});

test('polygonArea computes a known square area exactly', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  assert.equal(polygonArea(square), 100);
});

test('polygonArea is winding-order independent', () => {
  const cw = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ];
  assert.equal(polygonArea(cw), 100);
});

test('polygonArea returns 0 for a degenerate (< 3 point) ring', () => {
  assert.equal(polygonArea([[0, 0]]), 0);
  assert.equal(
    polygonArea([
      [0, 0],
      [1, 1],
    ]),
    0
  );
});

test('polygonArea computes a known triangle area', () => {
  const triangle = [
    [0, 0],
    [10, 0],
    [0, 10],
  ];
  assert.equal(polygonArea(triangle), 50);
});

console.log(`${passed} passing`);
if (process.exitCode) {
  console.error('SOME TESTS FAILED');
} else {
  console.log('ALL TESTS PASSED');
}
