import { VenueAdapter } from "../venue.js";

const trim=(s)=>String(s||"").replace(/\/+$/,"");
export class AlpacaBrokerSandboxAdapter extends VenueAdapter {
 constructor({
  clientId=process.env.ALPACA_BROKER_CLIENT_ID,
  clientSecret=process.env.ALPACA_BROKER_CLIENT_SECRET,
  authUrl=process.env.ALPACA_BROKER_AUTH_URL||"https://authx.sandbox.eu.alpaca.markets",
  baseUrl=process.env.ALPACA_BROKER_BASE_URL||"https://broker-api.sandbox.eu.alpaca.markets",
  allowOrders=process.env.MARSX_ALPACA_BROKER_ALLOW_ORDERS==="true"
 }={}){
  super("alpaca-broker-sandbox",["EQUITY","ETF"]);
  this.clientId=clientId;this.clientSecret=clientSecret;this.authUrl=trim(authUrl);this.baseUrl=trim(baseUrl);this.allowOrders=allowOrders;this.mode="sandbox-gated";
 }
 configured(){return Boolean(this.clientId&&this.clientSecret);}
 async token(){
  if(!this.configured()) throw new Error("Alpaca Broker sandbox credentials are not configured");
  const body=new URLSearchParams({grant_type:"client_credentials",client_id:this.clientId,client_secret:this.clientSecret});
  const r=await fetch(`${this.authUrl}/v1/oauth2/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  if(!r.ok) throw new Error(`Alpaca Broker auth HTTP ${r.status}`);
  return (await r.json()).access_token;
 }
 async request(path,{method="GET",body}={}){
  const access=await this.token();
  const r=await fetch(`${this.baseUrl}${path}`,{method,headers:{Authorization:`Bearer ${access}`,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(!r.ok) throw new Error(`Alpaca Broker HTTP ${r.status}`); return r.json();
 }
 createAccount(payload){if(!payload)throw new Error("account payload required");return this.request("/v1/accounts",{method:"POST",body:payload});}
 getAccount(id){if(!id)throw new Error("accountId required");return this.request(`/v1/accounts/${encodeURIComponent(id)}`);}
 async createOrder(accountId,payload){
  if(!this.allowOrders) throw new Error("Alpaca Broker sandbox order submission disabled");
  if(!accountId||!payload) throw new Error("accountId and order payload required");
  return this.request(`/v1/trading/accounts/${encodeURIComponent(accountId)}/orders`,{method:"POST",body:payload});
 }
 async placeOrder(){throw new Error("generic live execution disabled");}
}
