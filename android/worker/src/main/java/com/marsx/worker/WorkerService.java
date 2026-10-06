package com.marsx.worker;
import android.app.*;import android.content.*;import android.os.*;import java.io.*;import java.util.*;import java.util.regex.*;import java.security.*;
public final class WorkerService extends Service {
 static final String CHANNEL="marsx_worker"; static final int ID=4101; static final Pattern RATE=Pattern.compile("(?i)([0-9]+(?:\\.[0-9]+)?)\\s*([kmg]?)h?/?s");
 Handler h; Runnable safety; Process miner; volatile double hashrate;
 public void onCreate(){super.onCreate();NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel(CHANNEL,"MARS-X Worker",NotificationManager.IMPORTANCE_LOW));h=new Handler(Looper.getMainLooper());safety=()->{if(!safe())stopCompute();h.postDelayed(safety,15000);};}
 public int onStartCommand(Intent i,int f,int id){if(i!=null&&"STOP".equals(i.getAction())){stopCompute();stopSelf();return START_NOT_STICKY;}startForeground(ID,note("Worker güvenlik denetimi aktif"));h.removeCallbacks(safety);h.post(safety);if(safe())startComputeIfAvailable();return START_STICKY;}
 Notification note(String s){Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);return b.setContentTitle("MARS-X Worker").setContentText(s).setSmallIcon(android.R.drawable.stat_notify_sync).setOngoing(true).build();}
 boolean safe(){BatteryManager b=getSystemService(BatteryManager.class);int pct=b.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);return pct>=15&&readBatteryTemp()<43f;}
 float readBatteryTemp(){Intent x=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));return x==null?0f:x.getIntExtra(BatteryManager.EXTRA_TEMPERATURE,0)/10f;}
 synchronized void startComputeIfAvailable(){
  if(miner!=null&&miner.isAlive())return;
  File bin=new File(getFilesDir(),"miner/ccminer");
  SharedPreferences p=getSharedPreferences("worker",MODE_PRIVATE);
  String pool=p.getString("pool",""), user=p.getString("user",""); int threads=Math.max(1,Math.min(Runtime.getRuntime().availableProcessors(),p.getInt("threads",Math.max(1,Runtime.getRuntime().availableProcessors()/2))));
  String expected=p.getString("miner_sha256","").toLowerCase(Locale.ROOT); if(!bin.isFile()||!bin.canExecute()||!expected.matches("[a-f0-9]{64}")||!expected.equals(sha256(bin))||!pool.startsWith("stratum+tcp://")||user.isEmpty()){getSystemService(NotificationManager.class).notify(ID,note("Miner kurulumu/yapılandırması bekleniyor"));return;}
  try{
   miner=new ProcessBuilder(bin.getAbsolutePath(),"-a","verus","-o",pool,"-u",user,"-p","x","-t",String.valueOf(threads)).redirectErrorStream(true).start();
   new Thread(()->readMiner(miner),"marsx-miner-log").start();
   getSystemService(NotificationManager.class).notify(ID,note("Miner çalışıyor"));
  }catch(IOException e){miner=null;getSystemService(NotificationManager.class).notify(ID,note("Miner başlatılamadı"));}
 }
 void readMiner(Process p){try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream()))){String line;while((line=r.readLine())!=null&&p==miner){Matcher m=RATE.matcher(line);if(m.find()){double v=Double.parseDouble(m.group(1));String u=m.group(2).toLowerCase(Locale.ROOT);if("k".equals(u))v*=1e3;else if("m".equals(u))v*=1e6;else if("g".equals(u))v*=1e9;hashrate=v;}}}catch(Exception ignored){}finally{if(p==miner){miner=null;hashrate=0;}}}
 String sha256(File f){try{MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[8192];for(int n;(n=in.read(b))>0;)d.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte x:d.digest())s.append(String.format(Locale.ROOT,"%02x",x));return s.toString();}catch(Exception e){return "";}}\n synchronized void stopCompute(){Process p=miner;miner=null;hashrate=0;if(p!=null){p.destroy();try{if(!p.waitFor(3,java.util.concurrent.TimeUnit.SECONDS))p.destroyForcibly();}catch(InterruptedException e){Thread.currentThread().interrupt();p.destroyForcibly();}}}
 public void onDestroy(){if(h!=null)h.removeCallbacksAndMessages(null);stopCompute();super.onDestroy();}
 public IBinder onBind(Intent i){return null;}
}