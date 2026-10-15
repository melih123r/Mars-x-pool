import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWorkflowEvidence,
  formatWorkflowTelegramFeedback
} from './github-workflow-evidence.mjs';

const sha = 'a'.repeat(40);
const allowedWorkflowIds = [77];
const run = (overrides = {}) => ({
  id: 123,
  workflow_id: 77,
  event: 'workflow_dispatch',
  status: 'completed',
  conclusion: 'success',
  head_sha: sha,
  html_url: 'https://github.com/melih123r/Mars-x-pool/actions/runs/123',
  ...overrides
});

test('completed successful allowlisted workflow is PASS only for the expected commit', () => {
  assert.deepEqual(classifyWorkflowEvidence(run(), sha, allowedWorkflowIds), {
    result: 'PASS',
    runId: 123,
    url: run().html_url,
    conclusion: 'success'
  });
});

test('completed unsuccessful workflow conclusions are FAIL', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']) {
    assert.equal(classifyWorkflowEvidence(run({ conclusion }), sha, allowedWorkflowIds).result, 'FAIL');
  }
});

test('queued or running workflow is BLOCKED rather than a fabricated success', () => {
  assert.equal(classifyWorkflowEvidence(run({ status: 'in_progress', conclusion: null }), sha, allowedWorkflowIds).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ status: 'queued', conclusion: null }), sha, allowedWorkflowIds).result, 'BLOCKED');
});

test('missing evidence and commit mismatch are BLOCKED', () => {
  assert.equal(classifyWorkflowEvidence(null, sha, allowedWorkflowIds).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ head_sha: 'b'.repeat(40) }), sha, allowedWorkflowIds).result, 'BLOCKED');
});

test('workflow evidence fails closed without an explicit workflow allowlist', () => {
  assert.equal(classifyWorkflowEvidence(run(), sha).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run(), sha, []).result, 'BLOCKED');
});

test('unapproved workflow IDs and non-dispatch events are BLOCKED', () => {
  assert.equal(classifyWorkflowEvidence(run({ workflow_id: 88 }), sha, allowedWorkflowIds).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ event: 'pull_request' }), sha, allowedWorkflowIds).result, 'BLOCKED');
  assert.equal(classifyWorkflowEvidence(run({ event: 'push' }), sha, allowedWorkflowIds).result, 'BLOCKED');
});

test('invalid or untrusted workflow links are not sent to Telegram', () => {
  const evidence = classifyWorkflowEvidence(run({ html_url: 'https://example.com/fake' }), sha, allowedWorkflowIds);
  assert.equal(evidence.result, 'BLOCKED');
  assert.equal(evidence.url, null);
});

test('Telegram feedback carries verified result, SHA and GitHub link', () => {
  const feedback = formatWorkflowTelegramFeedback({
    taskId: 'telegram-86-task',
    expectedSha: sha,
    evidence: classifyWorkflowEvidence(run(), sha, allowedWorkflowIds)
  });
  assert.match(feedback, /^MARS-X görev telegram-86-task: PASS$/m);
  assert.match(feedback, new RegExp('SHA: ' + sha));
  assert.match(feedback, /https:\/\/github\.com\/melih123r\/Mars-x-pool\/actions\/runs\/123/);
});

test('Telegram feedback never leaks private command data or claims execution without evidence', () => {
  const secret = 'private-task-body-DO-NOT-SEND';
  const evidence = { ...classifyWorkflowEvidence(null, sha, allowedWorkflowIds), privateMessage: secret };
  const feedback = formatWorkflowTelegramFeedback({
    taskId: 'telegram-86-task',
    expectedSha: sha,
    evidence
  });
  assert.match(feedback, /BLOCKED/);
  assert.match(feedback, /Doğrulanmış GitHub workflow kanıtı yok/);
  assert.doesNotMatch(feedback, new RegExp(secret));
  assert.doesNotMatch(feedback, /ChatGPT sohbetine gönderildi|işlem gerçekleştirildi/i);
});
