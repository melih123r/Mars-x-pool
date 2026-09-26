const SERVICE = "marsx-pool-worker-api";
const VERSION = "0.6.1";
const TERMS_VERSION = "2026-09-26-v2";
const ASSET = "USDT_TEST";
const ASSET_DECIMALS = 6;
const ONLINE_WINDOW_MS = 120_000;
const MAX_BODY_BYTES = 16_384;
const DEFAULT_DORMANT_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const rateLimits = new Map();
const activationLimits = new Map();

const commonHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const corsHeaders = {
  ...commonHeaders,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Install-Id, X-Worker-Id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: {
      ...commonHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

async function readJson(request) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) throw httpError(415, "content_type_must_be_application/json");
  const text = await request.text();
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) throw httpError(413, "payload_too_large");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw httpError(400, "invalid_JSON");
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeWorkerId(data) {
  const candidate = data?.workerId ?? data?.node_id;
  return typeof candidate === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(candidate) ? candidate : null;
}

function validInstallId(value) {
  return /^[A-Za-z0-9_-]{12,80}$/.test(String(value || ""));
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

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function parseLicenseRecords(input) {
  if (!input) return [];
  let records;
  try {
    records = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return [];
  }
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    id: String(record.id || ""),
    keyHash: String(record.keyHash || "").toLowerCase(),
    status: String(record.status || "active"),
    expiresAt: record.expiresAt ? String(record.expiresAt) : null,
    maxDevices: Math.min(Math.max(Number(record.maxDevices || 1), 1), 25),
  })).filter((record) => record.id && /^[a-f0-9]{64}$/.test(record.keyHash));
}

function parseEntitlementIds(input) {
  return [...new Set(String(input || "pro,farm").split(",")
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z0-9._-]{1,80}$/.test(value)))];
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(String(value))));
}

async function hmacHex(secret, value) {
  return bytesToHex(await hmac(secret, value));
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  let mismatch = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) mismatch |= (a[index] || 0) ^ (b[index] || 0);
  return mismatch === 0;
}

async function findLicense(records, pepper, rawKey) {
  const digest = await hmacHex(pepper, normalizeLicenseKey(rawKey));
  return records.find((record) => constantTimeEqual(record.keyHash, digest)) || null;
}

async function issueSession(record, installId, secret, nowMs, ttlSeconds, source = "marsx_beta") {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload = {
    v: 1,
    lic: record.id,
    ins: installId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    terms: TERMS_VERSION,
  };
  if (source === "qonversion") {
    payload.src = "qonversion";
    payload.ent = record.entitlementId;
    payload.product = String(record.productId || "").slice(0, 120);
  }
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${bytesToBase64Url(await hmac(secret, encoded))}`;
}

async function verifySession(token, installId, records, secret, nowMs) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return null;
  let actual;
  try { actual = base64UrlToBytes(parts[1]); } catch { return null; }
  const expected = await hmac(secret, parts[0]);
  if (!constantTimeEqual(bytesToHex(actual), bytesToHex(expected))) return null;
  let payload;
  try { payload = JSON.parse(decoder.decode(base64UrlToBytes(parts[0]))); } catch { return null; }
  if (!payload.exp || payload.exp < Math.floor(nowMs / 1000)) return null;
  if (installId && payload.ins !== installId) return null;
  if (payload.src === "qonversion") {
    return payload.ent && payload.lic === `qonversion:${payload.ent}` ? payload : null;
  }
  const record = records.find((candidate) => candidate.id === payload.lic);
  if (!record || record.status !== "active") return null;
  if (record.expiresAt && Date.parse(record.expiresAt) <= nowMs) return null;
  return payload;
}

function authorizationToken(request, scheme) {
  const value = String(request.headers.get("authorization") || "");
  const prefix = `${scheme} `;
  return value.startsWith(prefix) ? value.slice(prefix.length) : "";
}

function safeAuthorization(request, scheme, token) {
  return Boolean(token) && constantTimeEqual(request.headers.get("authorization") || "", `${scheme} ${token}`);
}

function requestAddress(request) {
  return String(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0].trim();
}

function limited(map, key, windowMs, maximum, nowMs) {
  const recent = (map.get(key) || []).filter((seenAt) => nowMs - seenAt < windowMs);
  recent.push(nowMs);
  map.set(key, recent);
  if (map.size > 10_000) map.clear();
  return recent.length > maximum;
}

function workerFromRow(row) {
  if (!row) return null;
  return {
    workerId: row.worker_id,
    licenseId: row.license_id,
    installId: row.install_id,
    label: row.label,
    platform: row.platform,
    cpuPercent: row.cpu_percent,
    hashrate: row.hashrate,
    registeredAt: row.registered_at,
    lastSeen: row.last_seen,
    lastActivityAt: row.last_activity_at,
    lastActivityMs: row.last_activity_ms,
    dormantAt: row.dormant_at,
    reactivatedAt: row.reactivated_at,
    sessionId: row.session_id,
  };
}

function payoutFromRow(row) {
  return {
    id: row.id,
    workerId: row.worker_id,
    asset: row.asset,
    amountUnits: row.amount_units,
    amountDisplay: formatUnits(row.amount_units),
    destination: row.destination,
    status: row.status,
    sandbox: Boolean(row.sandbox),
    reference: row.reference || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function bindLicenseDevice(db, licenseId, installId, maxDevices, nowIso) {
  const existing = await db.prepare(
    "SELECT 1 AS ok FROM license_devices WHERE license_id = ?1 AND install_id = ?2",
  ).bind(licenseId, installId).first();
  if (existing) return true;
  const count = await db.prepare(
    "SELECT COUNT(*) AS count FROM license_devices WHERE license_id = ?1",
  ).bind(licenseId).first();
  if (Number(count?.count || 0) >= maxDevices) return false;
  await db.prepare(
    "INSERT INTO license_devices (license_id, install_id, bound_at) VALUES (?1, ?2, ?3)",
  ).bind(licenseId, installId, nowIso).run();
  return true;
}

async function getWorker(db, workerId) {
  return workerFromRow(await db.prepare("SELECT * FROM workers WHERE worker_id = ?1").bind(workerId).first());
}

async function restoreAndTouch(db, worker, nowMs) {
  const nowIso = new Date(nowMs).toISOString();
  let restoredUnits = 0;
  if (worker.dormantAt) {
    const reserve = await db.prepare("SELECT units FROM dormant_balances WHERE worker_id = ?1")
      .bind(worker.workerId).first();
    restoredUnits = Number(reserve?.units || 0);
    await db.batch([
      db.prepare("INSERT INTO balances (worker_id, units, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(worker_id) DO UPDATE SET units = balances.units + excluded.units, updated_at = excluded.updated_at")
        .bind(worker.workerId, restoredUnits, nowIso),
      db.prepare("DELETE FROM dormant_balances WHERE worker_id = ?1").bind(worker.workerId),
      db.prepare("UPDATE workers SET dormant_at = NULL, reactivated_at = ?2, last_activity_at = ?2, last_activity_ms = ?3 WHERE worker_id = ?1")
        .bind(worker.workerId, nowIso, nowMs),
    ]);
  } else {
    await db.prepare("UPDATE workers SET last_activity_at = ?2, last_activity_ms = ?3 WHERE worker_id = ?1")
      .bind(worker.workerId, nowIso, nowMs).run();
  }
  return restoredUnits;
}

async function authenticateWorker(request, env, records, nowMs) {
  const workerId = String(request.headers.get("x-worker-id") || "");
  const installId = String(request.headers.get("x-install-id") || "");
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(workerId) || !validInstallId(installId)) return null;
  const session = await verifySession(
    authorizationToken(request, "License"), installId, records, env.LICENSE_SESSION_SECRET, nowMs,
  );
  if (!session) return null;
  const worker = await getWorker(env.DB, workerId);
  if (!worker || worker.licenseId !== session.lic || worker.installId !== installId) return null;
  return { workerId, installId, session, worker };
}

async function qonversionJson(url, secretKey) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(7_000),
  });
  const raw = await response.text();
  if (encoder.encode(raw).byteLength > 262_144) throw new Error("qonversion_response_too_large");
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { throw new Error("qonversion_invalid_response"); }
  return { response, body };
}

async function findQonversionEntitlement(env, identityId, entitlementIds) {
  const apiBase = String(env.QONVERSION_API_BASE || "https://api.qonversion.io/v4").replace(/\/$/, "");
  const identity = await qonversionJson(
    `${apiBase}/identities/${encodeURIComponent(identityId)}`, env.QONVERSION_SECRET_KEY,
  );
  if (identity.response.status === 404) return { error: "qonversion_identity_not_found" };
  if (!identity.response.ok) throw new Error("qonversion_identity_lookup_failed");
  const userId = String(identity.body.user_id || "");
  if (!/^QON_[A-Za-z0-9_-]{8,256}$/.test(userId)) throw new Error("qonversion_invalid_user");
  const result = await qonversionJson(
    `${apiBase}/users/${encodeURIComponent(userId)}/entitlements`, env.QONVERSION_SECRET_KEY,
  );
  if (!result.response.ok) throw new Error("qonversion_entitlement_lookup_failed");
  const entitlements = Array.isArray(result.body.data) ? result.body.data : [];
  const active = entitlements.find((entry) => entry?.is_active === true && entitlementIds.includes(String(entry.id || "")));
  return active ? { entitlement: active } : { error: "qonversion_entitlement_inactive" };
}

async function sweepDormant(env, nowMs = Date.now()) {
  const dormantAfterMs = positiveNumber(env.DORMANT_AFTER_MS, DEFAULT_DORMANT_AFTER_MS);
  const threshold = nowMs - dormantAfterMs;
  const { results = [] } = await env.DB.prepare(
    "SELECT w.*, COALESCE(b.units, 0) AS balance_units FROM workers w LEFT JOIN balances b ON b.worker_id = w.worker_id WHERE w.dormant_at IS NULL AND w.last_activity_ms < ?1",
  ).bind(threshold).all();
  const movedAt = new Date(nowMs).toISOString();
  let reserveUnits = 0;
  for (const row of results) {
    const units = Number(row.balance_units || 0);
    reserveUnits += units;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO dormant_balances (worker_id, units, moved_at) VALUES (?1, ?2, ?3) ON CONFLICT(worker_id) DO UPDATE SET units = excluded.units, moved_at = excluded.moved_at")
        .bind(row.worker_id, units, movedAt),
      env.DB.prepare("INSERT INTO balances (worker_id, units, updated_at) VALUES (?1, 0, ?2) ON CONFLICT(worker_id) DO UPDATE SET units = 0, updated_at = excluded.updated_at")
        .bind(row.worker_id, movedAt),
      env.DB.prepare("UPDATE workers SET dormant_at = ?2 WHERE worker_id = ?1").bind(row.worker_id, movedAt),
    ]);
  }
  return { accountsMarked: results.length, reserveUnits };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function privacyPage() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MARS-X Pool Privacy</title><style>body{font:16px/1.6 system-ui;max-width:760px;margin:40px auto;padding:0 20px;color:#18202a}h1,h2{line-height:1.2}</style><h1>MARS-X Pool privacy notice</h1><p>Updated 26 September 2026. MARS-X Pool is a remote worker-management and sandbox-accounting beta. It performs no on-device cryptocurrency mining and no real-money or cryptocurrency payout.</p><h2>Data processed</h2><p>After an explicit action, the service receives a random installation/worker ID, licence or subscription entitlement, app/platform version, optional worker label, request time, sandbox balance and payout activity, and limited security logs. Google Play and Qonversion process purchase data when subscriptions are enabled; MARS-X does not receive payment-card data.</p><h2>Storage and rights</h2><p>Operational beta data is stored in Cloudflare D1. Data is not sold or shared with advertisers. After 365 days without activity, a sandbox balance moves to a client-liability reserve and is restored when the licensed account returns. To request access, correction or deletion, open an issue at <a href="https://github.com/melih123r/Mars-x-pool/issues">the MARS-X Pool repository</a> and provide only the worker ID shown in the app. Users in France may complain to the CNIL.</p></html>`;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const nowMs = Date.now();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method === "GET" && path === "/privacy") return html(200, privacyPage());

  const records = parseLicenseRecords(env.LICENSE_RECORDS_JSON);
  const sessionSecret = String(env.LICENSE_SESSION_SECRET || "");
  const pepper = String(env.LICENSE_PEPPER || "");
  const entitlementIds = parseEntitlementIds(env.QONVERSION_ENTITLEMENT_IDS);
  const legacyReady = pepper.length >= 32 && sessionSecret.length >= 32 && records.length > 0;
  const qonversionReady = /^(test_)?sk_[A-Za-z0-9_-]{8,}$/.test(String(env.QONVERSION_SECRET_KEY || ""))
    && sessionSecret.length >= 32 && entitlementIds.length > 0;
  const licensingReady = legacyReady || qonversionReady;

  if (request.method === "GET" && path === "/health") {
    try {
      const probe = await env.DB.prepare("SELECT 1 AS ok").first();
      return json(probe?.ok === 1 ? 200 : 503, {
        ok: probe?.ok === 1,
        service: SERVICE,
        version: VERSION,
        storage: "d1",
        persistent: true,
        licensing: licensingReady ? "ready" : "not_configured",
        license_provider: qonversionReady ? "qonversion" : (legacyReady ? "marsx_beta" : "none"),
        payoutMode: "sandbox",
        dormantPolicy: "safeguarded-liability-reserve",
      });
    } catch {
      return json(503, { ok: false, service: SERVICE, version: VERSION, storage: "d1", payoutMode: "sandbox" });
    }
  }

  if (limited(rateLimits, requestAddress(request), 60_000, positiveNumber(env.RATE_LIMIT_MAX, 120), nowMs)) {
    return json(429, { error: "rate_limit_exceeded" });
  }

  if (request.method === "POST" && path === "/license/activate") {
    if (!legacyReady) return json(503, { error: "legacy_licensing_not_configured" });
    if (limited(activationLimits, requestAddress(request), 600_000, 10, nowMs)) return json(429, { error: "too_many_attempts" });
    const data = await readJson(request);
    const installId = String(data.install_id || "");
    if (!validInstallId(installId)) return json(400, { error: "invalid_install_id" });
    if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
      return json(400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
    }
    const record = await findLicense(records, pepper, data.license_key);
    if (!record) return json(401, { error: "invalid_license" });
    if (record.status !== "active") return json(403, { error: "license_inactive" });
    if (record.expiresAt && Date.parse(record.expiresAt) <= nowMs) return json(403, { error: "license_expired" });
    if (!await bindLicenseDevice(env.DB, record.id, installId, record.maxDevices, new Date(nowMs).toISOString())) {
      return json(409, { error: "device_limit_reached" });
    }
    const ttl = Math.min(Math.max(positiveNumber(env.LICENSE_TOKEN_TTL_SECONDS, 2_592_000), 3_600), 7_776_000);
    return json(200, {
      ok: true,
      license_id: record.id,
      session_token: await issueSession(record, installId, sessionSecret, nowMs, ttl),
      expires_in: ttl,
      terms_version: TERMS_VERSION,
    });
  }

  if (request.method === "POST" && path === "/billing/qonversion/session") {
    if (!qonversionReady) return json(503, { error: "qonversion_not_configured" });
    if (limited(activationLimits, requestAddress(request), 600_000, 10, nowMs)) return json(429, { error: "too_many_attempts" });
    const data = await readJson(request);
    const installId = String(data.install_id || "");
    const identityId = String(data.identity_id || "");
    if (!validInstallId(installId) || identityId !== installId) return json(400, { error: "invalid_qonversion_identity" });
    if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
      return json(400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
    }
    let result;
    try { result = await findQonversionEntitlement(env, identityId, entitlementIds); }
    catch { return json(502, { error: "qonversion_unavailable" }); }
    if (result.error) return json(403, { error: result.error });
    const entitlement = result.entitlement;
    const record = {
      id: `qonversion:${entitlement.id}`,
      entitlementId: String(entitlement.id),
      productId: String(entitlement.product?.product_id || ""),
    };
    const ttl = Math.min(Math.max(positiveNumber(env.PARTNER_SESSION_TTL_SECONDS, 86_400), 3_600), 604_800);
    return json(200, {
      ok: true,
      provider: "qonversion",
      license_id: record.id,
      entitlement_id: record.entitlementId,
      session_token: await issueSession(record, installId, sessionSecret, nowMs, ttl, "qonversion"),
      expires_in: ttl,
      terms_version: TERMS_VERSION,
    });
  }

  if (request.method === "GET" && path === "/license/status") {
    if (!licensingReady) return json(503, { error: "licensing_not_configured" });
    const installId = String(request.headers.get("x-install-id") || "");
    const session = await verifySession(authorizationToken(request, "License"), installId, records, sessionSecret, nowMs);
    if (!session) return json(401, { error: "license_session_invalid" });
    return json(200, {
      ok: true,
      license_id: session.lic,
      provider: session.src === "qonversion" ? "qonversion" : "marsx_beta",
      expires_at: new Date(session.exp * 1000).toISOString(),
    });
  }

  if (request.method === "GET" && (path === "/workers" || path === "/summary")) {
    if (!env.WORKER_TOKEN) return json(503, { error: "WORKER_TOKEN_not_configured" });
    if (!safeAuthorization(request, "Bearer", env.WORKER_TOKEN)) return json(401, { error: "unauthorized" });
    if (path === "/summary") {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS registered, SUM(CASE WHEN last_seen >= ?1 THEN 1 ELSE 0 END) AS online FROM workers",
      ).bind(new Date(nowMs - ONLINE_WINDOW_MS).toISOString()).first();
      return json(200, { registered: Number(row?.registered || 0), online: Number(row?.online || 0) });
    }
    const { results = [] } = await env.DB.prepare("SELECT * FROM workers ORDER BY last_seen DESC").all();
    return json(200, {
      workers: results.map((row) => ({
        ...workerFromRow(row),
        status: nowMs - Date.parse(row.last_seen) < ONLINE_WINDOW_MS ? "online" : "offline",
      })),
    });
  }

  if (request.method === "POST" && (path === "/register" || path === "/heartbeat")) {
    if (!licensingReady) return json(503, { error: "licensing_not_configured" });
    const data = await readJson(request);
    const installId = String(data.install_id || "");
    const session = await verifySession(authorizationToken(request, "License"), installId, records, sessionSecret, nowMs);
    if (!session) return json(401, { error: "valid_license_required" });
    const workerId = normalizeWorkerId(data);
    if (!workerId) return json(400, { error: "invalid_worker_id" });
    const oldWorker = await getWorker(env.DB, workerId);
    if (path === "/heartbeat" && !oldWorker) return json(404, { error: "register_first" });
    if (oldWorker?.licenseId !== undefined && oldWorker.licenseId !== session.lic) return json(409, { error: "worker_already_registered" });
    if (oldWorker?.installId && oldWorker.installId !== installId) return json(409, { error: "worker_bound_to_another_installation" });
    const nowIso = new Date(nowMs).toISOString();
    const cpuCandidate = data.cpuPercent ?? data.cpu_percent;
    const cpuPercent = Number.isFinite(cpuCandidate) ? Math.min(100, Math.max(0, Number(cpuCandidate))) : oldWorker?.cpuPercent ?? null;
    const hashrate = Number.isFinite(data.hashrate) ? Math.max(0, Number(data.hashrate)) : oldWorker?.hashrate ?? null;
    const worker = {
      workerId,
      licenseId: session.lic,
      installId,
      label: String(data.label || oldWorker?.label || "worker").slice(0, 80),
      platform: String(data.platform || oldWorker?.platform || "unknown").slice(0, 40),
      cpuPercent,
      hashrate,
      registeredAt: oldWorker?.registeredAt || nowIso,
      lastSeen: nowIso,
      lastActivityAt: nowIso,
      lastActivityMs: nowMs,
      dormantAt: null,
      reactivatedAt: oldWorker?.reactivatedAt || null,
      sessionId: oldWorker?.sessionId || crypto.randomUUID(),
    };
    await env.DB.prepare(`INSERT INTO workers (
      worker_id, license_id, install_id, label, platform, cpu_percent, hashrate,
      registered_at, last_seen, last_activity_at, last_activity_ms, dormant_at, reactivated_at, session_id
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    ON CONFLICT(worker_id) DO UPDATE SET label=excluded.label, platform=excluded.platform,
      cpu_percent=excluded.cpu_percent, hashrate=excluded.hashrate, last_seen=excluded.last_seen,
      last_activity_at=excluded.last_activity_at, last_activity_ms=excluded.last_activity_ms,
      dormant_at=NULL`).bind(
      worker.workerId, worker.licenseId, worker.installId, worker.label, worker.platform,
      worker.cpuPercent, worker.hashrate, worker.registeredAt, worker.lastSeen,
      worker.lastActivityAt, worker.lastActivityMs, worker.dormantAt,
      worker.reactivatedAt, worker.sessionId,
    ).run();
    await env.DB.prepare("INSERT INTO balances (worker_id, units, updated_at) VALUES (?1, 0, ?2) ON CONFLICT(worker_id) DO NOTHING")
      .bind(workerId, nowIso).run();
    return json(200, { ok: true, worker });
  }

  if (request.method === "GET" && path === "/account") {
    if (!licensingReady) return json(503, { error: "licensing_not_configured" });
    const auth = await authenticateWorker(request, env, records, nowMs);
    if (!auth) return json(401, { error: "valid_license_and_worker_required" });
    const restoredUnits = await restoreAndTouch(env.DB, auth.worker, nowMs);
    const balance = await env.DB.prepare("SELECT units FROM balances WHERE worker_id = ?1").bind(auth.workerId).first();
    const availableUnits = Number(balance?.units || 0);
    const minimum = normalizePositiveUnits(env.MIN_PAYOUT_UNITS) || 1_000_000;
    return json(200, {
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
      dormantAfterDays: Math.round(positiveNumber(env.DORMANT_AFTER_MS, DEFAULT_DORMANT_AFTER_MS) / 86_400_000),
      restoredFromDormantUnits: restoredUnits,
    });
  }

  if (request.method === "GET" && path === "/payouts") {
    if (!licensingReady) return json(503, { error: "licensing_not_configured" });
    const auth = await authenticateWorker(request, env, records, nowMs);
    if (!auth) return json(401, { error: "valid_license_and_worker_required" });
    await restoreAndTouch(env.DB, auth.worker, nowMs);
    const { results = [] } = await env.DB.prepare("SELECT * FROM payouts WHERE worker_id = ?1 ORDER BY created_at DESC")
      .bind(auth.workerId).all();
    return json(200, { payoutMode: "sandbox", payouts: results.map(payoutFromRow) });
  }

  if (request.method === "POST" && path === "/payouts") {
    if (!licensingReady) return json(503, { error: "licensing_not_configured" });
    const auth = await authenticateWorker(request, env, records, nowMs);
    if (!auth) return json(401, { error: "valid_license_and_worker_required" });
    await restoreAndTouch(env.DB, auth.worker, nowMs);
    const data = await readJson(request);
    const amountUnits = normalizePositiveUnits(data.amountUnits);
    const destination = normalizeDestination(data.destination);
    const idempotencyKey = normalizeIdempotencyKey(data.idempotencyKey);
    const minimum = normalizePositiveUnits(env.MIN_PAYOUT_UNITS) || 1_000_000;
    if (!amountUnits || amountUnits < minimum) return json(400, { error: "amount_below_sandbox_minimum", minimumPayoutUnits: minimum });
    if (!destination) return json(400, { error: "invalid_sandbox_destination" });
    if (!idempotencyKey) return json(400, { error: "invalid_idempotency_key" });
    const existing = await env.DB.prepare("SELECT * FROM payouts WHERE worker_id = ?1 AND idempotency_key = ?2")
      .bind(auth.workerId, idempotencyKey).first();
    if (existing) {
      const balance = await env.DB.prepare("SELECT units FROM balances WHERE worker_id = ?1").bind(auth.workerId).first();
      return json(200, { ok: true, created: false, payout: payoutFromRow(existing), availableUnits: Number(balance?.units || 0), payoutMode: "sandbox" });
    }
    const balance = await env.DB.prepare("SELECT units FROM balances WHERE worker_id = ?1").bind(auth.workerId).first();
    const availableUnits = Number(balance?.units || 0);
    if (availableUnits < amountUnits) return json(409, { error: "insufficient_sandbox_balance", availableUnits });
    const id = `pay_${crypto.randomUUID().replace(/-/g, "")}`;
    const nowIso = new Date(nowMs).toISOString();
    const newBalance = availableUnits - amountUnits;
    await env.DB.batch([
      env.DB.prepare("UPDATE balances SET units = ?2, updated_at = ?3 WHERE worker_id = ?1 AND units >= ?4")
        .bind(auth.workerId, newBalance, nowIso, amountUnits),
      env.DB.prepare("INSERT INTO payouts (id, worker_id, asset, amount_units, destination, status, sandbox, idempotency_key, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', 1, ?6, ?7, ?7)")
        .bind(id, auth.workerId, ASSET, amountUnits, destination, idempotencyKey, nowIso),
      env.DB.prepare("INSERT INTO ledger (worker_id, type, amount_units, balance_units, reason, reference, created_at) VALUES (?1, 'sandbox_payout_debit', ?2, ?3, 'sandbox payout request', ?4, ?5)")
        .bind(auth.workerId, -amountUnits, newBalance, id, nowIso),
    ]);
    const created = await env.DB.prepare("SELECT * FROM payouts WHERE id = ?1").bind(id).first();
    return json(201, { ok: true, created: true, payout: payoutFromRow(created), availableUnits: newBalance, payoutMode: "sandbox" });
  }

  if (path.startsWith("/admin/")) {
    if (!env.ADMIN_TOKEN) return json(503, { error: "ADMIN_TOKEN_not_configured" });
    if (!safeAuthorization(request, "Bearer", env.ADMIN_TOKEN)) return json(401, { error: "admin_unauthorized" });
    if (request.method === "POST" && path === "/admin/credits") {
      const data = await readJson(request);
      const workerId = normalizeWorkerId(data);
      const amountUnits = normalizePositiveUnits(data.amountUnits);
      const worker = workerId ? await getWorker(env.DB, workerId) : null;
      if (!workerId || !worker) return json(404, { error: "worker_not_found" });
      if (worker.dormantAt) return json(409, { error: "dormant_account_must_reactivate" });
      if (!amountUnits) return json(400, { error: "invalid_amountUnits" });
      const at = new Date(nowMs).toISOString();
      const current = await env.DB.prepare("SELECT units FROM balances WHERE worker_id = ?1").bind(workerId).first();
      const balance = Number(current?.units || 0) + amountUnits;
      await env.DB.batch([
        env.DB.prepare("INSERT INTO balances (worker_id, units, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(worker_id) DO UPDATE SET units = excluded.units, updated_at = excluded.updated_at")
          .bind(workerId, balance, at),
        env.DB.prepare("INSERT INTO ledger (worker_id, type, amount_units, balance_units, reason, created_at) VALUES (?1, 'sandbox_credit', ?2, ?3, ?4, ?5)")
          .bind(workerId, amountUnits, balance, String(data.reason || "sandbox test").slice(0, 120), at),
      ]);
      return json(201, { ok: true, workerId, asset: ASSET, creditedUnits: amountUnits, availableUnits: balance, payoutMode: "sandbox" });
    }
    if (request.method === "GET" && path === "/admin/payouts") {
      const { results = [] } = await env.DB.prepare("SELECT * FROM payouts ORDER BY created_at DESC").all();
      return json(200, { payoutMode: "sandbox", payouts: results.map(payoutFromRow) });
    }
    if (request.method === "GET" && path === "/admin/dormancy") {
      const row = await env.DB.prepare("SELECT COUNT(*) AS accounts, COALESCE(SUM(units), 0) AS reserve_units FROM dormant_balances").first();
      return json(200, {
        dormantAccounts: Number(row?.accounts || 0),
        reserveUnits: Number(row?.reserve_units || 0),
        asset: ASSET,
        reserveType: "client-liability",
        companyRevenue: false,
        dormantAfterDays: Math.round(positiveNumber(env.DORMANT_AFTER_MS, DEFAULT_DORMANT_AFTER_MS) / 86_400_000),
      });
    }
    if (request.method === "POST" && path === "/admin/dormancy/sweep") {
      return json(200, { ok: true, ...await sweepDormant(env, nowMs), asset: ASSET, reserveType: "client-liability", companyRevenue: false });
    }
    const payoutMatch = path.match(/^\/admin\/payouts\/(pay_[A-Za-z0-9]+)$/);
    if (request.method === "POST" && payoutMatch) {
      const data = await readJson(request);
      const status = String(data.status || "");
      if (!["approved", "rejected", "simulated_paid"].includes(status)) return json(400, { error: "invalid_sandbox_status" });
      const payout = await env.DB.prepare("SELECT * FROM payouts WHERE id = ?1").bind(payoutMatch[1]).first();
      if (!payout) return json(404, { error: "payout_not_found" });
      if (payout.status !== "pending") return json(409, { error: "invalid_payout_transition", payout: payoutFromRow(payout) });
      const nowIso = new Date(nowMs).toISOString();
      await env.DB.prepare("UPDATE payouts SET status = ?2, reference = ?3, updated_at = ?4 WHERE id = ?1")
        .bind(payout.id, status, String(data.reference || "").slice(0, 120), nowIso).run();
      return json(200, { ok: true, payout: payoutFromRow(await env.DB.prepare("SELECT * FROM payouts WHERE id = ?1").bind(payout.id).first()), payoutMode: "sandbox" });
    }
  }

  return json(404, { error: "not_found" });
}

export default {
  async fetch(request, env) {
    try {
      if (!env.DB) return json(503, { ok: false, service: SERVICE, error: "D1_not_configured" });
      return await handleRequest(request, env);
    } catch (error) {
      if (error?.status) return json(error.status, { error: String(error.message || "request_error") });
      console.error("Request failed", error);
      return json(500, { error: "internal_error" });
    }
  },
  async scheduled(_event, env, context) {
    context.waitUntil(sweepDormant(env));
  },
};

export { handleRequest, sweepDormant };
