# MARS-X Pool Worker API

Authorized worker registry for the MARS-X Pool Android beta. This server does not mine cryptocurrency or run third-party code.

## Endpoints
- `GET /health` public readiness check
- `POST /register` authenticated node registration
- `POST /heartbeat` authenticated worker heartbeat
- `GET /workers` authenticated worker list
- `GET /summary` authenticated online/registered counts

Set `WORKER_TOKEN` to a random secret in Railway. Requests other than `/health` require `Authorization: Bearer <WORKER_TOKEN>`.

Sample registration:
```bash
curl -X POST https://YOUR-DOMAIN/register -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_TOKEN' -d '{"workerId":"node-001","platform":"android","label":"Node 001"}'
```

The current worker registry is in memory and resets on redeploy. A persistent Redis-backed registry is a future improvement. No earnings are implied by registered nodes.
