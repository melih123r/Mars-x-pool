// Binance REST snapshot bootstrap; read-only. Caller supplies already buffered websocket diff events.
import { BinanceDepthBook } from "./orderbook-binance.js";
const ALLOWED=new Set(["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","DOGEUSDT"]);
export async function bootstrapBinanceDepth({symbol="BTCUSDT",events=[],fetchImpl=fetch,signal}={}){
 if(!ALLOWED.has(symbol))throw Error("UNSUPPORTED_SYMBOL");
 if(!Array.isArray(events)||events.length>5000)throw Error("INVALID_EVENT_BUFFER");
 const response=await fetchImpl("https://api.binance.com/api/v3/depth?symbol="+symbol+"&limit=1000",{headers:{Accept:"application/json"},signal});
 if(!response.ok)throw Error("BINANCE_SNAPSHOT_HTTP_"+response.status);
 const snapshot=await response.json();
 const book=new BinanceDepthBook();book.snapshot(snapshot);
 const buffered=events.filter(e=>Number.isSafeInteger(e.u)&&e.u>snapshot.lastUpdateId);
 if(!buffered.length)return {status:"AWAITING_BRIDGE",book};
 if(buffered[0].U>snapshot.lastUpdateId+1){book.reset();throw Error("SEQUENCE_GAP_RESYNC_REQUIRED");}
 for(const event of buffered){try{book.delta(event);}catch(error){book.reset();throw error;}}
 return {status:book.ready?"SYNCHRONIZED":"AWAITING_BRIDGE",book,lastEventTime:book.ready?buffered.at(-1)?.E:null};
}
