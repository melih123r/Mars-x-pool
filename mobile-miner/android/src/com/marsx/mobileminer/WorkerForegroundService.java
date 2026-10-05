package com.marsx.mobileminer;
import android.app.*;
import android.content.*;
import android.os.*;

/** Explicit, visible experimental device session. Production money movement is absent. */
public final class WorkerForegroundService extends Service {
 public static final String ACTION_START="com.marsx.mobileminer.START_SESSION";
 public static final String ACTION_STOP="com.marsx.mobileminer.STOP_SESSION";
 public static final String ACTION_HEARTBEAT="com.marsx.mobileminer.SESSION_HEARTBEAT";
 private static final String CHANNEL="marsx_worker_session";
 private final Handler handler=new Handler(Looper.getMainLooper());
 private NativeEngineSession engine;
 private long lastHeartbeat, startedAt;
 private boolean running;
 private static volatile boolean active;
 private static volatile int acceptedShares;
 public static int acceptedShares(){return acceptedShares;}
 public static boolean isRunning(){return active;}
 private final Runnable watchdog=new Runnable(){public void run(){
  PowerManager power=getSystemService(PowerManager.class);
  if(!running||SystemClock.elapsedRealtime()-lastHeartbeat>2500||SystemClock.elapsedRealtime()-startedAt>=600000||
      power==null||power.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE){stopSession();return;}
  handler.postDelayed(this,500);
 }};
 public void onCreate(){super.onCreate();NotificationManager n=getSystemService(NotificationManager.class);
  if(n!=null)n.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X Worker",NotificationManager.IMPORTANCE_LOW));}
 public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null||ACTION_STOP.equals(intent.getAction())){stopSession();return START_NOT_STICKY;}
  if(ACTION_HEARTBEAT.equals(intent.getAction())){
   if(running&&safe(intent)==null)lastHeartbeat=SystemClock.elapsedRealtime();else stopSession();
   return START_NOT_STICKY;
  }
  if(!ACTION_START.equals(intent.getAction())||running||safe(intent)!=null||!EngineArtifact.ready(this)){
   stopSession();return START_NOT_STICKY;
  }
  NotificationManager manager=getSystemService(NotificationManager.class);
  if(manager==null||!manager.areNotificationsEnabled()){stopSession();return START_NOT_STICKY;}
  try{
   VrscConfig config=new VrscConfig(intent.getStringExtra("address"),intent.getStringExtra("worker"),0);
   Intent stop=new Intent(this,WorkerForegroundService.class).setAction(ACTION_STOP);
   PendingIntent pi=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   Notification note=new Notification.Builder(this,CHANNEL).setSmallIcon(com.marsx.mobileminer.R.drawable.ic_launcher)
    .setContentTitle("MARS-X · deneysel VRSC kazımı").setContentText("1 CPU thread · 10 dakika sınırı · Vipor")
    .setOngoing(true).addAction(new Notification.Action.Builder(null,"DURDUR",pi).build()).build();
   startForeground(1001,note);
   lastHeartbeat=startedAt=SystemClock.elapsedRealtime();
   engine=new NativeEngineSession();running=true;acceptedShares=0;
   engine.start(EngineArtifact.binary(this),EngineArtifact.ENGINE_SHA,config,true,true,null,
     ()->handler.post(()->stopSession()),()->acceptedShares++);
   active=true;handler.post(watchdog);
  }catch(Exception error){stopSession();}
  return START_NOT_STICKY;
 }
 private String safe(Intent i){
  return SafetyPolicy.veto(i.getBooleanExtra("consent",false),true,i.getBooleanExtra("visible",false),
   i.getDoubleExtra("temperature",Double.NaN),i.getIntExtra("battery",-1),i.getIntExtra("thermal",-1),
   i.getBooleanExtra("plugged",false),i.getBooleanExtra("unmetered",false),i.getLongExtra("ageMs",5001),
   running?SystemClock.elapsedRealtime()-startedAt:0);
 }
 private void stopSession(){
  active=false;running=false;handler.removeCallbacks(watchdog);
  if(engine!=null){engine.close();engine=null;}
  stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
 }
 public void onTaskRemoved(Intent root){stopSession();super.onTaskRemoved(root);}
 public void onDestroy(){active=false;running=false;handler.removeCallbacksAndMessages(null);if(engine!=null){engine.close();engine=null;}
  stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
 public IBinder onBind(Intent i){return null;}
}
