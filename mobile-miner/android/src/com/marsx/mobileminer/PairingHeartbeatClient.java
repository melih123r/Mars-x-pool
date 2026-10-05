package com.marsx.mobileminer;

import android.content.*;
import java.io.*;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;

/** Optional control-plane client. It can observe NONE/STOP only; it never starts mining. */
public final class PairingHeartbeatClient implements Closeable {
 private volatile boolean closed;
 private final String baseUrl,sessionId,workerId,token;
 private long nonce;
 public PairingHeartbeatClient(String baseUrl,String sessionId,String workerId,String token){
  if(baseUrl==null||!baseUrl.startsWith("https://"))throw new IllegalArgumentException("HTTPS required");
  this.baseUrl=baseUrl.replaceAll("/+$","");this.sessionId=sessionId;this.workerId=workerId;this.token=token;
  if(!safe(sessionId)||!safe(workerId)||token==null||token.length()<32)throw new IllegalArgumentException("Invalid pairing session");
 }
 public void poll(Context context){
  if(closed)return;
  new Thread(()->{
   try{
    long n; synchronized(this){n=++nonce;}
    HttpsURLConnection c=(HttpsURLConnection)new URL(baseUrl+"/pairing/heartbeat").openConnection();
    c.setRequestMethod("POST");c.setConnectTimeout(4000);c.setReadTimeout(4000);c.setDoOutput(true);
    c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Worker "+token);
    String body="{\"session_id\":\""+esc(sessionId)+"\",\"worker_id\":\""+esc(workerId)+"\",\"nonce\":"+n+"}";
    try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    if(c.getResponseCode()==200){
     String response=read(c.getInputStream());
     if(response.matches("(?s).*\\\"type\\\"\\s*:\\s*\\\"STOP\\\".*"))
      context.startService(new Intent(context,WorkerForegroundService.class).setAction(WorkerForegroundService.ACTION_STOP));
    }
    c.disconnect();
   }catch(Exception ignored){/* fail closed for remote control: never convert network failure into START */ }
  },"marsx-pairing-heartbeat").start();
 }
 public void close(){closed=true;}
 private static boolean safe(String v){return v!=null&&v.matches("[A-Za-z0-9_-]{8,64}");}
 private static String esc(String v){return v.replace("\\","\\\\").replace("\"","\\\"");}
 private static String read(InputStream in)throws IOException{try(BufferedReader r=new BufferedReader(new InputStreamReader(in,java.nio.charset.StandardCharsets.UTF_8))){StringBuilder b=new StringBuilder();String s;while((s=r.readLine())!=null&&b.length()<4096)b.append(s);return b.toString();}}
}
