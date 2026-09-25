import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const SERVICE = "marsx-pool-worker-api";
const VERSION = "0.2.0";
const WORKERS_KEY = "marsx:workers";
const ONLINE_WINDOW_MS = 120_000;
const MAX_BODY_BYTES = 16_384;

const baseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    ...baseHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    ...baseHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  });
  res.end(body);
}

async function readJson(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    const error = new Error("content type must be application/json");
    error.status = 415;
    throw error;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("payload too large");
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("invalid JSON");
    error.status = 400;
    throw error;
  }
}

function safeBearer(actual, token) {
  if (!token) return false;
  const supplied = Buffer.from(String(actual || ""));
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function normalizeWorkerId(data) {
  const candidate = data.workerId ?? data.node_id;
  if (typeof candidate !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(candidate)) return null;
  return candidate;
}

function normalizeWorker(data, oldWorker, now) {
  const workerId = normalizeWorkerId(data);
  if (!workerId) return null;
  const cpuCandidate = data.cpuPercent ?? data.cpu_percent;
  const cpuPercent = Number.isFinite(cpuCandidate)
    ? Math.min(100, Math.max(0, Number(cpuCandidate)))
    : oldWorker?.cpuPercent ?? null;

  return {
    workerId,
    label: String(data.label || oldWorker?.label || "worker").slice(0, 80),
    platform: String(data.platform || oldWorker?.platform || "unknown").slice(0, 40),
    cpuPercent,
    registeredAt: oldWorker?.registeredAt || new Date(now).toISOString(),
    lastSeen: new Date(now).toISOString(),
    sessionId: oldWorker?.sessionId || randomUUID(),
  };
}

export class MemoryStore {
  constructor() {
    this.kind = "memory";
    this.workers = new Map();
  }

  async ping() { return true; }
  async get(workerId) { return this.workers.get(workerId) || null; }
  async set(worker) { this.workers.set(worker.workerId, worker); }
  async all() { return [...this.workers.values()]; }
  async close() {}
}

class RedisStore {
  constructor(client) {
    this.kind = "redis";
    this.client = client;
  }

  async ping() { return (await this.client.ping()) === "PONG"; }

  async get(workerId) {
    const raw = await this.client.hGet(WORKERS_KEY, workerId);
    return raw ? JSON.parse(raw) : null;
  }

  async set(worker) {
    await this.client.hSet(WORKERS_KEY, worker.workerId, JSON.stringify(worker));
  }

  async all() {
    const values = await this.client.hVals(WORKERS_KEY);
    return values.map((value) => JSON.parse(value));
  }

  async close() {
    if (this.client.isOpen) await this.client.quit();
  }
}

export async function createStore(redisUrl = process.env.REDIS_URL) {
  if (!redisUrl) return new MemoryStore();
  const { createClient } = await import("redis");
  const client = createClient({
    url: redisUrl,
    socket: {
      family: 0,
      connectTimeout: 10_000,
      reconnectStrategy: (retries) => Math.min(200 * retries, 3_000),
    },
  });
  client.on("error", (error) => console.error("Redis error", error.message));
  await client.connect();
  await client.ping();
  return new RedisStore(client);
}

const privacyPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MARS-X Pool Privacy Policy</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#172033}h1,h2{color:#144991}</style></head>
<body><h1>MARS-X Pool Privacy Policy</h1><p>Last updated: 25 September 2026.</p>
<p>MARS-X Pool Beta is an authorized node registration and connectivity test. It does not mine cryptocurrency on the device, run background compute, promise earnings, use advertising SDKs, or sell data.</p>
<h2>Data processed</h2><p>Only after the user starts registration or a heartbeat, the service receives a randomly generated worker ID, a generic platform label, an optional user-entered label, and the request time. The service also processes standard network metadata needed to receive an HTTPS request. The beta does not request contacts, location, photos, microphone, camera, advertising ID, or financial information.</p>
<h2>Purpose and sharing</h2><p>Data is used only to operate and troubleshoot the closed beta and show node availability. It is not sold and is not shared with advertisers. Hosting providers process data only to run the service.</p>
<h2>Security, retention, and deletion</h2><p>Traffic uses HTTPS and protected API operations require a beta access token. Worker records remain for the beta period unless deleted earlier. To request deletion or ask a privacy question, open an issue at <a href="https://github.com/melih123r/Mars-x-pool/issues">the MARS-X Pool repository</a> and provide only the worker ID shown in the app.</p>
</body></html>`;

export function createServer({
  token = process.env.WORKER_TOKEN,
  store = new MemoryStore(),
  now = () => Date.now(),
  rateLimitMax = 300,
} = {}) {
  const rateLimits = new Map();

  function isRateLimited(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const key = forwarded || req.socket.remoteAddress || "unknown";
    const timestamp = now();
    const current = rateLimits.get(key);
    if (!current || timestamp - current.startedAt >= 60_000) {
      rateLimits.set(key, { startedAt: timestamp, count: 1 });
      if (rateLimits.size > 10_000) rateLimits.clear();
      return false;
    }
    current.count += 1;
    return current.count > rateLimitMax;
  }

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...baseHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
      return res.end();
    }

    if (req.method === "GET" && pathname === "/privacy") return sendHtml(res, 200, privacyPage);

    if (req.method === "GET" && pathname === "/health") {
      try {
        const ready = await store.ping();
        return sendJson(res, ready ? 200 : 503, {
          ok: Boolean(ready),
          service: SERVICE,
          version: VERSION,
          storage: store.kind,
          persistent: store.kind === "redis",
        });
      } catch {
        return sendJson(res, 503, { ok: false, service: SERVICE, version: VERSION, storage: store.kind });
      }
    }

    if (isRateLimited(req)) return sendJson(res, 429, { error: "rate limit exceeded" });
    if (!token) return sendJson(res, 503, { error: "WORKER_TOKEN not configured" });
    if (!safeBearer(req.headers.authorization, token)) return sendJson(res, 401, { error: "unauthorized" });

    try {
      if (req.method === "GET" && pathname === "/workers") {
        const timestamp = now();
        const workers = (await store.all())
          .map((worker) => ({
            ...worker,
            status: timestamp - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS ? "online" : "offline",
          }))
          .sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
        return sendJson(res, 200, { workers });
      }

      if (req.method === "GET" && pathname === "/summary") {
        const workers = await store.all();
        const timestamp = now();
        return sendJson(res, 200, {
          registered: workers.length,
          online: workers.filter((worker) => timestamp - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS).length,
        });
      }

      if (req.method === "POST" && (pathname === "/register" || pathname === "/heartbeat")) {
        const data = await readJson(req);
        const workerId = normalizeWorkerId(data);
        if (!workerId) return sendJson(res, 400, { error: "invalid workerId" });
        const oldWorker = await store.get(workerId);
        if (pathname === "/heartbeat" && !oldWorker) return sendJson(res, 404, { error: "register first" });
        const worker = normalizeWorker(data, oldWorker, now());
        await store.set(worker);
        return sendJson(res, 200, { ok: true, worker });
      }

      return sendJson(res, 404, { error: "not found" });
    } catch (error) {
      if (error?.status) return sendJson(res, error.status, { error: error.message });
      console.error("Request failed", error);
      return sendJson(res, 500, { error: "internal error" });
    }
  });
}

export async function start() {
  const port = Number(process.env.PORT || 3000);
  const store = await createStore();
  const server = createServer({ store });
  await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));
  console.log(`MARS-X API ${VERSION} listening on ${port} with ${store.kind} storage`);

  const shutdown = async () => {
    server.close();
    await store.close();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return { server, store };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) start().catch((error) => {
  console.error("Startup failed", error);
  process.exit(1);
});
