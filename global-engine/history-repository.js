export class HistoryRepository {
  async append(_record){throw new Error("append not implemented");}
  async query(_params){throw new Error("query not implemented");}
}
export class MemoryHistoryRepository extends HistoryRepository {
  constructor({maxRows=50000}={}){super();this.maxRows=maxRows;this.rows=[];}
  async append(record){this.rows.push(Object.freeze({...record}));if(this.rows.length>this.maxRows)this.rows.splice(0,this.rows.length-this.maxRows);return record;}
  async query({symbol,timeframe,limit=500}={}){return this.rows.filter(r=>(!symbol||r.symbol===symbol)&&(!timeframe||r.timeframe===timeframe)).slice(-Math.max(1,Math.min(Number(limit)||500,5000)));}
}
export class PostgresHistoryRepository extends HistoryRepository {
  constructor({query}){super();if(typeof query!=="function")throw new Error("postgres query function required");this.dbQuery=query;}
  async append(r){await this.dbQuery(`INSERT INTO marsx_ohlcv(symbol,timeframe,time,open,high,low,close,volume,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(symbol,timeframe,time,source) DO UPDATE SET open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,close=EXCLUDED.close,volume=EXCLUDED.volume`,[r.symbol,r.timeframe,r.time,r.open,r.high,r.low,r.close,r.volume||0,r.source||"unknown"]);return r;}
  async query({symbol,timeframe,limit=500}){const x=await this.dbQuery(`SELECT symbol,timeframe,time,open,high,low,close,volume,source FROM marsx_ohlcv WHERE symbol=$1 AND timeframe=$2 ORDER BY time DESC LIMIT $3`,[symbol,timeframe,Math.max(1,Math.min(Number(limit)||500,5000))]);return [...(x.rows||[])].reverse();}
}
export const OHLCV_SCHEMA=`CREATE TABLE IF NOT EXISTS marsx_ohlcv (
 symbol TEXT NOT NULL,timeframe TEXT NOT NULL,time TIMESTAMPTZ NOT NULL,
 open DOUBLE PRECISION NOT NULL,high DOUBLE PRECISION NOT NULL,low DOUBLE PRECISION NOT NULL,close DOUBLE PRECISION NOT NULL,
 volume DOUBLE PRECISION NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'unknown',
 PRIMARY KEY(symbol,timeframe,time,source)
);
CREATE INDEX IF NOT EXISTS marsx_ohlcv_lookup ON marsx_ohlcv(symbol,timeframe,time DESC);`;
