import http from "node:http";
import { instrument, order } from "./core.js";
import { MarsXGlobalEngine } from "./engine.js";
import { coinbaseBtcUsd, krakenBtcUsd } from "./adapters/public-crypto.js";
import { PublicFxAdapter } from "./adapters/public-fx.js";
import { AlpacaMarketDataAdapter } from "./adapters/alpaca.js";
import { MetalsDevGoldAdapter } from "./adapters/metals-dev.js";
import { GoldApiAdapter } from "./adapters/gold-api.js";
import { learningConsent } from "./learning-consent.js";
import { sanitizeTrainingEvent } from "./training-sanitize.js";
import { TrainingBuffer } from "./training-buffer.js";
import { ChangeNowAdapter } from "./adapters/changenow.js";
import { changeNowErrorView } from "./changenow-health.js";
import { LemonBrokerAdapter } from "./adapters/lemon-markets.js";
import { brokerProductionReadiness, brokerSafetyStatus } from "./broker-core.js";
import { buildChartView } from "./chart-view.js";

export function marketCapabilities(env=process.env){
  const alpaca=Boolean(env.ALPACA_API_KEY&&env.ALPACA_API_SECRET), metals=Boolean(env.METALS_DEV_API_KEY);
  return [
    {symbol:"BTC-USD",assetClass:"CRYPTO",status:"AVAILABLE",venues:["coinbase-public","kraken-public"]},
    {symbol:"ETH-USD",assetClass:"CRYPTO",status:"AVAILABLE",venues:["coinbase-public","kraken-public"]},
    ...["EUR-USD","GBP-USD","USD-JPY","USD-CHF","EUR-GBP","USD-TRY"].map(symbol=>({symbol,assetClass:"FX",status:"AVAILABLE_REFERENCE",venues:["frankfurter-fx"],executionReady:false})),
    {symbol:"XAU-USD",assetClass:"COMMODITY",status:"AVAILABLE_REFERENCE",venues:metals?["gold-api-public","metals-dev-gold"]:["gold-api-public"],requires:metals?undefined:"METALS_DEV_API_KEY optional for second source",executionReady:false},
    ...["XAG-USD","XPT-USD","XPD-USD","HG-USD"].map(symbol=>({symbol,assetClass:"COMMODITY",status:"AVAILABLE_REFERENCE",venues:["gold-api-public"],executionReady:false})),
    {symbol:"AAPL",assetClass:"EQUITY",status:alpaca?"AVAILABLE":"CREDENTIAL_REQUIRED",venues:alpaca?["alpaca-market-data"]:[],requires:"ALPACA_API_KEY + ALPACA_API_SECRET",executionReady:false},
    {symbol:"SPY",assetClass:"ETF",status:alpaca?"AVAILABLE":"CREDENTIAL_REQUIRED",venues:alpaca?["alpaca-market-data"]:[],requires:"ALPACA_API_KEY + ALPACA_API_SECRET",executionReady:false}
  ];
}

export function buildEngine(){
  const adapters=[coinbaseBtcUsd(),krakenBtcUsd(),new PublicFxAdapter(),new GoldApiAdapter()];
  if(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET) adapters.push(new AlpacaMarketDataAdapter());
  if(process.env.METALS_DEV_API_KEY) adapters.push(new MetalsDevGoldAdapter());
  return new MarsXGlobalEngine(adapters,{maxStaleMs:Number(process.env.MARSX_MAX_STALE_MS||15000),maxSpreadBps:Number(process.env.MARSX_MAX_SPREAD_BPS||50),minConsensus:Number(process.env.MARSX_MIN_CONSENSUS||1)});
}

export function demoChartRows({now=Date.now(),limit=96,base=64000}={}){
  const start=Math.floor((now-limit*60_000)/60_000)*60_000;
  return Array.from({length:limit},(_,i)=>{
    const time=start+i*60_000, drift=i*8, wave=Math.sin(i/5)*420+Math.cos(i/11)*180, close=base+drift+wave, open=base+(i-1)*8+Math.sin((i-1)/5)*420+Math.cos((i-1)/11)*180;
    const high=Math.max(open,close)+90+(i%7)*12, low=Math.min(open,close)-90-(i%5)*10;
    return {time,open:Number(open.toFixed(2)),high:Number(high.toFixed(2)),low:Number(low.toFixed(2)),close:Number(close.toFixed(2)),volume:120+i*3+(i%9)*17};
  });
}

export function createApi(engine=buildEngine()){
  const buckets=new Map(), limit=Number(process.env.MARSX_RATE_LIMIT_PER_MIN||120), trainingBuffer=new TrainingBuffer({minCohort:Number(process.env.MARSX_TRAINING_MIN_COHORT||20)}), changeNow=new ChangeNowAdapter(), lemon=new LemonBrokerAdapter();
  const convertHealth=()=>({provider:"MARS-X Engine",mode:"READ_ONLY",configured:changeNow.configured(),executionReady:false,capabilities:changeNow.capabilities(),executionBlockers:["provider_execution_disabled","transaction_confirmation_required","compliance_gate_required"]});
  const lemonProvider=()=>{
    const sandbox=/sandbox/i.test(lemon.baseUrl);
    const readiness=brokerProductionReadiness({providerConfigured:lemon.configured(),sandbox,ordersEnabled:lemon.allowOrderSubmission===true,withdrawalsEnabled:lemon.allowWithdrawals===true});
    return {id:"lemon-markets",assetClasses:["EQUITY","ETF"],configured:lemon.configured(),sandbox,kycRequired:true,ordersEnabled:lemon.allowOrderSubmission===true,withdrawalsEnabled:lemon.allowWithdrawals===true,executionReady:readiness.liveTradingReady,requiredSecrets:lemon.configured()?[]:["LEMON_MARKETS_API_KEY"],gates:readiness.missing.length?readiness.missing:["USER_REVIEW_REQUIRED","SCA_CONFIRMATION_REQUIRED"],readiness};
  };
  const brokerHealth=()=>{const provider=lemonProvider();return {provider:"MARS-X Broker Gateway",mode:provider.readiness.mode==="PRODUCTION_READY"?"PRODUCTION_REVIEW_READY":"PAPER_AND_ONBOARDING_READY",primaryBroker:"lemon.markets",configured:lemon.configured(),safety:brokerSafetyStatus(),providers:[provider],production:{liveTrading:provider.readiness.liveTradingReady,withdrawals:provider.readiness.withdrawalsReady,custody:false}};};
  const quoteParams=url=>({fromCurrency:url.searchParams.get("fromCurrency"),toCurrency:url.searchParams.get("toCurrency"),fromAmount:url.searchParams.get("fromAmount"),fromNetwork:url.searchParams.get("fromNetwork"),toNetwork:url.searchParams.get("toNetwork"),flow:url.searchParams.get("flow")||"standard"});
  return http.createServer(async(req,res)=>{
    res.setHeader("content-type","application/json"); res.setHeader("cache-control","no-store"); res.setHeader("x-content-type-options","nosniff");
    res.setHeader("referrer-policy","no-referrer"); res.setHeader("x-frame-options","DENY"); res.setHeader("permissions-policy","geolocation=(), microphone=(), camera=()");
    const ip=String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim(), minute=Math.floor(Date.now()/60000), key=ip+":"+minute, used=(buckets.get(key)||0)+1;
    buckets.set(key,used); if(buckets.size>5000) for(const k of buckets.keys()) if(!k.endsWith(":"+minute)) buckets.delete(k);
    res.setHeader("x-ratelimit-limit",String(limit)); res.setHeader("x-ratelimit-remaining",String(Math.max(0,limit-used)));
    if(used>limit){res.statusCode=429; return res.end(JSON.stringify({error:"RATE_LIMITED"}));}
    try{
      const url=new URL(req.url,"http://localhost");
      if(req.method==="GET" && url.pathname==="/convert/health") return res.end(JSON.stringify(convertHealth()));
      if(req.method==="GET" && url.pathname==="/convert/assets"){try{return res.end(JSON.stringify({provider:"MARS-X Engine",mode:"READ_ONLY",executionReady:false,data:await changeNow.currencies({active:url.searchParams.get("active")!=="false",flow:url.searchParams.get("flow")||"standard"})}));}catch(e){res.statusCode=e.status||503;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/convert/min-amount"){try{return res.end(JSON.stringify({provider:"MARS-X Engine",mode:"READ_ONLY",executionReady:false,data:await changeNow.minAmount(quoteParams(url))}));}catch(e){res.statusCode=e.status||400;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/convert/quote"){try{return res.end(JSON.stringify({provider:"MARS-X Engine",mode:"READ_ONLY",executionReady:false,data:await changeNow.estimate(quoteParams(url))}));}catch(e){res.statusCode=e.status||400;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/broker/health") return res.end(JSON.stringify(brokerHealth()));
      if(req.method==="GET" && url.pathname==="/broker/providers") return res.end(JSON.stringify({mode:"PAPER_AND_ONBOARDING_READY",providers:brokerHealth().providers}));
      if(req.method==="GET" && url.pathname==="/broker/readiness") return res.end(JSON.stringify({mode:"BROKER_PRODUCTION_READINESS",provider:lemonProvider()}));
      if(req.method==="GET" && url.pathname==="/chart/snapshot"){
        const symbol=(url.searchParams.get("symbol")||"BTC-USD").toUpperCase(), timeframe=url.searchParams.get("timeframe")||"1m";
        const view=buildChartView({symbol,timeframe,rows:demoChartRows({limit:120}),maxStaleMs:10*60_000,signals:[{time:Date.now()-20*60_000,price:64250,direction:"BUY",confidence:.72,label:"MARS-X"}]});
        return res.end(JSON.stringify({...view,mode:"READ_ONLY",executionReady:false,source:"deterministic-preview"}));
      }
      if(req.method==="GET" && url.pathname==="/changenow/health") return res.end(JSON.stringify({provider:"ChangeNOW",mode:"READ_ONLY",configured:changeNow.configured(),executionReady:false,capabilities:changeNow.capabilities()}));
      if(req.method==="GET" && url.pathname==="/changenow/currencies"){try{return res.end(JSON.stringify({provider:"ChangeNOW",mode:"READ_ONLY",data:await changeNow.currencies({active:url.searchParams.get("active")!=="false",flow:url.searchParams.get("flow")||"standard"})}));}catch(e){res.statusCode=e.status||503;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/changenow/min-amount"){try{return res.end(JSON.stringify({provider:"ChangeNOW",mode:"READ_ONLY",data:await changeNow.minAmount({fromCurrency:url.searchParams.get("fromCurrency"),toCurrency:url.searchParams.get("toCurrency"),fromNetwork:url.searchParams.get("fromNetwork"),toNetwork:url.searchParams.get("toNetwork"),flow:url.searchParams.get("flow")||"standard"})}));}catch(e){res.statusCode=e.status||400;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/changenow/quote"){try{return res.end(JSON.stringify({provider:"ChangeNOW",mode:"READ_ONLY",executionReady:false,data:await changeNow.estimate({fromCurrency:url.searchParams.get("fromCurrency"),toCurrency:url.searchParams.get("toCurrency"),fromAmount:url.searchParams.get("fromAmount"),fromNetwork:url.searchParams.get("fromNetwork"),toNetwork:url.searchParams.get("toNetwork"),flow:url.searchParams.get("flow")||"standard"})}));}catch(e){res.statusCode=e.status||400;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/pool/changenow/quote"){try{return res.end(JSON.stringify({provider:"ChangeNOW",consumer:"MARS-X Pool",mode:"READ_ONLY",executionReady:false,data:await changeNow.estimate({fromCurrency:url.searchParams.get("fromCurrency")||"vrsc",toCurrency:url.searchParams.get("toCurrency"),fromAmount:url.searchParams.get("fromAmount"),fromNetwork:url.searchParams.get("fromNetwork"),toNetwork:url.searchParams.get("toNetwork"),flow:url.searchParams.get("flow")||"standard"})}));}catch(e){res.statusCode=e.status||400;return res.end(JSON.stringify(changeNowErrorView(e)));}}
      if(req.method==="GET" && url.pathname==="/health") return res.end(JSON.stringify({ok:true,mode:"READ_ONLY",liveExecution:false,venues:engine.health.snapshot()}));
      if(req.method==="GET" && url.pathname==="/markets") return res.end(JSON.stringify({mode:"READ_ONLY",liveExecution:false,markets:marketCapabilities()}));
      if(req.method==="GET" && url.pathname==="/terminal/config") return res.end(JSON.stringify({
        version:"0.1",mode:"READ_ONLY",liveExecution:false,
        charts:["CANDLESTICK","LINE","AREA","HEIKIN_ASHI"],
        timeframes:["1m","5m","15m","1h","4h","1D","1W"],
        indicators:["VOLUME","SMA","EMA","RSI","MACD","BOLLINGER_BANDS","ATR"],
        drawings:["TRENDLINE","FIBONACCI"],
        layouts:[1,2,4],
        panels:["WATCHLIST","CHART","ORDER_BOOK","TRADES","POSITIONS","VENUE_COMPARISON","MARSX_INTELLIGENCE"],
        overlays:["LIQUIDITY","MACRO","MOMENTUM","POSITIONING","VOLATILITY","RISK","CONFIDENCE"],
        execution:{enabled:false,chartTrading:false,paperOnly:true},
        advanced:{
          dom:{status:"DATA_SOURCE_REQUIRED",level2:true},
          footprint:{status:"DATA_SOURCE_REQUIRED",requires:"trade-side/order-flow feed"},
          liquidityHeatmap:{status:"DATA_SOURCE_REQUIRED",requires:"depth/order-book history"},
          liquidationHeatmap:{status:"DATA_SOURCE_REQUIRED",requires:"derivatives liquidation feed"},
          replay:{status:"QUALITY_GATED_FOUNDATION",paperOnly:true},
          backtest:{status:"PAPER_QUALITY_GATED",paperOnly:true},
          optionsChain:{status:"DATA_SOURCE_REQUIRED",requires:"options market-data feed"},
          impliedVolatilitySurface:{status:"DATA_SOURCE_REQUIRED",requires:"options chain + IV"},
          economicCalendar:{status:"MACRO_COLLECTOR_FOUNDATION",referenceOnly:true},
          newsMarkers:{status:"PLANNED",referenceOnly:true},
          alerts:{status:"FOUNDATION_READY",types:["PRICE","INDICATOR","MARSX_SIGNAL","RISK"]},
          screener:{status:"FOUNDATION_READY",filters:["ASSET_CLASS","PRICE","VOLUME","VOLATILITY","MARSX_CONFIDENCE"]},
          workspace:{status:"FOUNDATION_READY",savedLayouts:true,symbolSync:true,crosshairSync:true},
          advancedOrders:{status:"PAPER_ONLY",types:["LIMIT","STOP","STOP_LIMIT","BRACKET","OCO"]},
          portfolioAttribution:{status:"FOUNDATION_READY"},
          optionsStrategyBuilder:{status:"ANALYTICS_READY_DATA_SOURCE_REQUIRED",requires:"options chain for live market inputs; Greeks model ready"}
        },
        riskTerminal:{
          mode:"PAPER_SIMULATION",
          metrics:["PNL","REALIZED_PNL","UNREALIZED_PNL","GROSS_EXPOSURE","NET_EXPOSURE","CONCENTRATION","CORRELATION","VAR","MAX_DRAWDOWN","MARGIN"],
          derivatives:["DELTA","GAMMA","THETA","VEGA"],
          analytics:["STRESS_TEST","WHAT_IF","SCENARIO_SHOCK","CORRELATION_MATRIX"],
          limits:{liveAccountActions:false,realMoneyRiskChanges:false}
        }
      }));
      if(req.method==="GET" && url.pathname==="/analytics/capabilities") return res.end(JSON.stringify({mode:"READ_ONLY",tca:["SLIPPAGE_BPS","DECISION_BPS","FEE_BPS","TOTAL_COST_BPS","LATENCY_MS","VENUE_SCORE"],risk:["GROSS_EXPOSURE","NET_EXPOSURE","LEVERAGE","CONCENTRATION","SCENARIO_SHOCK"],engines:{backtest:"PAPER_QUALITY_GATED",confidence:"ANALYTICS_ONLY",portfolioRisk:"PAPER_SIMULATION",audit:"IN_MEMORY_FOUNDATION",learning:"OPT_IN_AGGREGATE_ONLY"},storage:{historical:"CRYPTO_PROVIDERS_READY",providers:["coinbase-history","kraken-history"],symbols:["BTC-USD","ETH-USD"],quality:["OHLCV_VALIDITY","DUPLICATES","GAPS","STALE","CROSS_PROVIDER_DEVIATION"],minQualityScore:80,replay:"QUALITY_GATED_FOUNDATION",persistent:"POSTGRES_READY_NOT_PROVISIONED",schema:"marsx_ohlcv"}}));
      if(req.method==="GET" && url.pathname==="/learning/status") return res.end(JSON.stringify({mode:"OPT_IN_AGGREGATE_ONLY",rawIdentifiersStored:false,modelInternalsExposed:false,bufferCount:trainingBuffer.rows.length,minCohort:trainingBuffer.minCohort,ready:trainingBuffer.eligible()}));
      if(req.method==="POST" && url.pathname==="/learning/event"){
        let raw=""; for await (const chunk of req){raw+=chunk;if(raw.length>8192)throw new Error("PAYLOAD_TOO_LARGE");}
        const body=JSON.parse(raw||"{}"), consent=learningConsent(body.user||{});
        if(!consent.allowed){res.statusCode=403;return res.end(JSON.stringify({error:"TRAINING_CONSENT_REQUIRED"}));}
        const event=sanitizeTrainingEvent(body.event||{}); trainingBuffer.add(event,{consent});
        return res.end(JSON.stringify({accepted:true,mode:"OPT_IN_AGGREGATE_ONLY",rawIdentifiersStored:false}));
      }
      if(req.method==="GET" && url.pathname==="/macro/sources") return res.end(JSON.stringify({mode:"REFERENCE_ONLY",sources:[
        {id:"UST_YIELD_CURVE",provider:"U.S. Treasury",frequency:"DAILY",status:"AVAILABLE",series:["1M","3M","6M","1Y","2Y","5Y","10Y","20Y","30Y"],executionReady:false},
        {id:"FED_H15",provider:"Federal Reserve Board",frequency:"DAILY",status:"AVAILABLE",series:["FED_FUNDS","TREASURY_CONSTANT_MATURITY"],executionReady:false},
        {id:"ECB_DATA",provider:"European Central Bank",frequency:"MIXED",status:"AVAILABLE",series:["POLICY_RATES","FX_REFERENCE_RATES","YIELD_CURVES","MONETARY_AGGREGATES"],executionReady:false},
        {id:"EUROSTAT",provider:"Eurostat",frequency:"MIXED",status:"AVAILABLE",series:["HICP","GDP","UNEMPLOYMENT","INDUSTRIAL_PRODUCTION"],executionReady:false},
        {id:"CBOE_VIX",provider:"Cboe",frequency:"DAILY",status:"AVAILABLE_REFERENCE",series:["VIX_HISTORY"],executionReady:false},
        {id:"EIA",provider:"U.S. Energy Information Administration",frequency:"MIXED",status:"CREDENTIAL_REQUIRED",series:["WTI","BRENT","NATURAL_GAS","PETROLEUM"],requires:"EIA_API_KEY",executionReady:false}
      ]}));
      if(req.method==="GET" && ["/quote","/route"].includes(url.pathname)){
        const i=instrument({symbol:url.searchParams.get("symbol"),assetClass:url.searchParams.get("assetClass"),quoteCurrency:url.searchParams.get("quoteCurrency")||"USD"});
        const o=order({instrument:i,side:url.searchParams.get("side")||"BUY",amount:Number(url.searchParams.get("amount")||1)});
        const routed=await engine.route(o), result={...routed,mode:"READ_ONLY",executionReady:false};
        return res.end(JSON.stringify(url.pathname==="/quote"?result.quotes:result));
      }
      res.statusCode=404; return res.end(JSON.stringify({error:"NOT_FOUND"}));
    }catch(e){ res.statusCode=400; return res.end(JSON.stringify({error:String(e.message||e)})); }
  });
}
if(import.meta.url===`file://${process.argv[1]}`) createApi().listen(Number(process.env.PORT||8080));
