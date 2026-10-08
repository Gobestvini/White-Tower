import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSmokeResult } from './fixtures/typescript-smoke.ts';

test('the test runner imports checked TypeScript modules', () => {
  const result = makeSmokeResult(3);
  assert.deepEqual(result, { status: 'ready', count: 3 });
});
