package com.marsx.mobileminer;
import android.app.*; import android.content.*; import android.os.IBinder;
public final class WorkerForegroundService extends Service {
 public static final String ACTION_START="com.marsx.mobileminer.START_SESSION";
 public static final String ACTION_STOP="com.marsx.mobileminer.STOP_SESSION";
 private static final String CHANNEL="marsx_worker_session";
 public void onCreate(){super.onCreate(); NotificationManager n=getSystemService(NotificationManager.class);
  if(n!=null)n.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X Worker",NotificationManager.IMPORTANCE_LOW));}
 public int onStartCommand(Intent i,int flags,int id){
  if(i==null||!ACTION_START.equals(i.getAction())){stopSelf();return START_NOT_STICKY;}
  Intent stop=new Intent(this,WorkerForegroundService.class).setAction(ACTION_STOP);
  PendingIntent pi=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification note=new Notification.Builder(this,CHANNEL).setSmallIcon(com.marsx.mobileminer.R.drawable.ic_launcher)
   .setContentTitle("MARS-X Worker oturumu").setContentText("Kullanıcı başlattı · otomatik yeniden başlatma yok")
   .setOngoing(true).addAction(new Notification.Action.Builder(null,"DURDUR",pi).build()).build();
  startForeground(1001,note); return START_NOT_STICKY;
 }
 public void onTaskRemoved(Intent root){stopSelf();super.onTaskRemoved(root);}
 public void onDestroy(){stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
 public IBinder onBind(Intent i){return null;}
}
