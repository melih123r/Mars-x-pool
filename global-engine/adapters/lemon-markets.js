import { VenueAdapter } from "../venue.js";

const trimSlash=(s)=>String(s||"").replace(/\/+$/,"");
const ALLOWED_LEMON_HOSTS=new Set(["sandbox.api.lemon.markets","dev-brokerage.lemon.markets"]);
const validateBaseUrl=(value)=>{
  const normalized=trimSlash(value);
  const url=new URL(normalized);
  if(url.protocol!=="https:" || !ALLOWED_LEMON_HOSTS.has(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new Error("invalid lemon.markets base URL");
  }
  if(url.pathname!=="/v1") throw new Error("invalid lemon.markets API version path");
  return normalized;
};
const enc=(v)=>encodeURIComponent(String(v));
const validateIdempotencyKey=(value)=>{
  if(typeof value!=="string"||value.length<1||value.length>100||/[\r\n]/.test(value)) throw new Error("invalid idempotency key");
  return value;
};
const nonEmpty=(v,name)=>{ if(!v) throw new Error(`${name} required`); return v; };
const validateRedirectUri=(value,name)=>{
  nonEmpty(value,name);
  const url=new URL(String(value));
  if(url.username||url.password||url.hash) throw new Error(`${name} invalid`);
  if(url.protocol==="https:") return String(value);
  if(url.protocol==="marsx:" && !url.host) return String(value);
  throw new Error(`${name} invalid`);
};

export class LemonBrokerAdapter extends VenueAdapter {
  constructor({
    apiKey=process.env.LEMON_MARKETS_API_KEY,
    baseUrl=process.env.LEMON_MARKETS_BASE_URL || "https://sandbox.api.lemon.markets/v1",
    allowOrderSubmission=process.env.MARSX_LEMON_ALLOW_ORDERS==="true",
    allowWithdrawals=process.env.MARSX_LEMON_ALLOW_WITHDRAWALS==="true",
    timeoutMs=8000
  }={}) {
    super("lemon-markets",["EQUITY","ETF"]);
    this.apiKey=apiKey; this.baseUrl=validateBaseUrl(baseUrl);
    this.allowOrderSubmission=allowOrderSubmission;
    this.allowWithdrawals=allowWithdrawals;
    this.timeoutMs=Number(timeoutMs);
    if(!Number.isFinite(this.timeoutMs)||this.timeoutMs<1||this.timeoutMs>30000) throw new Error("invalid lemon.markets timeout");
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

  async request(path,{method="GET",body,principal,justification,idempotencyKey}={}) {
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const res=await fetch(`${this.baseUrl}${path}`,{
        method,headers:this.headers({principal,justification,idempotencyKey,body:body!==undefined}),
        body:body!==undefined?JSON.stringify(body):undefined,signal:controller.signal,redirect:"error"
      });
      const text=await res.text(); let payload={};
      if(text){ try{ payload=JSON.parse(text); }catch{ if(res.ok) throw new Error("lemon.markets invalid JSON response"); } }
      if(!res.ok) throw new Error(`lemon.markets HTTP ${res.status}`);
      return payload;
    } finally { clearTimeout(timeout); }
  }

  getAgreements(ctx={}) { return this.request("/agreements",{...ctx,justification:ctx.justification||"open_account"}); }
  createAccount(payload,ctx={}) {
    nonEmpty(payload,"account payload");
    if(typeof payload!=="object"||Array.isArray(payload)) throw new Error("invalid account payload");
    if(!payload.customer||typeof payload.customer!=="object"||Array.isArray(payload.customer)) throw new Error("customer required");
    if(!Array.isArray(payload.accepted_agreements)||payload.accepted_agreements.length===0) throw new Error("accepted agreements required");
    for(const item of payload.accepted_agreements){
      if(!item||typeof item!=="object"||!item.agreement_id||!item.accepted_at) throw new Error("invalid accepted agreement");
      if(Number.isNaN(Date.parse(String(item.accepted_at)))) throw new Error("invalid agreement acceptance timestamp");
    }
    if(typeof payload.declaration_of_acting_on_own_account!=="boolean") throw new Error("acting-on-own-account declaration required");
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
    nonEmpty(accountId,"accountId"); validateRedirectUri(redirectSuccess,"redirectSuccess"); validateRedirectUri(redirectFailure,"redirectFailure");
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
  createAuthenticator(accountId,payload,ctx={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(payload,"authenticator payload");
    nonEmpty(payload.name,"authenticator name");
    nonEmpty(payload.public_key,"authenticator public key");
    nonEmpty(payload.client_credential_id,"client credential id");
    nonEmpty(payload.verification,"authenticator verification");
    if(payload.recovery_code!==undefined && !/^\d{6}$/.test(String(payload.recovery_code))) throw new Error("invalid recovery code");
    return this.request(`/accounts/${enc(accountId)}/authenticators`,{
      method:"POST",body:payload,...ctx,justification:ctx.justification||"sca.authenticator.enroll"
    });
  }
  listAuthenticators(accountId,{limit=100,cursor}={},ctx={}) {
    nonEmpty(accountId,"accountId");
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid authenticator limit");
    const q=new URLSearchParams(); q.set("limit",String(n)); if(cursor) q.set("cursor",String(cursor));
    return this.request(`/accounts/${enc(accountId)}/authenticators?${q.toString()}`,{...ctx,justification:ctx.justification||"sca.authenticator.list"});
  }
  listInstruments({type,limit=100,cursor}={},ctx={}) {
    if(type && !["stock","etf","fund"].includes(type)) throw new Error("invalid instrument type");
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid instrument limit");
    const q=new URLSearchParams(); q.set("limit",String(n)); if(type) q.set("type",type); if(cursor) q.set("cursor",String(cursor));
    return this.request(`/instruments?${q.toString()}`,{...ctx,justification:ctx.justification||"market.instruments"});
  }
  listProductContracts({type="brokerage",limit=100,cursor}={},ctx={}) {
    if(!["brokerage","retirement"].includes(type)) throw new Error("invalid product contract type");
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid product contract limit");
    const q=new URLSearchParams(); q.set("limit",String(n)); q.set("type",type); if(cursor) q.set("cursor",String(cursor));
    return this.request(`/product_contracts?${q.toString()}`,{...ctx,justification:ctx.justification||"market.product_contracts"});
  }
  createSecuritiesAccount(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}/securities_accounts`,{
      method:"POST",...ctx,justification:ctx.justification||"securities_account.create"
    });
  }
  getPositions(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}/positions`,{...ctx,justification:ctx.justification||"portfolio.positions"});
  }
  getTrades(accountId,ctx={}) {
    nonEmpty(accountId,"accountId");
    return this.request(`/accounts/${enc(accountId)}/trades`,{...ctx,justification:ctx.justification||"portfolio.trades"});
  }
  listOrders(accountId,{limit=100,cursor,status,securitiesAccount}={},ctx={}) {
    nonEmpty(accountId,"accountId");
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid order list limit");
    const allowed=new Set(["accepted","canceled","canceling","confirmed","created","executed","rejected"]);
    if(status && !allowed.has(status)) throw new Error("invalid order status");
    const q=new URLSearchParams(); q.set("limit",String(n)); if(cursor) q.set("cursor",String(cursor)); if(status) q.set("status",status); if(securitiesAccount) q.set("securities_account",String(securitiesAccount));
    return this.request(`/accounts/${enc(accountId)}/orders?${q.toString()}`,{...ctx,justification:ctx.justification||"portfolio.orders"});
  }
  listTransactions(accountId,{limit=100,cursor}={},ctx={}) {
    nonEmpty(accountId,"accountId");
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid transaction list limit");
    const q=new URLSearchParams(); q.set("limit",String(n)); if(cursor) q.set("cursor",String(cursor));
    return this.request(`/accounts/${enc(accountId)}/transactions?${q.toString()}`,{...ctx,justification:ctx.justification||"portfolio.transactions"});
  }
  listAccounts({limit=100,cursor,status,personCustomer=true}={},ctx={}) {
    const n=Number(limit); if(!Number.isInteger(n)||n<1||n>100) throw new Error("invalid account list limit");
    const allowed=new Set(["closed","created","opened","rejected"]);
    if(status && !allowed.has(status)) throw new Error("invalid account status");
    const q=new URLSearchParams(); q.set("limit",String(n)); if(cursor) q.set("cursor",String(cursor)); if(status) q.set("status",status); q.set("person_customer",personCustomer?"true":"false");
    return this.request(`/accounts?${q.toString()}`,{...ctx,justification:ctx.justification||"onboarding.account_list"});
  }
  createWebhook({url,events},ctx={}) {
    nonEmpty(url,"webhook url");
    const target=new URL(String(url));
    if(target.protocol!=="https:"||target.username||target.password||target.hash) throw new Error("invalid webhook url");
    if(!Array.isArray(events)||events.length===0||events.some(x=>typeof x!=="string"||!/^[a-z0-9_.-]+$/i.test(x))) throw new Error("webhook events required");
    return this.request("/webhooks",{method:"POST",body:{url:String(url),events},...ctx,justification:ctx.justification||"webhook.configure"});
  }
  async createOrder(accountId,payload,{confirm=false,sca,principal,justification="order.create",idempotencyKey}={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(payload,"order payload");
    if(!this.allowOrderSubmission) throw new Error("lemon.markets order submission disabled");
    validateIdempotencyKey(idempotencyKey);
    const created=await this.request(`/accounts/${enc(accountId)}/orders`,{
      method:"POST",body:payload,principal,justification,idempotencyKey
    });
    if(!confirm) return {created,confirmed:false};
    const orderId=created?.data?.id??created?.results?.id??created?.id;
    if(!orderId) throw new Error("lemon.markets order id missing");
    if(!sca || typeof sca!=="object" || Array.isArray(sca)) throw new Error("SCA confirmation required");
    const confirmed=await this.confirmOrder(accountId,orderId,sca,{principal});
    return {created,confirmed};
  }
  confirmOrder(accountId,orderId,sca,ctx={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(orderId,"orderId");
    if(!this.allowOrderSubmission) throw new Error("lemon.markets order submission disabled");
    if(!sca || typeof sca!=="object" || Array.isArray(sca)) throw new Error("SCA confirmation required");
    return this.request(`/accounts/${enc(accountId)}/orders/${enc(orderId)}/confirm`,{
      method:"POST",body:{sca},...ctx,justification:ctx.justification||"order.confirm"
    });
  }
  createWithdrawal(accountId,{amount,currency="EUR"},ctx={}) {
    nonEmpty(accountId,"accountId");
    if(!this.allowWithdrawals) throw new Error("lemon.markets withdrawals disabled");
    if(!amount) throw new Error("withdrawal amount required");
    return this.request(`/accounts/${enc(accountId)}/withdrawals`,{
      method:"POST",body:{amount:String(amount),currency},...ctx,justification:ctx.justification||"withdrawal.create"
    });
  }
  confirmWithdrawal(accountId,withdrawalId,sca,ctx={}) {
    nonEmpty(accountId,"accountId"); nonEmpty(withdrawalId,"withdrawalId");
    if(!this.allowWithdrawals) throw new Error("lemon.markets withdrawals disabled");
    if(!sca || typeof sca!=="object" || Array.isArray(sca)) throw new Error("SCA confirmation required");
    return this.request(`/accounts/${enc(accountId)}/withdrawals/${enc(withdrawalId)}/confirm`,{
      method:"POST",body:{sca},...ctx,justification:ctx.justification||"withdrawal.confirm"
    });
  }
  async placeOrder(){ throw new Error("generic live execution disabled; use explicit sandbox createOrder gate"); }
}
