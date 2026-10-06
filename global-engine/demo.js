import { order } from "./core.js";
import { MarsXGlobalEngine } from "./engine.js";
import { coinbaseBtcUsd, krakenBtcUsd } from "./adapters/public-crypto.js";
import { AlpacaMarketDataAdapter } from "./adapters/alpaca.js";

export async function cryptoLiveDemo() {
  const engine=new MarsXGlobalEngine([coinbaseBtcUsd(),krakenBtcUsd()]);
  const o=order({instrument:{symbol:"BTC-USD",assetClass:"CRYPTO",quoteCurrency:"USD"},side:"BUY",amount:1000});
  return engine.route(o);
}

export async function equityLiveDemo(symbol="AAPL") {
  const engine=new MarsXGlobalEngine([new AlpacaMarketDataAdapter()]);
  const o=order({instrument:{symbol,assetClass:"EQUITY",quoteCurrency:"USD"},side:"BUY",amount:1000});
  return engine.route(o);
}
