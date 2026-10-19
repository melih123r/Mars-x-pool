// MARS-X read-only ChangeNOW smoke test. Never creates transactions or prints credentials.
// Usage: MARSX_BASE_URL=https://marsx-global-engine.onrender.com node scripts/changenow-readonly-smoke.mjs
const base = (process.env.MARSX_BASE_URL || 'http://127.0.0.1:10000').replace(/\/$/, '');
const timeoutMs = 20000;
const cases = [
  ['/health', 'backend'],
  ['/fiat/integration', 'fiat-safety'],
  ['/convert/health', 'configuration'],
  ['/changenow/health', 'provider'],
  ['/changenow/currencies', 'currencies'],
  ['/changenow/min-amount?fromCurrency=btc&toCurrency=eth&fromNetwork=btc&toNetwork=eth', 'minimum'],
  ['/changenow/quote?fromCurrency=btc&toCurrency=eth&fromAmount=0.01&fromNetwork=btc&toNetwork=eth', 'quote'],
];
let failed = false;
for (const [path, name] of cases) {
  try {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { Accept: 'application/json' } });
    const payload = await response.json();
    const configured = typeof payload.configured === 'boolean' ? payload.configured : undefined;
    const executionReady = typeof payload.executionReady === 'boolean' ? payload.executionReady : undefined;
    const fiatSafe = name !== 'fiat-safety' || (payload.mode === 'DEMO_ONLY' && payload.checkoutEnabled === false && payload.iframeEnabled === false && payload.redirectEnabled === false && payload.providerCheckoutUrl === null);
    const ok = response.ok && fiatSafe && !(name === 'provider' && payload.lastStatus) && !(name === 'provider' && configured === false);
    if (!ok) failed = true;
    console.log(JSON.stringify({ check: name, status: response.status, ok, ...(configured === undefined ? {} : { configured }), ...(executionReady === undefined ? {} : { executionReady }), errorCode: ok ? undefined : (payload.error?.code || payload.lastStatus?.code || 'CHECK_FAILED') }));
  } catch (e) {
    failed = true;
    console.log(JSON.stringify({ check: name, ok: false, errorCode: e.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_OR_JSON_ERROR' }));
  }
}
if (failed) process.exitCode = 1;
