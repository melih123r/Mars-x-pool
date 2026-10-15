import { VenueAdapter } from "../venue.js";
import { quote } from "../core.js";

const DEFAULT_TIMEOUT_MS=8000;
const DEFAULT_MAX_RESPONSE_BYTES=512*1024;
const HARD_MAX_RESPONSE_BYTES=2*1024*1024;

function alpacaError(message,{code,status=null,retryable=false}={}){
  const error=new Error(message);
  error.code=code;
  error.status=status;
  error.retryable=retryable;
  return error;
}

function httpError(status){
  if(status===429)return alpacaError("Alpaca market data rate limited",{code:"ALPACA_RATE_LIMITED",status,retryable:true});
  if(status===503)return alpacaError("Alpaca market data unavailable",{code:"ALPACA_UNAVAILABLE",status,retryable:true});
  if(status===401||status===403)return alpacaError("Alpaca market data authorization failed",{code:"ALPACA_AUTH",status,retryable:false});
  if(status>=400&&status<500)return alpacaError("Alpaca market data request rejected",{code:"ALPACA_INVALID_REQUEST",status,retryable:false});
  return alpacaError("Alpaca market data provider error",{code:"ALPACA_PROVIDER_ERROR",status,retryable:false});
}

function responseTooLarge(){
  return alpacaError("Alpaca market data response exceeds safe size limit",{code:"ALPACA_RESPONSE_TOO_LARGE",status:502,retryable:false});
}

async function boundedJson(response,maxBytes){
  const declared=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(declared)&&declared>maxBytes)throw responseTooLarge();

  if(!response.body?.getReader){
    if(typeof response.text!=="function")return response.json();
    const text=await response.text();
    if(new TextEncoder().encode(text).byteLength>maxBytes)throw responseTooLarge();
    try{return JSON.parse(text)}catch{throw alpacaError("Alpaca market data returned invalid JSON",{code:"ALPACA_INVALID_RESPONSE",status:502,retryable:false})}
  }

  const reader=response.body.getReader(),decoder=new TextDecoder();
  let total=0,text="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){
        await reader.cancel("response_too_large");
        throw responseTooLarge();
      }
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
  }finally{reader.releaseLock()}
  try{return JSON.parse(text)}catch{throw alpacaError("Alpaca market data returned invalid JSON",{code:"ALPACA_INVALID_RESPONSE",status:502,retryable:false})}
}

const delay=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve();

export class AlpacaMarketDataAdapter extends VenueAdapter {
  constructor({
    key=process.env.ALPACA_API_KEY,
    secret=process.env.ALPACA_API_SECRET,
    baseUrl="https://data.alpaca.markets",
    timeoutMs=DEFAULT_TIMEOUT_MS,
    maxResponseBytes=DEFAULT_MAX_RESPONSE_BYTES,
    maxAttempts=2,
    retryBaseMs=100
  }={}) {
    super("alpaca-market-data",["EQUITY","ETF"]);
    this.key=key;
    this.secret=secret;
    this.baseUrl=String(baseUrl).replace(/\/+$/,"");
    this.timeoutMs=Number(timeoutMs);
    this.maxResponseBytes=Number(maxResponseBytes);
    this.maxAttempts=Number(maxAttempts);
    this.retryBaseMs=Number(retryBaseMs);
    if(!Number.isFinite(this.timeoutMs)||this.timeoutMs<1)throw new Error("timeoutMs must be positive");
    if(!Number.isInteger(this.maxResponseBytes)||this.maxResponseBytes<1||this.maxResponseBytes>HARD_MAX_RESPONSE_BYTES)throw new Error("maxResponseBytes must be an integer between 1 and 2097152");
    if(!Number.isInteger(this.maxAttempts)||this.maxAttempts<1||this.maxAttempts>3)throw new Error("maxAttempts must be an integer between 1 and 3");
    if(!Number.isFinite(this.retryBaseMs)||this.retryBaseMs<0||this.retryBaseMs>2000)throw new Error("retryBaseMs must be between 0 and 2000");
  }

  async getQuote(order) {
    if(!this.key || !this.secret) throw new Error("Alpaca market-data credentials are not configured");
    const symbol=encodeURIComponent(order.instrument.symbol);
    let lastError;

    for(let attempt=1;attempt<=this.maxAttempts;attempt++){
      try{
        const res=await fetch(`${this.baseUrl}/v2/stocks/${symbol}/quotes/latest`,{
          method:"GET",
          redirect:"error",
          signal:AbortSignal.timeout(this.timeoutMs),
          headers:{
            "APCA-API-KEY-ID":this.key,
            "APCA-API-SECRET-KEY":this.secret,
            "accept":"application/json"
          }
        });
        if(!res.ok)throw httpError(res.status);
        const p=await boundedJson(res,this.maxResponseBytes),q=p.quote||{};
        const px=order.side==="BUY"?Number(q.ap):Number(q.bp);
        return quote({venue:this.name,price:px,fee:0,timestamp:q.t||new Date().toISOString(),metadata:{bid:Number(q.bp),ask:Number(q.ap),source:"alpaca-read-only"}});
      }catch(error){
        if(error?.code?.startsWith?.("ALPACA_"))lastError=error;
        else if(error?.name==="TimeoutError"||error?.name==="AbortError")lastError=alpacaError("Alpaca market data request timed out",{code:"ALPACA_TIMEOUT",status:504,retryable:true});
        else lastError=alpacaError("Alpaca market data network unavailable",{code:"ALPACA_NETWORK",status:503,retryable:true});

        if(!lastError.retryable||attempt===this.maxAttempts)throw lastError;
        await delay(this.retryBaseMs*attempt);
      }
    }
    throw lastError;
  }

  async placeOrder(){ throw new Error("live execution disabled"); }
}
