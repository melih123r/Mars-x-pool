package com.marsx.pool;

import android.content.*;

public final class WorkerStatusReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent i){
  if(i==null||!"com.marsx.pool.WORKER_STATUS".equals(i.getAction()))return;
  context.getSharedPreferences("local_worker",Context.MODE_PRIVATE).edit()
   .putString("state",i.getStringExtra("state"))
   .putLong("hashrate_bits",Double.doubleToRawLongBits(i.getDoubleExtra("hashrate",0)))
   .putLong("accepted",i.getLongExtra("accepted",0))
   .putLong("rejected",i.getLongExtra("rejected",0))
   .putLong("last_share_at",i.getLongExtra("last_share_at",0))
   .putLong("telemetry_at",i.getLongExtra("telemetry_at",0))
   .putBoolean("pool_connected",i.getBooleanExtra("pool_connected",false)).apply();
 }
}