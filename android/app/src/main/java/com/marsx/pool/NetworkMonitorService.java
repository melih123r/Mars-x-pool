package com.marsx.pool;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.os.Build;
import android.os.SystemClock;
import android.net.TrafficStats;
import android.content.SharedPreferences;

/** Foreground-only, opt-in local app-UID usage sampler. No proxy, resale, or payments. */
public final class NetworkMonitorService extends Service {
    public static final String ACTION_START="com.marsx.pool.NETWORK_MONITOR_START";
    public static final String ACTION_STOP="com.marsx.pool.NETWORK_MONITOR_STOP";
    private static final String CHANNEL="marsx_network_monitor";
    private long started,rxStart,txStart;
    private boolean running;
    @Override public void onCreate(){
        super.onCreate();
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X bağlantı izleme",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null || ACTION_STOP.equals(intent.getAction())){
            finishSession();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        SharedPreferences p=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        if(!ACTION_START.equals(intent.getAction()) || !p.getBoolean("consented",false)){
            stopSelf();return START_NOT_STICKY;
        }
        if(!running){
            started=SystemClock.elapsedRealtime();
            rxStart=TrafficStats.getUidRxBytes(android.os.Process.myUid());
            txStart=TrafficStats.getUidTxBytes(android.os.Process.myUid());
            running=true;
        }
        Notification notification=new Notification.Builder(this,CHANNEL)
            .setContentTitle("MARS-X Network")
            .setContentText("Yalnızca uygulama trafiği izleniyor • paylaşım kapalı")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true).build();
        startForeground(2001,notification);
        p.edit().putBoolean("monitor_active",true).apply();
        return START_NOT_STICKY;
    }
    private void finishSession(){
        if(!running)return;
        running=false;
        SharedPreferences p=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        long seconds=Math.max(0,(SystemClock.elapsedRealtime()-started)/1000);
        long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
        long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
        long bytes=rx<0||tx<0||rxStart<0||txStart<0?0:Math.max(0,rx-rxStart)+Math.max(0,tx-txStart);
        p.edit().putBoolean("monitor_active",false)
            .putLong("last_session_seconds",seconds).putLong("last_session_bytes",bytes)
            .putLong("total_session_seconds",p.getLong("total_session_seconds",0)+seconds)
            .putLong("total_session_bytes",p.getLong("total_session_bytes",0)+bytes).apply();
    }
    @Override public void onDestroy(){finishSession();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
