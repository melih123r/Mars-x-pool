package com.marsx.pool;

import android.app.Activity;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class ProtectActivity extends Activity {
    private MarsXTheme.Palette palette;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        palette = MarsXTheme.forModule(MarsXTheme.Module.PROTECT);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 28, 28, 28);
        root.setBackgroundColor(MarsXTheme.BACKGROUND);

        TextView title = text("MARS-X Protect", 28);
        title.setTextColor(palette.primary);
        root.addView(title);
        root.addView(text("Protection, built into the MARS-X ecosystem.", 15));

        LinearLayout status = card();
        status.addView(text("Pilot status", 14));
        TextView sandbox = text("SANDBOX · No real insurance coverage", 18);
        sandbox.setTextColor(palette.primary);
        status.addView(sandbox);
        status.addView(text("A licensed insurance partner will issue real policies only after the partner, regulatory and production gates are approved.", 14));
        root.addView(status);

        LinearLayout architecture = card();
        architecture.addView(text("Partner-ready architecture", 18));
        architecture.addView(text("MARS-X Protect uses a provider-neutral gateway. Komodi, Qover, Wakam or another approved provider can be connected without rebuilding this screen.", 14));
        root.addView(architecture);

        LinearLayout pilot = card();
        pilot.addView(text("Initial protection", 18));
        pilot.addView(text("Device / purchase protection · Travel disruption · Mobility", 14));
        Button quote = new Button(this);
        quote.setAllCaps(false);
        quote.setText("Demo quote — coming next");
        quote.setEnabled(false);
        quote.setTextColor(MarsXTheme.TEXT_PRIMARY);
        quote.setBackgroundTintList(android.content.res.ColorStateList.valueOf(palette.primary));
        pilot.addView(quote);
        root.addView(pilot);

        Button close = new Button(this);
        close.setAllCaps(false);
        close.setText("Back to MARS-X");
        close.setOnClickListener(v -> finish());
        root.addView(close);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    private TextView text(String value, int size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(MarsXTheme.TEXT_PRIMARY);
        view.setPadding(0, 6, 0, 6);
        return view;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(24, 20, 24, 20);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(MarsXTheme.SURFACE);
        bg.setCornerRadius(24f);
        bg.setStroke(2, palette.glow);
        card.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 16, 0, 8);
        card.setLayoutParams(lp);
        return card;
    }
}
