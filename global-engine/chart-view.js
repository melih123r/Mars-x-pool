import { chartSnapshot, chartQuality } from "./chart-engine.js";
import { chartVisualConfig, signalColor } from "./chart-theme.js";
import { createChartUiState, orderMarkers, signalMarkers } from "./chart-ui.js";

export function buildChartView({symbol,rows,timeframe="1h",orders=[],signals=[],ui,now=Date.now(),maxStaleMs}={}){
  if(typeof symbol!=="string"||!symbol.trim())throw new Error("symbol required");
  const state=ui||createChartUiState({symbol,timeframe});
  const snapshot=chartSnapshot(rows||[],{timeframe:state.timeframe});
  const quality=chartQuality(snapshot.candles,{now,maxStaleMs:maxStaleMs??Math.max(120_000,2*60_000)});
  const signalOverlay=signalMarkers(signals).map(s=>({...s,color:signalColor(s.direction,s.confidence)}));
  return {
    version:1,symbol,state,quality,visual:chartVisualConfig({showGrid:state.grid,showVolume:state.volume,showCrosshair:state.crosshair}),
    series:{candles:snapshot.candles,indicators:snapshot.indicators},
    overlays:{orders:orderMarkers(orders),signals:signalOverlay},
    interaction:{crosshair:true,zoom:true,pan:true,timeframeSelector:true,indicatorSelector:true,drawings:["horizontal-line","trend-line","price-range"]}
  };
}
