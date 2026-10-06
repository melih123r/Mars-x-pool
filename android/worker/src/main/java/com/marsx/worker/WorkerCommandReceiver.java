package com.marsx.worker;

import android.content.*;
import android.os.Build;

public final class WorkerCommandReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if(intent==null||intent.getAction()==null)return;
  String action=intent.getAction();
  if("com.marsx.worker.START".equals(action)){
   Intent service=new Intent(context,WorkerService.class).setAction("START");
   if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);else context.startService(service);
  }else if("com.marsx.worker.STOP".equals(action)){
   SharedPreferences p=context.getSharedPreferences("worker",Context.MODE_PRIVATE);
   p.edit().putBoolean("desired_running",false).putString("service_state","stopped").putLong("state_at",System.currentTimeMillis()).apply();
   context.stopService(new Intent(context,WorkerService.class));
  }else if("com.marsx.worker.STATUS".equals(action)){
   SharedPreferences p=context.getSharedPreferences("worker",Context.MODE_PRIVATE);
   Intent out=new Intent("com.marsx.pool.WORKER_STATUS").setPackage("com.marsx.pool");
   out.putExtra("state",p.getString("service_state","stopped"));
   out.putExtra("hashrate",Double.longBitsToDouble(p.getLong("hashrate_bits",0)));
   out.putExtra("accepted",p.getLong("accepted_shares",0));
   out.putExtra("rejected",p.getLong("rejected_shares",0));
   out.putExtra("last_share_at",p.getLong("last_share_at",0));
   out.putExtra("telemetry_at",p.getLong("telemetry_at",0));
   out.putExtra("pool_connected",p.getBoolean("pool_connected",false));
   context.sendBroadcast(out,"com.marsx.permission.CONTROL_WORKER");
  }
 }
}