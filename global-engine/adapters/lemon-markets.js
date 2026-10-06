import { VenueAdapter } from "../venue.js";

const trimSlash = (s) => String(s || "").replace(/\/+$/, "");

export class LemonBrokerAdapter extends VenueAdapter {
  constructor({
    apiKey=process.env.LEMON_MARKETS_API_KEY,
    baseUrl=process.env.LEMON_MARKETS_BASE_URL || "https://paper-trading.lemon.markets/v1",
    allowOrderSubmission=process.env.MARSX_LEMON_ALLOW_ORDERS === "true"
  }={}) {
    super("lemon-markets",["EQUITY","ETF"]);
    this.apiKey=apiKey;
    this.baseUrl=trimSlash(baseUrl);
    this.allowOrderSubmission=allowOrderSubmission;
    this.mode="sandbox-gated";
  }

  configured(){ return Boolean(this.apiKey); }

  headers(extra={}) {
    if(!this.apiKey) throw new Error("lemon.markets API credential is not configured");
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Accept":"application/json",
      ...extra
    };
  }

  async request(path,{method="GET",body}={}) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      const res=await fetch(`${this.baseUrl}${path}`,{
        method,
        headers:this.headers(body ? {"Content-Type":"application/json"} : {}),
        body:body ? JSON.stringify(body) : undefined,
        signal:controller.signal
      });
      const text=await res.text();
      let payload={};
      if(text) {
        try { payload=JSON.parse(text); } catch { payload={raw:text.slice(0,500)}; }
      }
      if(!res.ok) throw new Error(`lemon.markets HTTP ${res.status}`);
      return payload;
    } finally { clearTimeout(timeout); }
  }

  async getAccount(accountId) {
    if(!accountId) throw new Error("accountId required");
    return this.request(`/accounts/${encodeURIComponent(accountId)}`);
  }

  async getPositions(accountId) {
    if(!accountId) throw new Error("accountId required");
    return this.request(`/accounts/${encodeURIComponent(accountId)}/positions`);
  }

  async createOrder(accountId,payload,{submit=false}={}) {
    if(!accountId) throw new Error("accountId required");
    if(!payload || typeof payload!=="object") throw new Error("order payload required");
    if(!this.allowOrderSubmission) throw new Error("lemon.markets order submission disabled");
    const created=await this.request(
      `/accounts/${encodeURIComponent(accountId)}/orders`,
      {method:"POST",body:payload}
    );
    if(!submit) return {created,submitted:false};
    const orderId=created?.results?.id ?? created?.id;
    if(!orderId) throw new Error("lemon.markets order id missing");
    const submitted=await this.request(
      `/accounts/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}/activate`,
      {method:"PUT"}
    );
    return {created,submitted};
  }

  async placeOrder() {
    throw new Error("generic live execution disabled; use explicit sandbox createOrder gate");
  }
}
