import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWorkflowEvidence,
  formatWorkflowTelegramFeedback
} from './github-workflow-evidence.mjs';

const sha = 'a'.repeat(40);
const run = (overrides = {}) => ({
  id: 123,
  status: 'completed',
  conclusion: 'success',
  head_sha: sha,
  html_url: 'https://github.com/melih123r/Mars-x-pool/actions/runs/123',
  ...overrides
});

test('completed successful workflow is PASS only for the expected commit', () => {
  assert.deepEqual(classifyWorkflowEvidence(run(), sha), {
    result: 'PASS',
    runId: 123,
    url: run().html_url,
    conclusion: 'success'
  });
});

test('completed unsuccessful workflow conclusions are FAIL', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']) {
    assert.equal(classifyWorkflowEvidence(run({ conclusion }), sha).result, 'FAIL');
  }
});

test('queued or running workflow is BLOCKED rather than a fabricated success', () => {
  assert.equal(classifyWorkflowEvidence(run({ status: 'in_progress', conclusion: null }), sha).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ status: 'queued', conclusion: null }), sha).result, 'BLOCKED');
});

test('missing evidence and commit mismatch are BLOCKED', () => {
  assert.equal(classifyWorkflowEvidence(null, sha).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ head_sha: 'b'.repeat(40) }), sha).result, 'BLOCKED');
});

test('invalid or untrusted workflow links are not sent to Telegram', () => {
  const evidence = classifyWorkflowEvidence(run({ html_url: 'https://example.com/fake' }), sha);
  assert.equal(evidence.result, 'BLOCKED');
  assert.equal(evidence.url, null);
});

test('Telegram feedback carries verified result, SHA and GitHub link', () => {
  const feedback = formatWorkflowTelegramFeedback({
    taskId: 'telegram-86-task',
    expectedSha: sha,
    evidence: classifyWorkflowEvidence(run(), sha)
  });
  assert.match(feedback, /^MARS-X görev telegram-86-task: PASS$/m);
  assert.match(feedback, new RegExp('SHA: ' + sha));
  assert.match(feedback, /https:\/\/github\.com\/melih123r\/Mars-x-pool\/actions\/runs\/123/);
});

test('Telegram feedback never claims ChatGPT injection or real execution without evidence', () => {
  const feedback = formatWorkflowTelegramFeedback({
    taskId: 'telegram-86-task',
    expectedSha: sha,
    evidence: classifyWorkflowEvidence(null, sha)
  });
  assert.match(feedback, /BLOCKED/);
  assert.match(feedback, /Doğrulanmış GitHub workflow kanıtı yok/);
  assert.doesNotMatch(feedback, /ChatGPT sohbetine gönderildi|işlem gerçekleştirildi/i);
});
