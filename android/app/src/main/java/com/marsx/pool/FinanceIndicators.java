package com.marsx.pool;
/** Deterministic, allocation-light price indicators. NaN marks warm-up periods. */
public final class FinanceIndicators {
 private FinanceIndicators(){}
 private static void validate(double[] prices,int period){
  if(prices==null||period<1)throw new IllegalArgumentException("Invalid period or prices");
  for(double v:prices)if(!Double.isFinite(v)||v<=0)throw new IllegalArgumentException("Invalid price");
 }
 public static double[] sma(double[] prices,int period){
  validate(prices,period);double[] out=new double[prices.length];double sum=0;
  for(int i=0;i<prices.length;i++){sum+=prices[i];if(i>=period)sum-=prices[i-period];out[i]=i+1>=period?sum/period:Double.NaN;}return out;
 }
 public static double[] ema(double[] prices,int period){
  validate(prices,period);double[] out=new double[prices.length];double sum=0,previous=Double.NaN,k=2.0/(period+1);
  for(int i=0;i<prices.length;i++){if(i<period)sum+=prices[i];if(i+1<period)out[i]=Double.NaN;else if(i+1==period){previous=sum/period;out[i]=previous;}else{previous=prices[i]*k+previous*(1-k);out[i]=previous;}}return out;
 }
 public static double[] rsi(double[] prices,int period){
  validate(prices,period);double[] out=new double[prices.length];java.util.Arrays.fill(out,Double.NaN);
  if(prices.length<=period)return out;
  double gain=0,loss=0;
  for(int i=1;i<=period;i++){double d=prices[i]-prices[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}
  gain/=period;loss/=period;out[period]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);
  for(int i=period+1;i<prices.length;i++){double d=prices[i]-prices[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;out[i]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);}
  return out;
 }
}
