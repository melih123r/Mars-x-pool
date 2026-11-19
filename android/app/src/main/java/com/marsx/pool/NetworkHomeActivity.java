package com.marsx.pool;

import android.app.Activity;
import android.app.AlertDialog;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.BatteryManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.TrafficStats;
import android.content.Context;
import java.util.Locale;
import java.util.UUID;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.view.View;
import android.text.InputType;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Network-first pilot dashboard. Payments remain disabled; proxy requires explicit consent. */
public final class NetworkHomeActivity extends Activity {
    private static final int REQUEST_PROXY_NOTIFICATIONS=812;
    private static final int BG=Color.rgb(9,14,24), PANEL=Color.rgb(23,31,46);
    private static final int WHITE=Color.WHITE, MUTED=Color.rgb(171,183,201), ORANGE=Color.rgb(255,128,43);
    private SharedPreferences prefs;
    private SharedPreferences accountPrefs;
    private SecureStore secureStore;
    private GoogleSignInManager googleSignIn;
    private LinearLayout page;
    private TextView consentStatus;
    private Button consentButton;
    private TextView monitorStatus;
    private Button monitorButton;
    private TextView historyStatus;
    private DemoBanner demoBanner;
    private TextView proxyServerStatus;
    private TextView proxyPrerequisites;
    private CheckBox proxyDisclosureAcknowledgement;
    private Button proxyStatusButton;
    private Button proxyPilotStart;
    private TextView proxyPilotStatus;
    private ProxiesPilotController proxyPilot;
    private ProxiesPilotController.Listener proxyPilotListener;
    private TextView liveBoardStatus;
    private Button liveBoardButton;
    private int liveBoardGeneration;
    private TextView farmerLiveStatus;
    private Button farmerLiveButton;
    private int farmerLiveGeneration;
    private boolean farmerLiveLoading;
    private boolean farmerLiveResumed;
    private boolean authLoading;
    private boolean pendingPilotStart;
    private int pilotStatusAttempts;
    // Invalidate in-flight provider status responses after stop/revoke or a new start.
    private int pilotStatusGeneration;
    private int peerEnrollmentGeneration;
    private final Handler pilotStatusHandler=new Handler(Looper.getMainLooper());
    private final Handler farmerLiveHandler=new Handler(Looper.getMainLooper());
    private final Runnable farmerLiveRefresh=()->queryPrivateFarmerAccount(true);
    // Invalidate an outstanding HTTPS callback if consent is withdrawn.
    private int proxyStatusGeneration;
    private long sessionBytes;
    private long totalSessionBytes;
    private long totalSessionSeconds;
    private boolean wifiOnly=false;
    private long monitorStart;
    private long startRx=-1, startTx=-1;
    private final Handler monitorHandler=new Handler(Looper.getMainLooper());
    private final Runnable monitorTick=new Runnable(){
        @Override public void run(){
            if(monitorStatus!=null && monitorStart>0){
                ConnectivityManager cm=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities nc=cm.getNetworkCapabilities(cm.getActiveNetwork());
                String kind=nc==null?getString(R.string.nui_00):nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)?"Wi-Fi":nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)?getString(R.string.nui_02):getString(R.string.nui_01);
                if(nc==null || !nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                    android.widget.Toast.makeText(NetworkHomeActivity.this,getString(R.string.nui_04),android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                BatteryManager battery=(BatteryManager)getSystemService(Context.BATTERY_SERVICE);
                int batteryPct=battery==null?-1:battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if(batteryPct>=0 && batteryPct<15){
                    prefs.edit().putBoolean("monitor_active",false).apply();
                    stopMonitor();
                    if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                    android.widget.Toast.makeText(NetworkHomeActivity.this,getString(R.string.nui_05),android.widget.Toast.LENGTH_SHORT).show();
                    return;
                }
                long seconds=(SystemClock.elapsedRealtime()-monitorStart)/1000;
                long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
                long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
                String usage=(rx<0 || tx<0 || startRx<0 || startTx<0)?getString(R.string.nui_06):String.format(Locale.getDefault(),"%.3f MB",((Math.max(0,rx-startRx)+Math.max(0,tx-startTx))/1048576.0));
                if(rx>=0 && tx>=0 && startRx>=0 && startTx>=0)sessionBytes=Math.max(0,rx-startRx)+Math.max(0,tx-startTx);
                monitorStatus.setText(getString(R.string.nui_07)+kind+getString(R.string.nui_08)+(seconds/60)+getString(R.string.nui_09)+(seconds%60)+getString(R.string.nui_10)+usage+getString(R.string.nui_11));
                monitorHandler.postDelayed(this,1000);
            }
        }
    };

    @Override protected void attachBaseContext(Context base) {
        super.attachBaseContext(NetworkLocale.wrap(base));
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs=getSharedPreferences("network_consent_v1",MODE_PRIVATE);
        accountPrefs=getSharedPreferences("marsx_beta",MODE_PRIVATE);
        if(!accountPrefs.contains("worker_id")){
            accountPrefs.edit().putString("worker_id","node-"
                +UUID.randomUUID().toString().replace("-","")).apply();
        }
        secureStore=new SecureStore(this);
        googleSignIn=new GoogleSignInManager(this);
        proxyPilotListener=(status,deviceId)->runOnUiThread(()->
            updatePilotStatus(status.name(),deviceId));
        proxyPilot=ProxiesPilotController.attach(this,proxyPilotListener);
        // A fresh activity must not trust a saved 'sharing_active' flag as
        // evidence that the foreground SDK service is really connected.
        // The single-operator pilot requires deliberate restart after reopening.
        if(prefs.getBoolean("psx_sharing_active",false)
            || !prefs.getBoolean("consented",false)
            || !prefs.getBoolean("psx_read_notice_v1",false)) {
            prefs.edit().putBoolean("psx_sharing_active",false).apply();
            proxyPilot.stop();
        }
        totalSessionBytes=prefs.getLong("total_session_bytes",0);
        totalSessionSeconds=prefs.getLong("total_session_seconds",0);
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20),dp(32),dp(20),dp(24));
        scroll.addView(page);
        setContentView(scroll);

        text(page,getString(R.string.network_demo_heading),24,WHITE,true);

        LinearLayout network=card("1  •  NETWORK");
        consentStatus=text(network,"",15,MUTED,false);
        consentButton=button(network,getString(R.string.network_consent_button));
        consentButton.setOnClickListener(v->{
            if (prefs.getBoolean("consented",false)) {
                peerEnrollmentGeneration++;
                cancelPilotStatusChecks();
                proxyPilot.stop();
                prefs.edit().putBoolean("consented",false).putBoolean("monitor_active",false).apply();
                prefs.edit().putBoolean("psx_sharing_active",false).apply();
                stopMonitor();
                if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
                refreshConsent();
            } else {
                new AlertDialog.Builder(this)
                    .setTitle(getString(R.string.nui_12))
                    .setMessage(getString(R.string.nui_13))
                    .setNegativeButton(getString(R.string.nui_14), (dialog, which) -> dialog.dismiss())
                    .setPositiveButton(getString(R.string.nui_15), (dialog, which) -> {
                        prefs.edit().putBoolean("consented",true).apply();
                        refreshConsent();
                    })
                    .show();
            }
        });
        Button start=button(network,getString(R.string.network_start_monitoring));
        monitorButton=start;
        start.setOnClickListener(v -> {
            boolean active=prefs.getBoolean("monitor_active",false);
            if (active) {
                prefs.edit().putBoolean("monitor_active",false).apply();
                start.setText(getString(R.string.nui_03));
                stopMonitor();
            } else {
                if(!prefs.getBoolean("consented",false)){
                    android.widget.Toast.makeText(this,getString(R.string.nui_16),android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                ConnectivityManager connectivity=(ConnectivityManager)getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkCapabilities caps=connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
                if(caps==null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) || (wifiOnly && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))){
                    android.widget.Toast.makeText(this,getString(R.string.nui_17),android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                new AlertDialog.Builder(this)
                    .setTitle("MARS-X Network")
                    .setMessage(getString(R.string.nui_18))
                    .setNegativeButton(getString(R.string.nui_14),null)
                    .setPositiveButton(getString(R.string.nui_19),(d,w)->{
                        prefs.edit().putBoolean("monitor_active",true).apply();
                        start.setText(getString(R.string.nui_20));
                        startMonitor();
                    }).show();
            }
        });
        monitorStatus=text(network,getString(R.string.network_monitor_off),13,MUTED,false);
        refreshConsent();

        // Proxies.sx disclosures and controls share this ONE existing Network screen.
        // Acknowledgement only records reading the notice; it never starts a peer.
        LinearLayout proxy=card(getString(R.string.psx_page_title));
        text(proxy,getString(R.string.nui_13),14,WHITE,false);
        text(proxy,getString(R.string.psx_risk_extra),13,MUTED,false);
        text(proxy,getString(R.string.psx_pilot_warning),12,ORANGE,false);
        proxyDisclosureAcknowledgement=new CheckBox(this);
        proxyDisclosureAcknowledgement.setText(getString(R.string.psx_acknowledgement));
        proxyDisclosureAcknowledgement.setTextColor(WHITE);
        proxyDisclosureAcknowledgement.setTextSize(14);
        proxyDisclosureAcknowledgement.setChecked(prefs.getBoolean("psx_read_notice_v1",false));
        proxyDisclosureAcknowledgement.setOnCheckedChangeListener((button,checked)->{
            if(!checked){
                peerEnrollmentGeneration++;
                cancelPilotStatusChecks();
                proxyPilot.stop();
            }
            prefs.edit().putBoolean("psx_read_notice_v1",checked)
                .putBoolean("psx_sharing_active",checked
                    && prefs.getBoolean("psx_sharing_active",false)).apply();
        });
        proxy.addView(proxyDisclosureAcknowledgement,new LinearLayout.LayoutParams(-1,-2));
        proxyPilotStatus=text(proxy,getString(R.string.psx_pilot_stopped),15,ORANGE,true);
        text(proxy,getString(R.string.psx_zero_earnings),13,MUTED,false);
        text(proxy,getString(R.string.psx_auto_provisioning),12,MUTED,false);
        proxyPilotStart=button(proxy,getString(R.string.psx_pilot_start));
        proxyPilotStart.setOnClickListener(v->requestPilotStart());
        Button stopProxy=button(proxy,getString(R.string.psx_stop_revoke));
        stopProxy.setOnClickListener(v->{
            peerEnrollmentGeneration++;
            cancelPilotStatusChecks();
            proxyPilot.stop();
            proxyStatusGeneration++;
            proxyStatusButton.setEnabled(true);
            prefs.edit().putBoolean("psx_read_notice_v1",false)
                .putBoolean("consented",false).putBoolean("monitor_active",false)
                .putBoolean("psx_sharing_active",false).apply();
            proxyDisclosureAcknowledgement.setChecked(false);
            stopMonitor();
            if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
            refreshConsent();
            if(proxyServerStatus!=null)proxyServerStatus.setText(getString(R.string.psx_off_status));
            if(proxyPrerequisites!=null)proxyPrerequisites.setText(getString(R.string.psx_prerequisites));
        });
        proxyServerStatus=text(proxy,getString(R.string.psx_off_status),13,MUTED,false);
        proxyPrerequisites=text(proxy,getString(R.string.psx_prerequisites),12,MUTED,false);
        proxyStatusButton=button(proxy,getString(R.string.psx_check_backend));
        proxyStatusButton.setOnClickListener(v->queryProxiesReadiness());

        // Separate, real-time GLOBAL public vendor counts. Never confused with
        // the current farmer account, registered device traffic or earnings.
        text(proxy,getString(R.string.psx_live_scope),13,ORANGE,true);
        liveBoardStatus=text(proxy,getString(R.string.psx_live_initial),14,WHITE,false);
        liveBoardButton=button(proxy,getString(R.string.psx_live_refresh));
        liveBoardButton.setOnClickListener(v->queryLiveGlobalBoard());

        // PRIVATE publisher-account aggregates. Authentication uses the existing
        // encrypted MARS-X Google session; the Proxies.sx key remains server-side.
        text(proxy,getString(R.string.psx_farmer_scope),13,ORANGE,true);
        farmerLiveStatus=text(proxy,getString(R.string.psx_farmer_sign_in_required),14,WHITE,false);
        farmerLiveButton=button(proxy,getString(R.string.psx_farmer_sign_in));
        farmerLiveButton.setOnClickListener(v->{
            if(currentAuthSession()==null) beginNetworkGoogleSignIn(false);
            else queryPrivateFarmerAccount(false);
        });

        LinearLayout earnings=card(getString(R.string.network_earnings_heading));
        text(earnings,getString(R.string.nui_21),16,WHITE,true);
        text(earnings,getString(R.string.nui_22),12,MUTED,false);

        // Never ship an operator-owned wallet address as a user payout default.
        Button walletAddress=button(earnings,getString(R.string.nui_23));
        walletAddress.setOnClickListener(v -> {
            final String[] chains={"Solana","Base","Polygon"};
            new AlertDialog.Builder(this)
                .setTitle(getString(R.string.nui_24))
                .setItems(chains,(dialog,selected)->{
                    String chain=chains[selected];
                    EditText input=new EditText(this);
                    input.setTextDirection(View.TEXT_DIRECTION_LTR);
                    input.setSingleLine(true);
                    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
                    input.setHint(chain+getString(R.string.nui_25));
                    input.setText(prefs.getString("usdc_address",""));
                    new AlertDialog.Builder(this)
                        .setTitle("USDC • "+chain)
                        .setMessage(getString(R.string.nui_26))
                        .setView(input)
                        .setNegativeButton(getString(R.string.nui_14),null)
                        .setNeutralButton(getString(R.string.nui_27),(d,w)->{
                            prefs.edit().remove("usdc_address").remove("usdc_chain").apply();
                            walletAddress.setText(getString(R.string.nui_28));
                        })
                        .setPositiveButton(getString(R.string.nui_29),(d,w)->{
                            String address=input.getText().toString().trim();
                            boolean valid=selected==0
                                ?address.length()>=32 && address.length()<=44 && address.matches("[1-9A-HJ-NP-Za-km-z]+")
                                :address.matches("0x[0-9a-fA-F]{40}");
                            if(!valid){
                                android.widget.Toast.makeText(this,getString(R.string.nui_30),android.widget.Toast.LENGTH_LONG).show();
                                return;
                            }
                            prefs.edit().putString("usdc_address",address).putString("usdc_chain",chain).apply();
                            walletAddress.setText(chain+" • "+address.substring(0,6)+"…"+address.substring(address.length()-4));
                        }).show();
                }).show();
        });
        String savedAddress=prefs.getString("usdc_address","");
        if(!savedAddress.isEmpty() && savedAddress.length()>=10)
            walletAddress.setText(prefs.getString("usdc_chain","Polygon")+" • "+savedAddress.substring(0,6)+"…"+savedAddress.substring(savedAddress.length()-4));

        LinearLayout history=card(getString(R.string.network_history_heading));
        text(history,getString(R.string.nui_31),13,MUTED,false);
        historyStatus=text(history,"",13,MUTED,false);
        updateHistory();

        LinearLayout settings=card(getString(R.string.nui_32));
        Button lang=button(settings,getString(R.string.nui_33));
        final String[] languageNames=getResources().getStringArray(R.array.network_language_names);
        final String[] languageCodes=getResources().getStringArray(R.array.network_language_codes);
        String selectedCode=NetworkLocale.selected(this);
        final int selectedLanguage=java.util.Arrays.asList(languageCodes).indexOf(selectedCode);
        lang.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setTitle(getString(R.string.nui_33))
            .setSingleChoiceItems(languageNames,selectedLanguage,(d,i)->{
                d.dismiss();
                if(i!=selectedLanguage){
                    NetworkLocale.select(this,languageCodes[i]);
                }
            }).show());
        text(settings,getString(R.string.nui_34)+selectedCode+getString(R.string.nui_35),13,MUTED,false);

        LinearLayout advertising=card(getString(R.string.ads_title));
        TextView adStatus=text(advertising,"",12,MUTED,false);
        FrameLayout adSlot=new FrameLayout(this);
        adSlot.setVisibility(View.GONE);
        // Full page width is available to the adaptive banner; no double-parent insertion.
        page.addView(adSlot,new LinearLayout.LayoutParams(-1,-2));
        demoBanner=new DemoBanner(this,adSlot,adStatus);
        button(advertising,getString(R.string.ads_enable)).setOnClickListener(v->demoBanner.enable());
        button(advertising,getString(R.string.ads_disable)).setOnClickListener(v->demoBanner.withdraw());
        button(advertising,getString(R.string.ads_privacy)).setOnClickListener(v->demoBanner.privacy());

        text(page,getString(R.string.network_pilot_disclaimer),12,MUTED,false);
        text(page,getString(R.string.psx_pilot_warning),12,ORANGE,false);
    }

    private void requestPilotStart(){
        if(!prefs.getBoolean("consented",false)
            || !prefs.getBoolean("psx_read_notice_v1",false)){
            android.widget.Toast.makeText(this,getString(R.string.psx_pilot_consent_required),
                android.widget.Toast.LENGTH_LONG).show();
            return;
        }
        if(Build.VERSION.SDK_INT>=33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                !=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                REQUEST_PROXY_NOTIFICATIONS);
            return;
        }
        if(currentAuthSession()==null){
            pendingPilotStart=true;
            android.widget.Toast.makeText(this,getString(R.string.psx_auto_auth_required),
                android.widget.Toast.LENGTH_LONG).show();
            beginNetworkGoogleSignIn(true);
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle(getString(R.string.psx_pilot_confirm_title))
            .setMessage(getString(R.string.psx_pilot_confirm_message))
            .setNegativeButton(getString(R.string.nui_14),null)
            .setPositiveButton(getString(R.string.psx_pilot_start),(dialog,which)->startPilotAutomatic())
            .show();
    }

    private void startPilotAutomatic(){
        final int enrollmentId=++peerEnrollmentGeneration;
        final String session=currentAuthSession();
        final String installId=accountPrefs.getString("worker_id","");
        final String deviceId=proxyPilot.deviceId();
        proxyPilotStart.setEnabled(false);
        proxyPilotStatus.setText(getString(R.string.psx_auto_enrolling));
        new Thread(()->{
            ProxiesAutomaticEnrollmentClient.Result result=null;
            try{
                result=ProxiesAutomaticEnrollmentClient.enroll(session,installId,deviceId,
                    Build.MODEL,"Android "+Build.VERSION.RELEASE,
                    Locale.getDefault().getCountry().toUpperCase(Locale.ROOT));
            }catch(Exception ignored){ /* Never log credentials or provider responses. */ }
            final ProxiesAutomaticEnrollmentClient.Result credential=result;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed()||enrollmentId!=peerEnrollmentGeneration)return;
                if(!prefs.getBoolean("consented",false)
                    ||!prefs.getBoolean("psx_read_notice_v1",false)){
                    proxyPilot.stop();
                    return;
                }
                if(credential==null){
                    proxyPilot.stop();
                    prefs.edit().putBoolean("psx_sharing_active",false).apply();
                    proxyPilotStatus.setText(getString(R.string.psx_pilot_error));
                    proxyPilotStart.setEnabled(true);
                    return;
                }
                try{
                    proxyPilot.start(credential);
                    prefs.edit().putString("psx_device_id",credential.deviceId).apply();
                    proxyPilotStatus.setText(getString(R.string.psx_auto_provider_waiting)
                        +"\n"+getString(R.string.psx_pilot_device_id)+": "+credential.deviceId);
                    beginPilotStatusChecks(credential.deviceId);
                }catch(RuntimeException error){
                    proxyPilot.stop();
                    proxyPilotStatus.setText(getString(R.string.psx_pilot_error));
                    proxyPilotStart.setEnabled(true);
                }
            });
        },"marsx-v19-device-enrollment").start();
    }

    private void beginPilotStatusChecks(String deviceId){
        cancelPilotStatusChecks();
        pilotStatusAttempts=0;
        pollPilotStatus(deviceId);
    }

    private void pollPilotStatus(String deviceId){
        if(++pilotStatusAttempts>12)return;
        final int statusGeneration=pilotStatusGeneration;
        pilotStatusHandler.postDelayed(()->new Thread(()->{
            boolean online=false;
            try{
                online=ProxiesAutomaticEnrollmentClient.online(currentAuthSession(),
                    accountPrefs.getString("worker_id",""),deviceId);
            }catch(Exception ignored){ /* Remain CONNECTING; never invent online state. */ }
            final boolean confirmed=online;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed()
                    ||statusGeneration!=pilotStatusGeneration
                    ||!prefs.getBoolean("consented",false)
                    ||!prefs.getBoolean("psx_read_notice_v1",false))return;
                proxyPilot.providerOnline(confirmed);
                if(confirmed){
                    queryPrivateFarmerAccount(false);
                }else if(pilotStatusAttempts<12){
                    pollPilotStatus(deviceId);
                }
            });
        },"marsx-v19-provider-status").start(),5000);
    }

    private void cancelPilotStatusChecks(){
        pilotStatusGeneration++;
        pilotStatusAttempts=13;
        pilotStatusHandler.removeCallbacksAndMessages(null);
    }

    private void updatePilotStatus(String status,String deviceId){
        if(proxyPilotStatus==null)return;
        if(("CONNECTED".equals(status)||"CONNECTING".equals(status))
            && (!prefs.getBoolean("consented",false)
                || !prefs.getBoolean("psx_read_notice_v1",false))) {
            proxyPilot.stop();
            return;
        }
        int label;
        if("CONNECTED".equals(status))label=R.string.psx_pilot_connected;
        else if("CONNECTING".equals(status))label=R.string.psx_pilot_connecting;
        else if("ERROR".equals(status))label=R.string.psx_pilot_error;
        else label=R.string.psx_pilot_stopped;
        String value=getString(label);
        if(deviceId!=null&&!deviceId.isEmpty())value+="\n"+getString(R.string.psx_pilot_device_id)+": "+deviceId;
        proxyPilotStatus.setText(value);
        boolean running="CONNECTED".equals(status)||"CONNECTING".equals(status);
        prefs.edit().putBoolean("psx_sharing_active",running).apply();
        if(proxyPilotStart!=null)proxyPilotStart.setEnabled(!running);
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==REQUEST_PROXY_NOTIFICATIONS){
            if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)requestPilotStart();
            else android.widget.Toast.makeText(this,getString(R.string.psx_pilot_notification_required),
                android.widget.Toast.LENGTH_LONG).show();
        }
    }

    private String readinessLine(int name, String state) {
        return "• " + getString(name) + ": " + getString(
            "verified".equals(state) ? R.string.psx_check_verified : R.string.psx_check_unverified);
    }

    private String readinessChecklist(NetworkStatusClient.Result result) {
        return readinessLine(R.string.psx_check_partner, result.partnerAgreement) + "\n"
            + readinessLine(R.string.psx_check_credential, result.perDeviceCredentials) + "\n"
            + readinessLine(R.string.psx_check_isolation, result.privateNetworkIsolation) + "\n"
            + readinessLine(R.string.psx_check_distribution, result.distributionPolicy);
    }

    /** Manually checks read-only Supabase readiness; does NOT reach the Proxies.sx relay. */
    private void queryProxiesReadiness() {
        final int requestGeneration = ++proxyStatusGeneration;
        proxyStatusButton.setEnabled(false);
        proxyServerStatus.setText(getString(R.string.psx_checking));
        new Thread(() -> {
            NetworkStatusClient.Result fetched = null;
            try {
                fetched = NetworkStatusClient.fetch();
            } catch(Exception ignored) {
                // A failed/changed server contract never enables sharing.
                // Do not log network identifiers or remote response contents.
            }
            final NetworkStatusClient.Result result = fetched;
            runOnUiThread(() -> {
                if(isFinishing() || isDestroyed() || requestGeneration != proxyStatusGeneration) return;
                if(result != null) {
                    proxyServerStatus.setText(getString(R.string.psx_backend_available));
                    proxyPrerequisites.setText(readinessChecklist(result));
                } else {
                    proxyServerStatus.setText(getString(R.string.psx_backend_unavailable));
                    proxyPrerequisites.setText(getString(R.string.psx_prerequisites));
                }
                proxyStatusButton.setEnabled(true);
            });
        }, "marsx-v19-proxy-readiness").start();
    }

    /** Manual, user-triggered LIVE vendor statistics via read-only Supabase. */
    private void queryLiveGlobalBoard() {
        final int requestId=++liveBoardGeneration;
        liveBoardButton.setEnabled(false);
        liveBoardStatus.setText(getString(R.string.psx_live_loading));
        new Thread(()->{
            NetworkLiveBoardClient.Result fetched=null;
            try {
                fetched=NetworkLiveBoardClient.fetch();
            } catch(Exception ignored) {
                // Do not invent zeros on network errors, bad upstream data or timeout.
            }
            final NetworkLiveBoardClient.Result result=fetched;
            runOnUiThread(()->{
                if(isFinishing() || isDestroyed() || requestId!=liveBoardGeneration) return;
                if(result==null) {
                    liveBoardStatus.setText(getString(R.string.psx_live_unavailable));
                } else {
                    liveBoardStatus.setText(
                        getString(R.string.psx_live_total)+": "+result.total+"\n"
                        +getString(R.string.psx_live_online)+": "+result.online+"\n"
                        +getString(R.string.psx_live_mobile)+": "+result.mobile+"\n"
                        +getString(R.string.psx_live_residential)+": "+result.residential+"\n"
                        +getString(R.string.psx_live_datacenter)+": "+result.datacenter+"\n"
                        +getString(R.string.psx_live_updated)+": "+result.sampledAt);
                }
                liveBoardButton.setEnabled(true);
            });
        },"marsx-v19-public-live-board").start();
    }

    private String currentAuthSession() {
        return secureStore==null?null:secureStore.get("auth_session");
    }

    private void beginNetworkGoogleSignIn(boolean continuePilot){
        if(authLoading)return;
        pendingPilotStart=pendingPilotStart||continuePilot;
        if(!googleSignIn.isConfigured()){
            pendingPilotStart=false;
            android.widget.Toast.makeText(this,getString(R.string.psx_auto_auth_failed),
                android.widget.Toast.LENGTH_LONG).show();
            return;
        }
        authLoading=true;
        if(farmerLiveButton!=null){
            farmerLiveButton.setEnabled(false);
            farmerLiveButton.setText(getString(R.string.psx_live_loading));
        }
        final String installId=accountPrefs.getString("worker_id","");
        new Thread(()->{
            String nonce=null;
            try{nonce=NetworkAuthClient.requestNonce(installId);}
            catch(Exception ignored){ /* Authentication failure stays user-visible and generic. */ }
            final String requestedNonce=nonce;
            runOnUiThread(()->{
                if(requestedNonce==null){finishNetworkAuth(false);return;}
                googleSignIn.signIn(requestedNonce,false,new GoogleSignInManager.Callback(){
                    @Override public void onToken(String idToken){
                        new Thread(()->{
                            String session=null;
                            try{session=NetworkAuthClient.exchange(installId,requestedNonce,idToken);}
                            catch(Exception ignored){ /* Do not log Google tokens. */ }
                            final String authenticatedSession=session;
                            runOnUiThread(()->{
                                boolean stored=false;
                                if(authenticatedSession!=null){
                                    try{secureStore.put("auth_session",authenticatedSession);stored=true;}
                                    catch(Exception ignored){ /* Keystore failure is a failed sign-in. */ }
                                }
                                finishNetworkAuth(stored);
                            });
                        },"marsx-v19-auth-exchange").start();
                    }
                    @Override public void onError(String message){finishNetworkAuth(false);}
                });
            });
        },"marsx-v19-auth-nonce").start();
    }

    private void finishNetworkAuth(boolean success){
        authLoading=false;
        if(farmerLiveButton!=null){
            farmerLiveButton.setEnabled(true);
            farmerLiveButton.setText(success
                ?getString(R.string.psx_farmer_refresh):getString(R.string.psx_farmer_sign_in));
        }
        if(!success){
            pendingPilotStart=false;
            android.widget.Toast.makeText(this,getString(R.string.psx_auto_auth_failed),
                android.widget.Toast.LENGTH_LONG).show();
            return;
        }
        queryPrivateFarmerAccount(false);
        if(pendingPilotStart){
            pendingPilotStart=false;
            requestPilotStart();
        }
    }

    private String privateMetric(Double value, String suffix) {
        return value==null ? getString(R.string.psx_live_unavailable)
            : String.format(Locale.US,"%.6f %s",value,suffix);
    }

    /** Read-only private account refresh. It cannot initialize or start the SDK. */
    private void queryPrivateFarmerAccount(boolean automatic) {
        if(!farmerLiveResumed || farmerLiveLoading) return;
        String session=currentAuthSession();
        String installId=getSharedPreferences("marsx_beta",MODE_PRIVATE)
            .getString("worker_id","");
        if(session==null || installId.isEmpty()) {
            farmerLiveStatus.setText(getString(R.string.psx_farmer_sign_in_required));
            farmerLiveButton.setText(getString(R.string.psx_farmer_sign_in));
            return;
        }
        final int requestId=++farmerLiveGeneration;
        farmerLiveLoading=true;
        farmerLiveButton.setEnabled(false);
        farmerLiveButton.setText(getString(R.string.psx_live_loading));
        new Thread(()->{
            NetworkFarmerLiveClient.Result fetched=null;
            try { fetched=NetworkFarmerLiveClient.fetch(session,installId); }
            catch(Exception ignored) { /* Unknown stays unknown; no fake zero values. */ }
            final NetworkFarmerLiveClient.Result result=fetched;
            runOnUiThread(()->{
                if(isFinishing() || isDestroyed() || requestId!=farmerLiveGeneration) return;
                farmerLiveLoading=false;
                farmerLiveButton.setEnabled(true);
                farmerLiveButton.setText(getString(R.string.psx_farmer_refresh));
                if(result==null) {
                    farmerLiveStatus.setText(getString(R.string.psx_farmer_unavailable));
                } else {
                    farmerLiveStatus.setText(
                        getString(R.string.psx_live_total)+": "+result.total+"\n"
                        +getString(R.string.psx_live_online)+": "+result.online+"\n"
                        +getString(R.string.psx_farmer_verified)+": "+result.verified+"\n"
                        +getString(R.string.psx_farmer_listed)+": "+result.listed+"\n"
                        +getString(R.string.psx_live_mobile)+": "+result.mobile+"\n"
                        +getString(R.string.psx_live_residential)+": "+result.residential+"\n"
                        +getString(R.string.psx_live_datacenter)+": "+result.datacenter+"\n"
                        +getString(R.string.psx_farmer_traffic)+": "+privateMetric(result.trafficGb,"GB")+"\n"
                        +getString(R.string.psx_farmer_earnings)+": "+privateMetric(result.providerEarnings,"USD")+"\n"
                        +getString(R.string.psx_live_updated)+": "+result.sampledAt);
                }
                if(farmerLiveResumed) farmerLiveHandler.postDelayed(farmerLiveRefresh,60000);
            });
        },automatic?"marsx-v19-farmer-auto":"marsx-v19-farmer-manual").start();
    }

    private void startMonitor(){
        stopMonitor();
        monitorStart=SystemClock.elapsedRealtime();
        sessionBytes=0;
        startRx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
        startTx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
        monitorHandler.post(monitorTick);
    }
    private void stopMonitor(){
        monitorHandler.removeCallbacks(monitorTick);
        if(monitorStart>0){
            long rx=TrafficStats.getUidRxBytes(android.os.Process.myUid());
            long tx=TrafficStats.getUidTxBytes(android.os.Process.myUid());
            long bytes=(rx<0||tx<0||startRx<0||startTx<0)?0:Math.max(0,rx-startRx)+Math.max(0,tx-startTx);
            long seconds=Math.max(0,(SystemClock.elapsedRealtime()-monitorStart)/1000);
            totalSessionBytes=prefs.getLong("total_session_bytes",0)+bytes;
            totalSessionSeconds=prefs.getLong("total_session_seconds",0)+seconds;
            prefs.edit().putLong("last_session_bytes",bytes).putLong("last_session_seconds",seconds).putLong("total_session_bytes",totalSessionBytes).putLong("total_session_seconds",totalSessionSeconds).apply();
            updateHistory();
        }
        monitorStart=0;
        if(monitorStatus!=null)monitorStatus.setText(getString(R.string.nui_37));
    }
    private void updateHistory(){
        if(historyStatus!=null){
            long seconds=prefs.getLong("last_session_seconds",0);
            long bytes=prefs.getLong("last_session_bytes",0);
            historyStatus.setText(getString(R.string.nui_38)+seconds+getString(R.string.nui_39)+String.format(Locale.getDefault(),"%.3f MB",bytes/1048576.0)+getString(R.string.nui_40)+String.format(Locale.getDefault(),"%.3f MB",totalSessionBytes/1048576.0)+getString(R.string.nui_41)+(totalSessionSeconds/60)+getString(R.string.nui_42)+getString(R.string.nui_43));
        }
    }
    @Override protected void onStop(){
        if(prefs.getBoolean("monitor_active",false)){
            prefs.edit().putBoolean("monitor_active",false).apply();
            stopMonitor();
            if(monitorButton!=null)monitorButton.setText(getString(R.string.nui_03));
        }
        super.onStop();
    }
    @Override protected void onStart(){
        super.onStart();
        boolean active=prefs.getBoolean("monitor_active",false);
        if(monitorButton!=null)monitorButton.setText(active?getString(R.string.nui_20):getString(R.string.nui_03));
        totalSessionBytes=prefs.getLong("total_session_bytes",0);
        totalSessionSeconds=prefs.getLong("total_session_seconds",0);
        updateHistory();
        if(active && monitorStart==0)startMonitor();
        else if(active)monitorHandler.post(monitorTick);
    }
    @Override protected void onDestroy(){
        peerEnrollmentGeneration++;
        cancelPilotStatusChecks();
        proxyPilot.detach(proxyPilotListener);
        farmerLiveHandler.removeCallbacks(farmerLiveRefresh);
        farmerLiveGeneration++;
        if(demoBanner!=null)demoBanner.destroy();
        stopMonitor();
        super.onDestroy();
    }
    @Override protected void onPause(){
        farmerLiveResumed=false;
        farmerLiveLoading=false;
        farmerLiveGeneration++;
        farmerLiveHandler.removeCallbacks(farmerLiveRefresh);
        if(demoBanner!=null)demoBanner.pause();
        super.onPause();
    }
    @Override protected void onResume(){
        super.onResume();
        farmerLiveResumed=true;
        if(demoBanner!=null)demoBanner.resume();
        if(farmerLiveButton!=null) {
            farmerLiveButton.setText(currentAuthSession()==null
                ?getString(R.string.psx_farmer_sign_in):getString(R.string.psx_farmer_refresh));
            farmerLiveHandler.removeCallbacks(farmerLiveRefresh);
            queryPrivateFarmerAccount(true);
        }
    }

    private void refreshConsent(){
        boolean consent=prefs.getBoolean("consented",false);
        consentStatus.setText(consent
            ?getString(R.string.nui_44)
            :getString(R.string.nui_45));
        consentButton.setText(consent?getString(R.string.nui_46):getString(R.string.nui_47));
    }

    private LinearLayout card(String title){
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18),dp(14),dp(18),dp(18));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(PANEL);
        bg.setCornerRadius(dp(20));
        box.setBackground(bg);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.setMargins(0,dp(18),0,0);
        page.addView(box,lp);
        text(box,title,18,WHITE,true);
        return box;
    }

    private TextView text(LinearLayout parent,String value,int size,int color,boolean bold){
        TextView t=new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        if(bold)t.setTypeface(null,Typeface.BOLD);
        t.setPadding(0,dp(5),0,dp(6));
        parent.addView(t);
        return t;
    }

    private Button button(LinearLayout parent,String label){
        Button b=new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setMinHeight(dp(54));
        b.setContentDescription(label);
        parent.addView(b,new LinearLayout.LayoutParams(-1,-2));
        return b;
    }

    private int dp(int value){
        return (int)(value*getResources().getDisplayMetrics().density+0.5f);
    }
}
