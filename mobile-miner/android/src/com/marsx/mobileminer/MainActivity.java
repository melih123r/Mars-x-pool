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
    private TextView status;
    private TextView setupStatus, settlementStatus;
    private EditText address, worker, amount, destination;
    private Spinner region, target;
    private CheckBox ownWallet;
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
        TextView title = text("MARS-X\nVRSC WORKER TESTİ", 25);
        title.setTextColor(Color.rgb(255, 140, 40)); layout.addView(title);
        layout.addView(text("Deneysel worker: uygun ve doğrulanmış ARM64 motor varsa kullanıcı kendi VRSC cüzdanıyla test başlatabilir. Dönüşüm, çekim ve komisyon kapalıdır. Gelir ölçülmez.\n\n" +
            "Telefon madenciliği ısı, elektrik tüketimi ve pil yıpranması oluşturabilir. Kazanç garantisi yoktur.", 17));
        buildSetup(layout);
        layout.addView(text("2 · Başlat / Durdur", 22));
        layout.addView(text("Worker testi Vipor TLS bağlantısını kullanır. Hash hızı, kabul edilen share ve ödeme henüz ölçülmedi. Bu bir üretim sürümü değildir.", 16));
        miningConsent = new CheckBox(this);
        miningConsent.setText("BAŞLAT dediğimde cihazımın 1 CPU thread kullanacağını; ısı, pil ve elektrik tüketimi oluşabileceğini anladım ve kabul ediyorum. Kazanç garantisi yok.");
        miningConsent.setTextColor(Color.WHITE); layout.addView(miningConsent);
        miningConsent.setOnCheckedChangeListener((button, checked) -> { if (!checked) stopNative(); });
        miningStart = new Button(this); miningStart.setText("BAŞLAT");
        miningStart.setEnabled(EngineArtifact.ready(this));
        miningStart.setOnClickListener(v -> {
            if (nativeRequested) return;
            if (!miningConsent.isChecked() || !ownWallet.isChecked()) {
                Toast.makeText(this,"Cüzdan ve deneysel test onayları gerekli.",Toast.LENGTH_LONG).show(); return;
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
            try { new VrscConfig(address.getText().toString(),worker.getText().toString(),0); }
            catch (IllegalArgumentException error) { setupStatus.setText(error.getMessage()); return; }
            started=false; nativeRequested=true; nativeRequestedAt=SystemClock.elapsedRealtime();
            Intent request=new Intent(safetySnapshot).setAction(WorkerForegroundService.ACTION_START)
                .putExtra("address",address.getText().toString()).putExtra("worker",worker.getText().toString());
            if(pairingRegistry!=null&&pairingSession!=null&&pairingToken!=null) request.putExtra("registryUrl",pairingRegistry).putExtra("pairingSession",pairingSession).putExtra("pairingToken",pairingToken);
            startForegroundService(request);
        }); layout.addView(miningStart);
        consent = new CheckBox(this);
        consent.setText("Riskleri okudum; yalnızca cihaz uygunluk testini başlatıyorum.");
        consent.setTextColor(Color.WHITE); layout.addView(consent);
        Button start = new Button(this); start.setText("Cihaz testini başlat");
        accent(start);
        start.setOnClickListener(v -> {
            if (!consent.isChecked()) { Toast.makeText(this,"Önce onay kutusunu seç",Toast.LENGTH_SHORT).show(); return; }
            started = true; startedAt = SystemClock.elapsedRealtime(); update();
        }); layout.addView(start);
        Button stop = new Button(this); stop.setText("DURDUR");
        stop.setOnClickListener(v -> { started = false; stopNative(); stopPoolProbe(); update(); }); layout.addView(stop);
        consent.setOnCheckedChangeListener((button, checked) -> { if (!checked) started = false; update(); });
        status = text("", 18); layout.addView(status);
        layout.addView(text("Test sınırları: en fazla 10 dakika; pil en az %80; pil sıcaklığı 38°C altında; " +
            "harici güç ve doğrulanmış internet (Wi-Fi, mobil veri veya Ethernet). Uygulamadan ayrılınca test durur. Bu kontrol, cihaz güvenliği sertifikası değildir.", 16));
        buildSettlement(layout);
        addButton(layout, "Bu cihazdaki kurulumu sil", () -> {
            started = false; stopNative(); stopPoolProbe(); preferences.edit().clear().apply(); address.setText(""); worker.setText("phone");
            ownWallet.setChecked(false); region.setSelection(0); amount.setText(""); destination.setText("");
            setupStatus.setText("Kaydedilmiş kurulum silindi. Havuza bağlanılmadı."); update();
        });
        ScrollView scroll = new ScrollView(this); scroll.addView(layout); setContentView(scroll);
    }
    private TextView text(String value, int size) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size);
        view.setTextColor(Color.WHITE); view.setPadding(0, 12, 0, 16); return view;
    }
    private void buildSetup(LinearLayout layout) {
        preferences = getSharedPreferences("vrsc_setup", MODE_PRIVATE);
        layout.addView(text("1 · VRSC cüzdanın ve havuz", 22));
        layout.addView(text("Ödüller için kendi cüzdanındaki R-adresini kullan. Borsa yatırma adresi kullanma. " +
            "Seed veya özel anahtar istenmez. Adres kontrolü, cüzdanın sana ait olduğunu kanıtlamaz.", 16));
        address = input("VRSC R-adresi", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        address.setText(preferences.getString("address", "")); layout.addView(address);
        worker = input("Cihaz adı", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        worker.setText(preferences.getString("worker", "phone")); layout.addView(worker);
        region = spinner(VrscConfig.REGIONS); layout.addView(region);
        int savedRegion = preferences.getInt("region", 0);
        region.setSelection(savedRegion >= 0 && savedRegion < VrscConfig.REGIONS.length ? savedRegion : 0);
        ownWallet = new CheckBox(this); ownWallet.setText("Adres kendi cüzdanıma ait; tamamını kontrol ettim.");
        ownWallet.setTextColor(Color.WHITE); layout.addView(ownWallet);
        setupStatus = text("Kurulum yalnızca bu cihazda saklanır. Havuza bağlanılmadı.", 16);
        TextWatcher edited = watcher(() -> {
            stopNative(); stopPoolProbe();
            ownWallet.setChecked(false);
            setupStatus.setText("Kurulum değişti; adresi kontrol edip yeniden kaydet.");
        });
        address.addTextChangedListener(edited); worker.addTextChangedListener(edited);
        region.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            public void onItemSelected(AdapterView<?> parent, android.view.View view, int position, long id) {
                setupStatus.setText("Seçilen havuz: " + VrscConfig.REGIONS[position] + ". Havuza bağlanılmadı. Değişiklikleri kaydet.");
            }
            public void onNothingSelected(AdapterView<?> parent) {}
        });
        addButton(layout, "Adresi doğrula ve kurulumu kaydet", () -> {
            try {
                VrscConfig config = new VrscConfig(address.getText().toString(), worker.getText().toString(), region.getSelectedItemPosition());
                if (!ownWallet.isChecked()) throw new IllegalArgumentException("Cüzdan adresini kontrol edip kutuyu işaretle.");
                preferences.edit().putString("address", config.address).putString("worker", config.worker)
                    .putInt("region", region.getSelectedItemPosition()).apply();
                setupStatus.setText("Adres kontrolü geçti; kurulum kaydedildi.\nHavuz: " + config.endpointPreview() +
                    "\nCihaz: " + config.worker + "\nHavuza bağlanılmadı; kazım başlamadı.");
            } catch (IllegalArgumentException error) { setupStatus.setText(error.getMessage()); }
        });
        layout.addView(setupStatus);
        addButton(layout, "Vipor güvenli bağlantısını test et — kazım yapmaz", () -> {
            if (!ownWallet.isChecked()) { setupStatus.setText("Adresini kontrol edip sahiplik kutusunu işaretle."); return; }
            final String payout = address.getText().toString(), name = worker.getText().toString();
            try { new VrscConfig(payout, name, 0); }
            catch (IllegalArgumentException error) { setupStatus.setText(error.getMessage()); return; }
            stopPoolProbe();
            final int generation = probeGeneration;
            final PoolConnectionProbe probe = new PoolConnectionProbe(); poolProbe = probe;
            setupStatus.setText("Açık adresin Vipor'a gönderiliyor; güvenli bağlantı kontrol ediliyor…");
            new Thread(() -> {
                String result;
                try { result = probe.check(payout, name); }
                catch (Exception error) { result = "Bağlantı doğrulanamadı: " + error.getClass().getSimpleName(); }
                finally { probe.close(); }
                final String message = result;
                handler.post(() -> { if (visible && generation == probeGeneration) setupStatus.setText(message); });
            }, "marsx-pool-probe").start();
        });
        addButton(layout, "Verus cüzdan seçeneklerini aç", () -> openWeb("https://verus.io/wallet"));
        addButton(layout, "Vipor bağlantı bilgilerini aç", () -> openWeb("https://vipor.net/mine/verus"));
    }
    private void buildSettlement(LinearLayout layout) {
        layout.addView(text("3 · Dönüşüm ve çekim hazırlığı", 22));
        layout.addView(text("Havuz ödeme adresi kendi VRSC cüzdanındır. Uygulamada çekilebilir bir bakiye tutulmaz. " +
            "Aşağıdaki form yalnızca yerel taslak oluşturur; coinlerin listelenmesi dönüşüm desteği anlamına gelmez.", 16));
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
        status.setText("Pil: %" + percent + " | Sıcaklık: " + temperature + " °C\nAndroid termal durum: " + thermal +
            "\nHarici güç: " + plugged + " | İnternet doğrulandı: " + validatedNetwork + "\n\n" +
            (nativeRequested ? "Worker testi istendi; gelir/ödeme doğrulanmadı." :
                "Worker hazır olma kontrolü: " + (miningVeto==null ? "koşullar uygun" : miningVeto) + "\n" +
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
        lastLiveBatteryEvent = -1; stopNative(); stopPoolProbe(); visible = false; started = false; handler.removeCallbacks(sample); super.onPause(); }
    protected void onDestroy() { stopNative(); stopPoolProbe(); handler.removeCallbacks(sample); super.onDestroy(); }
}
