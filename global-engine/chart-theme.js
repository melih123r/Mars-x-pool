export const MARSX_CHART_THEME=Object.freeze({
  id:"marsx-finance-dark-v1",
  surface:{background:"#090D12",panel:"#10161F",panelRaised:"#151D28",grid:"#223044",axis:"#718096",text:"#F3F6FA",textMuted:"#9AA8BA",crosshair:"#C8D2E0"},
  candle:{up:"#16C784",down:"#EA3943",wickUp:"#16C784",wickDown:"#EA3943",neutral:"#8B98A9"},
  volume:{up:"rgba(22,199,132,0.32)",down:"rgba(234,57,67,0.32)"},
  indicators:{sma20:"#F5B642",ema20:"#4EA1FF",rsi14:"#B783FF",macd:"#00C2FF",macdSignal:"#FF9F43",bollingerUpper:"#6C8CFF",bollingerMiddle:"#A7B4C6",bollingerLower:"#6C8CFF"},
  signal:{strongBuy:"#00D084",buy:"#52D6A0",neutral:"#F5B642",sell:"#FF7B72",strongSell:"#FF3B4D"},
  risk:{safe:"#16C784",warning:"#F5B642",danger:"#EA3943",blocked:"#8B98A9"},
  order:{entry:"#4EA1FF",takeProfit:"#16C784",stopLoss:"#EA3943",pending:"#F5B642",filled:"#B783FF"},
  selection:{primary:"#B93CFF",secondary:"#00D8FF"},
  typography:{family:"Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",priceWeight:600,labelWeight:500},
  geometry:{candleBodyMinPx:1,crosshairWidth:1,gridWidth:1,indicatorWidth:2,markerRadius:4}
});

const hex=/^#[0-9A-F]{6}$/i;
export function validateChartTheme(theme=MARSX_CHART_THEME){
  if(!theme?.surface||!theme?.candle||!theme?.indicators)throw new Error("invalid chart theme");
  for(const group of ["surface","candle","indicators","signal","risk","order","selection"]){
    for(const [key,value] of Object.entries(theme[group]||{})){
      if(typeof value!=="string"||(!hex.test(value)&&!/^rgba\(/.test(value)))throw new Error(`invalid chart color ${group}.${key}`);
    }
  }
  if(theme.candle.up===theme.candle.down)throw new Error("up/down candle colors must differ");
  return true;
}

export function chartVisualConfig({theme=MARSX_CHART_THEME,showGrid=true,showVolume=true,showCrosshair=true}={}){
  validateChartTheme(theme);
  return {
    themeId:theme.id,layout:{background:theme.surface.background,textColor:theme.surface.text,fontFamily:theme.typography.family},
    grid:{visible:showGrid,color:theme.surface.grid,width:theme.geometry.gridWidth},
    axes:{color:theme.surface.axis,textColor:theme.surface.textMuted},
    crosshair:{visible:showCrosshair,color:theme.surface.crosshair,width:theme.geometry.crosshairWidth},
    candles:{upColor:theme.candle.up,downColor:theme.candle.down,wickUpColor:theme.candle.wickUp,wickDownColor:theme.candle.wickDown},
    volume:{visible:showVolume,upColor:theme.volume.up,downColor:theme.volume.down},
    indicators:theme.indicators,signals:theme.signal,risk:theme.risk,orders:theme.order,selection:theme.selection
  };
}

export function signalColor(direction,confidence=0){
  const c=Number(confidence);if(!Number.isFinite(c)||c<0||c>1)throw new Error("confidence must be 0..1");
  const d=String(direction||"").toUpperCase();
  if(d==="BUY")return c>=0.75?MARSX_CHART_THEME.signal.strongBuy:MARSX_CHART_THEME.signal.buy;
  if(d==="SELL")return c>=0.75?MARSX_CHART_THEME.signal.strongSell:MARSX_CHART_THEME.signal.sell;
  return MARSX_CHART_THEME.signal.neutral;
}
