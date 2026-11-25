/**
 * Read-only runtime configuration loader for short-lived Supabase isolates.
 * Deduplicate concurrent Vault reads; retry only a known transient connection
 * failure once. Never cache failed reads or log secrets/connection strings.
 */
const RETRYABLE_CONNECTION_CODES = new Set([
  "CONNECT_TIMEOUT", "ETIMEDOUT", "ECONNRESET", "EPIPE",
]);

export function retryableConnectionError(error) {
  return RETRYABLE_CONNECTION_CODES.has(error?.code);
}

export function createRuntimeConfigLoader(readConfig, {
  ttlMs = 60_000,
  retryDelayMs = 250,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let cached = null;
  let expiresAt = 0;
  let inFlight = null;

  return function getConfig() {
    if (cached !== null && now() < expiresAt) return Promise.resolve(cached);
    if (inFlight) return inFlight;
    inFlight = (async () => {
      let config;
      try {
        config = await readConfig();
      } catch (error) {
        if (!retryableConnectionError(error)) throw error;
        await sleep(retryDelayMs);
        config = await readConfig();
      }
      cached = config;
      expiresAt = now() + ttlMs;
      return config;
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}
