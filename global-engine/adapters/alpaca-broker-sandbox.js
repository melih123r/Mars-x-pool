import { VenueAdapter } from "../venue.js";

const HOSTS = Object.freeze({
  us: { api: "https://broker-api.sandbox.alpaca.markets", auth: "https://authx.sandbox.alpaca.markets" },
  eu: { api: "https://broker-api.sandbox.eu.alpaca.markets", auth: "https://authx.sandbox.eu.alpaca.markets" }
});
const id = (value, name = "accountId") => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error(`${name} required or invalid`);
  return value;
};
const exactHost = (value, expected) => {
  if (String(value).replace(/\/+$/, "") !== expected) throw new Error("Alpaca Broker requires the matching official sandbox host");
  return expected;
};
const withQuery = (path, query = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) params.set(key, String(value));
  return path + (params.size ? `?${params}` : "");
};
const SAFE_READ = [
  /^\/v1\/assets(?:\/[A-Za-z0-9_-]+)?$/,
  /^\/v1\/accounts(?:\/[A-Za-z0-9_-]+(?:\/cip)?)?$/,
  /^\/v1\/trading\/accounts\/[A-Za-z0-9_-]+\/(?:account(?:\/portfolio\/history)?|positions(?:\/[A-Za-z0-9_-]+)?|orders(?:\/[A-Za-z0-9_-]+)?)$/,
  /^\/v1\/events\/accounts\/status$/, /^\/v2\/events\/trades$/
];
const ORDER_PATH = /^\/v1\/trading\/accounts\/[A-Za-z0-9_-]+\/orders(?:\/[A-Za-z0-9_-]+)?$/;

export class AlpacaBrokerSandboxAdapter extends VenueAdapter {
  #apiKey; #apiSecret; #clientId; #clientSecret; #fetch; #clock;
  #accessToken = null; #expiresAt = 0; #tokenRequest = null;
  constructor({
    clientId = process.env.ALPACA_BROKER_CLIENT_ID, clientSecret = process.env.ALPACA_BROKER_CLIENT_SECRET,
    apiKey = process.env.ALPACA_BROKER_API_KEY, apiSecret = process.env.ALPACA_BROKER_API_SECRET,
    authMode = process.env.ALPACA_BROKER_AUTH_MODE || (apiKey || apiSecret ? "basic" : "oauth"),
    region = process.env.ALPACA_BROKER_REGION || (authMode === "basic" ? "us" : "eu"),
    authUrl = process.env.ALPACA_BROKER_AUTH_URL, baseUrl = process.env.ALPACA_BROKER_BASE_URL,
    allowOrders = process.env.MARSX_ALPACA_BROKER_ALLOW_ORDERS === "true",
    timeoutMs = 8000, fetchImpl = fetch, clock = Date.now
  } = {}) {
    super("alpaca-broker-sandbox", ["EQUITY", "ETF"]);
    if (!Object.hasOwn(HOSTS, region) || !["basic", "oauth"].includes(authMode)) throw new Error("Invalid Alpaca Broker sandbox region or auth mode");
    if (authMode === "basic" && region !== "us") throw new Error("EU sandbox requires OAuth client credentials");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid Alpaca Broker timeout");
    this.mode = "sandbox-gated";
    Object.defineProperties(this, {
      region: { value: region, enumerable: true }, authMode: { value: authMode, enumerable: true },
      authUrl: { value: exactHost(authUrl || HOSTS[region].auth, HOSTS[region].auth), enumerable: true },
      baseUrl: { value: exactHost(baseUrl || HOSTS[region].api, HOSTS[region].api), enumerable: true }
    });
    this.allowOrders = allowOrders === true; this.timeoutMs = timeoutMs;
    this.#apiKey = apiKey; this.#apiSecret = apiSecret; this.#clientId = clientId; this.#clientSecret = clientSecret;
    this.#fetch = fetchImpl; this.#clock = clock;
  }
  configured() { return this.authMode === "basic" ? Boolean(this.#apiKey && this.#apiSecret) : Boolean(this.#clientId && this.#clientSecret); }
  status() { return { region: this.region, authMode: this.authMode, configured: this.configured(), sandboxOrders: this.allowOrders, liveExecution: false, custody: false, withdrawals: false }; }
  async token() {
    if (this.authMode !== "oauth") throw new Error("OAuth token is unavailable in Basic auth mode");
    if (!this.configured()) throw new Error("Alpaca Broker sandbox credentials are not configured");
    if (this.#accessToken && this.#clock() < this.#expiresAt) return this.#accessToken;
    if (this.#tokenRequest) return this.#tokenRequest;
    this.#tokenRequest = (async () => {
      exactHost(this.authUrl, HOSTS[this.region].auth);
      const response = await this.#fetch(`${this.authUrl}/v1/oauth2/token`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(this.timeoutMs),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.#clientId, client_secret: this.#clientSecret })
      });
      if (!response.ok) throw new Error(`Alpaca Broker auth HTTP ${response.status}`);
      let payload; try { payload = await response.json(); } catch { throw new Error("Invalid Alpaca Broker auth response"); }
      if (typeof payload.access_token !== "string" || !payload.access_token || !Number.isFinite(Number(payload.expires_in)) || Number(payload.expires_in) <= 0 || String(payload.token_type).toLowerCase() !== "bearer") throw new Error("Invalid Alpaca Broker auth response");
      this.#accessToken = payload.access_token;
      this.#expiresAt = this.#clock() + Math.max(0, Number(payload.expires_in) - 30) * 1000;
      return this.#accessToken;
    })();
    try { return await this.#tokenRequest; } finally { this.#tokenRequest = null; }
  }
  #validate(path, method) {
    exactHost(this.baseUrl, HOSTS[this.region].api);
    if (typeof path !== "string" || !/^\/v[12]\//.test(path) || /[%#\\]|\/\//.test(path.split("?")[0]) || path.includes("#")) throw new Error("Invalid Alpaca Broker sandbox path");
    const pathname = path.split("?")[0];
    if (method === "GET" && SAFE_READ.some(pattern => pattern.test(pathname))) return;
    if (method === "POST" && (/^\/v1\/accounts$/.test(pathname) || /^\/v1\/accounts\/[A-Za-z0-9_-]+\/cip$/.test(pathname))) return;
    if (ORDER_PATH.test(pathname) && ["POST", "DELETE"].includes(method)) {
      if (!this.allowOrders) throw new Error("Alpaca Broker sandbox order submission disabled");
      if ((method === "DELETE" && !/^\/v1\/trading\/accounts\/[A-Za-z0-9_-]+\/orders\/[A-Za-z0-9_-]+$/.test(pathname)) || (method === "POST" && !pathname.endsWith("/orders"))) throw new Error("Unsupported order mutation");
      return;
    }
    throw new Error("Alpaca Broker operation disabled; custody, funding and withdrawals are unavailable");
  }
  async #response(path, { method = "GET", body, accept = "application/json" } = {}) {
    this.#validate(path, method);
    if (!this.configured()) throw new Error("Alpaca Broker sandbox credentials are not configured");
    const authorization = this.authMode === "basic" ? `Basic ${Buffer.from(`${this.#apiKey}:${this.#apiSecret}`).toString("base64")}` : `Bearer ${await this.token()}`;
    const response = await this.#fetch(`${this.baseUrl}${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Authorization: authorization, Accept: accept, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`Alpaca Broker HTTP ${response.status}`);
    return response;
  }
  async request(path, options = {}) {
    const response = await this.#response(path, options);
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw new Error("Invalid Alpaca Broker JSON response"); }
  }
  listAccounts(query) { return this.request(withQuery("/v1/accounts", query)); }
  createAccount(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("account payload required");
    return this.request("/v1/accounts", { method: "POST", body: payload });
  }
  getAccount(accountId) { return this.request(`/v1/accounts/${id(accountId)}`); }
  submitCip(accountId, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("CIP payload required");
    return this.request(`/v1/accounts/${id(accountId)}/cip`, { method: "POST", body: payload });
  }
  getTradingAccount(accountId) { return this.request(`/v1/trading/accounts/${id(accountId)}/account`); }
  getPositions(accountId) { return this.request(`/v1/trading/accounts/${id(accountId)}/positions`); }
  getPortfolioHistory(accountId, query) { return this.request(withQuery(`/v1/trading/accounts/${id(accountId)}/account/portfolio/history`, query)); }
  getOrders(accountId, query) { return this.request(withQuery(`/v1/trading/accounts/${id(accountId)}/orders`, query)); }
  getOrder(accountId, orderId) { return this.request(`/v1/trading/accounts/${id(accountId)}/orders/${id(orderId, "orderId")}`); }
  async createOrder(accountId, payload) {
    if (!this.allowOrders) throw new Error("Alpaca Broker sandbox order submission disabled");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("order payload required");
    return this.request(`/v1/trading/accounts/${id(accountId)}/orders`, { method: "POST", body: payload });
  }
  async cancelOrder(accountId, orderId) {
    if (!this.allowOrders) throw new Error("Alpaca Broker sandbox order submission disabled");
    return this.request(`/v1/trading/accounts/${id(accountId)}/orders/${id(orderId, "orderId")}`, { method: "DELETE" });
  }
  async *events(kind, { since, until, maxEvents = 100 } = {}) {
    const routes = { accounts: "/v1/events/accounts/status", trades: "/v2/events/trades" };
    if (!routes[kind] || !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 10000) throw new Error("Invalid Sandbox SSE request");
    if (this.region !== "us" && kind === "trades") throw new Error("EU trade SSE contract requires separate certification");
    if (until && !since) throw new Error("SSE since is required with until");
    for (const value of [since, until]) if (value && !Number.isFinite(Date.parse(value))) throw new Error("Invalid SSE timestamp");
    if (since && until && Date.parse(since) > Date.parse(until)) throw new Error("Invalid SSE range");
    const response = await this.#response(withQuery(routes[kind], { since, until }), { accept: "text/event-stream" });
    if (!response.headers.get("content-type")?.startsWith("text/event-stream") || !response.body) throw new Error("Invalid Alpaca Broker SSE response");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", count = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        if (buffer.length > 1048576) throw new Error("Alpaca Broker SSE event too large");
        let boundary;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
          const frame = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
          const lines = frame.split(/\r?\n/);
          if (lines.filter(line => line.startsWith(":")).some(line => /dropped|internal server error/i.test(line))) throw new Error("Alpaca Broker SSE stream requires replay after provider data loss");
          const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, "")).join("\n");
          if (!data) continue;
          let event; try { event = JSON.parse(data); } catch { throw new Error("Invalid Alpaca Broker SSE event"); }
          yield event;
          if (++count >= maxEvents) return;
        }
        if (done) { if (buffer.trim()) throw new Error("Truncated Alpaca Broker SSE event"); return; }
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  async placeOrder() { throw new Error("generic live execution disabled"); }
}

export function alpacaAccountState(status, region = "us") {
  const value = String(status || "").toUpperCase();
  if (value === "ACTIVE" || (region === "eu" && value === "APPROVED")) return "ACTIVE";
  if (["SUBMITTED", "ONBOARDING", "APPROVAL_PENDING", "APPROVED", "ACTION_REQUIRED"].includes(value)) return "KYC_PENDING";
  if (["ACCOUNT_CLOSED", "CLOSED"].includes(value)) return "CLOSED";
  if (value === "REJECTED") return "REJECTED";
  if (["DISABLED", "INACTIVE"].includes(value)) return "SUSPENDED";
  return "UNKNOWN";
}
