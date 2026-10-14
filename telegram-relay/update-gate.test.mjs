import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateGate } from './update-gate.mjs';

test('repeated and concurrent Telegram update ids are suppressed', () => {
  const gate = createUpdateGate({ maxRecent: 2 });
  assert.equal(gate.begin(10), 'accepted');
  assert.equal(gate.begin(10), 'processing');
  gate.finish(10, true);
  assert.equal(gate.begin(10), 'duplicate');
});

test('failed update can be retried and recent ids stay bounded', () => {
  const gate = createUpdateGate({ maxRecent: 2 });
  assert.equal(gate.begin(1), 'accepted');
  gate.finish(1, false);
  assert.equal(gate.begin(1), 'accepted');
  gate.finish(1, true);
  assert.equal(gate.begin(2), 'accepted'); gate.finish(2, true);
  assert.equal(gate.begin(3), 'accepted'); gate.finish(3, true);
  assert.equal(gate.begin(1), 'accepted');
});
