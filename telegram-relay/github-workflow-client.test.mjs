import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubWorkflowClient } from './github-workflow-client.mjs';

const sha = 'a'.repeat(40);
const taskId = 'telegram-86-task';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

test('dispatch sends metadata only to an explicitly allowlisted workflow and never retries POST', async () => {
  const calls = [];
  const client = createGitHubWorkflowClient({
    token: 'test-token',
    allowedWorkflows: { 77: 'main' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 204 });
    }
  });

  const result = await client.dispatch({ workflowId: 77, taskId, expectedSha: sha });
  assert.deepEqual(result, { result: 'DISPATCHED', workflowId: 77, taskId, expectedSha: sha });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/melih123r/Mars-x-pool/actions/workflows/77/dispatches');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    ref: 'main',
    inputs: { task_id: taskId, expected_sha: sha }
  });
  assert.doesNotMatch(calls[0].options.body, /private|message|instruction/i);
});

test('dispatch fails closed before network access for missing token or unapproved workflow', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response(null, { status: 204 }); };
  const noToken = createGitHubWorkflowClient({ token: '', allowedWorkflows: { 77: 'main' }, fetchImpl });
  const denied = createGitHubWorkflowClient({ token: 'test-token', allowedWorkflows: { 77: 'main' }, fetchImpl });

  assert.equal((await noToken.dispatch({ workflowId: 77, taskId, expectedSha: sha })).result, 'BLOCKED');
  assert.equal((await denied.dispatch({ workflowId: 88, taskId, expectedSha: sha })).result, 'BLOCKED');
  assert.equal(calls, 0);
});

test('dispatch does not retry ambiguous or rate-limited POST responses', async () => {
  let calls = 0;
  const client = createGitHubWorkflowClient({
    token: 'test-token',
    allowedWorkflows: { 77: 'main' },
    fetchImpl: async () => { calls += 1; return jsonResponse({ message: 'rate limited' }, 429); }
  });

  const result = await client.dispatch({ workflowId: 77, taskId, expectedSha: sha });
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.reason, 'github_http_429');
  assert.equal(calls, 1);
});

test('status returns PASS only through the existing verified evidence contract', async () => {
  const client = createGitHubWorkflowClient({
    token: 'test-token',
    allowedWorkflows: { 77: 'main' },
    fetchImpl: async (url, options) => {
      assert.match(url, /actions\/workflows\/77\/runs\?event=workflow_dispatch&per_page=20/);
      assert.equal(options.method, 'GET');
      return jsonResponse({ workflow_runs: [{
        id: 123,
        workflow_id: 77,
        event: 'workflow_dispatch',
        status: 'completed',
        conclusion: 'success',
        head_sha: sha,
        html_url: 'https://github.com/melih123r/Mars-x-pool/actions/runs/123'
      }] });
    }
  });

  const result = await client.status({ workflowId: 77, taskId, expectedSha: sha });
  assert.equal(result.result, 'PASS');
  assert.equal(result.runId, 123);
});

test('status is BLOCKED when no exact SHA run exists and leaks no GitHub error body', async () => {
  const client = createGitHubWorkflowClient({
    token: 'test-token',
    allowedWorkflows: { 77: 'main' },
    fetchImpl: async () => jsonResponse({ workflow_runs: [{
      id: 999,
      workflow_id: 77,
      event: 'workflow_dispatch',
      status: 'completed',
      conclusion: 'success',
      head_sha: 'b'.repeat(40),
      html_url: 'https://github.com/melih123r/Mars-x-pool/actions/runs/999',
      private_message: 'DO-NOT-LEAK'
    }] })
  });

  const result = await client.status({ workflowId: 77, taskId, expectedSha: sha });
  assert.deepEqual(result, { result: 'BLOCKED', runId: null, url: null, conclusion: null });
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-LEAK/);
});
