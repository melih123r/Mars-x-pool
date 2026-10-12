package com.marsx.pool;

import android.content.Context;
import android.graphics.*;
import android.view.MotionEvent;
import android.view.View;

/** Read-only cumulative market-depth renderer. It never submits or mutates orders. */
public final class FinanceDepthChartView extends View {
 private final Paint grid=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Paint bid=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Paint ask=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Paint label=new Paint(Paint.ANTI_ALIAS_FLAG);
 private final Path bidPath=new Path(),askPath=new Path();
 private FinanceDepthBook book;
 private FinanceDepthChartGeometry.Snapshot geometry;
 private float crossX=-1;

 public FinanceDepthChartView(Context context){
  super(context);
  setBackgroundColor(Color.rgb(7,12,19));
  setContentDescription("Piyasa derinlik grafiği");
  grid.setColor(Color.rgb(42,53,68));grid.setStrokeWidth(1);
  bid.setColor(Color.argb(185,29,199,131));
  ask.setColor(Color.argb(185,230,65,81));
  label.setColor(Color.rgb(220,226,234));label.setTextSize(24);
 }

 public void setBook(FinanceDepthBook next){
  if(next==null)throw new IllegalArgumentException("Missing depth book");
  book=next;geometry=FinanceDepthChartGeometry.from(next);crossX=-1;invalidate();
 }

 public void clear(){
  book=null;geometry=null;crossX=-1;invalidate();
 }

 @Override protected void onDraw(Canvas canvas){
  super.onDraw(canvas);
  float width=getWidth(),height=getHeight();
  if(width<=0||height<=0)return;
  for(int i=1;i<5;i++)canvas.drawLine(0,height*i/5f,width,height*i/5f,grid);
  if(book==null||geometry==null){
   canvas.drawText("DERİNLİK VERİSİ BEKLENİYOR",16,height/2f,label);
   return;
  }

  buildArea(bidPath,geometry,true,width,height);
  buildArea(askPath,geometry,false,width,height);
  canvas.drawPath(bidPath,bid);
  canvas.drawPath(askPath,ask);

  float mid=width*(float)normalizedMid(book);
  canvas.drawLine(mid,0,mid,height,grid);
  canvas.drawText("ALIŞ",16,32,label);
  float askLabelWidth=label.measureText("SATIŞ");
  canvas.drawText("SATIŞ",Math.max(16,width-askLabelWidth-16),32,label);
  String spread=String.format(java.util.Locale.US,"Spread %.2f bps",book.spreadBps());
  float spreadWidth=label.measureText(spread);
  canvas.drawText(spread,Math.max(8,(width-spreadWidth)/2f),height-12,label);

  if(crossX>=0){
   Paint cross=grid;
   cross.setColor(Color.LTGRAY);
   canvas.drawLine(crossX,0,crossX,height,cross);
   cross.setColor(Color.rgb(42,53,68));
  }
 }

 private static void buildArea(Path path,FinanceDepthChartGeometry.Snapshot data,
                               boolean bids,float width,float height){
  path.reset();
  int count=bids?data.bidCount():data.askCount();
  if(count==0)return;
  float firstX=width*(float)(bids?data.bidX(0):data.askX(0));
  path.moveTo(firstX,height);
  for(int i=0;i<count;i++){
   float x=width*(float)(bids?data.bidX(i):data.askX(i));
   float y=height*(float)(bids?data.bidY(i):data.askY(i));
   path.lineTo(x,y);
  }
  float lastX=width*(float)(bids?data.bidX(count-1):data.askX(count-1));
  path.lineTo(lastX,height);
  path.close();
 }

 private static double normalizedMid(FinanceDepthBook book){
  double low=book.bidAt(book.bidCount()-1).price;
  double high=book.askAt(book.askCount()-1).price;
  return Math.max(0,Math.min(1,(book.midPrice()-low)/(high-low)));
 }

 @Override public boolean onTouchEvent(MotionEvent event){
  switch(event.getActionMasked()){
   case MotionEvent.ACTION_DOWN:
   case MotionEvent.ACTION_MOVE:
    getParent().requestDisallowInterceptTouchEvent(true);
    crossX=Math.max(0,Math.min(getWidth(),event.getX()));invalidate();return true;
   case MotionEvent.ACTION_UP:
    crossX=-1;invalidate();performClick();return true;
   case MotionEvent.ACTION_CANCEL:
    crossX=-1;invalidate();return true;
   default:return true;
  }
 }

 @Override public boolean performClick(){super.performClick();return true;}
}
