# MARS-X Pool Beta

MARS-X Pool is an authorized Android node-registration and connectivity beta. It does **not** mine cryptocurrency on the device, run third-party workloads, promise earnings, or perform background compute.

## Live API

- `GET /health` — public readiness and storage status
- `GET /privacy` — public privacy policy
- `POST /register` — authenticated node registration
- `POST /heartbeat` — authenticated heartbeat for a registered node
- `GET /workers` — authenticated worker list
- `GET /summary` — authenticated registered/online counts

All protected routes require `Authorization: Bearer <WORKER_TOKEN>`.

Required Railway variables on the existing `worker-registry` service:

```text
WORKER_TOKEN=<long random beta secret>
REDIS_URL=redis://telemetry-store.railway.internal:6379
```

The existing `telemetry-store` service must remain private and must not receive a public TCP proxy. If `REDIS_URL` is absent, the API deliberately falls back to in-memory beta storage and reports `persistent: false` from `/health`.

## Development

```bash
npm install
npm test
npm start
```

The Android project lives in `android/`. Its beta access token is entered by the tester at runtime and is not committed to the repository. Registration and heartbeat occur only after an explicit button press.

## Google Play constraints

The Android build targets API 36. Google Play prohibits cryptocurrency mining on devices, so device mining and hidden/background computation are outside this project. Closed testing still requires genuine testers, accurate Data safety declarations, an accessible privacy policy, a signed App Bundle, and real feedback.
