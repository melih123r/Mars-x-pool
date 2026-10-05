package com.marsx.mobileminer;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.PowerManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.BatteryManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.graphics.Color;
import android.text.InputType;
import android.text.Editable;
import android.text.TextWatcher;
import android.widget.*;

/** Device diagnostic build: no mining payload, no remote commands or wallet secrets. */
public final class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView status, withdrawalProgress;
    private TextView setupStatus, settlementStatus;
    private EditText amount, destination;
    private Spinner target;

    private SharedPreferences preferences;
    private CheckBox consent, miningConsent;
    private Button miningStart;
    private boolean nativeRequested;
    private long nativeRequestedAt;
    private Intent safetySnapshot;
    private boolean started, visible;
    private String pairingRegistry, pairingSession, pairingToken;
    private PoolConnectionProbe poolProbe;
    private int probeGeneration;
    private long startedAt;
    private long lastLiveBatteryEvent = -1;
    private boolean batteryReceiverRegistered;
    private final android.content.BroadcastReceiver batteryEvents = new android.content.BroadcastReceiver() {
        public void onReceive(android.content.Context context, Intent intent) {
            if (Intent.ACTION_BATTERY_CHANGED.equals(intent.getAction()) && !isInitialStickyBroadcast())
                lastLiveBatteryEvent = SystemClock.elapsedRealtime();
        }
    };
    private final Runnable sample = new Runnable() {
        public void run() { update(); if (visible) handler.postDelayed(this, 1000); }
    };
    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(32, 40, 32, 32);
        layout.setBackgroundColor(Color.rgb(8, 12, 23));
        TextView title = text("MARS-X", 25);
        title.setTextColor(Color.rgb(255, 140, 40)); layout.addView(title);
        layout.addView(text("MARS-X cihaz hizmeti. İlk kurulumdan sonra BAŞLAT düğmesi güvenli bağlantıyı otomatik kurar.\n\n" +
            "Bu özellik cihazda VRSC madenciliği yapar; ısı, internet, elektrik ve pil kullanımı oluşturabilir. Kazanç garantisi yoktur.", 17));
        preferences = getSharedPreferences("vrsc_setup", MODE_PRIVATE);
        setupStatus = text("MARS-X bağlantısı otomatik hazırlanır. Adres, worker veya pool ayarı gerekmez.", 16);
        layout.addView(setupStatus);
        layout.addView(text("MARS-X Başlat / Durdur", 22));
        layout.addView(text("BAŞLAT dediğinde MARS-X güvenli bağlantıyı otomatik kurar. Teknik bağlantı ayarlarını değiştirmen gerekmez.", 16));
        miningConsent = new CheckBox(this);
        miningConsent.setText("MARS-X Worker'ın VRSC madenciliği için cihazımın 1 CPU thread'ini kullanacağını; internet, ısı, pil ve elektrik tüketimi oluşabileceğini anladım. BAŞLAT komutunu yalnız ben veririm ve DURDUR ile istediğim an sonlandırabilirim. Kazanç garantisi yok. Kabul ediyorum.");
        miningConsent.setTextColor(Color.WHITE); layout.addView(miningConsent);
        miningConsent.setOnCheckedChangeListener((button, checked) -> { if (!checked) stopNative(); });
        miningStart = new Button(this); miningStart.setText("BAŞLAT");
        miningStart.setEnabled(EngineArtifact.ready(this));
        miningStart.setOnClickListener(v -> {
            if (nativeRequested) return;
            if (!miningConsent.isChecked()) {
                Toast.makeText(this,"VRSC madenciliği onayı gerekli.",Toast.LENGTH_LONG).show(); return;
            }
            update();
            if (safetySnapshot == null || !safetySnapshot.getBooleanExtra("eligible", false)) {
                Toast.makeText(this,"Cihazın güncel güvenlik koşulları uygun değil.",Toast.LENGTH_LONG).show(); return;
            }
            android.app.NotificationManager notifications=getSystemService(android.app.NotificationManager.class);
            if (notifications == null || !notifications.areNotificationsEnabled()) {
                if (android.os.Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 9);
                Toast.makeText(this,"Bildirim iznini açıp yeniden Başlat'a dokun.",Toast.LENGTH_LONG).show(); return;
            }
            String autoWorker = automaticWorkerId();
            VrscConfig config;
            try { config = VrscConfig.marsx(autoWorker); }
            catch (IllegalArgumentException error) { setupStatus.setText(error.getMessage()); return; }
            started=false; nativeRequested=true; nativeRequestedAt=SystemClock.elapsedRealtime();
            Intent request=new Intent(safetySnapshot).setAction(WorkerForegroundService.ACTION_START)
                .putExtra("address",config.address).putExtra("worker",config.worker);
            if(pairingRegistry!=null&&pairingSession!=null&&pairingToken!=null) request.putExtra("registryUrl",pairingRegistry).putExtra("pairingSession",pairingSession).putExtra("pairingToken",pairingToken);
            startForegroundService(request);
        }); layout.addView(miningStart);
        consent = miningConsent;
        Button stop = new Button(this); stop.setText("DURDUR");
        stop.setOnClickListener(v -> { started = false; stopNative(); stopPoolProbe(); update(); }); layout.addView(stop);
        status = text("", 18); layout.addView(status);
        withdrawalProgress = text("Çekim hedefi: €1,00\nTahmini süre: doğrulanmış ödeme verisi bekleniyor.", 18); layout.addView(withdrawalProgress);
        layout.addView(text("Güvenlik sınırları: en fazla 10 dakika; pil en az %15; pil sıcaklığı 43°C altında; " +
            "harici güç ve doğrulanmış internet (Wi-Fi, mobil veri veya Ethernet). MARS-X arka planda yalnız görünür foreground bildirimiyle çalışır. Bu kontrol, cihaz güvenliği sertifikası değildir.", 16));
        buildSettlement(layout);
        addButton(layout, "Bu cihazdaki MARS-X kimliğini yenile", () -> {
            started = false; stopNative(); stopPoolProbe(); preferences.edit().remove("auto_worker").apply();
            amount.setText(""); destination.setText("");
            setupStatus.setText("Cihaz kimliği yenilenecek. Sonraki BAŞLAT işleminde otomatik hazırlanır."); update();
        });
        ScrollView scroll = new ScrollView(this); scroll.addView(layout); setContentView(scroll);
    }
    private TextView text(String value, int size) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size);
        view.setTextColor(Color.WHITE); view.setPadding(0, 12, 0, 16); return view;
    }
    private String automaticWorkerId() {
        String id = preferences.getString("auto_worker", "");
        if (id.matches("mx_[a-f0-9]{16}")) return id;
        String androidId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        if (androidId == null) androidId = "unknown-device";
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(("MARS-X:" + androidId + ":" + getPackageName()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder("mx_");
            for (int i = 0; i < 8; i++) hex.append(String.format(java.util.Locale.ROOT, "%02x", hash[i] & 255));
            id = hex.toString();
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
        preferences.edit().putString("auto_worker", id).apply();
        return id;
    }

    private void buildSettlement(LinearLayout layout) {
        layout.addView(text("Kazanç ve çekim hazırlığı", 22));
        layout.addView(text("MARS-X ortak payout adresi arka planda kullanılır. Accepted share doğrudan çekilebilir bakiye sayılmaz; " +
            "yalnız provider tarafından doğrulanan settlement kayıtları kazanç olarak kullanılabilir. Aşağıdaki form şimdilik yerel taslaktır.", 16));
        amount = input("Gönderilecek VRSC miktarı", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        layout.addView(amount);
        target = spinner(SettlementDraft.TARGETS); layout.addView(target);
        destination = input("Seçtiğin ağdaki hedef cüzdan adresi", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        layout.addView(destination);
        settlementStatus = text("Henüz taslak oluşturulmadı. Fiyat, minimum tutar ve ücret doğrulanmadı.", 16);
        TextWatcher invalidate = watcher(() -> settlementStatus.setText("Taslak güncel değil; yeniden hazırla. İşlem gönderilmedi."));
        amount.addTextChangedListener(invalidate); destination.addTextChangedListener(invalidate);
        target.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            public void onItemSelected(AdapterView<?> parent, android.view.View view, int position, long id) {
                settlementStatus.setText("Coin / ağ seçildi. Destek ve hedef adres doğrulanmadı; taslak oluşturabilirsin.");
            }
            public void onNothingSelected(AdapterView<?> parent) {}
        });
        addButton(layout, "İşlem taslağını göster — para göndermez", () -> {
            try {
                settlementStatus.setText(new SettlementDraft(amount.getText().toString(),
                    target.getSelectedItemPosition(), destination.getText().toString()).preview());
            } catch (IllegalArgumentException error) { settlementStatus.setText(error.getMessage()); }
        });
        layout.addView(settlementStatus);
        Button execute = new Button(this); execute.setText("Dönüştür / çek — bağlantı bekleniyor");
        execute.setEnabled(false); layout.addView(execute);
        addButton(layout, "Verus dönüşüm seçeneklerini incele", () -> openWeb("https://verus.io/get-vrsc"));
    }
    private TextWatcher watcher(Runnable action) {
        return new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            public void onTextChanged(CharSequence s, int start, int before, int count) { action.run(); }
            public void afterTextChanged(Editable e) {}
        };
    }
    private EditText input(String hint, int type) {
        EditText input = new EditText(this); input.setHint(hint); input.setInputType(type);
        input.setTextColor(Color.WHITE); input.setHintTextColor(Color.LTGRAY); input.setSingleLine(true);
        input.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(255, 140, 40)));
        input.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(128)});
        return input;
    }
    private Spinner spinner(String[] entries) {
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, entries);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter); return spinner;
    }
    private void addButton(LinearLayout parent, String title, Runnable action) {
        Button button = new Button(this); button.setText(title); accent(button);
        button.setOnClickListener(v -> action.run()); parent.addView(button);
    }
    private void accent(Button button) {
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(255, 140, 40)));
        button.setTextColor(Color.rgb(8, 12, 23));
    }
    private void openWeb(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException error) { Toast.makeText(this,"Bağlantıyı açacak tarayıcı bulunamadı.",Toast.LENGTH_LONG).show(); }
    }
    private void update() {
        if (status == null) return;
        Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        double temperature = Double.NaN; int percent = -1; boolean plugged = false;
        if (b != null) {
            if (b.hasExtra(BatteryManager.EXTRA_TEMPERATURE)) temperature = b.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) / 10.0;
            int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) percent = (int)(100L * level / scale);
            plugged = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
        }
        PowerManager power = getSystemService(PowerManager.class);
        int thermal = power == null ? -1 : power.getCurrentThermalStatus();
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        NetworkCapabilities caps = cm == null ? null : cm.getNetworkCapabilities(cm.getActiveNetwork());
        boolean validatedNetwork = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        long batteryAge = lastLiveBatteryEvent < 0 ? 5001 : SystemClock.elapsedRealtime() - lastLiveBatteryEvent;
        String miningVeto = SafetyPolicy.veto(miningConsent.isChecked(), true, visible, temperature,
            percent, thermal, plugged, validatedNetwork, batteryAge,
            nativeRequested ? SystemClock.elapsedRealtime() - nativeRequestedAt : 0);
        safetySnapshot = new Intent(this,WorkerForegroundService.class).putExtra("consent",miningConsent.isChecked())
            .putExtra("visible",visible).putExtra("temperature",temperature).putExtra("battery",percent)
            .putExtra("thermal",thermal).putExtra("plugged",plugged).putExtra("unmetered",validatedNetwork)
            .putExtra("ageMs",batteryAge).putExtra("eligible",miningVeto==null);
        if (nativeRequested) {
            if (miningVeto!=null || (SystemClock.elapsedRealtime()-nativeRequestedAt>2000 && !WorkerForegroundService.isRunning())) stopNative();
            else startService(new Intent(safetySnapshot).setAction(WorkerForegroundService.ACTION_HEARTBEAT));
        }
        String veto = SafetyPolicy.veto(consent.isChecked(), started, visible, temperature,
            percent, thermal, plugged, validatedNetwork, lastLiveBatteryEvent < 0 ? 5001 : SystemClock.elapsedRealtime() - lastLiveBatteryEvent,
            started ? SystemClock.elapsedRealtime() - startedAt : 0);
        if (veto != null) started = false;
        if (withdrawalProgress != null) withdrawalProgress.setText("Çekim hedefi: €1,00\nTahmini süre: doğrulanmış ödeme verisi bekleniyor.\nAccepted share sayısı bakiye olarak kullanılmaz.");
        status.setText("Pil: %" + percent + " | Sıcaklık: " + temperature + " °C\nAndroid termal durum: " + thermal +
            "\nHarici güç: " + plugged + " | İnternet doğrulandı: " + validatedNetwork + "\n\n" +
            (nativeRequested ? "MARS-X çalışıyor; güvenli bağlantı otomatik yönetiliyor." :
                "MARS-X hazır: " + (miningVeto==null ? "koşullar uygun" : miningVeto) + "\n" +
                (veto == null ? "Cihaz test koşulları uygun." : "Cihaz testi durdu: " + veto)) +
            "\nSon oturumda havuzun kabul ettiği share: " + WorkerForegroundService.acceptedShares() + "\nBu sayı ödeme veya bakiye değildir.");
    }
    private void stopNative() {
        nativeRequested=false; stopService(new Intent(this,WorkerForegroundService.class));
    }
    private void stopPoolProbe() {
        probeGeneration++;
        if (poolProbe != null) { poolProbe.close(); poolProbe = null; }
    }
    protected void onResume() {
        super.onResume(); visible = true; lastLiveBatteryEvent = -1;
        registerReceiver(batteryEvents, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        batteryReceiverRegistered = true; handler.post(sample);
    }
    protected void onPause() {
        if (batteryReceiverRegistered) { unregisterReceiver(batteryEvents); batteryReceiverRegistered = false; }
        lastLiveBatteryEvent = -1; stopPoolProbe(); visible = false; started = false; handler.removeCallbacks(sample); super.onPause(); }
    protected void onDestroy() { stopNative(); stopPoolProbe(); handler.removeCallbacks(sample); super.onDestroy(); }
}
