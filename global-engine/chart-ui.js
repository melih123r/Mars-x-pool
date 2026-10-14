export const CHART_TIMEFRAMES=Object.freeze(["1m","5m","15m","30m","1h","4h","1d","1w","1M"]);
export const CHART_INDICATORS=Object.freeze([
  {id:"volume",label:"Volume",panel:"main"},
  {id:"sma20",label:"SMA 20",panel:"main"},
  {id:"ema20",label:"EMA 20",panel:"main"},
  {id:"bollinger20",label:"Bollinger 20",panel:"main"},
  {id:"rsi14",label:"RSI 14",panel:"lower"},
  {id:"macd",label:"MACD",panel:"lower"}
]);
export function createChartUiState({symbol="BTC-USD",timeframe="1h"}={}){
  if(!CHART_TIMEFRAMES.includes(timeframe))throw new Error("unsupported timeframe");
  return {symbol,timeframe,chartType:"candles",crosshair:true,grid:true,volume:true,indicators:["volume"],drawingMode:null,zoom:{from:null,to:null},selectedOrderId:null};
}
export function setTimeframe(state,timeframe){if(!CHART_TIMEFRAMES.includes(timeframe))throw new Error("unsupported timeframe");return{...state,timeframe};}
export function toggleIndicator(state,id){if(!CHART_INDICATORS.some(x=>x.id===id))throw new Error("unknown indicator");const s=new Set(state.indicators||[]);s.has(id)?s.delete(id):s.add(id);return{...state,indicators:[...s]};}
function finiteCoordinate(value){return value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value));}
export function orderMarkers(orders=[]){return orders.filter(o=>finiteCoordinate(o?.price)&&finiteCoordinate(o?.time)).map(o=>({time:Number(o.time),price:Number(o.price),id:String(o.id||""),side:String(o.side||"").toUpperCase(),status:String(o.status||"").toUpperCase(),label:o.label||o.type||"ORDER"}));}
export function signalMarkers(signals=[]){return signals.filter(s=>finiteCoordinate(s?.price)&&finiteCoordinate(s?.time)).map(s=>({time:Number(s.time),price:Number(s.price),direction:String(s.direction||"NEUTRAL").toUpperCase(),confidence:Number(s.confidence||0),label:s.label||"MARS-X"}));}
