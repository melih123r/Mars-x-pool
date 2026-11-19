package com.marsx.pool;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;

import sx.proxies.peer.ProxiesPeerSDK;
import sx.proxies.peer.service.PeerProxyService;

/**
 * Starts only a server-issued, device-scoped Proxies.sx credential.
 * The farmer account key never exists in this process, APK or Android storage.
 */
final class ProxiesPilotController {
    interface Listener { void onStatus(ProxiesPeerSDK.Status status,String deviceId); }

    private static ProxiesPilotController shared;
    private final Context context;
    private volatile Listener listener;
    private volatile boolean consentedToRun;
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
        PeerProxyService.Companion.start(context,credential.deviceToken,credential.relayUrl,false);
        notifyStatus(ProxiesPeerSDK.Status.CONNECTING);
    }

    synchronized void providerOnline(boolean online){
        if(consentedToRun)notifyStatus(online
            ?ProxiesPeerSDK.Status.CONNECTED:ProxiesPeerSDK.Status.CONNECTING);
    }

    synchronized void stop(){
        consentedToRun=false;
        try{PeerProxyService.Companion.stop(context);}catch(RuntimeException ignored){}
        context.stopService(new Intent(context,PeerProxyService.class));
        notifyStatus(ProxiesPeerSDK.Status.STOPPED);
    }

    private void notifyStatus(ProxiesPeerSDK.Status status){
        Listener current=listener;
        if(current!=null)current.onStatus(status,activeDeviceId.isEmpty()?deviceId():activeDeviceId);
    }
}
