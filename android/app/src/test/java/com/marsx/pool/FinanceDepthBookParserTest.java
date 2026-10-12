package com.marsx.pool;

import static org.junit.Assert.*;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public final class FinanceDepthBookParserTest {
 private static final long NOW=1791780000000L;

 @Test public void parsesFreshReadOnlySnapshot() throws Exception {
  FinanceDepthBookParser.Snapshot result=FinanceDepthBookParser.parse(
    payload(false,"2026-10-12T04:39:59Z"),NOW,60_000);
  assertEquals("BTCUSDT",result.symbol);
  assertEquals(123L,result.lastUpdateId);
  assertEquals(2,result.book.bidCount());
  assertEquals(100.0,result.book.bestBid(),0.0);
  assertEquals(101.0,result.book.bestAsk(),0.0);
 }

 @Test public void rejectsExecutableAndStaleSnapshots() throws Exception {
  assertThrows(IllegalArgumentException.class,()->FinanceDepthBookParser.parse(
    payload(true,"2026-10-12T04:39:59Z"),NOW,60_000));
  assertThrows(IllegalArgumentException.class,()->FinanceDepthBookParser.parse(
    payload(false,"2026-10-12T04:00:00Z"),NOW,60_000));
 }

 @Test public void rejectsOversizedAndUnorderedBooks() throws Exception {
  JSONObject oversized=payload(false,"2026-10-12T04:39:59Z");
  JSONArray bids=new JSONArray();
  for(int i=0;i<=FinanceDepthBook.MAX_LEVELS_PER_SIDE;i++)
   bids.put(new JSONArray().put(String.valueOf(1000-i)).put("1"));
  oversized.put("bids",bids);
  assertThrows(IllegalArgumentException.class,()->FinanceDepthBookParser.parse(
    oversized,NOW,60_000));

  JSONObject unordered=payload(false,"2026-10-12T04:39:59Z");
  unordered.put("bids",new JSONArray()
    .put(new JSONArray().put("99").put("1"))
    .put(new JSONArray().put("100").put("1")));
  assertThrows(IllegalArgumentException.class,()->FinanceDepthBookParser.parse(
    unordered,NOW,60_000));
 }

 private static JSONObject payload(boolean executable,String receivedAt) throws Exception {
  return new JSONObject()
    .put("provider","Binance Spot public data")
    .put("symbol","BTCUSDT")
    .put("mode","READ_ONLY")
    .put("executable",executable)
    .put("orderBookType","EXTERNAL_MARKET_SNAPSHOT")
    .put("lastUpdateId",123)
    .put("receivedAt",receivedAt)
    .put("bids",new JSONArray()
      .put(new JSONArray().put("100").put("2"))
      .put(new JSONArray().put("99").put("3")))
    .put("asks",new JSONArray()
      .put(new JSONArray().put("101").put("4"))
      .put(new JSONArray().put("102").put("6")));
 }
}
