const SHA_PATTERN = /^[a-f0-9]{40}$/;
const TASK_ID_PATTERN = /^telegram-\d+-(chat|task)$/;
const FAIL_CONCLUSIONS = new Set([
  'failure', 'cancelled', 'timed_out', 'action_required',
  'startup_failure', 'stale'
]);

function trustedRunUrl(value, runId) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const expected = `/melih123r/Mars-x-pool/actions/runs/${runId}`;
    return url.protocol === 'https:' && url.hostname === 'github.com' &&
      url.pathname === expected && !url.search && !url.hash ? url.toString() : null;
  } catch {
    return null;
  }
}

export function classifyWorkflowEvidence(workflowRun, expectedSha, allowedWorkflowIds = []) {
  if (!SHA_PATTERN.test(expectedSha || ''))
    return { result: 'BLOCKED', runId: null, url: null, conclusion: null };

  if (!workflowRun || typeof workflowRun !== 'object')
    return { result: 'BLOCKED', runId: null, url: null, conclusion: null };

  if (!Array.isArray(allowedWorkflowIds) || allowedWorkflowIds.length === 0 ||
      !allowedWorkflowIds.every(id => Number.isSafeInteger(id) && id > 0))
    return { result: 'BLOCKED', runId: null, url: null, conclusion: null };

  const runId = Number.isSafeInteger(workflowRun.id) && workflowRun.id > 0
    ? workflowRun.id : null;
  const url = runId ? trustedRunUrl(workflowRun.html_url, runId) : null;
  const conclusion = typeof workflowRun.conclusion === 'string'
    ? workflowRun.conclusion : null;

  if (!runId || !url || workflowRun.head_sha !== expectedSha ||
      !allowedWorkflowIds.includes(workflowRun.workflow_id) ||
      workflowRun.event !== 'workflow_dispatch')
    return { result: 'BLOCKED', runId, url: null, conclusion };

  if (workflowRun.status !== 'completed')
    return { result: 'BLOCKED', runId, url, conclusion };

  if (conclusion === 'success')
    return { result: 'PASS', runId, url, conclusion };

  if (FAIL_CONCLUSIONS.has(conclusion))
    return { result: 'FAIL', runId, url, conclusion };

  return { result: 'BLOCKED', runId, url, conclusion };
}

export function formatWorkflowTelegramFeedback({ taskId, expectedSha, evidence }) {
  if (!TASK_ID_PATTERN.test(taskId || '')) throw new Error('invalid_task_id');
  if (!SHA_PATTERN.test(expectedSha || '')) throw new Error('invalid_expected_sha');
  if (!evidence || !['PASS', 'FAIL', 'BLOCKED'].includes(evidence.result))
    throw new Error('invalid_workflow_evidence');

  const lines = [
    `MARS-X görev ${taskId}: ${evidence.result}`,
    `SHA: ${expectedSha}`
  ];
  if (evidence.url) lines.push(`Kanıt: ${evidence.url}`);
  else lines.push('Doğrulanmış GitHub workflow kanıtı yok.');
  lines.push('Not: Bu rapor yalnız doğrulanmış GitHub durumunu gösterir; ChatGPT oturumu veya gerçek işlem yürütüldüğü anlamına gelmez.');
  return lines.join('\n');
}
