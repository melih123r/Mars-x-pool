package com.marsx.pool;

import static org.junit.Assert.*;
import org.junit.Test;

/** Regression coverage for the advanced, allocation-light chart indicators. */
public final class FinanceIndicatorsAdvancedTest {
 @Test public void wmaAndRocProduceDeterministicSeries(){
  double[] prices={10,11,12,15};
  double[] wma=FinanceIndicators.wma(prices,3);
  assertTrue(Double.isNaN(wma[1]));
  assertEquals(68.0/6.0,wma[2],1e-9);
  assertEquals(83.0/6.0,wma[3],1e-9);
  double[] roc=FinanceIndicators.roc(prices,2);
  assertEquals(20.0,roc[2],1e-9);
  assertEquals((15.0/11.0-1.0)*100.0,roc[3],1e-9);
 }

 @Test public void bollingerIsFlatForConstantPrices(){
  FinanceIndicators.Bands bands=FinanceIndicators.bollinger(
    new double[]{10,10,10,10},3,2);
  assertTrue(Double.isNaN(bands.middle[1]));
  assertEquals(10,bands.middle[2],1e-9);
  assertEquals(10,bands.upper[2],1e-9);
  assertEquals(10,bands.lower[2],1e-9);
 }

 @Test public void macdMaintainsLineSignalHistogramIdentity(){
  double[] prices={1,2,3,4,5,6,7,8,9,10};
  FinanceIndicators.Macd macd=FinanceIndicators.macd(prices,2,3,2);
  assertTrue(Double.isNaN(macd.line[1]));
  for(int i=0;i<prices.length;i++){
   if(Double.isFinite(macd.signal[i])){
    assertEquals(macd.line[i]-macd.signal[i],macd.histogram[i],1e-12);
   }
  }
  assertTrue(Double.isFinite(macd.histogram[prices.length-1]));
 }

 @Test public void obvUsesDirectionAndPreservesFlatCloses(){
  double[] obv=FinanceIndicators.obv(
    new double[]{10,11,11,9,12},
    new double[]{5,7,13,3,11});
  assertArrayEquals(new double[]{0,7,7,4,15},obv,1e-9);
 }

 @Test(expected=IllegalArgumentException.class)
 public void rejectsInvalidMacdPeriods(){
  FinanceIndicators.macd(new double[]{1,2,3},3,2,1);
 }

 @Test(expected=IllegalArgumentException.class)
 public void rejectsMismatchedVolumes(){
  FinanceIndicators.obv(new double[]{1,2},new double[]{1});
 }
}
