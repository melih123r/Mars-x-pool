package com.marsx.worker;

import android.content.*;
import android.os.Build;

public final class WorkerCommandReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if (intent == null || intent.getAction() == null) return;
  String action=intent.getAction();
  if ("com.marsx.worker.START".equals(action)) {
   Intent service=new Intent(context,WorkerService.class).setAction("START");
   if (Build.VERSION.SDK_INT>=26) context.startForegroundService(service); else context.startService(service);
  } else if ("com.marsx.worker.STOP".equals(action)) {
   context.startService(new Intent(context,WorkerService.class).setAction("STOP"));
  }
 }
}
