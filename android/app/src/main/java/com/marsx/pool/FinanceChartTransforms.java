package com.marsx.pool;

import java.util.Arrays;

/**
 * Pure chart-series transforms for the Android renderer.
 * No network, broker, order or account side effects.
 */
public final class FinanceChartTransforms {
 private FinanceChartTransforms() {}

 public static final class Candle {
  public final long timestamp;
  public final double open, high, low, close, volume;

  public Candle(long timestamp,double open,double high,double low,double close,double volume){
   if(timestamp<=0||!finitePositive(open)||!finitePositive(high)||!finitePositive(low)||
      !finitePositive(close)||!Double.isFinite(volume)||volume<0||
      high<Math.max(open,close)||low>Math.min(open,close)||high<low){
    throw new IllegalArgumentException("Invalid candle");
   }
   this.timestamp=timestamp;this.open=open;this.high=high;this.low=low;
   this.close=close;this.volume=volume;
  }
 }

 private static boolean finitePositive(double value){
  return Double.isFinite(value)&&value>0;
 }

 private static void validate(Candle[] candles){
  if(candles==null)throw new IllegalArgumentException("Candles required");
  long previous=-1;
  for(Candle candle:candles){
   if(candle==null||candle.timestamp<=previous)throw new IllegalArgumentException("Candles must be ordered");
   previous=candle.timestamp;
  }
 }

 /** Converts canonical OHLCV into deterministic Heikin-Ashi candles. */
 public static Candle[] heikinAshi(Candle[] candles){
  validate(candles);
  Candle[] out=new Candle[candles.length];
  for(int i=0;i<candles.length;i++){
   Candle raw=candles[i];
   double close=(raw.open+raw.high+raw.low+raw.close)/4.0;
   double open=i==0?(raw.open+raw.close)/2.0:(out[i-1].open+out[i-1].close)/2.0;
   double high=Math.max(raw.high,Math.max(open,close));
   double low=Math.min(raw.low,Math.min(open,close));
   out[i]=new Candle(raw.timestamp,open,high,low,close,raw.volume);
  }
  return out;
 }

 /** Closing-price series shared by line, area and baseline renderers. */
 public static double[] closeSeries(Candle[] candles){
  validate(candles);
  double[] out=new double[candles.length];
  for(int i=0;i<candles.length;i++)out[i]=candles[i].close;
  return out;
 }

 /** Baseline percentage delta; the first visible point is the default anchor. */
 public static double[] baselinePercent(Candle[] candles,int anchorIndex){
  validate(candles);
  if(anchorIndex<0||anchorIndex>=candles.length)throw new IllegalArgumentException("Invalid anchor");
  double anchor=candles[anchorIndex].close;
  double[] out=new double[candles.length];
  for(int i=0;i<candles.length;i++)out[i]=(candles[i].close/anchor-1.0)*100.0;
  return out;
 }

 /** 0..1 volume heights for allocation-light Canvas drawing. */
 public static double[] normalizedVolume(Candle[] candles){
  validate(candles);
  double max=0;
  for(Candle candle:candles)max=Math.max(max,candle.volume);
  double[] out=new double[candles.length];
  if(max==0)return out;
  for(int i=0;i<candles.length;i++)out[i]=candles[i].volume/max;
  return out;
 }

 public static Candle[] copy(Candle[] candles){
  validate(candles);
  return Arrays.copyOf(candles,candles.length);
 }
}
