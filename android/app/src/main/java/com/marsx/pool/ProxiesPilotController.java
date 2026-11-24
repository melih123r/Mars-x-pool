package com.marsx.pool;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

/**
 * Starts only a server-issued, device-scoped Proxies.sx credential.
 * The farmer account key never exists in this process, APK or Android storage.
 */
final class ProxiesPilotController {
    interface Listener { void onStatus(ProxiesPeerSDK.Status status,String deviceId); }

    // Agent JWT has ~1-hour lifetime. Until a vendor-approved refresh flow
    // exists, never keep a direct relay service running indefinitely.
    private static final long MAX_UNREFRESHED_SESSION_MS=45L*60L*1000L;
    private static ProxiesPilotController shared;
    private final Context context;
    private volatile boolean consentedToRun;
    private final Handler sessionHandler=new Handler(Looper.getMainLooper());
    private final Runnable expireUnrefreshedSession=()->{
        synchronized(ProxiesPilotController.this){
            if(consentedToRun)stop();
        }
    };
    private volatile Listener listener;
    private String activeDeviceId="";

    private ProxiesPilotController(Context context,Listener listener){
        this.context=context.getApplicationContext(); this.listener=listener;
    }

    static synchronized ProxiesPilotController attach(Context context,Listener listener){
        if(shared==null)shared=new ProxiesPilotController(context,listener);
        else shared.listener=listener;
        return shared;
    }

    synchronized void detach(Listener expected){if(listener==expected)listener=null;}

    String deviceId(){
        String androidId=Settings.Secure.getString(
            context.getContentResolver(),Settings.Secure.ANDROID_ID);
        if(androidId==null||androidId.isEmpty())return "";
        return "psx_"+androidId.substring(0,Math.min(16,androidId.length()));
    }

    synchronized void start(ProxiesAutomaticEnrollmentClient.Result credential){
        if(credential==null
            || !credential.deviceId.matches("(?:psx_|agent_)[A-Za-z0-9_-]{8,64}")
            || !ProxiesAutomaticEnrollmentClient.validRelay(credential.relayUrl)){
            throw new IllegalArgumentException("Invalid device credential");
        }
        consentedToRun=true;
        activeDeviceId=credential.deviceId;
        sessionHandler.removeCallbacks(expireUnrefreshedSession);
        try{
            PeerProxyService.Companion.start(context,credential.deviceToken,credential.relayUrl,false);
            // Stop before provider JWT expiry; do not claim auto-renewal.
            sessionHandler.postDelayed(expireUnrefreshedSession,MAX_UNREFRESHED_SESSION_MS);
            notifyStatus(ProxiesPeerSDK.Status.CONNECTING);
        }catch(RuntimeException error){
            stop();
            throw error;
        }
    }

    synchronized void providerOnline(boolean online){
        if(consentedToRun)notifyStatus(online
            ?ProxiesPeerSDK.Status.CONNECTED:ProxiesPeerSDK.Status.CONNECTING);
    }

    synchronized void stop(){
        consentedToRun=false;
        sessionHandler.removeCallbacks(expireUnrefreshedSession);
        try{PeerProxyService.Companion.stop(context);}catch(RuntimeException ignored){}
        context.stopService(new Intent(context,PeerProxyService.class));
        notifyStatus(ProxiesPeerSDK.Status.STOPPED);
    }

    private void notifyStatus(ProxiesPeerSDK.Status status){
        Listener current=listener;
        if(current!=null)current.onStatus(status,activeDeviceId.isEmpty()?deviceId():activeDeviceId);
    }
}
