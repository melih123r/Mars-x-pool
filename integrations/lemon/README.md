# MARS-X / lemon.markets integration (paper-first)

This is an **isolated backend Python module**, not yet connected to the Android UI or running Render service.

- Default mode is **local paper simulation**; no actual brokerage orders, custody or money movements.
- Sandbox mode requires a **partner-issued** `LEMON_SANDBOX_TOKEN` stored on the backend only.
- Only authenticated instrument reads, order listing and KYC initiation are implemented for sandbox.
- Real order placement is **always blocked** until commercial approval, regulatory review, customer SCA and integration QA.
- API data-privacy principal and justification are required for sandbox requests.
- Paper data is in memory only; it is not a persistent portfolio or ledger.

Run tests from this folder:

```sh
python -m unittest discover -p 'test_*.py' -v
```

References:
- https://developer.lemon.markets/docs/authorization
- https://developer.lemon.markets/reference/get_instrument-1
- https://developer.lemon.markets/reference/list_orders-1
- https://developer.lemon.markets/reference/start_identity_verification-1
- https://developer.lemon.markets/docs/strong-customer-authentication

Next: partner onboarding, sandbox token, customer consent/SCA, backend route auth and integration tests, then Android feature flag.
