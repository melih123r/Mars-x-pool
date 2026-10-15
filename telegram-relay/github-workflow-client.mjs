import { classifyWorkflowEvidence } from './github-workflow-evidence.mjs';

const REPOSITORY = 'melih123r/Mars-x-pool';
const API_ROOT = 'https://api.github.com/repos/' + REPOSITORY;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const TASK_ID_PATTERN = /^telegram-\d+-(chat|task)$/;
const REF_PATTERN = /^(?!\/)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._/-]{1,255}(?<!\/)$/;
const MAX_RESPONSE_BYTES = 256 * 1024;

function blocked(reason = null) {
  return reason
    ? { result: 'BLOCKED', runId: null, url: null, conclusion: null, reason }
    : { result: 'BLOCKED', runId: null, url: null, conclusion: null };
}

function normalizeAllowlist(input) {
  const allowed = new Map();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return allowed;
  for (const [rawId, ref] of Object.entries(input)) {
    const id = Number(rawId);
    if (Number.isSafeInteger(id) && id > 0 && typeof ref === 'string' && REF_PATTERN.test(ref))
      allowed.set(id, ref);
  }
  return allowed;
}

async function readJsonBounded(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES)
    throw new Error('response_too_large');

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('response_too_large');
    return JSON.parse(text);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel('response_too_large');
        throw new Error('response_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8'));
}

export function createGitHubWorkflowClient({
  token,
  allowedWorkflows,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000
} = {}) {
  const credential = typeof token === 'string' ? token.trim() : '';
  const allowed = normalizeAllowlist(allowedWorkflows);
  const allowedIds = [...allowed.keys()];

  function validate({ workflowId, taskId, expectedSha } = {}) {
    if (!credential) return 'github_token_missing';
    if (typeof fetchImpl !== 'function') return 'fetch_unavailable';
    if (!Number.isSafeInteger(workflowId) || !allowed.has(workflowId)) return 'workflow_not_allowed';
    if (!TASK_ID_PATTERN.test(taskId || '')) return 'invalid_task_id';
    if (!SHA_PATTERN.test(expectedSha || '')) return 'invalid_expected_sha';
    return null;
  }

  function headers(contentType = false) {
    return {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + credential,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'marsx-telegram-relay',
      ...(contentType ? { 'content-type': 'application/json' } : {})
    };
  }

  return {
    async dispatch(input = {}) {
      const reason = validate(input);
      if (reason) return blocked(reason);

      const { workflowId, taskId, expectedSha } = input;
      try {
        const response = await fetchImpl(
          API_ROOT + '/actions/workflows/' + workflowId + '/dispatches',
          {
            method: 'POST',
            signal: AbortSignal.timeout(timeoutMs),
            headers: headers(true),
            body: JSON.stringify({
              ref: allowed.get(workflowId),
              inputs: { task_id: taskId, expected_sha: expectedSha }
            })
          }
        );
        if (response.status !== 204) return blocked('github_http_' + response.status);
        return { result: 'DISPATCHED', workflowId, taskId, expectedSha };
      } catch {
        // Never retry workflow-dispatch POST: a timeout may still have created a run.
        return blocked('github_dispatch_unconfirmed');
      }
    },

    async status(input = {}) {
      const reason = validate(input);
      if (reason) return blocked(reason);

      const { workflowId, expectedSha } = input;
      try {
        const response = await fetchImpl(
          API_ROOT + '/actions/workflows/' + workflowId + '/runs?event=workflow_dispatch&per_page=20',
          {
            method: 'GET',
            signal: AbortSignal.timeout(timeoutMs),
            headers: headers(false)
          }
        );
        if (!response.ok) return blocked('github_http_' + response.status);
        const payload = await readJsonBounded(response);
        const run = Array.isArray(payload?.workflow_runs)
          ? payload.workflow_runs.find(item => item?.head_sha === expectedSha)
          : null;
        return classifyWorkflowEvidence(run, expectedSha, allowedIds);
      } catch (error) {
        return blocked(error?.message === 'response_too_large' ? 'response_too_large' : 'github_status_unavailable');
      }
    }
  };
}
