// Only provider GET quotes and the fixed, read-only estimateconversion RPC are permitted.
// It never creates an exchange, touches a balance, or signs a transaction.
const PLATFORM_FEE_BPS = 200n;
const CHANGE_NOW = "https://api.changenow.io";
const VERUS_PUBLIC_RPC = "https://api.verus.services/";
const VRSC_ID = "i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV";
const VETH_ID = "i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X";
const BRIDGE_POOL_ID = "i3f7tSctFkiPpiedY8QR5Tep9p4qDVebDx";

function result(status, body) {
  return { status, body: { ...body, executionEnabled: false, withdrawable: false } };
}

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function decimal(units, precision) {
  const digits = units.toString().padStart(precision + 1, "0");
  const fraction = digits.slice(-precision).replace(/0+$/, "");
  return `${digits.slice(0, -precision)}${fraction ? `.${fraction}` : ""}`;
}

function amountAfterFee(value, precision) {
  const input = String(value ?? "");
  if (!new RegExp(`^(?:0|[1-9][0-9]{0,11})(?:\\.[0-9]{1,${precision}})?$`).test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const units = BigInt(whole + fraction.padEnd(precision, "0"));
  if (units <= 0n) return null;
  // Round the service fee up to one input asset unit; do not use floating point.
  const fee = (units * PLATFORM_FEE_BPS + 9_999n) / 10_000n;
  if (units <= fee) return null;
  return {
    grossInput: decimal(units, precision),
    platformFeeInput: decimal(fee, precision),
    providerInput: decimal(units - fee, precision),
    platformFeeBps: Number(PLATFORM_FEE_BPS),
    feeAssetDecimals: precision,
    feeRounding: "up_to_input_asset_unit",
  };
}

function assetCode(value) {
  const code = String(value || "").toLowerCase();
  return /^[a-z0-9_-]{2,20}$/.test(code) ? code : null;
}

// Only asset/network combinations with known native precision are accepted.
// VRSC is included to report the provider's unsupported asset response safely.
function inputPrecision(currency, network) {
  if (currency === "eth" && network === "eth") return 18;
  if (currency === "sol" && network === "sol") return 9;
  if (currency === "vrsc" && network === "vrsc") return 8;
  return null;
}

function scalar(value) {
  return typeof value === "number" && Number.isFinite(value) ? value
    : typeof value === "string" && /^[0-9]+(?:\.[0-9]+)?$/.test(value) ? value : null;
}

function quoteFields(data) {
  if (!data || typeof data !== "object") return null;
  const fromAmount = scalar(data.fromAmount);
  const toAmount = scalar(data.toAmount);
  if (fromAmount === null || toAmount === null || Number(fromAmount) <= 0 || Number(toAmount) <= 0) return null;
  return {
    fromAmount, toAmount,
    depositFee: scalar(data.depositFee), withdrawalFee: scalar(data.withdrawalFee),
    flow: "standard", type: "direct",
    transactionSpeedForecast: typeof data.transactionSpeedForecast === "string"
      && /^[0-9-]{1,20}$/.test(data.transactionSpeedForecast) ? data.transactionSpeedForecast : null,
    // Floating quotes do not lock a rate or authorize an exchange.
    rateLocked: false,
  };
}

async function providerGet(fetchImpl, url, headers = {}) {
  try {
    const response = await fetchImpl(url, {
      method: "GET", redirect: "error",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(8_000),
    });
    let data;
    try { data = await response.json(); }
    catch { return { ok: false, status: 502, error: "provider_invalid_response" }; }
    if (!response.ok) {
      // Do not forward arbitrary provider bodies/messages: they can contain secrets.
      const status = response.status;
      return {
        ok: false,
        status: status === 400 || status === 422 ? 422 : status === 401 || status === 403 || status === 429 ? 503 : 502,
        error: status === 400 || status === 422 ? "provider_quote_unavailable"
          : status === 401 || status === 403 ? "provider_authentication_failed"
          : status === 429 ? "provider_rate_limited" : "provider_unavailable",
        providerStatus: status,
      };
    }
    return { ok: true, data };
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { ok: false, status: timeout ? 504 : 502, error: timeout ? "provider_timeout" : "provider_unavailable" };
  }
}

function providerFailure(response, provider) {
  return result(response.status, {
    error: response.error, provider,
    ...(response.providerStatus ? { providerStatus: response.providerStatus } : {}),
  });
}

async function publicVerusEstimate(fetchImpl, amount) {
  try {
    // amount is a validated decimal from amountAfterFee. Emit its exact JSON
    // number token rather than rounding it through JavaScript's Number type.
    const body = `{"jsonrpc":"2.0","id":"marsx-readonly-estimate","method":"estimateconversion","params":[{"currency":"VRSC","convertto":"vETH","via":"Bridge.vETH","amount":${amount}}]}`;
    const response = await fetchImpl(VERUS_PUBLIC_RPC, {
      method: "POST", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body, signal: AbortSignal.timeout(8_000),
    });
    let data;
    try { data = await response.json(); }
    catch { return result(502, { error: "provider_invalid_response", provider: "VerusPublicRPC" }); }
    if (!response.ok || data?.error) {
      return result(response.status === 429 ? 503 : 502, {
        error: "verus_estimate_unavailable", provider: "VerusPublicRPC",
        ...(Number.isInteger(data?.error?.code) ? { providerErrorCode: data.error.code } : {}),
      });
    }
    const estimate = data?.result;
    const output = scalar(estimate?.estimatedcurrencyout);
    const netInput = scalar(estimate?.netinputamount);
    if (!estimate || estimate.inputcurrencyid !== VRSC_ID || estimate.outputcurrencyid !== VETH_ID
      || estimate.estimatedcurrencystate?.currencyid !== BRIDGE_POOL_ID
      || output === null || netInput === null || Number(output) <= 0 || Number(netInput) <= 0
      || Number(netInput) > Number(amount)) {
      return result(502, { error: "provider_invalid_response", provider: "VerusPublicRPC" });
    }
    return result(200, {
      provider: "VerusPublicRPC", mode: "read_only", estimateContractVerified: true,
      estimate: {
        fromCurrencyId: VRSC_ID, toCurrencyId: VETH_ID, viaCurrencyId: BRIDGE_POOL_ID,
        netInputAfterProviderConversionFee: netInput, toAmount: output,
      },
      quoteScope: "verus_chain_conversion_only;ethereum_bridge_and_fees_not_quoted",
      providerFees: "included_in_provider_net_input_and_output_estimate",
      nativeEthDelivered: false, bridgeVerified: false, fullRouteVerified: false,
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return result(timeout ? 504 : 502, { error: timeout ? "provider_timeout" : "verus_estimate_unavailable", provider: "VerusPublicRPC" });
  }
}

function readiness(env) {
  const changeNowConfigured = configured(env.CHANGENOW_API_KEY);
  const verusConfigured = configured(env.VERUS_SCAN_API_KEY);
  return {
    mode: "read_only",
    route: "VRSC -> vETH on Verus -> native ETH on Ethereum -> ChangeNOW -> SOL",
    fullRouteVerified: false,
    verusEstimateAccess: "public_rpc_no_api_key",
    verusEstimateProvider: VERUS_PUBLIC_RPC,
    credentials: { changeNowConfigured, verusConfigured, treasurySignerVerified: false },
    platformFeeBps: Number(PLATFORM_FEE_BPS),
    blockers: [
      ...(!changeNowConfigured ? ["changenow_api_key_required"] : []),
      "verus_to_ethereum_bridge_not_verified",
      "treasury_signer_not_verified",
      "live_execution_not_implemented",
      "explicit_user_approval_required_before_spending_or_signing",
    ],
  };
}

export async function readOnlyConversion({ method, pathname, data = {}, env = {}, fetchImpl = fetch }) {
  if (method === "GET" && pathname === "/conversion/readiness") return result(200, readiness(env));
  if (method === "POST" && pathname === "/conversion/execute") {
    // Intentionally unconditional, including when unlock flags or signer secrets exist.
    return result(503, { error: "conversion_execution_disabled", ...readiness(env) });
  }
  if (method === "POST" && (!data || typeof data !== "object" || Array.isArray(data))) {
    return result(400, { error: "invalid_json_object" });
  }
  if (method === "GET" && pathname === "/conversion/changenow-status") {
    const response = await providerGet(fetchImpl, `${CHANGE_NOW}/v2/exchange/currencies`);
    if (!response.ok) return providerFailure(response, "ChangeNOW");
    if (!Array.isArray(response.data)) return result(502, { error: "provider_invalid_response" });
    const supports = (currency, network) => response.data.some((item) => item?.ticker === currency && item?.network === network);
    return result(200, {
      provider: "ChangeNOW", apiKeyConfigured: configured(env.CHANGENOW_API_KEY),
      credentialVerifiedByThisRequest: false, // currencies is a public endpoint
      supported: { vrsc: supports("vrsc", "vrsc"), eth: supports("eth", "eth"), sol: supports("sol", "sol") },
      fullRouteVerified: false,
    });
  }
  if (method === "POST" && pathname === "/conversion/changenow-quote") {
    if (!configured(env.CHANGENOW_API_KEY)) return result(503, { error: "changenow_api_key_required" });
    const fromCurrency = assetCode(data.fromCurrency);
    const fromNetwork = assetCode(data.fromNetwork);
    const toCurrency = assetCode(data.toCurrency);
    const toNetwork = assetCode(data.toNetwork);
    const precision = inputPrecision(fromCurrency, fromNetwork);
    // Initially restrict output to native Solana; other routes require independent validation.
    if (!precision || toCurrency !== "sol" || toNetwork !== "sol" || fromCurrency === toCurrency) {
      return result(400, { error: "unsupported_asset_network_pair" });
    }
    const fee = amountAfterFee(data.amount, precision);
    if (!fee) return result(400, { error: "invalid_amount" });
    const params = new URLSearchParams({ fromCurrency, fromNetwork, toCurrency, toNetwork, fromAmount: fee.providerInput, flow: "standard" });
    const response = await providerGet(fetchImpl, `${CHANGE_NOW}/v2/exchange/estimated-amount?${params}`, {
      "x-changenow-api-key": env.CHANGENOW_API_KEY,
    });
    if (!response.ok) return providerFailure(response, "ChangeNOW");
    const quote = quoteFields(response.data);
    if (!quote || response.data.fromCurrency !== fromCurrency || response.data.fromNetwork !== fromNetwork
      || response.data.toCurrency !== toCurrency || response.data.toNetwork !== toNetwork
      || Number(quote.fromAmount) !== Number(fee.providerInput)) {
      return result(502, { error: "provider_invalid_response", provider: "ChangeNOW" });
    }
    return result(200, {
      provider: "ChangeNOW", mode: "read_only", credentialVerifiedByThisRequest: true,
      fromCurrency, fromNetwork, toCurrency, toNetwork,
      ...fee, quote, fullRouteVerified: false,
      quoteScope: "standalone_input_after_marsx_fee;not_a_full_verus_route_quote",
      providerFees: "provider_reported;do_not_subtract_again",
    });
  }
  if (method === "POST" && pathname === "/conversion/verus-estimate") {
    const fee = amountAfterFee(data.amountVrsc, 8);
    if (!fee) return result(400, { error: "invalid_amount" });
    const target = String(data.toCurrency || "vETH").toLowerCase();
    // ETH is a compatibility alias for the Verus-chain vETH quote, never native ETH.
    if (target !== "veth" && target !== "eth") return result(400, { error: "unsupported_verus_target" });
    const response = await publicVerusEstimate(fetchImpl, fee.providerInput);
    if (response.status !== 200) return response;
    return result(200, { ...response.body, fromCurrency: "VRSC", toCurrency: "vETH", toNetwork: "verus", ...fee });
  }
  return result(404, { error: "not_found" });
}
