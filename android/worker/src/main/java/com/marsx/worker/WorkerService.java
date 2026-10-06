package com.marsx.worker;
import android.app.*;import android.content.*;import android.os.*;import androidx.annotation.Nullable;
public final class WorkerService extends Service {
 static final String CHANNEL="marsx_worker"; static final int ID=4101; Handler h; Runnable safety;
 public void onCreate(){super.onCreate();NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X Worker",NotificationManager.IMPORTANCE_LOW));h=new Handler(Looper.getMainLooper());safety=()->{if(!safe()){stopCompute();}h.postDelayed(safety,15000);};}
 public int onStartCommand(Intent i,int f,int id){if(i!=null&&"STOP".equals(i.getAction())){stopCompute();stopSelf();return START_NOT_STICKY;}startForeground(ID,new Notification.Builder(this,CHANNEL).setContentTitle("MARS-X Worker").setContentText("Worker güvenlik denetimi aktif").setSmallIcon(android.R.drawable.stat_notify_sync).build());h.removeCallbacks(safety);h.post(safety);if(safe())startComputeIfAvailable();return START_STICKY;}
 boolean safe(){android.os.BatteryManager b=getSystemService(android.os.BatteryManager.class);int pct=b.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY);float temp=readBatteryTemp();return pct>=15&&temp<43f;}
 float readBatteryTemp(){Intent x=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));return x==null?0f:x.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE,0)/10f;}
 void startComputeIfAvailable(){/* Miner executable integration point. Never fabricate running/hashrate state. */}
 void stopCompute(){/* Process handle termination is wired here when an approved miner executable is installed. */}
 public void onDestroy(){if(h!=null)h.removeCallbacksAndMessages(null);stopCompute();super.onDestroy();}
 @Nullable public android.os.IBinder onBind(Intent i){return null;}
}