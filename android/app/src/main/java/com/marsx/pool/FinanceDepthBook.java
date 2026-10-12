package com.marsx.pool;

import java.util.Arrays;

/**
 * Immutable, read-only order-book snapshot for the depth renderer.
 * The level cap prevents untrusted provider responses from causing unbounded memory use.
 */
public final class FinanceDepthBook {
 public static final int MAX_LEVELS_PER_SIDE=200;

 public static final class Level {
  public final double price,size;
  public Level(double price,double size){
   if(!Double.isFinite(price)||price<=0||!Double.isFinite(size)||size<=0)
    throw new IllegalArgumentException("Invalid depth level");
   this.price=price;this.size=size;
  }
 }

 private final Level[] bids,asks;
 private final double[] bidCumulative,askCumulative;
 private final double maxCumulative;

 public FinanceDepthBook(Level[] bids,Level[] asks){
  if(bids==null||asks==null||bids.length==0||asks.length==0||
     bids.length>MAX_LEVELS_PER_SIDE||asks.length>MAX_LEVELS_PER_SIDE)
   throw new IllegalArgumentException("Depth sides required and bounded");
  this.bids=copyAndValidate(bids,true);
  this.asks=copyAndValidate(asks,false);
  if(this.bids[0].price>=this.asks[0].price)
   throw new IllegalArgumentException("Crossed order book");
  bidCumulative=cumulative(this.bids);
  askCumulative=cumulative(this.asks);
  maxCumulative=Math.max(bidCumulative[bidCumulative.length-1],
                         askCumulative[askCumulative.length-1]);
 }

 private static Level[] copyAndValidate(Level[] source,boolean descending){
  Level[] out=Arrays.copyOf(source,source.length);
  for(int i=0;i<out.length;i++){
   if(out[i]==null)throw new IllegalArgumentException("Missing depth level");
   if(i>0){
    boolean ordered=descending?out[i-1].price>out[i].price:out[i-1].price<out[i].price;
    if(!ordered)throw new IllegalArgumentException("Depth prices must be unique and ordered");
   }
  }
  return out;
 }

 private static double[] cumulative(Level[] levels){
  double[] out=new double[levels.length];double total=0;
  for(int i=0;i<levels.length;i++){
   total+=levels[i].size;
   if(!Double.isFinite(total))throw new IllegalArgumentException("Depth size overflow");
   out[i]=total;
  }
  return out;
 }

 public int bidCount(){return bids.length;}
 public int askCount(){return asks.length;}
 public Level bidAt(int index){return bids[index];}
 public Level askAt(int index){return asks[index];}
 public double bidCumulativeAt(int index){return bidCumulative[index];}
 public double askCumulativeAt(int index){return askCumulative[index];}
 public double maxCumulative(){return maxCumulative;}
 public double bestBid(){return bids[0].price;}
 public double bestAsk(){return asks[0].price;}
 public double midPrice(){return (bestBid()+bestAsk())/2.0;}
 public double spread(){return bestAsk()-bestBid();}
 public double spreadBps(){return spread()/midPrice()*10000.0;}
}
