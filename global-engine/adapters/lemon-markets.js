import { VenueAdapter } from "../venue.js";

const trimSlash=(s)=>String(s||"").replace(/\/+$/,"");
const enc=(v)=>encodeURIComponent(String(v));
const nonEmpty=(v,name)=>{ if(!v) throw new Error(`${name} required`); return v; };

export class LemonBrokerAdapter extends VenueAdapter {
  constructor({
    apiKey=process.env.LEMON_MARKETS_API_KEY,
    baseUrl=process.env.LEMON_MARKETS_BASE_URL || "https://sandbox.api.lemon.markets/v1",
    allowOrderSubmission=process.env.MARSX_LEMON_ALLOW_ORDERS==="true",
    allowWithdrawals=process.env.MARSX_LEMON_ALLOW_WITHDRAWALS==="true"
  }={}) {
    super("lemon-markets",["EQUITY","ETF"]);
    this.apiKey=apiKey; this.baseUrl=trimSlash(baseUrl);
    this.allowOrderSubmission=allowOrderSubmission;
    this.allowWithdrawals=allowWithdrawals;
    this.mode="sandbox-gated";
  }

  configured(){ return Boolean(this.apiKey); }

  headers({principal,justification,idempotencyKey,body=false}={}) {
    if(!this.apiKey) throw new Error("lemon.markets API credential is not configured");
    nonEmpty(principal,"privacy principal");
    nonEmpty(justification,"privacy justification");
    return {
      "Authorization":`Bearer ${this.apiKey}`,
      "Accept":"application/json",
      "LMG-Data-Privacy-Access-Principal":String(principal),
      "LMG-Data-Privacy-Access-Justification":String(justification),
      ...(idempotencyKey?{"Idempotency-Key":String(idempotencyKey)}:{}),
      ...(body?{"Content-Type":"application/json"}:{})
    };
  }

  async request(path,{method="GET",body,principal="backend-marsx",justification="service.operation",idempotencyKey}={}) {
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),8000);
    try {
      const res=await fetch(`${this.baseUrl}${path}`,{
        method,headers:this.headers({principal,justification,idempotencyKey,body:body!==undefined}),
        body:body!==undefined?JSON.stringify(body):undefined,signal:controller.signal
      });
      const text=await res.text(); let payload={};
      if(text){ try{ payload=JSON.parse(text); }catch{ payload={raw:text.slice(0,500)}; } }
      if(!res.ok) throw new Error(`lemon.markets HTTP ${res.status}`);
      return payload;
    } finally { clearTimeout(timeout); }
  }

  getAgreements(ctx={}) { return this.request("/agreements",{...ctx,justification:ctx.justification||"open_account"}); }
  createAccount(payload,ctx={}) {
    nonEmpty(payload,"account payload");
    return this.request("/accounts",{method:"POST",body:payload,...ctx,justification:ctx.justification||"open_account"});
  }
  getAccount(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}`,{...ctx,justification:ctx.justification||"onboarding.display_cash_account"});
  }
  getOnboardingChecks(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}/checks`,{...ctx,justification:ctx.justification||"onboarding.check_status"});
  }
  startIdentityVerification(accountId,{redirectSuccess,redirectFailure},ctx={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(redirectSuccess,"redirectSuccess"); nonEmpty(redirectFailure,"redirectFailure");
    return this.request(`/accounts/${enc(accountId)}/identity_verification`,{
      method:"POST",body:{redirect_success:redirectSuccess,redirect_failure:redirectFailure},...ctx,
      justification:ctx.justification||"onboarding.identity_verification"
    });
  }
  setExperience(accountId,payload,ctx={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(payload,"experience payload");
    return this.request(`/accounts/${enc(accountId)}/experience`,{
      method:"POST",body:payload,...ctx,justification:ctx.justification||"onboarding.knowledge_and_experience"
    });
  }
  getPositions(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}/positions`,{...ctx,justification:ctx.justification||"portfolio.positions"});
  }
  createWebhook({url,events},ctx={}) {
    nonEmpty(url,"webhook url");
    if(!Array.isArray(events)||events.length===0) throw new Error("webhook events required");
    return this.request("/webhooks",{method:"POST",body:{url,events},...ctx,justification:ctx.justification||"webhook.configure"});
  }
  async createOrder(accountId,payload,{submit=false,principal="backend-marsx",justification="order.create",idempotencyKey}={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(payload,"order payload");
    if(!this.allowOrderSubmission) throw new Error("lemon.markets order submission disabled");
    const created=await this.request(`/accounts/${enc(accountId)}/orders`,{
      method:"POST",body:payload,principal,justification,idempotencyKey
    });
    if(!submit) return {created,submitted:false};
    const orderId=created?.results?.id??created?.id;
    if(!orderId) throw new Error("lemon.markets order id missing");
    const submitted=await this.request(`/accounts/${enc(accountId)}/orders/${enc(orderId)}/activate`,{
      method:"PUT",principal,justification:"order.activate"
    });
    return {created,submitted};
  }
  createWithdrawal(accountId,{amount,currency="EUR"},ctx={}) {
    nonEmpty(accountId,"accountId");
    if(!this.allowWithdrawals) throw new Error("lemon.markets withdrawals disabled");
    if(!amount) throw new Error("withdrawal amount required");
    return this.request(`/accounts/${enc(accountId)}/withdrawals`,{
      method:"POST",body:{amount:String(amount),currency},...ctx,justification:ctx.justification||"withdrawal.create"
    });
  }
  async placeOrder(){ throw new Error("generic live execution disabled; use explicit sandbox createOrder gate"); }
}
