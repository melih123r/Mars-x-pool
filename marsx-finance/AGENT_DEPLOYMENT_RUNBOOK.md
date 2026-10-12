# MARS-X independent engineering agent — rollout

This is a deployment runbook, not a claim that autonomous AI workers are active.

## Phase 1: secure review agent

Use OpenHands in an isolated environment with repository read access. Target:
- Repository: melih123r/Mars-x-pool
- Branch: finance-open-source-integration-20261012
- Pull request: #58

Review tasks: Android build and TradingView integration; Python market gateway; test coverage; supply-chain security; APK artifacts.

Never send production credentials, wallet secrets or private keys to an agent. Real-money order execution, withdrawals and swaps remain disabled.

## Access boundaries

1. Start with GitHub read-only permissions.
2. Store model credentials in the agent runtime's secret manager, never in the repository.
3. Require explicit human review before granting write access.
4. If write access is later granted, use isolated branches and pull requests only; prohibit direct writes to main and deployment secrets.
5. Set spending limits and execution timeouts before enabling repeated runs.

## Continuous verification

GitHub Actions already defines independent checks for Android build/lint and Python unit tests. These are CI jobs, not autonomous AI agents. The separate OpenHands review workflow requires a valid OpenHands integration and credential and must be verified on a manual run before scheduling.

## Acceptance criteria

- One agent review completes with reproducible findings and logs.
- Android and Python CI complete successfully after a proposed fix.
- A human reviews the resulting diff and approves merging.
- Runtime cost and execution time are measured over 10 runs before scaling to multiple agents.

## Infrastructure choice

Prefer a self-hosted isolated runner or an already-funded environment. Do not provision paid Railway services automatically. A Replit Agent app creation attempt was rejected for lack of an active subscription.

## Further scaling

After phase 1 passes, split work into independent Android, charts, market gateway, test/security and integration agents. Limit each agent to its own branch and a narrow issue. Track merged, tested PRs per week rather than number of bot messages.
