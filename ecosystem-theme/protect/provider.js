const PROVIDERS = new Set(["sandbox", "komodi", "qover", "wakam", "meetch"]);

export function protectConfig(env = process.env) {
  const provider = String(env.MARSX_PROTECT_PROVIDER || "sandbox").toLowerCase();
  if (!PROVIDERS.has(provider)) throw new Error("protect_provider_unsupported");
  return {
    provider,
    live: String(env.MARSX_PROTECT_LIVE || "").toLowerCase() === "true",
    regulatoryGate: String(env.MARSX_PROTECT_REGULATORY_GATE || "").toLowerCase() === "approved",
    partnerContract: String(env.MARSX_PROTECT_PARTNER_CONTRACT || "").toLowerCase() === "signed",
  };
}

export function normalizeMoneyMinor(value) {
  const units = Number(value);
  if (!Number.isSafeInteger(units) || units < 0) throw new Error("protect_invalid_money");
  return units;
}

export class ProtectProvider {
  async getProducts() { throw new Error("not_implemented"); }
  async createQuote() { throw new Error("not_implemented"); }
  async acceptQuote() { throw new Error("not_implemented"); }
  async getPolicy() { throw new Error("not_implemented"); }
  async cancelPolicy() { throw new Error("not_implemented"); }
  async startClaim() { throw new Error("not_implemented"); }
  async getClaim() { throw new Error("not_implemented"); }
  async getCommissionLedger() { throw new Error("not_implemented"); }
}

export class SandboxProtectProvider extends ProtectProvider {
  constructor() {
    super();
    this.quotes = new Map();
    this.policies = new Map();
  }

  async getProducts(country = "FR") {
    return [{ id: "device-protection-demo", country, name: "Device Protection", sandbox: true, currency: "EUR" }];
  }

  async createQuote(productId, context = {}) {
    if (productId !== "device-protection-demo") throw new Error("protect_product_unknown");
    const quote = {
      id: `quote_demo_${crypto.randomUUID()}`,
      productId, premiumMinor: 499, currency: "EUR", sandbox: true,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      context: { country: String(context.country || "FR").slice(0, 2).toUpperCase() },
    };
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async acceptQuote(quoteId, consent = {}) {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new Error("protect_quote_unknown");
    if (consent.accepted !== true) throw new Error("protect_consent_required");
    const policy = {
      id: `policy_demo_${crypto.randomUUID()}`, quoteId, status: "sandbox_active", sandbox: true,
      insurer: "DEMO ONLY — NO COVERAGE", premiumMinor: normalizeMoneyMinor(quote.premiumMinor), currency: quote.currency,
    };
    this.policies.set(policy.id, policy);
    return policy;
  }

  async getPolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error("protect_policy_unknown");
    return policy;
  }
}

class PendingPartnerProvider extends ProtectProvider {
  constructor(name) { super(); this.name = name; }
  fail() { throw new Error(`protect_${this.name}_credentials_or_contract_missing`); }
  async getProducts() { return this.fail(); }
  async createQuote() { return this.fail(); }
  async acceptQuote() { return this.fail(); }
  async getPolicy() { return this.fail(); }
  async cancelPolicy() { return this.fail(); }
  async startClaim() { return this.fail(); }
  async getClaim() { return this.fail(); }
  async getCommissionLedger() { return this.fail(); }
}

export function createProtectProvider(env = process.env) {
  const config = protectConfig(env);
  if (config.provider === "sandbox") {
    if (config.live) throw new Error("protect_sandbox_cannot_be_live");
    return new SandboxProtectProvider();
  }
  if (!config.live) return new PendingPartnerProvider(config.provider);
  if (!config.partnerContract || !config.regulatoryGate) {
    throw new Error("protect_live_blocked_until_partner_contract_and_regulatory_gate");
  }
  // Partner endpoints and credentials are intentionally not guessed.
  // Replace this gate with the documented provider adapter after credentials are issued.
  return new PendingPartnerProvider(config.provider);
}
