import { readOnlyConversion } from "./conversion.js";

const SERVICE = "marsx-pool-worker-api";
const VERSION = "0.8.6";
const TERMS_VERSION = "2026-09-27-v3";
const ONLINE_WINDOW_MS = 120_000;
const MAX_BODY_BYTES = 16_384;
const ASSET = "USDT_TEST";
const ASSET_DECIMALS = 6;
const DEFAULT_DORMANT_AFTER_MS = 365 * 24 * 60 * 60 * 1000;
const QONVERSION_API_BASE = "https://api.qonversion.io/v4";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const AUTH_NONCE_TTL_MS = 5 * 60 * 1000;
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PLATFORM_FEE_BPS = 200;
const REFERRAL_SHARE_OF_FEE_BPS = 300;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Install-Id, X-Worker-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

async function readJson(request) {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) throw httpError(415, "content_type_must_be_application/json");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) throw httpError(413, "payload_too_large");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw httpError(400, "invalid_JSON");
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hmacBytes(secret, value) {
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
  return [...await hmacBytes(secret, value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64Url(value);
}

function validReferralCode(value) {
  return /^[A-Z0-9]{8,16}$/.test(String(value || "").trim().toUpperCase());
}

function calculateFee(amountUnits, hasReferrer) {
  const platformFeeUnits = Math.floor(amountUnits * PLATFORM_FEE_BPS / 10_000);
  const referralRewardUnits = hasReferrer
    ? Math.floor(platformFeeUnits * REFERRAL_SHARE_OF_FEE_BPS / 10_000)
    : 0;
  return {
    grossUnits: amountUnits,
    payoutUnits: amountUnits - platformFeeUnits,
    platformFeeUnits,
    referralRewardUnits,
    marsxNetFeeUnits: platformFeeUnits - referralRewardUnits,
  };
}

function parseJwtPart(value) {
  try { return JSON.parse(decoder.decode(base64UrlToBytes(value))); }
  catch { return null; }
}

async function verifyGoogleIdToken(fetchImpl, token, expectedAudience, expectedNonce, timestamp) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !expectedAudience || !expectedNonce) return null;
  const header = parseJwtPart(parts[0]);
  const claims = parseJwtPart(parts[1]);
  if (!header || !claims || header.alg !== "RS256" || !/^[A-Za-z0-9_-]{1,128}$/.test(String(header.kid || ""))) {
    return null;
  }
  let jwks;
  try {
    const response = await fetchImpl(GOOGLE_JWKS_URL, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    jwks = await response.json();
  } catch { return null; }
  const jwk = Array.isArray(jwks?.keys)
    ? jwks.keys.find((key) => key.kid === header.kid && key.kty === "RSA" && key.alg === "RS256")
    : null;
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;
  } catch { return null; }
  const nowSeconds = Math.floor(timestamp / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) return null;
  if (!audiences.includes(expectedAudience)) return null;
  if (audiences.length > 1 && claims.azp !== expectedAudience) return null;
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) return null;
  if (!Number.isFinite(claims.iat) || claims.iat > nowSeconds + 60) return null;
  if (claims.nonce !== expectedNonce || !/^[A-Za-z0-9_-]{6,255}$/.test(String(claims.sub || ""))) return null;
  if (claims.email_verified !== true && claims.email_verified !== "true") return null;
  return claims;
}

async function safeAuthorization(actual, scheme, token) {
  if (!token) return false;
  return constantTimeEqual(encoder.encode(String(actual || "")), encoder.encode(`${scheme} ${token}`));
}

function normalizeWorkerId(data) {
  const value = data.workerId ?? data.node_id;
  return typeof value === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(value) ? value : null;
}

function normalizeWorker(data, oldWorker, now, licenseId, installId) {
  const workerId = normalizeWorkerId(data);
  if (!workerId) return null;
  const cpuCandidate = data.cpuPercent ?? data.cpu_percent;
  const cpuPercent = Number.isFinite(cpuCandidate)
    ? Math.min(100, Math.max(0, Number(cpuCandidate)))
    : oldWorker?.cpuPercent ?? null;
  const at = new Date(now).toISOString();
  return {
    workerId,
    licenseId: licenseId || oldWorker?.licenseId || "legacy-admin",
    installId: installId || oldWorker?.installId || null,
    label: String(data.label || oldWorker?.label || "worker").slice(0, 80),
    platform: String(data.platform || oldWorker?.platform || "unknown").slice(0, 40),
    cpuPercent,
    registeredAt: oldWorker?.registeredAt || at,
    lastSeen: at,
    lastActivityAt: at,
    lastActivityMs: now,
    dormantAt: null,
    reactivatedAt: oldWorker?.reactivatedAt || null,
    sessionId: oldWorker?.sessionId || crypto.randomUUID(),
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

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function parseLicenseRecords(input) {
  if (!input) return [];
  let records = input;
  if (typeof input === "string") {
    try { records = JSON.parse(input); } catch { throw new Error("LICENSE_RECORDS_JSON_must_be_valid_JSON"); }
  }
  if (!Array.isArray(records)) throw new Error("LICENSE_RECORDS_JSON_must_be_an_array");
  return records.map((record) => ({
    id: String(record.id || ""),
    keyHash: String(record.keyHash || "").toLowerCase(),
    status: String(record.status || "active"),
    expiresAt: record.expiresAt ? String(record.expiresAt) : null,
    maxDevices: Math.min(Math.max(Number(record.maxDevices || 1), 1), 25),
  })).filter((record) => record.id && /^[a-f0-9]{64}$/.test(record.keyHash));
}

function parseEntitlementIds(input) {
  const source = Array.isArray(input) ? input : String(input || "pro,farm").split(",");
  return [...new Set(source.map((value) => String(value).trim())
    .filter((value) => /^[A-Za-z0-9._-]{1,80}$/.test(value)))];
}

async function findLicense(records, pepper, rawKey) {
  const digest = await hmacHex(pepper, normalizeLicenseKey(rawKey));
  const digestBytes = encoder.encode(digest);
  return records.find((record) => constantTimeEqual(encoder.encode(record.keyHash), digestBytes));
}

async function issueSession(payload, secret) {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = bytesToBase64Url(await hmacBytes(secret, encoded));
  return `${encoded}.${signature}`;
}

async function issueLicenseSession(record, installId, secret, timestamp, ttlSeconds) {
  const issuedAt = Math.floor(timestamp / 1000);
  return issueSession({
    v: 1, lic: record.id, ins: installId, iat: issuedAt,
    exp: issuedAt + ttlSeconds, terms: TERMS_VERSION,
  }, secret);
}

async function issueQonversionSession(entitlement, installId, secret, timestamp, ttlSeconds) {
  const issuedAt = Math.floor(timestamp / 1000);
  return issueSession({
    v: 1,
    src: "qonversion",
    lic: `qonversion:${entitlement.id}`,
    ent: entitlement.id,
    product: String(entitlement.product?.product_id || "").slice(0, 120),
    ins: installId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    terms: TERMS_VERSION,
  }, secret);
}

async function verifyLicenseSession(token, installId, records, secret, timestamp) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return null;
  let actual;
  try { actual = base64UrlToBytes(parts[1]); } catch { return null; }
  if (!constantTimeEqual(actual, await hmacBytes(secret, parts[0]))) return null;
  let payload;
  try { payload = JSON.parse(decoder.decode(base64UrlToBytes(parts[0]))); } catch { return null; }
  if (!payload.exp || payload.exp < Math.floor(timestamp / 1000)) return null;
  if (installId && payload.ins !== installId) return null;
  if (payload.src === "qonversion") {
    return payload.ent && payload.lic === `qonversion:${payload.ent}` ? payload : null;
  }
  const record = records.find((candidate) => candidate.id === payload.lic);
  if (!record || record.status !== "active") return null;
  if (record.expiresAt && Date.parse(record.expiresAt) <= timestamp) return null;
  return payload;
}

function authorizationToken(request, scheme) {
  const value = String(request.headers.get("authorization") || "");
  const prefix = `${scheme} `;
  return value.startsWith(prefix) ? value.slice(prefix.length) : "";
}

function validInstallId(value) {
  return /^[A-Za-z0-9_-]{12,80}$/.test(String(value || ""));
}

function requestAddress(request) {
  return String(request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}

async function auditLicense(event, request, pepper, data = {}) {
  const ipHash = pepper ? (await hmacHex(pepper, requestAddress(request))).slice(0, 16) : "unconfigured";
  console.log(JSON.stringify({
    type: "license_audit", event, at: new Date().toISOString(),
    eventId: crypto.randomUUID(), ipHash, ...data,
  }));
}

async function qonversionJson(fetchImpl, url, secretKey) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(7_000),
  });
  const raw = await response.text();
  if (encoder.encode(raw).byteLength > 262_144) throw new Error("qonversion_response_too_large");
  let body;
  try { body = JSON.parse(raw || "{}"); } catch { throw new Error("qonversion_invalid_response"); }
  return { response, body };
}

async function findQonversionEntitlement(fetchImpl, secretKey, identityId, entitlementIds) {
  const identityResult = await qonversionJson(
    fetchImpl,
    `${QONVERSION_API_BASE}/identities/${encodeURIComponent(identityId)}`,
    secretKey,
  );
  if (identityResult.response.status === 404) return { error: "qonversion_identity_not_found" };
  if (!identityResult.response.ok) throw new Error("qonversion_identity_lookup_failed");
  const userId = String(identityResult.body.user_id || "");
  if (!/^QON_[A-Za-z0-9_-]{8,256}$/.test(userId)) throw new Error("qonversion_invalid_user");
  const entitlementResult = await qonversionJson(
    fetchImpl,
    `${QONVERSION_API_BASE}/users/${encodeURIComponent(userId)}/entitlements`,
    secretKey,
  );
  if (!entitlementResult.response.ok) throw new Error("qonversion_entitlement_lookup_failed");
  const entitlements = Array.isArray(entitlementResult.body.data) ? entitlementResult.body.data : [];
  const entitlement = entitlements.find((item) =>
    item?.is_active === true && entitlementIds.includes(String(item.id || "")));
  return entitlement ? { entitlement } : { error: "qonversion_entitlement_inactive" };
}

function workerStatement(db, worker) {
  return db.prepare(`
    INSERT INTO workers(worker_id, data, last_seen, last_activity_ms, dormant_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET
      data=excluded.data,
      last_seen=excluded.last_seen,
      last_activity_ms=excluded.last_activity_ms,
      dormant_at=excluded.dormant_at
  `).bind(
    worker.workerId,
    JSON.stringify(worker),
    worker.lastSeen,
    Number(worker.lastActivityMs || 0),
    worker.dormantAt || null,
  );
}

export class D1Store {
  constructor(db) {
    if (!db) throw new Error("D1_binding_DB_is_required");
    this.db = db;
    this.kind = "d1";
  }

  async ping() {
    return Boolean(await this.db.prepare("SELECT 1 AS ok").first("ok"));
  }

  async get(workerId) {
    const row = await this.db.prepare("SELECT data FROM workers WHERE worker_id=?").bind(workerId).first();
    return row?.data ? JSON.parse(row.data) : null;
  }

  async set(worker) {
    await workerStatement(this.db, worker).run();
  }

  async all() {
    const result = await this.db.prepare("SELECT data FROM workers ORDER BY last_seen DESC").all();
    return (result.results || []).map((row) => JSON.parse(row.data));
  }

  async bindLicenseDevice(licenseId, installId, maxDevices) {
    await this.db.prepare(`
      INSERT OR IGNORE INTO license_devices(license_id, install_id, bound_at)
      SELECT ?, ?, ?
      WHERE EXISTS(
        SELECT 1 FROM license_devices WHERE license_id=? AND install_id=?
      ) OR (
        SELECT COUNT(*) FROM license_devices WHERE license_id=?
      ) < ?
    `).bind(
      licenseId, installId, new Date().toISOString(),
      licenseId, installId, licenseId, maxDevices,
    ).run();
    return Boolean(await this.db.prepare(
      "SELECT 1 AS ok FROM license_devices WHERE license_id=? AND install_id=?",
    ).bind(licenseId, installId).first("ok"));
  }

  async createAuthNonce(nonceHash, installId, expiresAtMs, createdAt) {
    await this.db.prepare(`
      INSERT INTO auth_nonces(nonce_hash,install_id,expires_at_ms,created_at)
      VALUES (?, ?, ?, ?)
    `).bind(nonceHash, installId, expiresAtMs, createdAt).run();
  }

  async consumeAuthNonce(nonceHash, installId, atMs) {
    const result = await this.db.prepare(`
      UPDATE auth_nonces SET used_at_ms=?
      WHERE nonce_hash=? AND install_id=? AND used_at_ms IS NULL AND expires_at_ms>=?
    `).bind(atMs, nonceHash, installId, atMs).run();
    return Number(result?.meta?.changes || 0) === 1;
  }

  async upsertGoogleUser(subjectHash, email, displayName, at) {
    let row = await this.db.prepare(`
      SELECT user_id,deleted_at FROM users WHERE google_subject_hash=?
    `).bind(subjectHash).first();
    if (row?.deleted_at) return null;
    if (!row) {
      const userId = `usr_${crypto.randomUUID().replaceAll("-", "")}`;
      await this.db.prepare(`
        INSERT INTO users(user_id,google_subject_hash,email,display_name,created_at,updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, subjectHash, email, displayName, at, at).run();
      row = { user_id: userId, deleted_at: null };
    } else {
      await this.db.prepare(`
        UPDATE users SET email=?,display_name=?,updated_at=? WHERE user_id=?
      `).bind(email, displayName, at, row.user_id).run();
    }
    await this.ensureReferralCode(row.user_id, at);
    return this.getUser(row.user_id);
  }

  async getUser(userId) {
    return this.db.prepare(`
      SELECT user_id,email,display_name,created_at,referral_locked_at,deleted_at FROM users WHERE user_id=?
    `).bind(userId).first();
  }

  async ensureReferralCode(userId, at) {
    const existing = await this.db.prepare("SELECT code FROM referral_codes WHERE user_id=?")
      .bind(userId).first("code");
    if (existing) return String(existing);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomToken(8).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase();
      if (code.length < 8) continue;
      const result = await this.db.prepare(`
        INSERT OR IGNORE INTO referral_codes(user_id,code,created_at) VALUES (?, ?, ?)
      `).bind(userId, code, at).run();
      if (Number(result?.meta?.changes || 0) === 1) return code;
    }
    throw new Error("referral_code_generation_failed");
  }

  async setReferralOnce(inviteeUserId, rawCode, at) {
    const code = String(rawCode || "").trim().toUpperCase();
    const user = await this.db.prepare("SELECT referral_locked_at FROM users WHERE user_id=?")
      .bind(inviteeUserId).first();
    const existing = await this.db.prepare(`
      SELECT r.referrer_user_id, c.code FROM referrals r
      JOIN referral_codes c ON c.user_id=r.referrer_user_id
      WHERE r.invitee_user_id=?
    `).bind(inviteeUserId).first();
    if (existing) return { result: "existing", referrerUserId: existing.referrer_user_id, code: existing.code };
    if (user?.referral_locked_at) return { result: "locked_none" };
    if (!code) {
      await this.db.prepare("UPDATE users SET referral_locked_at=?,updated_at=? WHERE user_id=?")
        .bind(at, at, inviteeUserId).run();
      return { result: "none" };
    }
    if (!validReferralCode(code)) return { result: "invalid" };
    const referrer = await this.db.prepare(`
      SELECT c.user_id FROM referral_codes c JOIN users u ON u.user_id=c.user_id
      WHERE c.code=? AND u.deleted_at IS NULL
    `).bind(code).first("user_id");
    if (!referrer) return { result: "invalid" };
    if (referrer === inviteeUserId) return { result: "self" };
    await this.db.prepare(`
      INSERT OR IGNORE INTO referrals(invitee_user_id,referrer_user_id,code,created_at)
      VALUES (?, ?, ?, ?)
    `).bind(inviteeUserId, referrer, code, at).run();
    await this.db.prepare("UPDATE users SET referral_locked_at=?,updated_at=? WHERE user_id=?")
      .bind(at, at, inviteeUserId).run();
    return { result: "created", referrerUserId: referrer, code };
  }

  async issueAuthSession(userId, installId, tokenHash, expiresAtMs, at) {
    await this.db.prepare(`
      INSERT INTO user_sessions(session_hash,user_id,install_id,expires_at_ms,created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(tokenHash, userId, installId, expiresAtMs, at).run();
  }

  async authUser(tokenHash, installId, atMs) {
    return this.db.prepare(`
      SELECT u.user_id,u.email,u.display_name,u.created_at
      FROM user_sessions s JOIN users u ON u.user_id=s.user_id
      WHERE s.session_hash=? AND s.install_id=? AND s.revoked_at IS NULL
        AND s.expires_at_ms>=? AND u.deleted_at IS NULL
    `).bind(tokenHash, installId, atMs).first();
  }

  async linkUserWorker(userId, workerId, at) {
    await this.db.prepare(`
      INSERT INTO user_workers(user_id,worker_id,linked_at) VALUES (?, ?, ?)
      ON CONFLICT(worker_id) DO UPDATE SET user_id=excluded.user_id,linked_at=excluded.linked_at
    `).bind(userId, workerId, at).run();
  }

  async referralProfile(userId) {
    const row = await this.db.prepare(`
      SELECT c.code,
        (SELECT code FROM referrals WHERE invitee_user_id=?) AS used_code,
        COALESCE((SELECT amount_units FROM referral_balances WHERE user_id=?),0) AS reward_units,
        (SELECT COUNT(*) FROM referrals WHERE referrer_user_id=?) AS invited_count
      FROM referral_codes c WHERE c.user_id=?
    `).bind(userId, userId, userId, userId).first();
    return row ? {
      code: row.code,
      usedCode: row.used_code || null,
      rewardUnits: Number(row.reward_units || 0),
      invitedCount: Number(row.invited_count || 0),
    } : null;
  }

  async referrerForWorker(workerId) {
    const row = await this.db.prepare(`
      SELECT r.invitee_user_id,r.referrer_user_id
      FROM user_workers w LEFT JOIN referrals r ON r.invitee_user_id=w.user_id
      WHERE w.worker_id=?
    `).bind(workerId).first();
    return row || null;
  }

  async recordFee(eventId, workerId, fee, payoutId, at) {
    const relation = await this.referrerForWorker(workerId);
    if (!relation?.invitee_user_id) return;
    const reward = relation.referrer_user_id ? fee.referralRewardUnits : 0;
    const inserted = await this.db.prepare(`
      INSERT OR IGNORE INTO fee_events(
        event_id,user_id,worker_id,payout_id,gross_units,platform_fee_units,
        referral_reward_units,marsx_net_fee_units,referrer_user_id,created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId, relation.invitee_user_id, workerId, payoutId, fee.grossUnits,
      fee.platformFeeUnits, reward, fee.platformFeeUnits - reward,
      relation.referrer_user_id || null, at,
    ).run();
    if (Number(inserted?.meta?.changes || 0) !== 1) return;
    if (relation.referrer_user_id && reward > 0) await this.db.prepare(`
      INSERT INTO referral_balances(user_id,amount_units,updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET amount_units=amount_units+excluded.amount_units,updated_at=excluded.updated_at
    `).bind(relation.referrer_user_id, reward, at).run();
  }

  async deleteUser(userId, at) {
    const linkedWorkers = await this.db.prepare("SELECT worker_id FROM user_workers WHERE user_id=?")
      .bind(userId).all();
    const statements = [
      this.db.prepare("DELETE FROM fee_events WHERE user_id=? OR referrer_user_id=?").bind(userId, userId),
      this.db.prepare("DELETE FROM referral_balances WHERE user_id=?").bind(userId),
      this.db.prepare("DELETE FROM referrals WHERE invitee_user_id=? OR referrer_user_id=?").bind(userId, userId),
      this.db.prepare("DELETE FROM referral_codes WHERE user_id=?").bind(userId),
      this.db.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(userId),
      this.db.prepare("DELETE FROM user_workers WHERE user_id=?").bind(userId),
    ];
    for (const worker of linkedWorkers.results || []) {
      statements.push(this.db.prepare("DELETE FROM workers WHERE worker_id=?").bind(worker.worker_id));
    }
    statements.push(this.db.prepare("DELETE FROM users WHERE user_id=?").bind(userId));
    await this.db.batch(statements);
  }

  async getBalance(workerId) {
    return Number(await this.db.prepare("SELECT amount_units FROM balances WHERE worker_id=?")
      .bind(workerId).first("amount_units") || 0);
  }

  async getDormantBalance(workerId) {
    return Number(await this.db.prepare("SELECT amount_units FROM dormant_balances WHERE worker_id=?")
      .bind(workerId).first("amount_units") || 0);
  }

  async touchActivity(workerId, atMs) {
    const worker = await this.get(workerId);
    if (!worker) return { worker: null, restoredUnits: 0 };
    const at = new Date(atMs).toISOString();
    const restoredUnits = await this.getDormantBalance(workerId);
    if (worker.dormantAt) worker.reactivatedAt = at;
    worker.dormantAt = null;
    worker.lastActivityAt = at;
    worker.lastActivityMs = atMs;
    const statements = [workerStatement(this.db, worker)];
    if (restoredUnits > 0) {
      const entry = { type: "dormant_reactivated", amountUnits: restoredUnits, at };
      statements.push(
        this.db.prepare(`
          INSERT INTO balances(worker_id, amount_units) VALUES (?, ?)
          ON CONFLICT(worker_id) DO UPDATE SET amount_units=amount_units+excluded.amount_units
        `).bind(workerId, restoredUnits),
        this.db.prepare("DELETE FROM dormant_balances WHERE worker_id=?").bind(workerId),
        this.db.prepare(`
          INSERT INTO ledger(worker_id,event_type,payout_id,amount_units,created_at,data)
          VALUES (?, 'dormant_reactivated', NULL, ?, ?, ?)
        `).bind(workerId, restoredUnits, at, JSON.stringify(entry)),
      );
    }
    await this.db.batch(statements);
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
    worker.dormantAt = at;
    const statements = [workerStatement(this.db, worker)];
    if (movedUnits > 0) {
      const entry = { type: "dormant_safeguard", amountUnits: -movedUnits, at };
      statements.push(
        this.db.prepare("UPDATE balances SET amount_units=0 WHERE worker_id=?").bind(workerId),
        this.db.prepare(`
          INSERT INTO dormant_balances(worker_id, amount_units) VALUES (?, ?)
          ON CONFLICT(worker_id) DO UPDATE SET amount_units=amount_units+excluded.amount_units
        `).bind(workerId, movedUnits),
        this.db.prepare(`
          INSERT INTO ledger(worker_id,event_type,payout_id,amount_units,created_at,data)
          VALUES (?, 'dormant_safeguard', NULL, ?, ?, ?)
        `).bind(workerId, -movedUnits, at, JSON.stringify(entry)),
      );
    }
    await this.db.batch(statements);
    return { changed: true, movedUnits };
  }

  async sweepDormant(cutoffMs, atMs) {
    const candidates = await this.db.prepare(`
      SELECT worker_id FROM workers
      WHERE dormant_at IS NULL AND last_activity_ms <= ?
      ORDER BY last_activity_ms ASC LIMIT 1000
    `).bind(cutoffMs).all();
    let accountsMarked = 0;
    let movedUnits = 0;
    for (const row of candidates.results || []) {
      const result = await this.markDormant(row.worker_id, cutoffMs, atMs);
      if (result.changed) accountsMarked += 1;
      movedUnits += result.movedUnits;
    }
    return { accountsMarked, movedUnits };
  }

  async dormantSummary() {
    const row = await this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM workers WHERE dormant_at IS NOT NULL) AS dormant_accounts,
        (SELECT COALESCE(SUM(amount_units),0) FROM dormant_balances) AS reserved_units
    `).first();
    return {
      dormantAccounts: Number(row?.dormant_accounts || 0),
      reservedUnits: Number(row?.reserved_units || 0),
    };
  }

  async credit(workerId, amountUnits, entry) {
    await this.db.batch([
      this.db.prepare(`
        INSERT INTO balances(worker_id, amount_units) VALUES (?, ?)
        ON CONFLICT(worker_id) DO UPDATE SET amount_units=amount_units+excluded.amount_units
      `).bind(workerId, amountUnits),
      this.db.prepare(`
        INSERT INTO ledger(worker_id,event_type,payout_id,amount_units,created_at,data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        workerId,
        String(entry.type || "sandbox_credit"),
        entry.payoutId || null,
        amountUnits,
        entry.at,
        JSON.stringify(entry),
      ),
    ]);
    return this.getBalance(workerId);
  }

  async createPayout(workerId, payout, idempotencyKey) {
    const existing = await this.db.prepare(`
      SELECT p.data FROM payout_idempotency i
      JOIN payouts p ON p.id=i.payout_id
      WHERE i.worker_id=? AND i.idempotency_key=?
    `).bind(workerId, idempotencyKey).first();
    if (existing?.data) {
      return { result: "existing", payout: JSON.parse(existing.data), balance: await this.getBalance(workerId) };
    }
    const entry = {
      type: "payout_reserved", payoutId: payout.id,
      amountUnits: -payout.amountUnits, at: payout.createdAt,
    };
    await this.db.batch([
      this.db.prepare(`
        INSERT INTO payouts(id,worker_id,status,created_at,updated_at,refunded,data)
        SELECT ?, ?, ?, ?, ?, 0, ?
        WHERE EXISTS(
          SELECT 1 FROM balances WHERE worker_id=? AND amount_units>=?
        ) AND NOT EXISTS(
          SELECT 1 FROM payout_idempotency WHERE worker_id=? AND idempotency_key=?
        )
      `).bind(
        payout.id, workerId, payout.status, payout.createdAt, payout.updatedAt, JSON.stringify(payout),
        workerId, payout.amountUnits, workerId, idempotencyKey,
      ),
      this.db.prepare(`
        INSERT OR IGNORE INTO payout_idempotency(worker_id,idempotency_key,payout_id)
        SELECT ?, ?, ? WHERE EXISTS(SELECT 1 FROM payouts WHERE id=?)
      `).bind(workerId, idempotencyKey, payout.id, payout.id),
      this.db.prepare(`
        UPDATE balances SET amount_units=amount_units-?
        WHERE worker_id=? AND EXISTS(SELECT 1 FROM payouts WHERE id=?)
      `).bind(payout.amountUnits, workerId, payout.id),
      this.db.prepare(`
        INSERT INTO ledger(worker_id,event_type,payout_id,amount_units,created_at,data)
        SELECT ?, 'payout_reserved', ?, ?, ?, ?
        WHERE EXISTS(SELECT 1 FROM payouts WHERE id=?)
      `).bind(workerId, payout.id, -payout.amountUnits, payout.createdAt, JSON.stringify(entry), payout.id),
    ]);
    const created = await this.db.prepare("SELECT data FROM payouts WHERE id=?").bind(payout.id).first();
    if (!created?.data) {
      const retried = await this.db.prepare(`
        SELECT p.data FROM payout_idempotency i JOIN payouts p ON p.id=i.payout_id
        WHERE i.worker_id=? AND i.idempotency_key=?
      `).bind(workerId, idempotencyKey).first();
      if (retried?.data) {
        return { result: "existing", payout: JSON.parse(retried.data), balance: await this.getBalance(workerId) };
      }
      return { result: "insufficient", balance: await this.getBalance(workerId) };
    }
    return { result: "created", payout, balance: await this.getBalance(workerId) };
  }

  async payoutsFor(workerId) {
    const result = await this.db.prepare(
      "SELECT data FROM payouts WHERE worker_id=? ORDER BY created_at DESC",
    ).bind(workerId).all();
    return (result.results || []).map((row) => JSON.parse(row.data));
  }

  async allPayouts() {
    const result = await this.db.prepare("SELECT data FROM payouts ORDER BY created_at DESC").all();
    return (result.results || []).map((row) => JSON.parse(row.data));
  }

  async updatePayout(payoutId, status, updatedAt, reference = "") {
    const row = await this.db.prepare("SELECT data FROM payouts WHERE id=?").bind(payoutId).first();
    if (!row?.data) return { result: "missing" };
    const payout = JSON.parse(row.data);
    const allowed = payout.status === "pending"
      ? ["approved", "rejected", "simulated_paid"]
      : payout.status === "approved" ? ["rejected", "simulated_paid"] : [];
    if (payout.status === status) return { result: "existing", payout };
    if (!allowed.includes(status)) return { result: "invalid", payout };
    payout.status = status;
    payout.updatedAt = updatedAt;
    if (reference) payout.reference = reference;
    const statements = [];
    if (status === "rejected" && !payout.refunded) {
      payout.refunded = true;
      const worker = await this.get(payout.workerId);
      const table = worker?.dormantAt ? "dormant_balances" : "balances";
      statements.push(
        this.db.prepare(`
          INSERT INTO ${table}(worker_id, amount_units) VALUES (?, ?)
          ON CONFLICT(worker_id) DO UPDATE SET amount_units=amount_units+excluded.amount_units
        `).bind(payout.workerId, payout.amountUnits),
        this.db.prepare(`
          INSERT INTO ledger(worker_id,event_type,payout_id,amount_units,created_at,data)
          VALUES (?, 'payout_refund', ?, ?, ?, ?)
        `).bind(
          payout.workerId, payoutId, payout.amountUnits, updatedAt,
          JSON.stringify({ type: "payout_refund", payoutId, amountUnits: payout.amountUnits, at: updatedAt }),
        ),
      );
    }
    statements.unshift(this.db.prepare(`
      UPDATE payouts SET status=?,updated_at=?,refunded=?,data=? WHERE id=?
    `).bind(status, updatedAt, payout.refunded ? 1 : 0, JSON.stringify(payout), payoutId));
    await this.db.batch(statements);
    return { result: "updated", payout };
  }

  async close() {}
}

const privacyPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MARS-X Pool Privacy Policy</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#172033}h1,h2{color:#144991}a{color:#144991}</style></head>
<body><h1>MARS-X Pool Privacy Policy</h1><p>Last updated: 30 September 2026.</p>
<p>MARS-X Pool Beta is an authorised remote node/pool management and sandbox-payout test. It does not mine cryptocurrency on the Android device, run hidden background compute, promise earnings, or transfer real money in sandbox mode.</p>
<h2>Data processed</h2><p>After an explicit action, the service receives a random installation/worker ID, Google account subject identifier, verified email and display name, licence or subscription status, optional one-level referral relationship, app/platform version, request time, sandbox balance activity and security logs. The Google subject is stored only as a keyed hash. Qonversion and Google Play process subscription data; Supabase processes API requests and stores service records in PostgreSQL. Payment-card data is not received by MARS-X.</p>
<h2>Purpose, retention and rights</h2><p>Data is used to authenticate accounts, protect licences, operate the beta, calculate the disclosed referral share, prevent abuse and troubleshoot faults. The app provides an account-deletion action that deletes the MARS-X account, linked worker records, profile, active sessions, referral records and sandbox activity associated with that account. Users who no longer have the app can start the same request from the <a href="./delete-account">account deletion page</a>. Data is not sold to advertisers. Users in France may complain to the CNIL.</p>
<p>Controller: AbdilMelih Demirbaş / MARS-X Pool. Privacy and support contact: <a href="mailto:abdilmelih08@gmail.com">abdilmelih08@gmail.com</a>.</p>
</body></html>`;

const accountDeletionPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Delete your MARS-X Pool account</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#172033}h1,h2{color:#144991}a{color:#144991}</style></head>
<body><h1>Delete your MARS-X Pool account</h1>
<p>MARS-X Pool Beta users can delete their account immediately in the Android app: open <strong>Account</strong>, choose <strong>Delete account</strong>, and confirm. This deletes the MARS-X account, linked worker records, profile, active sessions, referral records and sandbox activity associated with that account.</p>
<p>If the app is no longer installed, email <a href="mailto:abdilmelih08@gmail.com?subject=MARS-X%20Pool%20account%20deletion%20request">abdilmelih08@gmail.com</a> from the Google email address used with MARS-X Pool and write “MARS-X Pool account deletion request”. We will verify ownership before deletion and confirm completion by email.</p>
<p>This request concerns MARS-X Pool data only. It does not delete the user's Google account or Google Play account.</p>
<p><a href="./privacy">Read the privacy policy</a>.</p>
</body></html>`;

export function createApp({ store: injectedStore, now = () => Date.now(), fetchImpl = fetch } = {}) {
  const generalLimits = new Map();
  const activationLimits = new Map();
  const memoryAuth = {
    nonces: new Map(), users: new Map(), usersBySubject: new Map(), sessions: new Map(),
    codesByUser: new Map(), usersByCode: new Map(), referrals: new Map(), workerUsers: new Map(),
    rewards: new Map(), feeEvents: new Set(),
  };

  async function authCreateNonce(store, hash, installId, expiresAtMs, createdAt) {
    if (typeof store.createAuthNonce === "function") return store.createAuthNonce(hash, installId, expiresAtMs, createdAt);
    memoryAuth.nonces.set(hash, { installId, expiresAtMs, used: false });
  }

  async function authConsumeNonce(store, hash, installId, atMs) {
    if (typeof store.consumeAuthNonce === "function") return store.consumeAuthNonce(hash, installId, atMs);
    const record = memoryAuth.nonces.get(hash);
    if (!record || record.used || record.installId !== installId || record.expiresAtMs < atMs) return false;
    record.used = true;
    return true;
  }

  async function authEnsureCode(store, userId, at) {
    if (typeof store.ensureReferralCode === "function") return store.ensureReferralCode(userId, at);
    if (memoryAuth.codesByUser.has(userId)) return memoryAuth.codesByUser.get(userId);
    let code;
    do { code = randomToken(8).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase(); }
    while (code.length < 8 || memoryAuth.usersByCode.has(code));
    memoryAuth.codesByUser.set(userId, code);
    memoryAuth.usersByCode.set(code, userId);
    return code;
  }

  async function authUpsertUser(store, subjectHash, email, displayName, at) {
    if (typeof store.upsertGoogleUser === "function") return store.upsertGoogleUser(subjectHash, email, displayName, at);
    let userId = memoryAuth.usersBySubject.get(subjectHash);
    let user = userId ? memoryAuth.users.get(userId) : null;
    if (!user) {
      userId = `usr_${crypto.randomUUID().replaceAll("-", "")}`;
      user = { user_id: userId, email, display_name: displayName, created_at: at, referral_locked_at: null };
      memoryAuth.users.set(userId, user);
      memoryAuth.usersBySubject.set(subjectHash, userId);
    } else {
      user.email = email;
      user.display_name = displayName;
    }
    await authEnsureCode(store, userId, at);
    return user;
  }

  async function authSetReferral(store, userId, rawCode, at) {
    if (typeof store.setReferralOnce === "function") return store.setReferralOnce(userId, rawCode, at);
    const user = memoryAuth.users.get(userId);
    const existing = memoryAuth.referrals.get(userId);
    if (existing) return { result: "existing", referrerUserId: existing.userId, code: existing.code };
    if (user?.referral_locked_at) return { result: "locked_none" };
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) {
      user.referral_locked_at = at;
      return { result: "none" };
    }
    if (!validReferralCode(code)) return { result: "invalid" };
    const referrerUserId = memoryAuth.usersByCode.get(code);
    if (!referrerUserId) return { result: "invalid" };
    if (referrerUserId === userId) return { result: "self" };
    memoryAuth.referrals.set(userId, { userId: referrerUserId, code });
    user.referral_locked_at = at;
    return { result: "created", referrerUserId, code };
  }

  async function authIssueSession(store, userId, installId, tokenHash, expiresAtMs, at) {
    if (typeof store.issueAuthSession === "function") return store.issueAuthSession(userId, installId, tokenHash, expiresAtMs, at);
    memoryAuth.sessions.set(tokenHash, { userId, installId, expiresAtMs });
  }

  async function authGetUser(store, tokenHash, installId, atMs) {
    if (typeof store.authUser === "function") return store.authUser(tokenHash, installId, atMs);
    const session = memoryAuth.sessions.get(tokenHash);
    if (!session || session.installId !== installId || session.expiresAtMs < atMs) return null;
    return memoryAuth.users.get(session.userId) || null;
  }

  async function authLinkWorker(store, userId, workerId, at) {
    if (typeof store.linkUserWorker === "function") return store.linkUserWorker(userId, workerId, at);
    memoryAuth.workerUsers.set(workerId, userId);
  }

  async function authReferralProfile(store, userId) {
    if (typeof store.referralProfile === "function") return store.referralProfile(userId);
    const used = memoryAuth.referrals.get(userId);
    let invitedCount = 0;
    for (const referral of memoryAuth.referrals.values()) if (referral.userId === userId) invitedCount += 1;
    return {
      code: memoryAuth.codesByUser.get(userId), usedCode: used?.code || null,
      rewardUnits: memoryAuth.rewards.get(userId) || 0, invitedCount,
    };
  }

  async function authRecordFee(store, eventId, workerId, fee, payoutId, at) {
    if (typeof store.recordFee === "function") return store.recordFee(eventId, workerId, fee, payoutId, at);
    if (memoryAuth.feeEvents.has(eventId)) return;
    memoryAuth.feeEvents.add(eventId);
    const userId = memoryAuth.workerUsers.get(workerId);
    const referral = userId ? memoryAuth.referrals.get(userId) : null;
    if (referral && fee.referralRewardUnits > 0) {
      memoryAuth.rewards.set(referral.userId, (memoryAuth.rewards.get(referral.userId) || 0) + fee.referralRewardUnits);
    }
  }

  async function authReferralForWorker(store, workerId) {
    if (typeof store.referrerForWorker === "function") return store.referrerForWorker(workerId);
    const userId = memoryAuth.workerUsers.get(workerId);
    const referral = userId ? memoryAuth.referrals.get(userId) : null;
    return userId ? {
      invitee_user_id: userId,
      referrer_user_id: referral?.userId || null,
    } : null;
  }

  async function authDeleteUser(store, userId, at) {
    if (typeof store.deleteUser === "function") return store.deleteUser(userId, at);
    for (const [hash, session] of memoryAuth.sessions) if (session.userId === userId) memoryAuth.sessions.delete(hash);
    for (const [workerId, owner] of memoryAuth.workerUsers) if (owner === userId) memoryAuth.workerUsers.delete(workerId);
    memoryAuth.users.delete(userId);
  }

  function limited(map, request, windowMs, maximum) {
    const key = requestAddress(request);
    const timestamp = now();
    const previous = (map.get(key) || []).filter((seenAt) => timestamp - seenAt < windowMs);
    previous.push(timestamp);
    map.set(key, previous);
    if (map.size > 10_000) map.clear();
    return previous.length > maximum;
  }

  async function route(request, env) {
    const store = injectedStore || new D1Store(env.DB);
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        ...responseHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Install-Id, X-Worker-Id",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
    if (request.method === "GET" && pathname === "/privacy") return html(200, privacyPage);
    if (request.method === "GET" && pathname === "/delete-account") return html(200, accountDeletionPage);

    let records;
    try { records = parseLicenseRecords(env.LICENSE_RECORDS_JSON); }
    catch { return json(503, { error: "licensing_configuration_invalid" }); }
    const licensePepper = String(env.LICENSE_PEPPER || "");
    const sessionSecret = String(env.LICENSE_SESSION_SECRET || "");
    const entitlementIds = parseEntitlementIds(env.QONVERSION_ENTITLEMENT_IDS);
    const legacyReady = licensePepper.length >= 32 && sessionSecret.length >= 32 && records.length > 0;
    const qonversionSecret = String(env.QONVERSION_SECRET_KEY || "");
    const qonversionReady = /^(test_)?sk_[A-Za-z0-9_-]{8,}$/.test(qonversionSecret)
      && sessionSecret.length >= 32 && entitlementIds.length > 0;
    const licenseReady = legacyReady || qonversionReady;
    const googleAudience = String(env.GOOGLE_WEB_CLIENT_ID || "");
    const authPepper = String(env.AUTH_SUBJECT_PEPPER || "");
    const googleAuthReady = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleAudience)
      && authPepper.length >= 32;
    const licenseTtl = Math.min(Math.max(Number(env.LICENSE_TOKEN_TTL_SECONDS || 2_592_000), 3_600), 7_776_000);
    const partnerTtl = Math.min(Math.max(Number(env.QONVERSION_SESSION_TTL_SECONDS || 86_400), 900), 86_400);
    const minimum = normalizePositiveUnits(env.MIN_PAYOUT_UNITS) || 1_000_000;
    const dormancyWindow = Math.max(Number(env.DORMANT_AFTER_MS || DEFAULT_DORMANT_AFTER_MS), 86_400_000);

    async function currentLicense(installId) {
      return verifyLicenseSession(
        authorizationToken(request, "License"), installId, records, sessionSecret, now(),
      );
    }

    async function authenticateWorker() {
      const workerId = String(request.headers.get("x-worker-id") || "");
      const installId = String(request.headers.get("x-install-id") || "");
      if (!/^[A-Za-z0-9_-]{3,64}$/.test(workerId) || !validInstallId(installId)) return null;
      const session = await currentLicense(installId);
      if (!session) return null;
      const worker = await store.get(workerId);
      if (!worker || worker.licenseId !== session.lic || (worker.installId && worker.installId !== installId)) return null;
      return { workerId, installId, session, worker };
    }

    async function authenticateUser() {
      const installId = String(request.headers.get("x-install-id") || "");
      const token = authorizationToken(request, "Bearer");
      if (!validInstallId(installId) || token.length < 32) return null;
      return authGetUser(store, await sha256Hex(token), installId, now());
    }

    if (request.method === "GET" && pathname === "/health") {
      try {
        const ready = await store.ping();
        return json(ready ? 200 : 503, {
          ok: Boolean(ready), service: SERVICE, version: VERSION, storage: store.kind,
          persistent: store.kind === "d1" || store.kind === "postgres",
          licensing: licenseReady ? "ready" : "not_configured",
          license_provider: qonversionReady ? "qonversion" : (legacyReady ? "marsx_beta" : "none"),
          google_auth: googleAuthReady ? "ready" : "not_configured",
          payoutMode: "sandbox", dormantPolicy: "safeguarded-liability-reserve",
          conversionMode: "read_only", realWithdrawalsEnabled: false,
        });
      } catch {
        return json(503, { ok: false, service: SERVICE, version: VERSION, storage: store.kind });
      }
    }

    if (limited(generalLimits, request, 60_000, 300)) return json(429, { error: "rate_limit_exceeded" });

    try {
      if (pathname.startsWith("/conversion/")) {
        // Readiness and the closed execution gate are safe to inspect publicly.
        const publicRoute = (request.method === "GET" && pathname === "/conversion/readiness")
          || (request.method === "POST" && pathname === "/conversion/execute");
        if (!publicRoute) {
          const operator = env.WORKER_TOKEN && await safeAuthorization(
            request.headers.get("authorization"), "Bearer", env.WORKER_TOKEN,
          );
          if (!operator && !await authenticateWorker()) {
            return json(401, { error: "conversion_authorization_required" });
          }
          if (limited(activationLimits, request, 60_000, 20)) return json(429, { error: "too_many_attempts" });
        }
        const data = request.method === "POST" && pathname !== "/conversion/execute" ? await readJson(request) : {};
        const response = await readOnlyConversion({ method: request.method, pathname, data, env, fetchImpl });
        return json(response.status, response.body);
      }

      if (request.method === "POST" && pathname === "/auth/google/nonce") {
        if (!googleAuthReady) return json(503, { error: "google_auth_not_configured" });
        if (limited(activationLimits, request, 600_000, 20)) return json(429, { error: "too_many_attempts" });
        const data = await readJson(request);
        const installId = String(data.install_id || "");
        if (!validInstallId(installId)) return json(400, { error: "invalid_install_id" });
        const nonce = randomToken(32);
        await authCreateNonce(
          store, await sha256Hex(nonce), installId, now() + AUTH_NONCE_TTL_MS, new Date(now()).toISOString(),
        );
        return json(200, { ok: true, nonce, expires_in: Math.floor(AUTH_NONCE_TTL_MS / 1000) });
      }

      if (request.method === "POST" && pathname === "/auth/google/exchange") {
        if (!googleAuthReady) return json(503, { error: "google_auth_not_configured" });
        if (limited(activationLimits, request, 600_000, 20)) return json(429, { error: "too_many_attempts" });
        const data = await readJson(request);
        const installId = String(data.install_id || "");
        const workerId = String(data.worker_id || installId);
        const nonce = String(data.nonce || "");
        if (!validInstallId(installId) || !/^[A-Za-z0-9_-]{3,64}$/.test(workerId)) {
          return json(400, { error: "invalid_install_id" });
        }
        const claims = await verifyGoogleIdToken(
          fetchImpl, String(data.id_token || ""), googleAudience, nonce, now(),
        );
        if (!claims) return json(401, { error: "google_id_token_invalid" });
        if (!await authConsumeNonce(store, await sha256Hex(nonce), installId, now())) {
          return json(409, { error: "google_nonce_invalid_or_used" });
        }
        const at = new Date(now()).toISOString();
        const user = await authUpsertUser(
          store,
          await hmacHex(authPepper, claims.sub),
          String(claims.email || "").slice(0, 254).toLowerCase(),
          String(claims.name || claims.given_name || "MARS-X user").slice(0, 100),
          at,
        );
        if (!user) return json(403, { error: "account_deleted" });
        const referral = await authSetReferral(store, user.user_id, data.referral_code, at);
        if (referral.result === "invalid") return json(400, { error: "referral_code_invalid" });
        if (referral.result === "self") return json(400, { error: "self_referral_not_allowed" });
        const sessionToken = randomToken(48);
        await authIssueSession(
          store, user.user_id, installId, await sha256Hex(sessionToken), now() + AUTH_SESSION_TTL_MS, at,
        );
        await authLinkWorker(store, user.user_id, workerId, at);
        const profile = await authReferralProfile(store, user.user_id);
        return json(200, {
          ok: true, session_token: sessionToken, expires_in: Math.floor(AUTH_SESSION_TTL_MS / 1000),
          user: { display_name: user.display_name, email: user.email },
          referral: profile,
        });
      }

      if (request.method === "GET" && pathname === "/auth/me") {
        if (!googleAuthReady) return json(503, { error: "google_auth_not_configured" });
        const user = await authenticateUser();
        if (!user) return json(401, { error: "user_session_invalid" });
        return json(200, {
          ok: true,
          user: { display_name: user.display_name, email: user.email },
          referral: await authReferralProfile(store, user.user_id),
          referral_policy: {
            platform_fee_percent: 2,
            share_of_platform_fee_percent: 3,
            effective_gross_percent: 0.06,
            charged_to_invitee: false,
            levels: 1,
          },
        });
      }

      if (request.method === "POST" && pathname === "/auth/delete") {
        if (!googleAuthReady) return json(503, { error: "google_auth_not_configured" });
        const user = await authenticateUser();
        if (!user) return json(401, { error: "user_session_invalid" });
        await authDeleteUser(store, user.user_id, new Date(now()).toISOString());
        return json(200, { ok: true, deleted: true });
      }

      if (request.method === "POST" && pathname === "/billing/qonversion/session") {
        if (!qonversionReady) return json(503, { error: "qonversion_not_configured" });
        if (limited(activationLimits, request, 600_000, 10)) return json(429, { error: "too_many_attempts" });
        const data = await readJson(request);
        const installId = String(data.install_id || "");
        const identityId = String(data.identity_id || "");
        if (!validInstallId(installId) || identityId !== installId) return json(400, { error: "invalid_qonversion_identity" });
        if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
          return json(400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
        }
        let result;
        try {
          result = await findQonversionEntitlement(fetchImpl, qonversionSecret, identityId, entitlementIds);
        } catch (error) {
          await auditLicense("qonversion_lookup_failed", request, licensePepper, {
            reason: String(error?.message || "unknown").slice(0, 80),
          });
          return json(502, { error: "qonversion_unavailable" });
        }
        if (result.error) {
          await auditLicense("qonversion_session_denied", request, licensePepper, { reason: result.error });
          return json(403, { error: result.error });
        }
        const sessionToken = await issueQonversionSession(
          result.entitlement, installId, sessionSecret, now(), partnerTtl,
        );
        await auditLicense("qonversion_session_granted", request, licensePepper, {
          entitlementId: result.entitlement.id,
          installHash: licensePepper ? (await hmacHex(licensePepper, installId)).slice(0, 24) : "unconfigured",
          termsVersion: TERMS_VERSION,
          appVersion: String(data.app_version || "unknown").slice(0, 30),
        });
        return json(200, {
          ok: true, provider: "qonversion", license_id: `qonversion:${result.entitlement.id}`,
          entitlement_id: result.entitlement.id, session_token: sessionToken,
          expires_in: partnerTtl, terms_version: TERMS_VERSION,
        });
      }

      if (request.method === "POST" && pathname === "/license/activate") {
        if (!legacyReady) return json(503, { error: "legacy_licensing_not_configured" });
        if (limited(activationLimits, request, 600_000, 10)) return json(429, { error: "too_many_attempts" });
        const data = await readJson(request);
        const installId = String(data.install_id || "");
        if (!validInstallId(installId)) return json(400, { error: "invalid_install_id" });
        if (data.terms_accepted !== true || String(data.terms_version || "") !== TERMS_VERSION) {
          return json(400, { error: "terms_not_accepted", terms_version: TERMS_VERSION });
        }
        const record = await findLicense(records, licensePepper, data.license_key);
        if (!record) {
          await auditLicense("activation_denied", request, licensePepper, { reason: "unknown_key" });
          return json(401, { error: "invalid_license" });
        }
        if (record.status !== "active") return json(403, { error: "license_inactive" });
        if (record.expiresAt && Date.parse(record.expiresAt) <= now()) return json(403, { error: "license_expired" });
        if (!await store.bindLicenseDevice(record.id, installId, record.maxDevices)) {
          return json(409, { error: "device_limit_reached" });
        }
        const sessionToken = await issueLicenseSession(record, installId, sessionSecret, now(), licenseTtl);
        return json(200, {
          ok: true, license_id: record.id, session_token: sessionToken,
          expires_in: licenseTtl, terms_version: TERMS_VERSION,
        });
      }

      if (request.method === "GET" && pathname === "/license/status") {
        if (!licenseReady) return json(503, { error: "licensing_not_configured" });
        const session = await currentLicense(String(request.headers.get("x-install-id") || ""));
        if (!session) return json(401, { error: "license_session_invalid" });
        return json(200, {
          ok: true, license_id: session.lic,
          provider: session.src === "qonversion" ? "qonversion" : "marsx_beta",
          expires_at: new Date(session.exp * 1000).toISOString(),
        });
      }

      if (request.method === "GET" && (pathname === "/workers" || pathname === "/summary")) {
        if (!env.WORKER_TOKEN) return json(503, { error: "WORKER_TOKEN_not_configured" });
        if (!await safeAuthorization(request.headers.get("authorization"), "Bearer", env.WORKER_TOKEN)) {
          return json(401, { error: "unauthorized" });
        }
        const workers = await store.all();
        if (pathname === "/summary") return json(200, {
          registered: workers.length,
          online: workers.filter((worker) => now() - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS).length,
        });
        return json(200, { workers: workers.map((worker) => ({
          ...worker,
          status: now() - Date.parse(worker.lastSeen) < ONLINE_WINDOW_MS ? "online" : "offline",
        })) });
      }

      if (request.method === "POST" && (pathname === "/register" || pathname === "/heartbeat")) {
        if (!licenseReady) return json(503, { error: "licensing_not_configured" });
        const data = await readJson(request);
        const installId = String(data.install_id || "");
        const session = await currentLicense(installId);
        if (!session) return json(401, { error: "valid_license_required" });
        const workerId = normalizeWorkerId(data);
        if (!workerId) return json(400, { error: "invalid_worker_id" });
        const oldWorker = await store.get(workerId);
        if (pathname === "/heartbeat" && !oldWorker) return json(404, { error: "register_first" });
        if (oldWorker?.licenseId && oldWorker.licenseId !== session.lic) return json(409, { error: "worker_already_registered" });
        if (oldWorker?.installId && oldWorker.installId !== installId) {
          return json(409, { error: "worker_bound_to_another_installation" });
        }
        if (oldWorker) await store.touchActivity(workerId, now());
        const worker = normalizeWorker(data, await store.get(workerId), now(), session.lic, installId);
        await store.set(worker);
        return json(200, { ok: true, worker });
      }

      if (request.method === "GET" && pathname === "/account") {
        const auth = await authenticateWorker();
        if (!auth) return json(401, { error: "valid_license_and_worker_required" });
        const activity = await store.touchActivity(auth.workerId, now());
        const availableUnits = await store.getBalance(auth.workerId);
        return json(200, {
          workerId: auth.workerId, asset: ASSET, decimals: ASSET_DECIMALS,
          availableUnits, availableDisplay: formatUnits(availableUnits),
          minimumPayoutUnits: minimum, minimumPayoutDisplay: formatUnits(minimum),
          payoutMode: "sandbox", withdrawable: false, accountStatus: "active",
          dormantAfterDays: Math.round(dormancyWindow / 86_400_000),
          restoredFromDormantUnits: activity.restoredUnits,
        });
      }

      if (request.method === "GET" && pathname === "/payouts") {
        const auth = await authenticateWorker();
        if (!auth) return json(401, { error: "valid_license_and_worker_required" });
        await store.touchActivity(auth.workerId, now());
        return json(200, { payoutMode: "sandbox", payouts: await store.payoutsFor(auth.workerId) });
      }

      if (request.method === "POST" && pathname === "/payouts") {
        const auth = await authenticateWorker();
        if (!auth) return json(401, { error: "valid_license_and_worker_required" });
        await store.touchActivity(auth.workerId, now());
        const data = await readJson(request);
        const amountUnits = normalizePositiveUnits(data.amountUnits);
        const destination = normalizeDestination(data.destination);
        const idempotencyKey = normalizeIdempotencyKey(data.idempotencyKey);
        if (!amountUnits || amountUnits < minimum) {
          return json(400, { error: "amount_below_sandbox_minimum", minimumPayoutUnits: minimum });
        }
        if (!destination) return json(400, { error: "invalid_sandbox_destination" });
        if (!idempotencyKey) return json(400, { error: "invalid_idempotency_key" });
        const timestamp = new Date(now()).toISOString();
        const relation = await authReferralForWorker(store, auth.workerId);
        const fee = calculateFee(amountUnits, Boolean(relation?.referrer_user_id));
        const payout = {
          id: `pay_${crypto.randomUUID().replaceAll("-", "")}`,
          workerId: auth.workerId, asset: ASSET, amountUnits,
          amountDisplay: formatUnits(amountUnits), destination,
          payoutNetUnits: fee.payoutUnits,
          payoutNetDisplay: formatUnits(fee.payoutUnits),
          platformFeeUnits: fee.platformFeeUnits,
          platformFeeDisplay: formatUnits(fee.platformFeeUnits),
          referralRewardUnits: fee.referralRewardUnits,
          referralRewardDisplay: formatUnits(fee.referralRewardUnits),
          marsxNetFeeUnits: fee.marsxNetFeeUnits,
          feePolicy: "2_percent_platform_fee;3_percent_of_fee_to_single_level_referrer",
          status: "pending", sandbox: true, createdAt: timestamp, updatedAt: timestamp,
        };
        const result = await store.createPayout(auth.workerId, payout, idempotencyKey);
        if (result.result === "insufficient") {
          return json(409, { error: "insufficient_sandbox_balance", availableUnits: result.balance });
        }
        return json(result.result === "created" ? 201 : 200, {
          ok: true, created: result.result === "created", payout: result.payout,
          availableUnits: result.balance, payoutMode: "sandbox",
          referralChargedToInvitee: false,
        });
      }

      if (pathname.startsWith("/admin/")) {
        if (!env.ADMIN_TOKEN) return json(503, { error: "ADMIN_TOKEN_not_configured" });
        if (!await safeAuthorization(request.headers.get("authorization"), "Bearer", env.ADMIN_TOKEN)) {
          return json(401, { error: "admin_unauthorized" });
        }
        if (request.method === "POST" && pathname === "/admin/credits") {
          const data = await readJson(request);
          const workerId = normalizeWorkerId(data);
          const amountUnits = normalizePositiveUnits(data.amountUnits);
          const worker = workerId ? await store.get(workerId) : null;
          if (!workerId || !worker) return json(404, { error: "worker_not_found" });
          if (worker.dormantAt) return json(409, { error: "dormant_account_must_reactivate" });
          if (!amountUnits) return json(400, { error: "invalid_amountUnits" });
          const at = new Date(now()).toISOString();
          const balance = await store.credit(workerId, amountUnits, {
            type: "sandbox_credit", amountUnits,
            reason: String(data.reason || "sandbox test").slice(0, 120), at,
          });
          return json(201, {
            ok: true, workerId, asset: ASSET, creditedUnits: amountUnits,
            availableUnits: balance, payoutMode: "sandbox",
          });
        }
        if (request.method === "GET" && pathname === "/admin/payouts") {
          return json(200, { payoutMode: "sandbox", payouts: await store.allPayouts() });
        }
        if (request.method === "GET" && pathname === "/admin/dormancy") {
          return json(200, {
            ...await store.dormantSummary(), asset: ASSET,
            reserveType: "client-liability", companyRevenue: false,
            dormantAfterDays: Math.round(dormancyWindow / 86_400_000),
          });
        }
        if (request.method === "POST" && pathname === "/admin/dormancy/sweep") {
          const timestamp = now();
          return json(200, {
            ok: true, ...await store.sweepDormant(timestamp - dormancyWindow, timestamp),
            asset: ASSET, reserveType: "client-liability", companyRevenue: false,
          });
        }
        const match = pathname.match(/^\/admin\/payouts\/(pay_[A-Za-z0-9]+)$/);
        if (request.method === "POST" && match) {
          const data = await readJson(request);
          const status = String(data.status || "");
          if (!["approved", "rejected", "simulated_paid"].includes(status)) {
            return json(400, { error: "invalid_sandbox_status" });
          }
          const result = await store.updatePayout(
            match[1], status, new Date(now()).toISOString(), String(data.reference || "").slice(0, 120),
          );
          if (result.result === "missing") return json(404, { error: "payout_not_found" });
          if (result.result === "invalid") return json(409, { error: "invalid_payout_transition", payout: result.payout });
          if (status === "simulated_paid") {
            const fee = {
              grossUnits: Number(result.payout.amountUnits),
              payoutUnits: Number(result.payout.payoutNetUnits),
              platformFeeUnits: Number(result.payout.platformFeeUnits),
              referralRewardUnits: Number(result.payout.referralRewardUnits),
              marsxNetFeeUnits: Number(result.payout.marsxNetFeeUnits),
            };
            await authRecordFee(
              store, `fee_${result.payout.id}`, result.payout.workerId, fee,
              result.payout.id, result.payout.updatedAt,
            );
          }
          return json(200, { ok: true, payout: result.payout, payoutMode: "sandbox" });
        }
      }
      return json(404, { error: "not_found" });
    } catch (error) {
      if (error?.status) return json(error.status, { error: error.message });
      console.error("Worker request failed", error);
      return json(500, { error: "internal_error" });
    }
  }

  return { fetch: route };
}

const productionApp = createApp();

export default {
  fetch(request, env) {
    return productionApp.fetch(request, env);
  },
  async scheduled(_controller, env, context) {
    const store = new D1Store(env.DB);
    const windowMs = Math.max(Number(env.DORMANT_AFTER_MS || DEFAULT_DORMANT_AFTER_MS), 86_400_000);
    const timestamp = Date.now();
    context.waitUntil(store.sweepDormant(timestamp - windowMs, timestamp));
  },
};
