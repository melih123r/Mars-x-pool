package com.marsx.pool;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Read-only local entry point; never accepts Telegram credentials or executes commands. */
public final class TelegramStatusActivity extends Activity {
    private TextView label(String value, int size) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextColor(Color.WHITE);
        text.setTextSize(size);
        text.setPadding(0, 12, 0, 12);
        return text;
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(24, 36, 24, 24);
        root.setBackgroundColor(Color.rgb(12, 15, 24));
        root.addView(label("MARS-X Command Center", 24));
        root.addView(label("Telegram integration status: NOT CONNECTED", 17));
        root.addView(label("Backend commands: /chat, /task, /status, /help", 16));
        root.addView(label("This screen is read-only. Commands and GitHub jobs are not executed here. No Telegram token is stored on the device.", 14));
        Button back = new Button(this);
        back.setText("Back to Network");
        back.setOnClickListener(v -> finish());
        root.addView(back);
        scroll.addView(root);
        setContentView(scroll);
    }
}
