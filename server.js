import http from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

const SERVICE = "marsx-pool-worker-api";
const VERSION = "0.6.0";
const TERMS_VERSION = "2026-09-26-v2";
const WORKERS_KEY = "marsx:workers";
const LICENSE_DEVICES_PREFIX = "marsx:license-devices:";
const BALANCES_KEY = "marsx:balances:usdt-test";
const DORMANT_BALANCES_KEY = "marsx:dormant-balances:usdt-test";
const PAYOUTS_KEY = "marsx:payouts";
const IDEMPOTENCY_KEY = "marsx:payout-idempotency";
const LEDGER_PREFIX = "marsx:ledger:";
const ONLINE_WINDOW_MS = 120_000;
const MAX_BODY_BYTES = 16_384;
const ASSET = "USDT_TEST";
const ASSET_DECIMALS = 6;
const DEFAULT_DORMANT_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

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
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Install-Id, X-Worker-Id",
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

function safeAuthorization(actual, scheme, token) {
  if (!token) return false;
  const supplied = Buffer.from(String(actual || ""));
  const expected = Buffer.from(`${scheme} ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function normalizeWorkerId(data) {
  const candidate = data.workerId ?? data.node_id;
  if (typeof candidate !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(candidate)) return null;
  return candidate;
}

function normalizeWorker(data, oldWorker, now, licenseId, installId) {
  const workerId = normalizeWorkerId(data);
  if (!workerId) return null;
  const cpuCandidate = data.cpuPercent ?? data.cpu_percent;
  const cpuPercent = Number.isFinite(cpuCandidate)
    ? Math.min(100, Math.max(0, Number(cpuCandidate)))
    : oldWorker?.cpuPercent ?? null;

  return {
    workerId,
    licenseId: licenseId || oldWorker?.licenseId || "legacy-admin",
    installId: installId || oldWorker?.installId || null,
    label: String(data.label || oldWorker?.label || "worker").slice(0, 80),
    platform: String(data.platform || oldWorker?.platform || "unknown").slice(0, 40),
    cpuPercent,
    registeredAt: oldWorker?.registeredAt || new Date(now).toISOString(),
    lastSeen: new Date(now).toISOString(),
    lastActivityAt: new Date(now).toISOString(),
    lastActivityMs: now,
    dormantAt: null,
    reactivatedAt: oldWorker?.reactivatedAt || null,
    sessionId: oldWorker?.sessionId || randomUUID(),
  };
}

function normalizePositiveUnits(value) {
  const units = Number(value);
  return Number.isSafeInteger(units) && units > 0 && units <= 1_000_000_000_000 ? units : null;
}

function formatUnits(units) {
  const whole = Math.floor(units / 10 ** ASSET_DECIMALS);
  const fraction = String(units % 10 ** ASSET_DECIMALS).padStart(ASSET_DECIMALS, "0");
  return `${whole}.${fraction}`;
}

function normalizeDestination(value) {
  const destination = String(value || "").trim();
  return /^[A-Za-z0-9:._-]{8,128}$/.test(destination) ? destination : null;
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(key) ? key : null;
}

function parseLicenseRecords(input) {
  if (!input) return [];
  let records = input;
  if (typeof input === "string") {
    try {
      records = JSON.parse(input);
    } catch {
      throw new Error("LICENSE_RECORDS_JSON must be valid JSON");
    }
  }
  if (!Array.isArray(records)) throw new Error("LICENSE_RECORDS_JSON must be an array");
  return records.map((record) => ({
    id: String(record.id || ""),
    keyHash: String(record.keyHash || "").toLowerCase(),
    status: String(record.status || "active"),
    expiresAt: record.expiresAt ? String(record.expiresAt) : null,
    maxDevices: Math.min(Math.max(Number(record.maxDevices || 1), 1), 25),
  })).filter((record) => record.id && /^[a-f0-9]{64}$/.test(record.keyHash));
}

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function hmacHex(secret, value) {
  return createHmac("sha256", secret).update(String(value)).digest("hex");
}

function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function findLicense(records, pepper, rawKey) {
  const digest = hmacHex(pepper, normalizeLicenseKey(rawKey));
  return records.find((record) => safeEqualHex(record.keyHash, digest));
}

function issueLicenseSession(record, installId, secret, timestamp, ttlSeconds) {
  const issuedAt = Math.floor(timestamp / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    lic: record.id,
    ins: installId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    terms: TERMS_VERSION,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function issueQonversionSession(entitlement, installId, secret, timestamp, ttlSeconds) {
  const issuedAt = Math.floor(timestamp / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    src: "qonversion",
    lic: `qonversion:${entitlement.id}`,
    ent: entitlement.id,
    product: String(entitlement.product?.product_id || "").slice(0, 120),
    ins: installId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    terms: TERMS_VERSION,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyLicenseSession(token, installId, records, secret, timestamp) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest();
  let actual;
  try { actual = Buffer.from(parts[1], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch { return null; }
  if (!payload.exp || payload.exp < Math.floor(timestamp / 1000)) return null;
  if (installId && payload.ins !== installId) return null;
  if (payload.src === "qonversion") {
    if (!payload.ent || payload.lic !== `qonversion:${payload.ent}`) return null;
    return payload;
  }
  const record = records.find((candidate) => candidate.id === payload.lic);
  if (!record || record.status !== "active") return null;
  if (record.expiresAt && Date.parse(record.expiresAt) <= timestamp) return null;
  return payload;
}

function parseEntitlementIds(input) {
  const source = Array.isArray(input) ? input : String(input || "pro,farm").split(",");
  return [...new Set(source.map((value) => String(value).trim()).filter((value) => /^[A-Za-z0-9._-]{1,80}$/.test(value)))];
}

async function qonversionJson(fetchImpl, url, secretKey) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    signal: AbortSignal.timeout(7_000),
  });
  const raw = await response.text();
  if (Buffer.byteLength(raw) > 262_144) throw new Error("qonversion_response_too_large");
  let body = {};
  try { body = JSON.parse(raw || "{}"); } catch { throw new Error("qonversion_invalid_response"); }
  return { response, body };
}

async function findQonversionEntitlement({ fetchImpl, apiBase, secretKey, identityId, entitlementIds }) {
  const encodedIdentity = encodeURIComponent(identityId);
  const identityResult = await qonversionJson(fetchImpl, `${apiBase}/identities/${encodedIdentity}`, secretKey);
  if (identityResult.response.status === 404) return { error: "qonversion_identity_not_found" };
  if (!identityResult.response.ok) throw new Error("qonversion_identity_lookup_failed");
  const userId = String(identityResult.body.user_id || "");
  if (!/^QON_[A-Za-z0-9_-]{8,256}$/.test(userId)) throw new Error("qonversion_invalid_user" );

  const entitlementResult = await qonversionJson(
    fetchImpl,
    `${apiBase}/users/${encodeURIComponent(userId)}/entitlements`,
    secretKey,
  );
  if (!entitlementResult.response.ok) throw new Error("qonversion_entitlement_lookup_failed");
  const entitlements = Array.isArray(entitlementResult.body.data) ? entitlementResult.body.data : [];
  const active = entitlements.find((entitlement) =>
    entitlement?.is_active === true && entitlementIds.includes(String(entitlement.id || ""))
  );
  return active ? { entitlement: active } : { error: "qonversion_entitlement_inactive" };
}

function authorizationToken(req, scheme) {
  const value = String(req.headers.authorization || "");
  const prefix = `${scheme} `;
  return value.startsWith(prefix) ? value.slice(prefix.length) : "";
}

function validInstallId(value) {
  return /^[A-Za-z0-9_-]{12,80}$/.test(String(value || ""));
}

function requestAddress(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function auditLicense(event, req, pepper, data = {}) {
  const ipHash = pepper ? hmacHex(pepper, requestAddress(req)).slice(0, 16) : "unconfigured";
  process.stdout.write(`${JSON.stringify({
    type: "license_audit",
    event,
    at: new Date().toISOString(),
    eventId: randomUUID(),
    ipHash,
    ...data,
  })}\n`);
}

export class MemoryStore {
  constructor() {
    this.kind = "memory";
    this.workers = new Map();
    this.licenseDevices = new Map();
    this.balances = new Map();
    this.dormantBalances = new Map();
    this.payouts = new Map();
    this.idempotency = new Map();
    this.ledger = new Map();
  }

  async ping() { return true; }
  async get(workerId) { return this.workers.get(workerId) || null; }
  async set(worker) { this.workers.set(worker.workerId, worker); }
  async all() { return [...this.workers.values()]; }
  async bindLicenseDevice(licenseId, installId, maxDevices) {
    const devices = this.licenseDevices.get(licenseId) || new Set();
    if (!devices.has(installId) && devices.size >= maxDevices) return false;
    devices.add(installId);
    this.licenseDevices.set(licenseId, devices);
    return true;
  }
  async getBalance(workerId) { return this.balances.get(workerId) || 0; }
  async getDormantBalance(workerId) { return this.dormantBalances.get(workerId) || 0; }
  async touchActivity(workerId, atMs) {
    const worker = await this.get(workerId);
    if (!worker) return { worker: null, restoredUnits: 0 };
    const at = new Date(atMs).toISOString();
    const restoredUnits = await this.getDormantBalance(workerId);
    if (restoredUnits > 0) {
      this.dormantBalances.delete(workerId);
      this.balances.set(workerId, (await this.getBalance(workerId)) + restoredUnits);
      const ledger = this.ledger.get(workerId) || [];
      ledger.push({ type: "dormant_reactivated", amountUnits: restoredUnits, at });
      this.ledger.set(workerId, ledger);
    }
    worker.lastActivityAt = at;
    worker.lastActivityMs = atMs;
    if (worker.dormantAt) worker.reactivatedAt = at;
    worker.dormantAt = null;
    await this.set(worker);
    return { worker, restoredUnits };
  }
  async markDormant(workerId, cutoffMs, atMs) {
    const worker = await this.get(workerId);
    const activityMs = Number(worker?.lastActivityMs)
      || Date.parse(worker?.lastActivityAt || worker?.lastSeen || worker?.registeredAt || "");
    if (!worker || worker.dormantAt || !Number.isFinite(activityMs) || activityMs > cutoffMs) {
      return { changed: false, movedUnits: 0 };
    }
    const at = new Date(atMs).toISOString();
    const movedUnits = await this.getBalance(workerId);
    if (movedUnits > 0) {
      this.balances.set(workerId, 0);
      this.dormantBalances.set(workerId, (await this.getDormantBalance(workerId)) + movedUnits);
      const ledger = this.ledger.get(workerId) || [];
      ledger.push({ type: "dormant_safeguard", amountUnits: -movedUnits, at });
      this.ledger.set(workerId, ledger);
    }
    worker.dormantAt = at;
    await this.set(worker);
    return { changed: true, movedUnits };
  }
  async sweepDormant(cutoffMs, atMs) {
    let accountsMarked = 0;
    let movedUnits = 0;
    for (const worker of await this.all()) {
      const result = await this.markDormant(worker.workerId, cutoffMs, atMs);
      if (result.changed) accountsMarked += 1;
      movedUnits += result.movedUnits;
    }
    return { accountsMarked, movedUnits };
  }
  async dormantSummary() {
    const workers = await this.all();
    let reservedUnits = 0;
    for (const amount of this.dormantBalances.values()) reservedUnits += amount;
    return { dormantAccounts: workers.filter((worker) => Boolean(worker.dormantAt)).length, reservedUnits };
  }
  async credit(workerId, amountUnits, entry) {
    const balance = (await this.getBalance(workerId)) + amountUnits;
    this.balances.set(workerId, balance);
    const ledger = this.ledger.get(workerId) || [];
    ledger.push(entry);
    this.ledger.set(workerId, ledger);
    return balance;
  }
  async createPayout(workerId, payout, idempotencyKey) {
    const composite = `${workerId}:${idempotencyKey}`;
    const existingId = this.idempotency.get(composite);
    if (existingId) {
      return { result: "existing", payout: this.payouts.get(existingId), balance: await this.getBalance(workerId) };
    }
    const balance = await this.getBalance(workerId);
    if (balance < payout.amountUnits) return { result: "insufficient", balance };
    this.balances.set(workerId, balance - payout.amountUnits);
    this.payouts.set(payout.id, payout);
    this.idempotency.set(composite, payout.id);
    const ledger = this.ledger.get(workerId) || [];
    ledger.push({ type: "payout_reserved", payoutId: payout.id, amountUnits: -payout.amountUnits, at: payout.createdAt });
    this.ledger.set(workerId, ledger);
    return { result: "created", payout, balance: balance - payout.amountUnits };
  }
  async payoutsFor(workerId) {
    return [...this.payouts.values()].filter((payout) => payout.workerId === workerId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  async allPayouts() {
    return [...this.payouts.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  async updatePayout(payoutId, status, updatedAt, reference = "") {
    const payout = this.payouts.get(payoutId);
    if (!payout) return { result: "missing" };
    const allowed = payout.status === "pending"
      ? ["approved", "rejected", "simulated_paid"]
      : payout.status === "approved" ? ["rejected", "simulated_paid"] : [];
    if (payout.status === status) return { result: "existing", payout };
    if (!allowed.includes(status)) return { result: "invalid", payout };
    payout.status = status;
    payout.updatedAt = updatedAt;
    if (reference) payout.reference = reference;
    if (status === "rejected" && !payout.refunded) {
      payout.refunded = true;
      const worker = await this.get(payout.workerId);
      if (worker?.dormantAt) {
        this.dormantBalances.set(payout.workerId, (await this.getDormantBalance(payout.workerId)) + payout.amountUnits);
      } else {
        this.balances.set(payout.workerId, (await this.getBalance(payout.workerId)) + payout.amountUnits);
      }
      const ledger = this.ledger.get(payout.workerId) || [];
      ledger.push({ type: "payout_refund", payoutId, amountUnits: payout.amountUnits, at: updatedAt });
      this.ledger.set(payout.workerId, ledger);
    }
    this.payouts.set(payoutId, payout);
    return { result: "updated", payout };
  }
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

  async bindLicenseDevice(licenseId, installId, maxDevices) {
    const script = `
      if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 1 end
      if redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
      redis.call('SADD', KEYS[1], ARGV[1])
      return 1
    `;
    const result = await this.client.eval(script, {
      keys: [`${LICENSE_DEVICES_PREFIX}${licenseId}`],
      arguments: [installId, String(maxDevices)],
    });
    return Number(result) === 1;
  }

  async getBalance(workerId) {
    return Number(await this.client.hGet(BALANCES_KEY, workerId) || 0);
  }

  async getDormantBalance(workerId) {
    return Number(await this.client.hGet(DORMANT_BALANCES_KEY, workerId) || 0);
  }

  async touchActivity(workerId, atMs) {
    const at = new Date(atMs).toISOString();
    const script = `
      local raw = redis.call('HGET', KEYS[1], ARGV[1])
      if not raw then return {'', '0'} end
      local worker = cjson.decode(raw)
      local restored = tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or '0')
      if restored > 0 then
        redis.call('HDEL', KEYS[3], ARGV[1])
        redis.call('HINCRBY', KEYS[2], ARGV[1], restored)
        redis.call('RPUSH', KEYS[4], cjson.encode({type='dormant_reactivated', amountUnits=restored, at=ARGV[3]}))
      end
      if worker.dormantAt and worker.dormantAt ~= cjson.null then worker.reactivatedAt = ARGV[3] end
      worker.dormantAt = cjson.null
      worker.lastActivityMs = tonumber(ARGV[2])
      worker.lastActivityAt = ARGV[3]
      local updated = cjson.encode(worker)
      redis.call('HSET', KEYS[1], ARGV[1], updated)
      return {updated, tostring(restored)}
    `;
    const result = await this.client.eval(script, {
      keys: [WORKERS_KEY, BALANCES_KEY, DORMANT_BALANCES_KEY, `${LEDGER_PREFIX}${workerId}`],
      arguments: [workerId, String(atMs), at],
    });
    return { worker: result[0] ? JSON.parse(result[0]) : null, restoredUnits: Number(result[1]) };
  }

  async markDormant(workerId, cutoffMs, atMs) {
    const current = await this.get(workerId);
    const fallbackActivityMs = Number(current?.lastActivityMs)
      || Date.parse(current?.lastActivityAt || current?.lastSeen || current?.registeredAt || "");
    if (!current || !Number.isFinite(fallbackActivityMs) || fallbackActivityMs > cutoffMs) {
      return { changed: false, movedUnits: 0 };
    }
    const at = new Date(atMs).toISOString();
    const script = `
      local raw = redis.call('HGET', KEYS[1], ARGV[1])
      if not raw then return {'missing', '0'} end
      local worker = cjson.decode(raw)
      if worker.dormantAt and worker.dormantAt ~= cjson.null then return {'existing', '0'} end
      if tonumber(worker.lastActivityMs or ARGV[4]) > tonumber(ARGV[2]) then return {'active', '0'} end
      local moved = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
      if moved > 0 then
        redis.call('HDEL', KEYS[2], ARGV[1])
        redis.call('HINCRBY', KEYS[3], ARGV[1], moved)
        redis.call('RPUSH', KEYS[4], cjson.encode({type='dormant_safeguard', amountUnits=-moved, at=ARGV[3]}))
      end
      worker.dormantAt = ARGV[3]
      redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(worker))
      return {'changed', tostring(moved)}
    `;
    const result = await this.client.eval(script, {
      keys: [WORKERS_KEY, BALANCES_KEY, DORMANT_BALANCES_KEY, `${LEDGER_PREFIX}${workerId}`],
      arguments: [workerId, String(cutoffMs), at, String(fallbackActivityMs)],
    });
    return { changed: result[0] === "changed", movedUnits: Number(result[1]) };
  }

  async sweepDormant(cutoffMs, atMs) {
    let accountsMarked = 0;
    let movedUnits = 0;
    for (const worker of await this.all()) {
      const result = await this.markDormant(worker.workerId, cutoffMs, atMs);
      if (result.changed) accountsMarked += 1;
      movedUnits += result.movedUnits;
    }
    return { accountsMarked, movedUnits };
  }

  async dormantSummary() {
    const workers = await this.all();
    const balances = await this.client.hGetAll(DORMANT_BALANCES_KEY);
    return {
      dormantAccounts: workers.filter((worker) => Boolean(worker.dormantAt)).length,
      reservedUnits: Object.values(balances).reduce((sum, value) => sum + Number(value), 0),
    };
  }

  async credit(workerId, amountUnits, entry) {
    const transaction = this.client.multi();
    transaction.hIncrBy(BALANCES_KEY, workerId, amountUnits);
    transaction.rPush(`${LEDGER_PREFIX}${workerId}`, JSON.stringify(entry));
    const results = await transaction.exec();
    return Number(results[0]);
  }

  async createPayout(workerId, payout, idempotencyKey) {
    const script = `
      local existing = redis.call('HGET', KEYS[3], ARGV[2])
      if existing then
        local raw = redis.call('HGET', KEYS[2], existing)
        return {'existing', raw or '', redis.call('HGET', KEYS[1], ARGV[1]) or '0'}
      end
      local balance = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
      local amount = tonumber(ARGV[3])
      if balance < amount then return {'insufficient', '', tostring(balance)} end
      local remaining = redis.call('HINCRBY', KEYS[1], ARGV[1], -amount)
      redis.call('HSET', KEYS[2], ARGV[4], ARGV[5])
      redis.call('HSET', KEYS[3], ARGV[2], ARGV[4])
      redis.call('RPUSH', KEYS[4], ARGV[6])
      return {'created', ARGV[5], tostring(remaining)}
    `;
    const composite = `${workerId}:${idempotencyKey}`;
    const ledgerEntry = JSON.stringify({
      type: "payout_reserved",
      payoutId: payout.id,
      amountUnits: -payout.amountUnits,
      at: payout.createdAt,
    });
    const result = await this.client.eval(script, {
      keys: [BALANCES_KEY, PAYOUTS_KEY, IDEMPOTENCY_KEY, `${LEDGER_PREFIX}${workerId}`],
      arguments: [workerId, composite, String(payout.amountUnits), payout.id, JSON.stringify(payout), ledgerEntry],
    });
    return {
      result: result[0],
      payout: result[1] ? JSON.parse(result[1]) : undefined,
      balance: Number(result[2]),
    };
  }

  async payoutsFor(workerId) {
    const values = await this.client.hVals(PAYOUTS_KEY);
    return values.map((value) => JSON.parse(value)).filter((payout) => payout.workerId === workerId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async allPayouts() {
    const values = await this.client.hVals(PAYOUTS_KEY);
    return values.map((value) => JSON.parse(value))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async updatePayout(payoutId, status, updatedAt, reference = "") {
    const existing = await this.client.hGet(PAYOUTS_KEY, payoutId);
    if (!existing) return { result: "missing" };
    const current = JSON.parse(existing);
    const script = `
      local raw = redis.call('HGET', KEYS[2], ARGV[1])
      if not raw then return {'missing', ''} end
      local payout = cjson.decode(raw)
      if payout.status == ARGV[2] then return {'existing', raw} end
      local allowed = (payout.status == 'pending' and (ARGV[2] == 'approved' or ARGV[2] == 'rejected' or ARGV[2] == 'simulated_paid'))
        or (payout.status == 'approved' and (ARGV[2] == 'rejected' or ARGV[2] == 'simulated_paid'))
      if not allowed then return {'invalid', raw} end
      payout.status = ARGV[2]
      payout.updatedAt = ARGV[3]
      if ARGV[4] ~= '' then payout.reference = ARGV[4] end
      if ARGV[2] == 'rejected' and not payout.refunded then
        payout.refunded = true
        local workerRaw = redis.call('HGET', KEYS[4], payout.workerId)
        local worker = workerRaw and cjson.decode(workerRaw) or nil
        if worker and worker.dormantAt and worker.dormantAt ~= cjson.null then
          redis.call('HINCRBY', KEYS[5], payout.workerId, payout.amountUnits)
        else
          redis.call('HINCRBY', KEYS[1], payout.workerId, payout.amountUnits)
        end
        redis.call('RPUSH', KEYS[3], cjson.encode({type='payout_refund', payoutId=ARGV[1], amountUnits=payout.amountUnits, at=ARGV[3]}))
      end
      local updated = cjson.encode(payout)
      redis.call('HSET', KEYS[2], ARGV[1], updated)
      return {'updated', updated}
    `;
    const result = await this.client.eval(script, {
      keys: [BALANCES_KEY, PAYOUTS_KEY, `${LEDGER_PREFIX}${current.workerId}`, WORKERS_KEY, DORMANT_BALANCES_KEY],
      arguments: [payoutId, status, updatedAt, reference],
    });
    return { result: result[0], payout: result[1] ? JSON.parse(result[1]) : undefined };
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
<body><h1>MARS-X Pool Privacy Policy</h1><p>Last updated: 26 September 2026.</p>
<p>MARS-X Pool Beta is an authorised remote node/pool management and sandbox-payout test. It does not mine cryptocurrency on the Android device, run hidden background compute, promise earnings, transfer real money in sandbox mode, use advertising SDKs, or sell personal data.</p>
<h2>Data processed</h2><p>After an explicit action, the service receives a random installation/worker ID, licence or subscription entitlement ID and status, app/platform version, optional node label, request time, sandbox balance activity, sandbox payout destination and status, and security logs containing truncated keyed hashes of network and installation identifiers. Commercial builds use Qonversion and Google Play Billing to validate purchases and subscription access; payment-card data is handled by Google Play and is not received by MARS-X. The beta does not request contacts, location, photos, microphone, camera, advertising ID, bank credentials, identity documents, or wallet credentials.</p>
<h2>Purpose and legal basis</h2><p>Data is used to activate and protect licences, operate the closed beta, show node availability, prevent abuse and troubleshoot faults. Processing is limited to contract performance and the legitimate interests of service security and support.</p>
<h2>Sharing, retention and rights</h2><p>Data is not sold or shared with advertisers. Qonversion, Google Play, infrastructure and app-distribution providers process only the data needed to provide subscriptions and the service. Security hashes are normally retained for 90 days; service and contract records are retained only as long as necessary. After 365 days without account activity, a sandbox account is marked dormant and its test balance is moved to a separately recorded client-liability reserve. It is never treated as company revenue and is automatically restored when the licensed account returns. To request access, correction or deletion, use the support contact in the store listing or open an issue at <a href="https://github.com/melih123r/Mars-x-pool/issues">the MARS-X Pool repository</a> and provide only the worker ID shown in the app. Users in France may complain to the CNIL.</p>
<p>Controller: AbdilMelih Demirbaş / MARS-X Pool. A monitored privacy email and legally required publisher details must be added before public commercial release.</p>
</body></html>`;

export function createServer({
  token = process.env.WORKER_TOKEN,
  adminToken = process.env.ADMIN_TOKEN,
  store = new MemoryStore(),
  now = () => Date.now(),
  rateLimitMax = 300,
  minPayoutUnits = Number(process.env.MIN_PAYOUT_UNITS || 1_000_000),
  dormantAfterMs = Number(process.env.DORMANT_AFTER_MS || DEFAULT_DORMANT_AFTER_MS),
  licensePepper = process.env.LICENSE_PEPPER || "",
  licenseSessionSecret = process.env.LICENSE_SESSION_SECRET || "",
  licenseRecords = parseLicenseRecords(process.env.LICENSE_RECORDS_JSON),
  licenseTokenTtlSeconds = Number(process.env.LICENSE_TOKEN_TTL_SECONDS || 2_592_000),
  qonversionSecretKey = process.env.QONVERSION_SECRET_KEY || "",
  qonversionEntitlementIds = process.env.QONVERSION_ENTITLEMENT_IDS || "pro,farm",
  qonversionSessionTtlSeconds = Number(process.env.QONVERSION_SESSION_TTL_SECONDS || 3_600),
  qonversionApiBase = "https://api.qonversion.io/v4",
  qonversionFetch = globalThis.fetch,
} = {}) {
  const records = parseLicenseRecords(licenseRecords);
  const ttlSeconds = Math.min(Math.max(Number(licenseTokenTtlSeconds), 3_600), 7_776_000);
  const partnerTtlSeconds = Math.min(Math.max(Number(qonversionSessionTtlSeconds), 900), 86_400);
  const entitlementIds = parseEntitlementIds(qonversionEntitlementIds);
  const minimum = normalizePositiveUnits(minPayoutUnits) || 1_000_000;
  const dormancyWindow = Number.isFinite(dormantAfterMs) && dormantAfterMs > 0
    ? dormantAfterMs
    : DEFAULT_DORMANT_AFTER_MS;
  const legacyLicenseReady = licensePepper.length >= 32 && licenseSessionSecret.length >= 32 && records.length > 0;
  const qonversionReady = /^(test_)?sk_[A-Za-z0-9_-]{8,}$/.test(qonversionSecretKey)
    && licenseSessionSecret.length >= 32
    && entitlementIds.length > 0
    && typeof qonversionFetch === "function";
  const licenseReady = legacyLicenseReady || qonversionReady;
  const rateLimits = new Map();
  const activationLimits = new Map();

  function isRateLimited(req) {
    const key = requestAddress(req);
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

  function isActivationRateLimited(req) {
    const key = requestAddress(req);
    const timestamp = now();
    const previous = activationLimits.get(key) || [];
    const recent = previous.filter((seenAt) => timestamp - seenAt < 600_000);
    recent.push(timestamp);
    activationLimits.set(key, recent);
    return recent.length > 10;
  }

  function currentLicense(req, installId) {
    return verifyLicenseSession(
      authorizationToken(req, "License"),
      installId,
      records,
      licenseSessionSecret,
      now(),
    );
  }

  async function authenticateWorker(req) {
    const workerId = String(req.headers["x-worker-id"] || "");
    const installId = String(req.headers["x-install-id"] || "");
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(workerId) || !validInstallId(installId)) return null;
    const session = currentLicense(req, installId);
    if (!session) return null;
    const worker = await store.get(workerId);
    if (!worker || worker.licenseId !== session.lic || (worker.installId && worker.installId !== installId)) return null;
    return { workerId, installId, session, worker };
  }

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...baseHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Install-Id, X-Worker-Id",
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
          licensing: licenseReady ? "ready" : "not_configured",
          license_provider: qonversionReady ? "qonversion" : (legacyLicenseReady ? "marsx_beta" : "none"),
          payoutMode: "sandbox",
          dormantPolicy: "safeguarded-liability-reserve",
        });
      } catch {
        return sendJson(res, 503, {
          ok: false,
          service: SERVICE,
          version: VERSION,
          storage: store.kind,
          payoutMode: "sandbox",
          dormantPolicy: "safeguarded-liability-reserve",
        });
      }
    }

    if (isRateLimited(req)) return sendJson(res, 429, { error: "rate_limit_exceeded" });

    try {
      if (req.method === "POST" && pathname === "/billing/qonversion/session") {
        if (!qonversionReady) return sendJson(res, 503, { error: "qonversion_not_configured" });
        if (isActivationRateLimited(req)) return sendJson(res, 429, { error: "too_many_attempts" });
        const data = await readJson(req);
        const installId = String(data.install_id || "");
        const identityId = String(data.identity_id || "");
        if (!validInstallId(installId) || identityId !== installId) {
          return sendJson(res, 400, { error: "invalid_qonversion_identity" });
        }
        if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
          return sendJson(res, 400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
        }
        let result;
        try {
          result = await findQonversionEntitlement({
            fetchImpl: qonversionFetch,
            apiBase: qonversionApiBase.replace(/\/$/, ""),
            secretKey: qonversionSecretKey,
            identityId,
            entitlementIds,
          });
        } catch (error) {
          auditLicense("qonversion_lookup_failed", req, licensePepper, {
            reason: String(error?.message || "unknown").slice(0, 80),
          });
          return sendJson(res, 502, { error: "qonversion_unavailable" });
        }
        if (result.error) {
          auditLicense("qonversion_session_denied", req, licensePepper, { reason: result.error });
          return sendJson(res, 403, { error: result.error });
        }
        const sessionToken = issueQonversionSession(
          result.entitlement,
          installId,
          licenseSessionSecret,
          now(),
          partnerTtlSeconds,
        );
        auditLicense("qonversion_session_granted", req, licensePepper, {
          entitlementId: result.entitlement.id,
          installHash: licensePepper ? hmacHex(licensePepper, installId).slice(0, 24) : "unconfigured",
          termsVersion: TERMS_VERSION,
          appVersion: String(data.app_version || "unknown").slice(0, 30),
        });
        return sendJson(res, 200, {
          ok: true,
          provider: "qonversion",
          license_id: `qonversion:${result.entitlement.id}`,
          entitlement_id: result.entitlement.id,
          session_token: sessionToken,
          expires_in: partnerTtlSeconds,
          terms_version: TERMS_VERSION,
        });
      }

      if (req.method === "POST" && pathname === "/license/activate") {
        if (!legacyLicenseReady) return sendJson(res, 503, { error: "legacy_licensing_not_configured" });
        if (isActivationRateLimited(req)) return sendJson(res, 429, { error: "too_many_attempts" });
        const data = await readJson(req);
        const installId = String(data.install_id || "");
        if (!validInstallId(installId)) return sendJson(res, 400, { error: "invalid_install_id" });
        if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
          return sendJson(res, 400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
        }
        const record = findLicense(records, licensePepper, data.license_key);
        if (!record) {
          auditLicense("activation_denied", req, licensePepper, { reason: "unknown_key" });
          return sendJson(res, 401, { error: "invalid_license" });
        }
        if (record.status !== "active") return sendJson(res, 403, { error: "license_inactive" });
        if (record.expiresAt && Date.parse(record.expiresAt) <= now()) {
          return sendJson(res, 403, { error: "license_expired" });
        }
        if (!await store.bindLicenseDevice(record.id, installId, record.maxDevices)) {
          auditLicense("activation_denied", req, licensePepper, { licenseId: record.id, reason: "device_limit" });
          return sendJson(res, 409, { error: "device_limit_reached" });
        }
        const sessionToken = issueLicenseSession(record, installId, licenseSessionSecret, now(), ttlSeconds);
        auditLicense("activation_granted", req, licensePepper, {
          licenseId: record.id,
          installHash: hmacHex(licensePepper, installId).slice(0, 24),
          termsVersion: TERMS_VERSION,
          appVersion: String(data.app_version || "unknown").slice(0, 30),
        });
        return sendJson(res, 200, {
          ok: true,
          license_id: record.id,
          session_token: sessionToken,
          expires_in: ttlSeconds,
          terms_version: TERMS_VERSION,
        });
      }

      if (req.method === "GET" && pathname === "/license/status") {
        if (!licenseReady) return sendJson(res, 503, { error: "licensing_not_configured" });
        const session = currentLicense(req, String(req.headers["x-install-id"] || ""));
        if (!session) return sendJson(res, 401, { error: "license_session_invalid" });
        return sendJson(res, 200, {
          ok: true,
          license_id: session.lic,
          provider: session.src === "qonversion" ? "qonversion" : "marsx_beta",
          expires_at: new Date(session.exp * 1000).toISOString(),
        });
      }

      if (req.method === "GET" && (pathname === "/workers" || pathname === "/summary")) {
        if (!token) return sendJson(res, 503, { error: "WORKER_TOKEN not configured" });
        if (!safeAuthorization(req.headers.authorization, "Bearer", token)) {
          return sendJson(res, 401, { error: "unauthorized" });
        }
        const workers = await store.all();
        const timestamp = now();
        if (pathname === "/summary") {
          return sendJson(res, 200, {
            registered: workers.length,
            online: workers.filter((worker) => timestamp - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS).length,
          });
        }
        return sendJson(res, 200, {
          workers: workers.map((worker) => ({
            ...worker,
            status: timestamp - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS ? "online" : "offline",
          })).sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen)),
        });
      }

      if (req.method === "POST" && (pathname === "/register" || pathname === "/heartbeat")) {
        if (!licenseReady) return sendJson(res, 503, { error: "licensing_not_configured" });
        const data = await readJson(req);
        const installId = String(data.install_id || "");
        const session = currentLicense(req, installId);
        if (!session) return sendJson(res, 401, { error: "valid_license_required" });
        const workerId = normalizeWorkerId(data);
        if (!workerId) return sendJson(res, 400, { error: "invalid_worker_id" });
        const oldWorker = await store.get(workerId);
        if (pathname === "/heartbeat" && !oldWorker) return sendJson(res, 404, { error: "register_first" });
        if (oldWorker && oldWorker.licenseId && oldWorker.licenseId !== session.lic) {
          return sendJson(res, 409, { error: "worker_already_registered" });
        }
        if (oldWorker?.installId && oldWorker.installId !== installId) {
          return sendJson(res, 409, { error: "worker_bound_to_another_installation" });
        }
        if (oldWorker) await store.touchActivity(workerId, now());
        const worker = normalizeWorker(data, await store.get(workerId), now(), session.lic, installId);
        await store.set(worker);
        return sendJson(res, 200, { ok: true, worker });
      }

      if (req.method === "GET" && pathname === "/account") {
        if (!licenseReady) return sendJson(res, 503, { error: "licensing_not_configured" });
        const auth = await authenticateWorker(req);
        if (!auth) return sendJson(res, 401, { error: "valid_license_and_worker_required" });
        const activity = await store.touchActivity(auth.workerId, now());
        const availableUnits = await store.getBalance(auth.workerId);
        return sendJson(res, 200, {
          workerId: auth.workerId,
          asset: ASSET,
          decimals: ASSET_DECIMALS,
          availableUnits,
          availableDisplay: formatUnits(availableUnits),
          minimumPayoutUnits: minimum,
          minimumPayoutDisplay: formatUnits(minimum),
          payoutMode: "sandbox",
          withdrawable: false,
          accountStatus: "active",
          dormantAfterDays: Math.round(dormancyWindow / 86_400_000),
          restoredFromDormantUnits: activity.restoredUnits,
        });
      }

      if (req.method === "GET" && pathname === "/payouts") {
        if (!licenseReady) return sendJson(res, 503, { error: "licensing_not_configured" });
        const auth = await authenticateWorker(req);
        if (!auth) return sendJson(res, 401, { error: "valid_license_and_worker_required" });
        await store.touchActivity(auth.workerId, now());
        return sendJson(res, 200, {
          payoutMode: "sandbox",
          payouts: await store.payoutsFor(auth.workerId),
        });
      }

      if (req.method === "POST" && pathname === "/payouts") {
        if (!licenseReady) return sendJson(res, 503, { error: "licensing_not_configured" });
        const auth = await authenticateWorker(req);
        if (!auth) return sendJson(res, 401, { error: "valid_license_and_worker_required" });
        await store.touchActivity(auth.workerId, now());
        const data = await readJson(req);
        const amountUnits = normalizePositiveUnits(data.amountUnits);
        const destination = normalizeDestination(data.destination);
        const idempotencyKey = normalizeIdempotencyKey(data.idempotencyKey);
        if (!amountUnits || amountUnits < minimum) {
          return sendJson(res, 400, { error: "amount_below_sandbox_minimum", minimumPayoutUnits: minimum });
        }
        if (!destination) return sendJson(res, 400, { error: "invalid_sandbox_destination" });
        if (!idempotencyKey) return sendJson(res, 400, { error: "invalid_idempotency_key" });
        const timestamp = new Date(now()).toISOString();
        const payout = {
          id: `pay_${randomUUID().replaceAll("-", "")}`,
          workerId: auth.workerId,
          asset: ASSET,
          amountUnits,
          amountDisplay: formatUnits(amountUnits),
          destination,
          status: "pending",
          sandbox: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const created = await store.createPayout(auth.workerId, payout, idempotencyKey);
        if (created.result === "insufficient") {
          return sendJson(res, 409, { error: "insufficient_sandbox_balance", availableUnits: created.balance });
        }
        return sendJson(res, created.result === "created" ? 201 : 200, {
          ok: true,
          created: created.result === "created",
          payout: created.payout,
          availableUnits: created.balance,
          payoutMode: "sandbox",
        });
      }

      if (pathname.startsWith("/admin/")) {
        if (!adminToken) return sendJson(res, 503, { error: "ADMIN_TOKEN_not_configured" });
        if (!safeAuthorization(req.headers.authorization, "Bearer", adminToken)) {
          return sendJson(res, 401, { error: "admin_unauthorized" });
        }
        if (req.method === "POST" && pathname === "/admin/credits") {
          const data = await readJson(req);
          const workerId = normalizeWorkerId(data);
          const amountUnits = normalizePositiveUnits(data.amountUnits);
          const worker = workerId ? await store.get(workerId) : null;
          if (!workerId || !worker) return sendJson(res, 404, { error: "worker_not_found" });
          if (worker.dormantAt) return sendJson(res, 409, { error: "dormant_account_must_reactivate" });
          if (!amountUnits) return sendJson(res, 400, { error: "invalid_amountUnits" });
          const at = new Date(now()).toISOString();
          const balance = await store.credit(workerId, amountUnits, {
            type: "sandbox_credit",
            amountUnits,
            reason: String(data.reason || "sandbox test").slice(0, 120),
            at,
          });
          return sendJson(res, 201, {
            ok: true,
            workerId,
            asset: ASSET,
            creditedUnits: amountUnits,
            availableUnits: balance,
            payoutMode: "sandbox",
          });
        }
        if (req.method === "GET" && pathname === "/admin/payouts") {
          return sendJson(res, 200, { payoutMode: "sandbox", payouts: await store.allPayouts() });
        }
        if (req.method === "GET" && pathname === "/admin/dormancy") {
          const summary = await store.dormantSummary();
          return sendJson(res, 200, {
            ...summary,
            asset: ASSET,
            reserveType: "client-liability",
            companyRevenue: false,
            dormantAfterDays: Math.round(dormancyWindow / 86_400_000),
          });
        }
        if (req.method === "POST" && pathname === "/admin/dormancy/sweep") {
          const timestamp = now();
          const result = await store.sweepDormant(timestamp - dormancyWindow, timestamp);
          return sendJson(res, 200, {
            ok: true,
            ...result,
            asset: ASSET,
            reserveType: "client-liability",
            companyRevenue: false,
          });
        }
        const match = pathname.match(/^\/admin\/payouts\/(pay_[A-Za-z0-9]+)$/);
        if (req.method === "POST" && match) {
          const data = await readJson(req);
          const status = String(data.status || "");
          if (!["approved", "rejected", "simulated_paid"].includes(status)) {
            return sendJson(res, 400, { error: "invalid_sandbox_status" });
          }
          const result = await store.updatePayout(
            match[1],
            status,
            new Date(now()).toISOString(),
            String(data.reference || "").slice(0, 120),
          );
          if (result.result === "missing") return sendJson(res, 404, { error: "payout_not_found" });
          if (result.result === "invalid") {
            return sendJson(res, 409, { error: "invalid_payout_transition", payout: result.payout });
          }
          return sendJson(res, 200, { ok: true, payout: result.payout, payoutMode: "sandbox" });
        }
      }

      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error?.status) return sendJson(res, error.status, { error: error.message.replaceAll(" ", "_") });
      console.error("Request failed", error);
      return sendJson(res, 500, { error: "internal_error" });
    }
  });
}

export async function start() {
  const port = Number(process.env.PORT || 3000);
  const store = await createStore();
  const server = createServer({ store });
  await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));
  console.log(`MARS-X API ${VERSION} listening on ${port} with ${store.kind} storage and sandbox payouts`);

  const configuredDormancyWindow = Number(process.env.DORMANT_AFTER_MS || DEFAULT_DORMANT_AFTER_MS);
  const dormancyWindow = Number.isFinite(configuredDormancyWindow) && configuredDormancyWindow > 0
    ? configuredDormancyWindow
    : DEFAULT_DORMANT_AFTER_MS;
  const sweep = async () => {
    const timestamp = Date.now();
    const result = await store.sweepDormant(timestamp - dormancyWindow, timestamp);
    if (result.accountsMarked > 0) console.log("Dormancy sweep", result);
  };
  const sweepTimer = setInterval(
    () => sweep().catch((error) => console.error("Dormancy sweep failed", error)),
    6 * 60 * 60 * 1000,
  );
  sweepTimer.unref();
  sweep().catch((error) => console.error("Initial dormancy sweep failed", error));

  const shutdown = async () => {
    clearInterval(sweepTimer);
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
