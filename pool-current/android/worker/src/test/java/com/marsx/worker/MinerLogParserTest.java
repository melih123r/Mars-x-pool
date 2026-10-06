package com.marsx.worker;

import org.junit.Test;
import static org.junit.Assert.*;

public class MinerLogParserTest {
 @Test public void parsesRealCcminerHashrate(){
  assertEquals(595002d,MinerLogParser.hashrate("Speed [15 sec]: 0.595002 MH/s,"),0.01);
  assertEquals(1000000d,MinerLogParser.hashrate("Speed [15 sec]: 1 MH/s,"),0.01);
  assertEquals(8500d,MinerLogParser.hashrate("8.5 kH/s"),0.01);
  assertEquals(2000000000d,MinerLogParser.hashrate("2 GH/s"),0.01);
  assertEquals(-1d,MinerLogParser.hashrate("latency 45 ms"),0d);
  assertEquals(-1d,MinerLogParser.hashrate("retrying in 5 seconds"),0d);
 }
 @Test public void detectsRealShareResultsWithoutFalsePositives(){
  assertTrue(MinerLogParser.accepted("stratum | Accepted share #4"));
  assertTrue(MinerLogParser.accepted("share accepted yay!!!"));
  assertTrue(MinerLogParser.rejected("share rejected booooo"));
  assertFalse(MinerLogParser.accepted("connection accepted by proxy"));
  assertFalse(MinerLogParser.rejected("connection refused; retrying"));
 }
 @Test public void detectsPoolConnection(){
  assertTrue(MinerLogParser.connected("stratum connected"));
  assertTrue(MinerLogParser.connected("stratum | Authorized worker droidMiner.217232"));
  assertTrue(MinerLogParser.connected("login succeeded"));
  assertFalse(MinerLogParser.connected("retrying in 5 seconds"));
 }
}
