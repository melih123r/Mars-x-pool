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
  compare({internalCash,providerCash,internalPositions={},providerPositions={},tolerance=0.01}){
    const mismatches=[];
    if(Math.abs(Number(internalCash)-Number(providerCash))>tolerance) mismatches.push({type:"CASH",internal:internalCash,provider:providerCash});
    for(const symbol of new Set([...Object.keys(internalPositions),...Object.keys(providerPositions)])){
      const a=Number(internalPositions[symbol]||0),b=Number(providerPositions[symbol]||0);
      if(Math.abs(a-b)>tolerance) mismatches.push({type:"POSITION",symbol,internal:a,provider:b});
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
