# MARS-X Pool conversion readiness

The existing Supabase Free project serves the Android Pool API at:

`https://gcqcxiqhuzfudlfosqlp.supabase.co/functions/v1/marsx-pool-api`

API 0.8.6 serves read-only conversion checks here, including the public Verus RPC estimate. The Railway trial expired and its worker-registry deployment was removed on 5 October 2026. No paid plan or new project is required for this deployment. Pool registration, Google authentication, licensing, account deletion and sandbox payouts retain the deployed API's existing behavior.

## Read-only endpoints

| Method/path | Access | Behavior |
| --- | --- | --- |
| GET `/conversion/readiness` | Public | Credential presence and remaining blockers; no provider calls |
| GET `/conversion/changenow-status` | Operator or licensed worker | Public provider asset list; does not authenticate the partner key |
| POST `/conversion/changenow-quote` | Operator or licensed worker | Authenticated floating ETH → native SOL estimate; no exchange order |
| POST `/conversion/verus-estimate` | Operator or licensed worker | Public Verus RPC estimate from VRSC to vETH through Bridge.vETH; no signer or bridge execution |
| POST `/conversion/execute` | Public closed gate | Always 503 `conversion_execution_disabled`, regardless of secrets or unlock flags |

Operator checks use the existing `WORKER_TOKEN` as Bearer authorization. Worker checks use the existing License session, `X-Install-Id` and `X-Worker-Id`. Never copy the operator token or partner key into a client. Authorized conversion requests are limited to 20 per IP per minute in each runtime instance; this is not a global quota.

Example non-secret quote body:

```json
{"fromCurrency":"eth","fromNetwork":"eth","toCurrency":"sol","toNetwork":"sol","amount":"0.01"}
```

The API computes a 0.0002 ETH service fee (2%) and requests the provider estimate for the remaining 0.0098 ETH. Amounts and fees are calculated with integer native asset units and returned as decimal strings. Provider-reported fees remain separately labeled; do not subtract them again from its estimated output. No fee is collected during a quote. Estimates are floating and do not reserve a rate or authorize spending. This standalone ETH input estimate is not a quote for the full Verus route. A future multi-stage route must apply the MARS-X fee only once at its original input, rather than chaining two standalone fee-bearing quotes.

## Credentials and route gates

`marsx_pool_changenow_api_key` is encrypted in Supabase Vault and mapped only into the server runtime. The optional future `marsx_pool_verus_scan_api_key` maps to `VERUS_SCAN_API_KEY`. Runtime configuration is cached for 60 seconds. Client database roles cannot read the decrypted Vault view. No new public tables, SQL functions or grants are added.

The Verus quote now uses the independently operated, public `https://api.verus.services/` endpoint and its read-only `estimateconversion` method, so a VerusScan developer key is optional for this quote path. The destination, basket, method and host are fixed in server code. No caller-supplied RPC URL or method is accepted. The validated decimal amount is emitted as an exact JSON number token. Responses must match the VRSC, vETH and Bridge.vETH currency IDs and contain positive, consistent amounts; arbitrary RPC error messages and states are not forwarded.

The earlier Scan Verus REST best-conversion endpoint still requires its free developer key. Its account login requires a VerusID challenge signature; no login signature was requested or performed. No alternative protected Scan endpoint is used to circumvent that requirement.

For `{"amountVrsc":"1","toCurrency":"vETH"}`, the service applies a 0.02 VRSC platform fee and estimates conversion of the remaining 0.98 VRSC. The public RPC returned approximately 0.00032336 vETH during the 5 October read-only check. This is a Verus-chain asset amount, not an Ethereum delivery or SOL payout. The legacy `ETH` target spelling maps explicitly to vETH and returns `toNetwork: "verus"`. Provider conversion fees and slippage are represented in its estimate; Ethereum bridge and settlement fees are still unquoted.

The partner key was verified by an authenticated read-only ETH → SOL estimate. ChangeNOW's asset list excludes native VRSC, and a direct VRSC → SOL estimate returns an unsupported currency error. Its raw error body is not relayed to clients.

The full VRSC → Verus → ETH → ChangeNOW → SOL route remains unverified:

- A Verus-chain ETH representation does not prove native Ethereum ETH delivery. Bridge support, liquidity, minimums, fees and settlement must be verified.
- The treasury signer and its credentials have not been verified.
- Live execution is not implemented. Both real withdrawal and real payout runtime flags are fixed to false.
- Explicit user approval is required before spending funds or signing a small real E2E transaction.

Successful HTTP access or credential presence never clears these gates. No exchange creation, wallet funding, treasury signing, real withdrawal or payment-plan change was performed.

The official v1.2.17-6 release (23 August 2026) describes security hardening ahead of Ethereum contract upgrades. The public explorer currently reports a synced chain and working estimate metadata, but recent-transfer data does not prove a current native-ETH import for this route. Do not infer bridge availability from historical transfers, a synced node, positive reserves or a successful mathematical conversion estimate.

Primary references: [public RPC client](https://github.com/VerusCoin/verusd-rpc-ts-client), [Scan API access tiers](https://scan.verus.cx/developers), [official bridge description](https://verus.io/ethereum-bridge), [security release](https://github.com/VerusCoin/VerusCoin/releases/tag/v1.2.17-6).

## Conversion/withdrawal completion checkpoints

This is a five-checkpoint acceptance plan for this conversion module, not a measured estimate of engineering time. Three checkpoints are complete (60%); two remain (40%).

| Checkpoint | Status |
| --- | --- |
| Existing Free production API, encrypted partner key, protected quote access and fixed execution block | Complete |
| Authenticated ChangeNOW ETH → native SOL quote and separate 2% fee calculation | Complete |
| Credential-free public Verus VRSC → vETH quote with verified response currency IDs | Complete |
| Verify native Ethereum bridge delivery/fees and treasury signer; implement idempotent execution and settlement reconciliation | Remaining |
| User-approved small real E2E test with one platform fee and confirmed final SOL receipt | Remaining |

## Validation

`npm run check` and `npm test` cover authorization before provider calls, exact fee/net input calculations, amount/network validation, missing credentials, sanitized provider failures/timeouts, malformed quotes, public Verus RPC host/method restrictions and currency IDs, honest support status and an unconditional execution block even when unlock flags are true. All 28 tests pass. The deployed privacy and account-deletion changes are preserved from Supabase version 4.
