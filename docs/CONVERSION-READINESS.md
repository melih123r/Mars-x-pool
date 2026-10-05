# MARS-X Pool conversion readiness

The existing Supabase Free project serves the Android Pool API at:

`https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api`

API 0.8.5 adds read-only conversion checks here. The Railway trial expired and its worker-registry deployment was removed on 5 October 2026. No paid plan or new project is required for this deployment. Pool registration, Google authentication, licensing, account deletion and sandbox payouts retain the deployed API's existing behavior.

## Read-only endpoints

| Method/path | Access | Behavior |
| --- | --- | --- |
| GET `/conversion/readiness` | Public | Credential presence and remaining blockers; no provider calls |
| GET `/conversion/changenow-status` | Operator or licensed worker | Public provider asset list; does not authenticate the partner key |
| POST `/conversion/changenow-quote` | Operator or licensed worker | Authenticated floating ETH → native SOL estimate; no exchange order |
| POST `/conversion/verus-estimate` | Operator or licensed worker | Requires a VerusScan developer key; no signer or bridge execution |
| POST `/conversion/execute` | Public closed gate | Always 503 `conversion_execution_disabled`, regardless of secrets or unlock flags |

Operator checks use the existing `WORKER_TOKEN` as Bearer authorization. Worker checks use the existing License session, `X-Install-Id` and `X-Worker-Id`. Never copy the operator token or partner key into a client. Authorized conversion requests are limited to 20 per IP per minute in each runtime instance; this is not a global quota.

Example non-secret quote body:

```json
{"fromCurrency":"eth","fromNetwork":"eth","toCurrency":"sol","toNetwork":"sol","amount":"0.01"}
```

The API computes a 0.0002 ETH service fee (2%) and requests the provider estimate for the remaining 0.0098 ETH. Amounts and fees are calculated with integer native asset units and returned as decimal strings. Provider-reported fees remain separately labeled; do not subtract them again from its estimated output. No fee is collected during a quote. Estimates are floating and do not reserve a rate or authorize spending. This standalone ETH input estimate is not a quote for the full Verus route. A future multi-stage route must apply the MARS-X fee only once at its original input, rather than chaining two standalone fee-bearing quotes.

## Credentials and route gates

`marsx_pool_changenow_api_key` is encrypted in Supabase Vault and mapped only into the server runtime. The optional future `marsx_pool_verus_scan_api_key` maps to `VERUS_SCAN_API_KEY`. Runtime configuration is cached for 60 seconds. Client database roles cannot read the decrypted Vault view. No new public tables, SQL functions or grants are added.

The partner key was verified by an authenticated read-only ETH → SOL estimate. ChangeNOW's asset list excludes native VRSC, and a direct VRSC → SOL estimate returns an unsupported currency error. Its raw error body is not relayed to clients.

The full VRSC → Verus → ETH → ChangeNOW → SOL route remains unverified:

- A VerusScan developer key is missing. The authenticated best-conversion endpoint currently requires one.
- A Verus-chain ETH representation does not prove native Ethereum ETH delivery. Bridge support, liquidity, minimums, fees and settlement must be verified.
- The treasury signer and its credentials have not been verified.
- Live execution is not implemented. Both real withdrawal and real payout runtime flags are fixed to false.
- Explicit user approval is required before spending funds or signing a small real E2E transaction.

Successful HTTP access or credential presence never clears these gates. No exchange creation, wallet funding, treasury signing, real withdrawal or payment-plan change was performed.

## Validation

`npm run check` and `npm test` cover authorization before provider calls, exact fee/net input calculations, amount/network validation, missing credentials, sanitized provider failures/timeouts, malformed quotes, honest support status and an unconditional execution block even when unlock flags are true. The deployed privacy and account-deletion changes are preserved from Supabase version 4.
