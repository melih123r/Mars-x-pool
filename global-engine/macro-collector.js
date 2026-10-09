const JSON_HEADERS={accept:"application/json"};
async function getJson(url){const r=await fetch(url,{headers:JSON_HEADERS,signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`macro HTTP ${r.status}`);return r.json();}
export class MacroCollector{
 async treasury(){const year=new Date().getUTCFullYear();const p=await getJson(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}&_format=json`);return {provider:"UST",data:p,executionReady:false};}
 async ecbFx({currency="USD"}={}){const p=await getJson(`https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?format=jsondata&lastNObservations=10`);return {provider:"ECB",data:p,executionReady:false};}
}
