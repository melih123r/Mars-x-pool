export const BROKER_ACCOUNT_STATES=Object.freeze(["DRAFT","KYC_PENDING","ACTIVE","SUSPENDED","CLOSED"]);
export const BROKER_ORDER_STATES=Object.freeze(["NEW","PENDING_SUBMIT","SUBMITTED","PARTIALLY_FILLED","FILLED","CANCEL_PENDING","CANCELLED","REJECTED","EXPIRED"]);

const finitePositive=(v,name)=>{ const n=Number(v); if(!Number.isFinite(n)||n<=0) throw new Error(`${name} must be finite and positive`); return n; };

export class BrokerLedger {
  constructor(){ this.entries=[]; this.keys=new Set(); }
  post({idempotencyKey,accountId,debit,credit,amount,currency="EUR",type,reference}){
    if(!idempotencyKey) throw new Error("idempotencyKey required");
    if(this.keys.has(idempotencyKey)) return {duplicate:true};
    if(!accountId||!debit||!credit||debit===credit||!type) throw new Error("invalid ledger entry");
    const entry=Object.freeze({id:crypto.randomUUID(),idempotencyKey,accountId,debit,credit,amount:finitePositive(amount,"amount"),currency,type,reference:reference||null,at:new Date().toISOString()});
    this.keys.add(idempotencyKey); this.entries.push(entry); return entry;
  }
  list(accountId){ return this.entries.filter(x=>x.accountId===accountId); }
}

export class BrokerOrderStore {
  constructor(){ this.orders=new Map(); this.keys=new Map(); }
  create({accountId,idempotencyKey,symbol,side,type="MARKET",quantity}){
    if(!accountId||!idempotencyKey||!symbol) throw new Error("missing order field");
    if(this.keys.has(idempotencyKey)) return this.orders.get(this.keys.get(idempotencyKey));
    if(!["BUY","SELL"].includes(side)) throw new Error("invalid side");
    const order={id:crypto.randomUUID(),accountId,idempotencyKey,symbol,side,type,quantity:finitePositive(quantity,"quantity"),filledQuantity:0,state:"NEW",providerOrderId:null,updatedAt:new Date().toISOString()};
    this.orders.set(order.id,order); this.keys.set(idempotencyKey,order.id); return order;
  }
  transition(id,next,patch={}){
    const o=this.orders.get(id); if(!o) throw new Error("order not found");
    const allowed={
      NEW:["PENDING_SUBMIT","REJECTED","CANCELLED"],
      PENDING_SUBMIT:["SUBMITTED","REJECTED","CANCELLED"],
      SUBMITTED:["PARTIALLY_FILLED","FILLED","CANCEL_PENDING","CANCELLED","REJECTED","EXPIRED"],
      PARTIALLY_FILLED:["PARTIALLY_FILLED","FILLED","CANCEL_PENDING","CANCELLED"],
      CANCEL_PENDING:["CANCELLED","PARTIALLY_FILLED","FILLED"],
      FILLED:[],CANCELLED:[],REJECTED:[],EXPIRED:[]
    };
    if(!BROKER_ORDER_STATES.includes(next)||!allowed[o.state].includes(next)) throw new Error(`invalid order transition ${o.state}->${next}`);
    Object.assign(o,patch,{state:next,updatedAt:new Date().toISOString()}); return o;
  }
}

export class BrokerReconciler {
  compare({internalCash,providerCash,internalPositions={},providerPositions={},tolerance=0.01,positionTolerance=1e-9}){
    const finite=(value)=>["string","number"].includes(typeof value)&&String(value).trim()!==""&&Number.isFinite(Number(value));
    if(!finite(internalCash)||!finite(providerCash)||!finite(tolerance)||Number(tolerance)<0||!finite(positionTolerance)||Number(positionTolerance)<0) throw new Error("invalid reconciliation values");
    if(!internalPositions||!providerPositions||typeof internalPositions!=="object"||typeof providerPositions!=="object"||Array.isArray(internalPositions)||Array.isArray(providerPositions)) throw new Error("invalid reconciliation positions");
    const mismatches=[];
    if(Math.abs(Number(internalCash)-Number(providerCash))>tolerance) mismatches.push({type:"CASH",internal:internalCash,provider:providerCash});
    for(const symbol of new Set([...Object.keys(internalPositions),...Object.keys(providerPositions)])){
      const a=Number(internalPositions[symbol]||0),b=Number(providerPositions[symbol]||0);
      if((Object.hasOwn(internalPositions,symbol)&&!finite(internalPositions[symbol]))||(Object.hasOwn(providerPositions,symbol)&&!finite(providerPositions[symbol]))) throw new Error("invalid reconciliation position quantity");
      if(Math.abs(a-b)>positionTolerance) mismatches.push({type:"POSITION",symbol,internal:a,provider:b});
    }
    return {ok:mismatches.length===0,mismatches,autoCorrected:false};
  }
}

export const brokerSafetyStatus=()=>({
  mode:"PROVIDER_READY_PAPER",
  liveExecution:false,
  withdrawals:false,
  custody:false,
  providerCredentialsRequiredForExternalCalls:true
});

export const BROKER_PROVIDER_CANDIDATES=Object.freeze([
  {
    id:"lemon-markets",
    label:"lemon.markets",
    region:"EU",
    assetClasses:["EQUITY","ETF"],
    model:"brokerage-api",
    strengths:["EU brokerage focus","account onboarding primitives","SCA-aware order/withdrawal flow"],
    blockers:["business approval","KYC/SCA production verification","production credentials"],
    priority:92
  },
  {
    id:"alpaca-broker",
    label:"Alpaca Broker",
    region:"US/EU sandbox",
    assetClasses:["EQUITY","ETF"],
    model:"broker-api-sandbox",
    strengths:["sandbox lifecycle","account/KYC test fixtures","SSE trade/account events"],
    blockers:["broker agreement","region-specific auth","production certification"],
    priority:88
  },
  {
    id:"upvest",
    label:"Upvest Investment API",
    region:"EU/UK",
    assetClasses:["EQUITY","ETF","FUND"],
    model:"embedded-investment-infrastructure",
    strengths:["brokerage, settlement and custody through one Investment API","fractional investment support","sandbox and OpenAPI documentation"],
    blockers:["commercial onboarding","operating model selection","licensed-provider contract"],
    priority:86
  },
  {
    id:"drivewealth",
    label:"DriveWealth",
    region:"Global partner",
    assetClasses:["EQUITY","ETF"],
    model:"brokerage-as-a-service",
    strengths:["embedded investing model","fractional US equities focus","partner platform pattern"],
    blockers:["partner approval","API credential review","country availability"],
    priority:78
  },
  {
    id:"ibkr",
    label:"Interactive Brokers",
    region:"Global",
    assetClasses:["EQUITY","ETF","FX","OPTION","FUTURE"],
    model:"client-broker-api",
    strengths:["broad market coverage","paper trading","portfolio and market data APIs"],
    blockers:["gateway/session operations","not ideal for embedded white-label onboarding","user brokerage account dependency"],
    priority:70
  }
]);

export function brokerProviderScorecard({env=process.env,lemonConfigured=false,alpacaConfigured=false}={}) {
  return BROKER_PROVIDER_CANDIDATES.map((provider)=>{
    const configured = provider.id==="lemon-markets"
      ? lemonConfigured
      : provider.id==="alpaca-broker"
        ? alpacaConfigured
        : false;
    const status = configured ? "SANDBOX_OR_REVIEW_READY" : "PARTNER_OR_CREDENTIAL_REQUIRED";
    return Object.freeze({
      ...provider,
      configured,
      status,
      executionReady:false,
      liveTrading:false,
      withdrawals:false,
      custody:false,
      gates:[
        ...(configured?[]:["PROVIDER_CREDENTIAL_OR_PARTNER"]),
        "BUSINESS_APPROVAL",
        "KYC_PROVIDER",
        "SCA_PROVIDER",
        "ORDER_GATE",
        "USER_CONFIRMATION"
      ],
      recommended:provider.priority>=85,
      envHints:provider.id==="lemon-markets"
        ? ["LEMON_MARKETS_API_KEY","LEMON_MARKETS_BASE_URL"]
        : provider.id==="alpaca-broker"
          ? ["ALPACA_BROKER_AUTH_MODE","ALPACA_BROKER_REGION","ALPACA_BROKER_API_KEY or OAuth client credentials"]
          : []
    });
  }).sort((a,b)=>b.priority-a.priority);
}

export function brokerProductionReadiness({env=process.env,providerConfigured=false,sandbox=true,ordersEnabled=false,withdrawalsEnabled=false}={}){
  const checks=[
    {id:"PROVIDER_CREDENTIAL",ready:providerConfigured,required:"LEMON_MARKETS_API_KEY"},
    {id:"PRODUCTION_PROVIDER_HOST",ready:sandbox!==true,required:"non-sandbox provider base URL"},
    {id:"BUSINESS_APPROVAL",ready:env.MARSX_BROKER_PRODUCTION_APPROVED==="true",required:"signed broker/compliance approval"},
    {id:"KYC_PROVIDER",ready:env.MARSX_KYC_PROVIDER_VERIFIED==="true",required:"KYC provider verified"},
    {id:"SCA_PROVIDER",ready:env.MARSX_SCA_PROVIDER_ENABLED==="true",required:"SCA provider enabled"},
    {id:"ORDER_GATE",ready:ordersEnabled===true,required:"MARSX_LEMON_ALLOW_ORDERS=true"},
    {id:"WITHDRAWAL_GATE",ready:withdrawalsEnabled===true,required:"MARSX_LEMON_ALLOW_WITHDRAWALS=true"}
  ];
  const missing=checks.filter(x=>!x.ready).map(x=>x.id);
  return Object.freeze({
    mode:missing.length===0?"PRODUCTION_READY":"PRODUCTION_BLOCKED",
    liveTradingReady:missing.length===0,
    withdrawalsReady:missing.length===0,
    custodyReady:false,
    checks,
    missing,
    userFacingAction:missing.length===0?"REVIEW_AND_CONFIRM_ORDER":"COMPLETE_ONBOARDING_REQUIREMENTS"
  });
}
