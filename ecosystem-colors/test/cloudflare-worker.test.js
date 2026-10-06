import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import { createApp } from "../cloudflare/src/worker.js";
import { MemoryStore } from "../server.js";

const LICENSE_KEY = "MARSX-CF-TEST-ABCD-EFGH";
const LICENSE_PEPPER = "cloudflare-test-pepper-at-least-32-characters";
const LICENSE_SESSION_SECRET = "cloudflare-test-session-secret-32-chars";
const LICENSE_RECORDS = [{
  id: "cloudflare_beta_001",
  keyHash: createHmac("sha256", LICENSE_PEPPER).update(LICENSE_KEY).digest("hex"),
  status: "active",
  maxDevices: 5,
}];

const GOOGLE_AUDIENCE = "123456789-marsx.apps.googleusercontent.com";
const GOOGLE_KEY_ID = "marsx-google-test-key";
const { privateKey: googlePrivateKey, publicKey: googlePublicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const googleJwk = { ...googlePublicKey.export({ format: "jwk" }), kid: GOOGLE_KEY_ID, alg: "RS256", use: "sig" };

function googleToken({ nonce, sub, email }) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid: GOOGLE_KEY_ID, typ: "JWT" });
  const payload = encode({
    iss: "https://accounts.google.com", aud: GOOGLE_AUDIENCE, sub, email,
    email_verified: true, name: email.split("@")[0], nonce, iat: now, exp: now + 600,
  });
  return `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), googlePrivateKey).toString("base64url")}`;
}

function googleFetch(url) {
  assert.equal(String(url), "https://www.googleapis.com/oauth2/v3/certs");
  return Promise.resolve(new Response(JSON.stringify({ keys: [googleJwk] }), { status: 200 }));
}

function environment(extra = {}) {
  return {
    WORKER_TOKEN: "worker-admin-token",
    ADMIN_TOKEN: "payout-admin-token",
    LICENSE_PEPPER,
    LICENSE_SESSION_SECRET,
    LICENSE_RECORDS_JSON: JSON.stringify(LICENSE_RECORDS),
    LICENSE_TOKEN_TTL_SECONDS: "2592000",
    QONVERSION_ENTITLEMENT_IDS: "pro,farm",
    QONVERSION_SESSION_TTL_SECONDS: "86400",
    GOOGLE_WEB_CLIENT_ID: GOOGLE_AUDIENCE,
    AUTH_SUBJECT_PEPPER: "google-auth-subject-pepper-at-least-32-characters",
    MIN_PAYOUT_UNITS: "1000000",
    DORMANT_AFTER_MS: "31536000000",
    ...extra,
  };
}

function request(path, options = {}) {
  return new Request(`https://marsx-pool-api.example${path}`, options);
}

async function activate(app, env, installId = "node-cloudflare12345") {
  const response = await app.fetch(request("/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10" },
    body: JSON.stringify({
      license_key: LICENSE_KEY,
      install_id: installId,
      terms_accepted: true,
      terms_version: "2026-09-27-v3",
      app_version: "0.8-beta",
    }),
  }), env);
  assert.equal(response.status, 200);
  return response.json();
}

test("Cloudflare health exposes the serverless runtime contract", async () => {
  const app = createApp({ store: new MemoryStore() });
  const response = await app.fetch(request("/health"), environment());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.version, "0.8.4");
  assert.equal(body.licensing, "ready");
  assert.equal(body.google_auth, "ready");
  assert.equal(body.payoutMode, "sandbox");
});

async function googleSignIn(app, env, installId, sub, email, referralCode = "") {
  const nonceResponse = await app.fetch(request("/auth/google/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ install_id: installId }),
  }), env);
  assert.equal(nonceResponse.status, 200);
  const { nonce } = await nonceResponse.json();
  const exchange = await app.fetch(request("/auth/google/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      install_id: installId, worker_id: installId, nonce,
      id_token: googleToken({ nonce, sub, email }), referral_code: referralCode,
    }),
  }), env);
  assert.equal(exchange.status, 200);
  return { ...(await exchange.json()), nonce };
}

test("Google sign-in verifies RS256 nonce and locks a one-level referral", async () => {
  const store = new MemoryStore();
  const app = createApp({ store, fetchImpl: googleFetch });
  const env = environment();
  const referrerInstall = "node-google-referrer-01";
  const inviteeInstall = "node-google-invitee-001";
  const referrer = await googleSignIn(app, env, referrerInstall, "google-sub-referrer", "referrer@example.com");
  const referralCode = referrer.referral.code;
  assert.match(referralCode, /^[A-Z0-9]{8,16}$/);
  const invitee = await googleSignIn(
    app, env, inviteeInstall, "google-sub-invitee", "invitee@example.com", referralCode,
  );
  assert.equal(invitee.referral.usedCode, referralCode);

  const replay = await app.fetch(request("/auth/google/exchange", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      install_id: inviteeInstall, worker_id: inviteeInstall, nonce: invitee.nonce,
      id_token: googleToken({ nonce: invitee.nonce, sub: "google-sub-invitee", email: "invitee@example.com" }),
      referral_code: referralCode,
    }),
  }), env);
  assert.equal(replay.status, 409);

  const activated = await activate(app, env, inviteeInstall);
  const licenceHeaders = { Authorization: `License ${activated.session_token}`, "Content-Type": "application/json" };
  assert.equal((await app.fetch(request("/register", {
    method: "POST", headers: licenceHeaders,
    body: JSON.stringify({ workerId: inviteeInstall, install_id: inviteeInstall, platform: "android-36" }),
  }), env)).status, 200);
  assert.equal((await app.fetch(request("/admin/credits", {
    method: "POST", headers: { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ workerId: inviteeInstall, amountUnits: 100_000_000 }),
  }), env)).status, 201);

  const payout = await app.fetch(request("/payouts", {
    method: "POST",
    headers: {
      ...licenceHeaders, "X-Install-Id": inviteeInstall, "X-Worker-Id": inviteeInstall,
    },
    body: JSON.stringify({
      amountUnits: 100_000_000, destination: "sandbox-wallet-referral", idempotencyKey: "referral-fee-0001",
    }),
  }), env);
  assert.equal(payout.status, 201);
  const payoutBody = await payout.json();
  assert.equal(payoutBody.payout.platformFeeUnits, 2_000_000);
  assert.equal(payoutBody.payout.payoutNetUnits, 98_000_000);
  assert.equal(payoutBody.payout.referralRewardUnits, 60_000);

  assert.equal((await app.fetch(request(`/admin/payouts/${payoutBody.payout.id}`, {
    method: "POST", headers: { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ status: "simulated_paid" }),
  }), env)).status, 200);
  assert.equal((await app.fetch(request(`/admin/payouts/${payoutBody.payout.id}`, {
    method: "POST", headers: { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ status: "simulated_paid" }),
  }), env)).status, 200);

  const me = await app.fetch(request("/auth/me", {
    headers: { Authorization: `Bearer ${referrer.session_token}`, "X-Install-Id": referrerInstall },
  }), env);
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.referral.rewardUnits, 60_000);
  assert.equal(profile.referral_policy.effective_gross_percent, 0.06);
  assert.equal(profile.referral_policy.charged_to_invitee, false);
});

test("Google account deletion revokes the local MARS-X session", async () => {
  const app = createApp({ store: new MemoryStore(), fetchImpl: googleFetch });
  const env = environment();
  const installId = "node-google-delete-0001";
  const account = await googleSignIn(app, env, installId, "google-sub-delete", "delete@example.com");
  const headers = { Authorization: `Bearer ${account.session_token}`, "X-Install-Id": installId };
  assert.equal((await app.fetch(request("/auth/delete", { method: "POST", headers }), env)).status, 200);
  assert.equal((await app.fetch(request("/auth/me", { headers }), env)).status, 401);
});

test("Cloudflare licence sessions stay bound to one installation", async () => {
  const app = createApp({ store: new MemoryStore() });
  const env = environment();
  const activated = await activate(app, env);
  const ok = await app.fetch(request("/license/status", {
    headers: {
      Authorization: `License ${activated.session_token}`,
      "X-Install-Id": "node-cloudflare12345",
    },
  }), env);
  assert.equal(ok.status, 200);
  const wrongDevice = await app.fetch(request("/license/status", {
    headers: {
      Authorization: `License ${activated.session_token}`,
      "X-Install-Id": "node-cloudflare99999",
    },
  }), env);
  assert.equal(wrongDevice.status, 401);
});

test("Cloudflare register, credit and idempotent sandbox payout preserve the API", async () => {
  const store = new MemoryStore();
  const app = createApp({ store });
  const env = environment();
  const installId = "node-cloudflare12345";
  const workerId = "node-cf-001";
  const activated = await activate(app, env, installId);
  const licenceHeaders = {
    Authorization: `License ${activated.session_token}`,
    "Content-Type": "application/json",
  };
  const registration = await app.fetch(request("/register", {
    method: "POST",
    headers: licenceHeaders,
    body: JSON.stringify({ workerId, install_id: installId, platform: "android-36" }),
  }), env);
  assert.equal(registration.status, 200);

  const credit = await app.fetch(request("/admin/credits", {
    method: "POST",
    headers: { Authorization: "Bearer payout-admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ workerId, amountUnits: 5_000_000 }),
  }), env);
  assert.equal(credit.status, 201);

  const payoutHeaders = {
    ...licenceHeaders,
    "X-Install-Id": installId,
    "X-Worker-Id": workerId,
  };
  const body = JSON.stringify({
    amountUnits: 2_000_000,
    destination: "sandbox-wallet-cf",
    idempotencyKey: "cloudflare-payout-001",
  });
  const first = await app.fetch(request("/payouts", { method: "POST", headers: payoutHeaders, body }), env);
  assert.equal(first.status, 201);
  assert.equal((await first.json()).availableUnits, 3_000_000);
  const retry = await app.fetch(request("/payouts", { method: "POST", headers: payoutHeaders, body }), env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).availableUnits, 3_000_000);
});

test("Cloudflare exchanges active Qonversion entitlement for a 24-hour session", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).includes("/identities/")) {
      return new Response(JSON.stringify({ user_id: "QON_cloudflare12345678" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      data: [{ id: "pro", is_active: true, product: { product_id: "marsx_pro_monthly" } }],
    }), { status: 200 });
  };
  const app = createApp({ store: new MemoryStore(), fetchImpl });
  const env = environment({ QONVERSION_SECRET_KEY: "test_sk_cloudflare123456" });
  const response = await app.fetch(request("/billing/qonversion/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity_id: "node-cloudflare12345",
      install_id: "node-cloudflare12345",
      terms_accepted: true,
      terms_version: "2026-09-27-v3",
      app_version: "0.8-beta",
    }),
  }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.entitlement_id, "pro");
  assert.equal(body.expires_in, 86_400);
  assert.equal(calls.length, 2);
});
