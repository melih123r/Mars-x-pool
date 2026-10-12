package com.marsx.pool;

/** Pure, allocation-bounded geometry derived from a verified depth snapshot. */
public final class FinanceDepthChartGeometry {
 private FinanceDepthChartGeometry(){}

 public static final class Snapshot {
  private final double[] bidX,bidY,askX,askY;
  private Snapshot(double[] bidX,double[] bidY,double[] askX,double[] askY){
   this.bidX=bidX;this.bidY=bidY;this.askX=askX;this.askY=askY;
  }
  public int bidCount(){return bidX.length;}
  public int askCount(){return askX.length;}
  public double bidX(int index){return bidX[index];}
  public double bidY(int index){return bidY[index];}
  public double askX(int index){return askX[index];}
  public double askY(int index){return askY[index];}
 }

 public static Snapshot from(FinanceDepthBook book){
  if(book==null)throw new IllegalArgumentException("Missing depth book");
  double low=book.bidAt(book.bidCount()-1).price;
  double high=book.askAt(book.askCount()-1).price;
  double priceRange=high-low;
  double max=book.maxCumulative();
  if(!Double.isFinite(priceRange)||priceRange<=0||!Double.isFinite(max)||max<=0)
   throw new IllegalArgumentException("Invalid depth geometry bounds");
  double[] bx=new double[book.bidCount()],by=new double[book.bidCount()];
  double[] ax=new double[book.askCount()],ay=new double[book.askCount()];
  for(int i=0;i<bx.length;i++){
   bx[i]=unit((book.bidAt(i).price-low)/priceRange);
   by[i]=unit(1.0-book.bidCumulativeAt(i)/max);
  }
  for(int i=0;i<ax.length;i++){
   ax[i]=unit((book.askAt(i).price-low)/priceRange);
   ay[i]=unit(1.0-book.askCumulativeAt(i)/max);
  }
  return new Snapshot(bx,by,ax,ay);
 }

 private static double unit(double value){
  if(!Double.isFinite(value))throw new IllegalArgumentException("Non-finite depth geometry");
  return Math.max(0.0,Math.min(1.0,value));
 }
}
