package com.marsx.pool;

import static org.junit.Assert.*;
import org.junit.Test;

public final class FinanceChartTransformsTest {
 private static FinanceChartTransforms.Candle c(long t,double o,double h,double l,double close,double volume){
  return new FinanceChartTransforms.Candle(t,o,h,l,close,volume);
 }

 @Test public void heikinAshiIsDeterministicAndPreservesMetadata(){
  FinanceChartTransforms.Candle[] raw={
   c(1,10,14,8,12,100),
   c(2,12,16,11,15,250)
  };
  FinanceChartTransforms.Candle[] out=FinanceChartTransforms.heikinAshi(raw);
  assertEquals(11.0,out[0].open,0.000001);
  assertEquals(11.0,out[0].close,0.000001);
  assertEquals(11.0,out[1].open,0.000001);
  assertEquals(13.5,out[1].close,0.000001);
  assertEquals(16.0,out[1].high,0.000001);
  assertEquals(11.0,out[1].low,0.000001);
  assertEquals(2,out[1].timestamp);
  assertEquals(250,out[1].volume,0.0);
 }

 @Test public void derivesLineBaselineAndVolumeSeries(){
  FinanceChartTransforms.Candle[] raw={
   c(1,10,11,9,10,0),
   c(2,10,13,9,12,25),
   c(3,12,13,9,9,100)
  };
  assertArrayEquals(new double[]{10,12,9},FinanceChartTransforms.closeSeries(raw),0.0);
  assertArrayEquals(new double[]{0,20,-10},FinanceChartTransforms.baselinePercent(raw,0),0.000001);
  assertArrayEquals(new double[]{0,0.25,1},FinanceChartTransforms.normalizedVolume(raw),0.000001);
 }

 @Test public void rejectsInvalidOrUnorderedCandles(){
  assertThrows(IllegalArgumentException.class,()->c(1,10,9,8,10,1));
  FinanceChartTransforms.Candle[] unordered={c(2,10,11,9,10,1),c(1,10,11,9,10,1)};
  assertThrows(IllegalArgumentException.class,()->FinanceChartTransforms.heikinAshi(unordered));
  assertThrows(IllegalArgumentException.class,()->FinanceChartTransforms.baselinePercent(
    new FinanceChartTransforms.Candle[]{c(1,10,11,9,10,1)},1));
 }
}
