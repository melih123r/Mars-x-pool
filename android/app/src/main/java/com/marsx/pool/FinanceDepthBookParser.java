package com.marsx.pool;

import java.time.Instant;
import org.json.JSONArray;
import org.json.JSONObject;

/** Strict parser for backend-proxied, read-only external order-book snapshots. */
public final class FinanceDepthBookParser {
 private static final long MAX_FUTURE_SKEW_MS=5_000L;
 private FinanceDepthBookParser(){}

 public static final class Snapshot {
  public final FinanceDepthBook book;
  public final String symbol;
  public final long lastUpdateId,receivedAtEpochMs;
  private Snapshot(FinanceDepthBook book,String symbol,long lastUpdateId,long receivedAtEpochMs){
   this.book=book;this.symbol=symbol;this.lastUpdateId=lastUpdateId;
   this.receivedAtEpochMs=receivedAtEpochMs;
  }
 }

 public static Snapshot parse(JSONObject payload,long nowMs,long maxAgeMs){
  if(payload==null)throw new IllegalArgumentException("Missing depth payload");
  if(nowMs<=0||maxAgeMs<=0)throw new IllegalArgumentException("Invalid freshness bounds");
  try{
   if(!"READ_ONLY".equals(payload.getString("mode"))||
      payload.optBoolean("executable",true)||
      !"EXTERNAL_MARKET_SNAPSHOT".equals(payload.getString("orderBookType")))
    throw new IllegalArgumentException("Executable or untrusted depth payload");
   String symbol=payload.getString("symbol").trim().toUpperCase(java.util.Locale.US);
   if(!symbol.matches("[A-Z0-9]{5,20}"))
    throw new IllegalArgumentException("Invalid market symbol");
   long updateId=payload.getLong("lastUpdateId");
   if(updateId<0)throw new IllegalArgumentException("Invalid depth update id");
   long received=Instant.parse(payload.getString("receivedAt")).toEpochMilli();
   if(received>nowMs+MAX_FUTURE_SKEW_MS||nowMs-received>maxAgeMs)
    throw new IllegalArgumentException("Stale depth snapshot");
   FinanceDepthBook.Level[] bids=levels(payload.getJSONArray("bids"));
   FinanceDepthBook.Level[] asks=levels(payload.getJSONArray("asks"));
   return new Snapshot(new FinanceDepthBook(bids,asks),symbol,updateId,received);
  }catch(IllegalArgumentException ex){
   throw ex;
  }catch(Exception ex){
   throw new IllegalArgumentException("Invalid depth payload",ex);
  }
 }

 private static FinanceDepthBook.Level[] levels(JSONArray rows){
  int count=rows.length();
  if(count<1||count>FinanceDepthBook.MAX_LEVELS_PER_SIDE)
   throw new IllegalArgumentException("Depth levels missing or oversized");
  FinanceDepthBook.Level[] out=new FinanceDepthBook.Level[count];
  for(int i=0;i<count;i++){
   JSONArray row=rows.getJSONArray(i);
   if(row.length()!=2)throw new IllegalArgumentException("Invalid depth row");
   out[i]=new FinanceDepthBook.Level(
     Double.parseDouble(row.getString(0)),
     Double.parseDouble(row.getString(1)));
  }
  return out;
 }
}
