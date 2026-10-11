package com.marsx.pool;
import java.util.Arrays;

/** Deterministic, allocation-light price indicators. NaN marks warm-up periods. */
public final class FinanceIndicators {
 private FinanceIndicators(){}

 public static final class Bands {
  public final double[] middle,upper,lower;
  Bands(double[] m,double[] u,double[] l){middle=m;upper=u;lower=l;}
 }
 public static final class Macd {
  public final double[] line,signal,histogram;
  Macd(double[] l,double[] s,double[] h){line=l;signal=s;histogram=h;}
 }

 private static void validate(double[] prices,int period){
  if(prices==null||period<1)throw new IllegalArgumentException("Invalid period or prices");
  for(double v:prices)if(!Double.isFinite(v)||v<=0)throw new IllegalArgumentException("Invalid price");
 }
 private static void validateVolumes(double[] prices,double[] volumes){
  validate(prices,1);
  if(volumes==null||volumes.length!=prices.length)throw new IllegalArgumentException("Invalid volumes");
  for(double v:volumes)if(!Double.isFinite(v)||v<0)throw new IllegalArgumentException("Invalid volume");
 }
 private static double[] empty(int length){double[] out=new double[length];Arrays.fill(out,Double.NaN);return out;}

 public static double[] sma(double[] prices,int period){
  validate(prices,period);double[] out=empty(prices.length);double sum=0;
  for(int i=0;i<prices.length;i++){sum+=prices[i];if(i>=period)sum-=prices[i-period];if(i+1>=period)out[i]=sum/period;}return out;
 }
 public static double[] ema(double[] prices,int period){
  validate(prices,period);return emaFrom(prices,period,0);
 }
 private static double[] emaFrom(double[] values,int period,int start){
  double[] out=empty(values.length);if(start<0||start+period>values.length)return out;
  double sum=0;for(int i=start;i<start+period;i++){if(!Double.isFinite(values[i]))return out;sum+=values[i];}
  double previous=sum/period,k=2.0/(period+1);out[start+period-1]=previous;
  for(int i=start+period;i<values.length;i++){if(!Double.isFinite(values[i]))break;previous=values[i]*k+previous*(1-k);out[i]=previous;}return out;
 }
 public static double[] wma(double[] prices,int period){
  validate(prices,period);double[] out=empty(prices.length);double denominator=period*(period+1)/2.0;
  for(int i=period-1;i<prices.length;i++){double weighted=0;for(int j=0;j<period;j++)weighted+=prices[i-period+1+j]*(j+1);out[i]=weighted/denominator;}return out;
 }
 public static double[] rsi(double[] prices,int period){
  validate(prices,period);double[] out=empty(prices.length);if(prices.length<=period)return out;
  double gain=0,loss=0;
  for(int i=1;i<=period;i++){double d=prices[i]-prices[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}
  gain/=period;loss/=period;out[period]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);
  for(int i=period+1;i<prices.length;i++){double d=prices[i]-prices[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;out[i]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);}return out;
 }
 public static double[] roc(double[] prices,int period){
  validate(prices,period);double[] out=empty(prices.length);
  for(int i=period;i<prices.length;i++)out[i]=(prices[i]/prices[i-period]-1.0)*100.0;return out;
 }
 public static Bands bollinger(double[] prices,int period,double deviations){
  validate(prices,period);if(!Double.isFinite(deviations)||deviations<=0)throw new IllegalArgumentException("Invalid deviations");
  double[] middle=sma(prices,period),upper=empty(prices.length),lower=empty(prices.length);
  for(int i=period-1;i<prices.length;i++){double variance=0;for(int j=i-period+1;j<=i;j++){double d=prices[j]-middle[i];variance+=d*d;}double width=Math.sqrt(variance/period)*deviations;upper[i]=middle[i]+width;lower[i]=middle[i]-width;}
  return new Bands(middle,upper,lower);
 }
 public static Macd macd(double[] prices,int fastPeriod,int slowPeriod,int signalPeriod){
  validate(prices,Math.max(fastPeriod,slowPeriod));if(fastPeriod>=slowPeriod||signalPeriod<1)throw new IllegalArgumentException("Invalid MACD periods");
  double[] fast=ema(prices,fastPeriod),slow=ema(prices,slowPeriod),line=empty(prices.length);
  int start=slowPeriod-1;for(int i=start;i<prices.length;i++)line[i]=fast[i]-slow[i];
  double[] signal=emaFrom(line,signalPeriod,start),histogram=empty(prices.length);
  for(int i=0;i<prices.length;i++)if(Double.isFinite(line[i])&&Double.isFinite(signal[i]))histogram[i]=line[i]-signal[i];
  return new Macd(line,signal,histogram);
 }
 public static double[] obv(double[] prices,double[] volumes){
  validateVolumes(prices,volumes);double[] out=new double[prices.length];if(prices.length==0)return out;
  for(int i=1;i<prices.length;i++)out[i]=out[i-1]+(prices[i]>prices[i-1]?volumes[i]:prices[i]<prices[i-1]?-volumes[i]:0);return out;
 }
}