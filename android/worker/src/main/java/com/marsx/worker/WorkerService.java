package com.marsx.worker;

import android.app.*;
import android.content.*;
import android.os.*;
import android.net.*;
import java.io.*;
import java.security.*;
import java.util.*;
import java.util.regex.*;

public final class WorkerService extends Service {
 static final String CHANNEL="marsx_worker";
 static final int ID=4101;
 static final Pattern RATE=Pattern.compile("(?i)([0-9]+(?:\\\\.[0-9]+)?)\\\\s*([kmg]?)h?/?s");
 static final Pattern ACCEPTED=Pattern.compile("(?i)(accepted|share accepted|yay!!!)");
 static final Pattern REJECTED=Pattern.compile("(?i)(rejected|share rejected|booooo)");
 static final Pattern CONNECTED=Pattern.compile("(?i)(stratum.*(connected|subscribed|authorized)|connected to|login succeeded)");

 Handler h; Runnable safety; java.lang.Process miner; SharedPreferences prefs;
 volatile double hashrate; volatile long accepted,rejected,lastShareAt; volatile boolean poolConnected;
 long restartAfter; int crashCount;
 ConnectivityManager connectivity; ConnectivityManager.NetworkCallback networkCallback; volatile boolean networkAvailable=true;

 @Override public void onCreate(){
  super.onCreate();
  NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26) nm.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X Worker",NotificationManager.IMPORTANCE_LOW));
  h=new Handler(Looper.getMainLooper()); prefs=getSharedPreferences("worker",MODE_PRIVATE);
  accepted=prefs.getLong("accepted_shares",0); rejected=prefs.getLong("rejected_shares",0); lastShareAt=prefs.getLong("last_share_at",0);
  connectivity=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
  networkAvailable=isNetworkUsable();
  if(Build.VERSION.SDK_INT>=24&&connectivity!=null){
   networkCallback=new ConnectivityManager.NetworkCallback(){
    @Override public void onAvailable(Network network){networkAvailable=true;restartAfter=0;h.post(()->{if(prefs.getBoolean("desired_running",false)&&safeToResume())startComputeIfAvailable();});}
    @Override public void onLost(Network network){networkAvailable=isNetworkUsable();if(!networkAvailable){stopCompute();saveState("waiting_network");}}
   };
   try{connectivity.registerDefaultNetworkCallback(networkCallback);}catch(Exception ignored){}
  }
  safety=()->{boolean running=miner!=null; boolean ok=running?safeToKeepRunning():safeToResume(); if(!ok){stopCompute();saveState("protected");}else if(prefs.getBoolean("desired_running",false)&&System.currentTimeMillis()>=restartAfter)startComputeIfAvailable(); h.postDelayed(safety,15000);};
 }

 @Override public int onStartCommand(Intent i,int flags,int startId){
  if(i!=null&&"STOP".equals(i.getAction())){prefs.edit().putBoolean("desired_running",false).apply();stopCompute();saveState("stopped");stopSelf();return START_NOT_STICKY;}
  if(i!=null&&"START".equals(i.getAction()))prefs.edit().putBoolean("desired_running",true).apply();
  if(!prefs.getBoolean("desired_running",false)){saveState("stopped");stopSelf();return START_NOT_STICKY;}
  startForeground(ID,note("Worker güvenlik denetimi aktif"));h.removeCallbacks(safety);h.post(safety);
  if(safeToResume())startComputeIfAvailable();else saveState("protected");return START_STICKY;
 }

 Notification note(String s){Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);return b.setContentTitle("MARS-X Worker").setContentText(s).setSmallIcon(android.R.drawable.stat_notify_sync).setOngoing(true).build();}
 boolean safeToKeepRunning(){return safeLimits(15,43f);} boolean safeToResume(){return safeLimits(20,41f);}
 boolean safeLimits(int batteryMin,float thermalMax){BatteryManager b=(BatteryManager)getSystemService(BATTERY_SERVICE);int pct=b==null?-1:b.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);float temp=readBatteryTemp();boolean batteryOk=pct<0||pct>=batteryMin,tempOk=temp<=0f||temp<thermalMax;if(Build.VERSION.SDK_INT>=29){PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);if(pm!=null&&pm.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_SEVERE)tempOk=false;}return batteryOk&&tempOk;}
 float readBatteryTemp(){Intent x=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));return x==null?0f:x.getIntExtra(BatteryManager.EXTRA_TEMPERATURE,0)/10f;}

 boolean isNetworkUsable(){if(connectivity==null)return true;Network n=connectivity.getActiveNetwork();if(n==null)return false;NetworkCapabilities caps=connectivity.getNetworkCapabilities(n);return caps!=null&&caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);}

 synchronized void startComputeIfAvailable(){
  if(!networkAvailable||!isNetworkUsable()){networkAvailable=false;saveState("waiting_network");return;}
  if(miner!=null){try{miner.exitValue();miner=null;}catch(IllegalThreadStateException running){return;}}
  File bin=new File(getFilesDir(),"miner/ccminer");String pool=prefs.getString("pool",""),user=prefs.getString("user","");
  int threads=Math.max(1,Math.min(Runtime.getRuntime().availableProcessors(),prefs.getInt("threads",Math.max(1,Runtime.getRuntime().availableProcessors()/2))));
  String expected=prefs.getString("miner_sha256","").toLowerCase(Locale.ROOT);
  if(!bin.isFile()||!bin.canExecute()||!expected.matches("[a-f0-9]{64}")||!expected.equals(sha256(bin))||!pool.startsWith("stratum+tcp://")||user.isEmpty()){saveState("setup_required");getSystemService(NotificationManager.class).notify(ID,note("Miner kurulumu/yapılandırması bekleniyor"));return;}
  try{miner=new ProcessBuilder(bin.getAbsolutePath(),"-a","verus","-o",pool,"-u",user,"-p","x","-t",String.valueOf(threads)).redirectErrorStream(true).start();java.lang.Process p=miner;new Thread(()->readMiner(p),"marsx-miner-log").start();saveState("running");getSystemService(NotificationManager.class).notify(ID,note("Miner çalışıyor"));}
  catch(IOException e){miner=null;scheduleRestart();saveState("error");getSystemService(NotificationManager.class).notify(ID,note("Miner başlatılamadı"));}
 }

 void readMiner(java.lang.Process p){
  try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){
   String line; while((line=r.readLine())!=null&&p==miner){
    Matcher m=RATE.matcher(line); if(m.find()){double v=Double.parseDouble(m.group(1));String u=m.group(2).toLowerCase(Locale.ROOT);if("k".equals(u))v*=1e3;else if("m".equals(u))v*=1e6;else if("g".equals(u))v*=1e9;hashrate=v;}
    if(CONNECTED.matcher(line).find())poolConnected=true;
    if(ACCEPTED.matcher(line).find()){accepted++;lastShareAt=System.currentTimeMillis();crashCount=0;}
    if(REJECTED.matcher(line).find()){rejected++;lastShareAt=System.currentTimeMillis();}
    saveTelemetry();
   }
  }catch(Exception ignored){}
  finally{if(p==miner){miner=null;hashrate=0;poolConnected=false;if(prefs.getBoolean("desired_running",false)){scheduleRestart();saveState("waiting");}else saveState("stopped");}}
 }
 void scheduleRestart(){crashCount=Math.min(6,crashCount+1);restartAfter=System.currentTimeMillis()+Math.min(60000L,1000L<<(crashCount-1));}
 String sha256(File f){try{MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[8192];for(int n;(n=in.read(b))>0;)d.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte x:d.digest())s.append(String.format(Locale.ROOT,"%02x",x));return s.toString();}catch(Exception e){return "";}}
 void saveTelemetry(){prefs.edit().putLong("hashrate_bits",Double.doubleToRawLongBits(hashrate)).putLong("accepted_shares",accepted).putLong("rejected_shares",rejected).putLong("last_share_at",lastShareAt).putBoolean("pool_connected",poolConnected).putLong("telemetry_at",System.currentTimeMillis()).apply();}
 void saveState(String s){prefs.edit().putString("service_state",s).putLong("state_at",System.currentTimeMillis()).putLong("hashrate_bits",Double.doubleToRawLongBits(hashrate)).apply();}
 synchronized void stopCompute(){java.lang.Process p=miner;miner=null;hashrate=0;poolConnected=false;saveTelemetry();if(p!=null){p.destroy();long until=System.currentTimeMillis()+3000;while(System.currentTimeMillis()<until){try{p.exitValue();return;}catch(IllegalThreadStateException running){try{Thread.sleep(50);}catch(InterruptedException e){Thread.currentThread().interrupt();break;}}}p.destroy();}}
 @Override public void onDestroy(){if(h!=null)h.removeCallbacksAndMessages(null);if(connectivity!=null&&networkCallback!=null){try{connectivity.unregisterNetworkCallback(networkCallback);}catch(Exception ignored){}}stopCompute();super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
}
