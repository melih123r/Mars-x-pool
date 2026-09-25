package com.marsx.pool;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final String DEFAULT_URL = "https://worker-registry-production.up.railway.app";
    private static final String[] TASKS = {
            "Uygulama açılıyor",
            "Node kimliği görüntüleniyor",
            "Sunucu bağlantısı test ediliyor",
            "Node yalnızca açık onayla kaydediliyor",
            "Heartbeat yalnızca açık onayla gönderiliyor",
            "Gizlilik politikası açılabiliyor",
            "Geri bildirim paylaşılabiliyor"
    };

    private TextView status;
    private TextView feedback;
    private EditText endpoint;
    private EditText token;
    private SharedPreferences prefs;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("marsx_beta", MODE_PRIVATE);
        if (!prefs.contains("worker_id")) {
            prefs.edit().putString("worker_id", "node-" + UUID.randomUUID().toString().replace("-", "")).apply();
        }

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 36, 28, 36);
        root.setBackgroundColor(Color.rgb(246, 248, 252));
        scroll.addView(root);

        addTitle(root, "MARS-X POOL");
        addText(root, "Beta 0.2 • Kapalı test", 18);
        addText(root, "Bu sürüm cihazda madencilik yapmaz, para kazanma vaadi sunmaz ve arka planda hesaplama çalıştırmaz.", 14);

        addTitle(root, "Bu cihazın worker kimliği");
        addText(root, prefs.getString("worker_id", ""), 13);
        addText(root, "Sunucuyla iletişim yalnızca aşağıdaki düğmelere bastığında başlar.", 13);

        addTitle(root, "Sunucu bağlantısı");
        endpoint = new EditText(this);
        endpoint.setSingleLine(true);
        endpoint.setText(prefs.getString("endpoint", DEFAULT_URL));
        endpoint.setHint("https://...");
        root.addView(endpoint);

        token = new EditText(this);
        token.setSingleLine(true);
        token.setHint("Kapalı beta erişim anahtarı");
        token.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        token.setText(prefs.getString("worker_token", ""));
        root.addView(token);
        addText(root, "Anahtar yalnızca bu cihazda saklanır; geri bildirim metnine eklenmez.", 12);

        status = addText(root, "Henüz test edilmedi.", 15);
        button(root, "HTTPS /health bağlantısını test et", view -> request("GET", "/health", false));
        button(root, "Bu cihazı kaydet", view -> request("POST", "/register", true));
        button(root, "Manuel heartbeat gönder", view -> request("POST", "/heartbeat", true));
        button(root, "Gizlilik politikasını aç", view -> openPrivacy());

        addTitle(root, "Kapalı test kontrol listesi");
        for (int i = 0; i < TASKS.length; i++) {
            final int index = i;
            CheckBox checkBox = new CheckBox(this);
            checkBox.setText(TASKS[i]);
            checkBox.setChecked(prefs.getBoolean("test_" + i, false));
            checkBox.setOnCheckedChangeListener((button, checked) -> {
                prefs.edit().putBoolean("test_" + index, checked).apply();
                updateFeedback();
            });
            root.addView(checkBox);
        }

        feedback = addText(root, "", 15);
        updateFeedback();
        button(root, "Test geri bildirimini paylaş", view -> shareFeedback());
        setContentView(scroll);
    }

    private void request(String method, String path, boolean authenticated) {
        String base = endpoint.getText().toString().trim().replaceAll("/$", "");
        String accessToken = token.getText().toString().trim();
        if (!base.matches("https://[A-Za-z0-9._:-]+")) {
            status.setText("Yalnızca geçerli bir HTTPS sunucu adresi kullan.");
            return;
        }
        if (authenticated && accessToken.length() < 16) {
            status.setText("Kapalı beta erişim anahtarını gir.");
            return;
        }

        prefs.edit().putString("endpoint", base).putString("worker_token", accessToken).apply();
        status.setText("İstek gönderiliyor…");
        new Thread(() -> {
            String result;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(base + path).openConnection();
                connection.setConnectTimeout(7_000);
                connection.setReadTimeout(7_000);
                connection.setRequestMethod(method);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "application/json");
                if (authenticated) connection.setRequestProperty("Authorization", "Bearer " + accessToken);
                if ("POST".equals(method)) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    String workerId = prefs.getString("worker_id", "");
                    String body = "{\"workerId\":\"" + workerId + "\",\"platform\":\"android-" + Build.VERSION.SDK_INT + "\",\"label\":\"Android beta\"}";
                    connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
                }
                int code = connection.getResponseCode();
                InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (stream != null) stream.close();
                if (code == 200) {
                    if ("/health".equals(path)) result = "Sunucu hazır: HTTP 200.";
                    else if ("/register".equals(path)) result = "Worker kaydı başarılı: HTTP 200.";
                    else result = "Heartbeat başarılı: HTTP 200.";
                } else if (code == 401) {
                    result = "Erişim anahtarı kabul edilmedi: HTTP 401.";
                } else if (code == 404 && "/heartbeat".equals(path)) {
                    result = "Önce cihazı kaydet: HTTP 404.";
                } else {
                    result = "Sunucu yanıtı: HTTP " + code + ".";
                }
            } catch (Exception error) {
                result = "Bağlantı kurulamadı. İnternet ve sunucu adresini kontrol et.";
            } finally {
                if (connection != null) connection.disconnect();
            }
            String message = result;
            runOnUiThread(() -> status.setText(message));
        }).start();
    }

    private void openPrivacy() {
        String base = endpoint.getText().toString().trim().replaceAll("/$", "");
        if (!base.matches("https://[A-Za-z0-9._:-]+")) base = DEFAULT_URL;
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(base + "/privacy")));
    }

    private void shareFeedback() {
        int completed = completedCount();
        String workerId = prefs.getString("worker_id", "unknown");
        String suffix = workerId.length() > 8 ? workerId.substring(workerId.length() - 8) : workerId;
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT,
                "MARS-X Pool Beta 0.2 test raporu\nTamamlanan adım: " + completed + "/" + TASKS.length +
                        "\nBağlantı durumu: " + status.getText() + "\nWorker sonu: " + suffix);
        startActivity(Intent.createChooser(intent, "Test raporunu gönder"));
    }

    private int completedCount() {
        int completed = 0;
        for (int i = 0; i < TASKS.length; i++) if (prefs.getBoolean("test_" + i, false)) completed++;
        return completed;
    }

    private void updateFeedback() {
        if (feedback != null) feedback.setText("Tamamlanan test: " + completedCount() + "/" + TASKS.length);
    }

    private TextView addText(LinearLayout root, String text, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(34, 46, 67));
        view.setPadding(0, 8, 0, 12);
        root.addView(view);
        return view;
    }

    private void addTitle(LinearLayout root, String text) {
        TextView view = addText(root, text, 23);
        view.setTextColor(Color.rgb(20, 73, 145));
    }

    private void button(LinearLayout root, String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setOnClickListener(listener);
        root.addView(button);
    }
}
