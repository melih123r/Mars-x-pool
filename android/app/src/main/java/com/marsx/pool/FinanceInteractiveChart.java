package com.marsx.pool;
import android.content.Context;
import android.graphics.*;
import android.view.*;
import java.util.*;
import org.json.*;
/** Read-only chart; input must be verified OHLCV in ascending timestamp order. */
public final class FinanceInteractiveChart extends View {
 public static final class Bar {
  public final long time;public final float open,high,low,close,volume;
  public Bar(long t,float o,float h,float l,float c,float v){
   if(t<=0||!Float.isFinite(o)||!Float.isFinite(h)||!Float.isFinite(l)||!Float.isFinite(c)||!Float.isFinite(v)||l<=0||v<0||h<Math.max(o,c)||l>Math.min(o,c))throw new IllegalArgumentException("Invalid OHLCV");
   time=t;open=o;high=h;low=l;close=c;volume=v;
  }
 }
 public int accent=Color.rgb(255,120,35);
 private final ArrayList<Bar> data=new ArrayList<>();
 private final Paint p=new Paint(3);
 private final ScaleGestureDetector pinch;
 private float count=48,offset=0,lastX,cross=-1;
 private boolean showEma=true,showSma=false,showRsi=true;
 public FinanceInteractiveChart(Context c){super(c);setBackgroundColor(Color.rgb(7,12,19));pinch=new ScaleGestureDetector(c,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
  @Override public boolean onScale(ScaleGestureDetector d){count=Math.max(12,Math.min(180,count/d.getScaleFactor()));clamp();invalidate();return true;}
 });}
 public void setBars(List<Bar> bars){long prev=0;for(Bar b:bars){if(b.time<=prev)throw new IllegalArgumentException("Unsorted timestamps");prev=b.time;}data.clear();data.addAll(bars);offset=0;invalidate();}
 public void setCandles(JSONArray rows){ArrayList<Bar> bars=new ArrayList<>();try{for(int i=0;i<rows.length();i++){JSONObject x=rows.getJSONObject(i);bars.add(new Bar(x.getLong("time"), (float)x.getDouble("open"),(float)x.getDouble("high"),(float)x.getDouble("low"),(float)x.getDouble("close"),(float)x.optDouble("volume",0)));}setBars(bars);}catch(Exception ex){clear();}}
 public void setIndicators(boolean ema,boolean sma,boolean rsi){showEma=ema;showSma=sma;showRsi=rsi;invalidate();}
 public void clear(){data.clear();invalidate();}
 private void clamp(){offset=Math.max(0,Math.min(offset,Math.max(0,data.size()-count)));}
 @Override public boolean onTouchEvent(MotionEvent e){pinch.onTouchEvent(e);switch(e.getActionMasked()){
  case MotionEvent.ACTION_DOWN:lastX=e.getX();cross=lastX;invalidate();return true;
  case MotionEvent.ACTION_MOVE:if(!pinch.isInProgress()){offset+=(lastX-e.getX())/Math.max(1,getWidth()/count);clamp();}lastX=e.getX();cross=lastX;invalidate();return true;
  default:return true;
 }}
 @Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth(),h=getHeight();if(w<=0||h<=0)return;
  p.setColor(Color.rgb(45,55,70));p.setStrokeWidth(1);for(int i=1;i<5;i++)c.drawLine(0,h*i/5,w,h*i/5,p);
  if(data.isEmpty()){p.setColor(Color.WHITE);p.setTextSize(26);c.drawText("VERİ BEKLENİYOR",16,h/2,p);return;}
  int end=Math.max(0,data.size()-(int)offset),start=Math.max(0,end-(int)Math.ceil(count));if(start>=end)return;
  float hi=0,lo=Float.MAX_VALUE,mv=1;for(int i=start;i<end;i++){Bar b=data.get(i);hi=Math.max(hi,b.high);lo=Math.min(lo,b.low);mv=Math.max(mv,b.volume);}
  float range=Math.max(.00001f,hi-lo),step=w/count,chartH=h*(showRsi?.61f:.72f),volTop=h*(showRsi?.65f:.79f),volBottom=h*(showRsi?.76f:.96f);
  for(int i=start;i<end;i++){Bar b=data.get(i);float x=(i-start+.5f)*step,yo=(hi-b.open)/range*chartH,yc=(hi-b.close)/range*chartH;
   p.setColor(b.close>=b.open?Color.rgb(29,199,131):Color.rgb(230,65,81));p.setStrokeWidth(2);c.drawLine(x,(hi-b.high)/range*chartH,x,(hi-b.low)/range*chartH,p);
   p.setStyle(Paint.Style.FILL);c.drawRect(x-step*.28f,Math.min(yo,yc),x+step*.28f,Math.max(yo,yc)+1,p);
   p.setColor(Color.rgb(80,95,110));c.drawRect(x-step*.28f,volBottom-(b.volume/mv)*(volBottom-volTop),x+step*.28f,volBottom,p);
  }
  double[] closes=new double[data.size()];for(int i=0;i<data.size();i++)closes[i]=data.get(i).close;
  double[] ema=showEma?FinanceIndicators.ema(closes,20):null;
  double[] sma=showSma?FinanceIndicators.sma(closes,20):null;
  Path line=new Path();boolean started=false;
  p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2.5f);p.setColor(accent);
  for(int i=start;showEma&&i<end;i++){if(Double.isNaN(ema[i]))continue;
   float x=(i-start+.5f)*step,y=(float)((hi-ema[i])/range*chartH);
   if(!started){line.moveTo(x,y);started=true;}else line.lineTo(x,y);
  }
  if(started)c.drawPath(line,p);
  if(showSma){Path smaline=new Path();boolean begun=false;p.setColor(Color.rgb(77,171,247));
   for(int i=start;i<end;i++){if(Double.isNaN(sma[i]))continue;float x=(i-start+.5f)*step,y=(float)((hi-sma[i])/range*chartH);
    if(!begun){smaline.moveTo(x,y);begun=true;}else smaline.lineTo(x,y);}
   if(begun)c.drawPath(smaline,p);
  }
  if(showRsi){double[] rsi=FinanceIndicators.rsi(closes,14);float panelTop=h*.80f,panelHeight=h*.17f;
   p.setColor(Color.rgb(50,64,78));p.setStrokeWidth(1);
   c.drawLine(0,panelTop+panelHeight*.3f,w,panelTop+panelHeight*.3f,p);
   c.drawLine(0,panelTop+panelHeight*.7f,w,panelTop+panelHeight*.7f,p);
   Path rsipath=new Path();boolean begun=false;p.setColor(Color.rgb(192,145,255));p.setStrokeWidth(2);
   for(int i=start;i<end;i++){if(Double.isNaN(rsi[i]))continue;float x=(i-start+.5f)*step,y=panelTop+panelHeight*(float)(1-rsi[i]/100);
    if(!begun){rsipath.moveTo(x,y);begun=true;}else rsipath.lineTo(x,y);}
   if(begun)c.drawPath(rsipath,p);
  }
  p.setStyle(Paint.Style.FILL);
  if(cross>=0){p.setColor(Color.LTGRAY);p.setStrokeWidth(1);c.drawLine(cross,0,cross,h,p);}
 }
}
