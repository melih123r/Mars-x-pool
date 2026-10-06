package com.marsx.worker;

import org.junit.Test;
import static org.junit.Assert.*;

public class MinerLogParserTest {
 @Test public void parsesHashrateUnits(){
  assertEquals(1230000d,MinerLogParser.hashrate("speed 1.23 MH/s"),0.01);
  assertEquals(8500d,MinerLogParser.hashrate("8.5 kH/s"),0.01);
  assertEquals(2000000000d,MinerLogParser.hashrate("2 GH/s"),0.01);
  assertEquals(-1d,MinerLogParser.hashrate("no rate here"),0d);
 }
 @Test public void detectsShareResults(){
  assertTrue(MinerLogParser.accepted("share accepted yay!!!"));
  assertTrue(MinerLogParser.rejected("share rejected booooo"));
  assertFalse(MinerLogParser.accepted("connection accepted by proxy"));
  assertFalse(MinerLogParser.rejected("no rejected share text here"));
 }
 @Test public void detectsPoolConnection(){
  assertTrue(MinerLogParser.connected("stratum connected"));
  assertTrue(MinerLogParser.connected("login succeeded"));
  assertFalse(MinerLogParser.connected("retrying in 5 seconds"));
 }
}
