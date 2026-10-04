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
    private CheckBox consent;
    private boolean started, visible;
    private long startedAt;
    private final Runnable sample = new Runnable() {
        public void run() { update(); if (visible) handler.postDelayed(this, 1000); }
    };
    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL); layout.setPadding(32, 40, 32, 32);
        layout.setBackgroundColor(Color.rgb(8, 12, 23));
        TextView title = text("MARS-X\nVRSC KURULUM TESTİ", 25);
        title.setTextColor(Color.rgb(255, 140, 40)); layout.addView(title);
        layout.addView(text("Bu test sürümünde kazım, dönüşüm ve çekim aktif değil. Gerçek bakiye veya gelir ölçülmez.\n\n" +
            "Telefon madenciliği ısı, elektrik tüketimi ve pil yıpranması oluşturabilir. Kazanç garantisi yoktur.", 17));
        buildSetup(layout);
        layout.addView(text("2 · Başlat / Durdur", 22));
        layout.addView(text("Kazım motoru: mevcut değil\nHavuz bağlantısı: kurulmadı\nHash hızı / kabul edilen share: ölçülmedi", 16));
        Button miningStart = new Button(this); miningStart.setText("VRSC kazımını başlat — henüz hazır değil");
        miningStart.setEnabled(false); layout.addView(miningStart);
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
        stop.setOnClickListener(v -> { started = false; update(); }); layout.addView(stop);
        consent.setOnCheckedChangeListener((button, checked) -> { if (!checked) started = false; update(); });
        status = text("", 18); layout.addView(status);
        layout.addView(text("Test sınırları: en fazla 10 dakika; pil en az %80; pil sıcaklığı 38°C altında; " +
            "harici güç ve ölçümsüz ağ. Uygulamadan ayrılınca test durur. Bu kontrol, cihaz güvenliği sertifikası değildir.", 16));
        buildSettlement(layout);
        addButton(layout, "Bu cihazdaki kurulumu sil", () -> {
            started = false; preferences.edit().clear().apply(); address.setText(""); worker.setText("phone");
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
            ownWallet.setChecked(false);
            setupStatus.setText("Kurulum değişti; adresi kontrol edip yeniden kaydet.");
        });
        address.addTextChangedListener(edited); worker.addTextChangedListener(edited);
        region.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            public void onItemSelected(AdapterView<?> parent, android.view.View view, int position, long id) {
                setupStatus.setText("Seçilen bölge: " + VrscConfig.REGIONS[position] + ". Havuza bağlanılmadı. Değişiklikleri kaydet.");
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
        addButton(layout, "Verus cüzdan seçeneklerini aç", () -> openWeb("https://verus.io/wallet"));
        addButton(layout, "LuckPool bağlantı bilgilerini aç", () -> openWeb("https://luckpool.net/verus/connect.html"));
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
        boolean unmetered = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        String veto = SafetyPolicy.veto(consent.isChecked(), started, visible, temperature,
            percent, thermal, plugged, unmetered, b == null ? 5001 : 0,
            started ? SystemClock.elapsedRealtime() - startedAt : 0);
        if (veto != null) started = false;
        status.setText("Pil: %" + percent + " | Sıcaklık: " + temperature + " °C\nAndroid termal durum: " + thermal +
            "\nHarici güç: " + plugged + " | Ölçümsüz ağ: " + unmetered + "\n\n" +
            (veto == null ? "Cihaz test koşulları uygun. Madencilik motoru mevcut değil." : "Test durdu: " + veto));
    }
    protected void onResume() { super.onResume(); visible = true; handler.post(sample); }
    protected void onPause() { visible = false; started = false; handler.removeCallbacks(sample); super.onPause(); }
    protected void onDestroy() { handler.removeCallbacks(sample); super.onDestroy(); }
}
