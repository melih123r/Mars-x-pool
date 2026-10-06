package com.marsx.pool;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public class BrokerActivity extends Activity {
    private static final double STARTING_CASH = 10000.0;
    private static final int PURPLE = Color.rgb(157, 78, 221);
    private final Map<String, Double> prices = new LinkedHashMap<>();
    private SharedPreferences prefs;
    private TextView portfolio;
    private TextView orderStatus;
    private EditText amount;
    private String selected = "BTC";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("marsx_broker_paper", MODE_PRIVATE);
        if (!prefs.contains("cash")) prefs.edit().putLong("cash", Double.doubleToRawLongBits(STARTING_CASH)).apply();
        prices.put("BTC", 60000.0);
        prices.put("ETH", 2500.0);
        prices.put("SOL", 150.0);
        prices.put("AAPL", 250.0);
        prices.put("SPY", 680.0);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 28, 28, 36);
        root.setBackgroundColor(Color.rgb(13, 10, 20));

        title(root, "MARS-X BROKER");
        text(root, "BETA • PAPER / SIMULATION", 14, PURPLE);
        text(root, "No real money, securities or crypto are used. Prices are demo values and are not live market data.", 13, Color.LTGRAY);

        LinearLayout portfolioCard = card(root);
        text(portfolioCard, "Paper portfolio", 18, Color.WHITE);
        portfolio = text(portfolioCard, "", 20, Color.WHITE);
        refreshPortfolio();

        LinearLayout marketCard = card(root);
        text(marketCard, "Demo markets", 18, Color.WHITE);
        for (Map.Entry<String, Double> entry : prices.entrySet()) {
            Button b = button(marketCard, entry.getKey() + "   " + money(entry.getValue()), v -> {
                selected = ((Button) v).getText().toString().split("\\s+")[0];
                orderStatus.setText("Selected " + selected + " • PAPER");
            });
            b.setTextColor(PURPLE);
        }

        LinearLayout orderCard = card(root);
        text(orderCard, "Paper order", 18, Color.WHITE);
        amount = new EditText(this);
        amount.setHint("Amount in demo EUR");
        amount.setHintTextColor(Color.GRAY);
        amount.setTextColor(Color.WHITE);
        amount.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        orderCard.addView(amount);
        button(orderCard, "BUY • PAPER", v -> trade(true));
        button(orderCard, "SELL • PAPER", v -> trade(false));
        orderStatus = text(orderCard, "Select an asset and enter an amount.", 14, Color.LTGRAY);

        LinearLayout engineCard = card(root);
        text(engineCard, "MARS-X Engine", 18, Color.WHITE);
        text(engineCard, "Analysis-only beta. No automated execution and no investment recommendation.", 14, Color.LTGRAY);

        button(root, "Reset paper portfolio", v -> {
            SharedPreferences.Editor e = prefs.edit().clear();
            e.putLong("cash", Double.doubleToRawLongBits(STARTING_CASH)).apply();
            refreshPortfolio();
            orderStatus.setText("Paper portfolio reset.");
        });
        button(root, "Back to MARS-X", v -> finish());

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    private void trade(boolean buy) {
        double eur;
        try { eur = Double.parseDouble(amount.getText().toString().trim()); }
        catch (Exception e) { orderStatus.setText("Enter a valid demo amount."); return; }
        if (!Double.isFinite(eur) || eur <= 0 || eur > 1_000_000) {
            orderStatus.setText("Enter a demo amount between 0 and 1,000,000."); return;
        }
        double price = prices.get(selected);
        double cash = cash();
        double units = units(selected);
        if (buy) {
            if (eur > cash) { orderStatus.setText("Not enough paper cash."); return; }
            cash -= eur;
            units += eur / price;
        } else {
            double sellUnits = eur / price;
            if (sellUnits > units) { orderStatus.setText("Not enough paper position."); return; }
            cash += eur;
            units -= sellUnits;
        }
        prefs.edit()
                .putLong("cash", Double.doubleToRawLongBits(cash))
                .putLong("units_" + selected, Double.doubleToRawLongBits(units))
                .apply();
        orderStatus.setText((buy ? "Bought " : "Sold ") + money(eur) + " " + selected + " • PAPER ONLY");
        amount.setText("");
        refreshPortfolio();
    }

    private double cash() {
        return Double.longBitsToDouble(prefs.getLong("cash", Double.doubleToRawLongBits(STARTING_CASH)));
    }
    private double units(String symbol) {
        return Double.longBitsToDouble(prefs.getLong("units_" + symbol, Double.doubleToRawLongBits(0.0)));
    }
    private void refreshPortfolio() {
        double total = cash();
        StringBuilder positions = new StringBuilder();
        for (Map.Entry<String, Double> e : prices.entrySet()) {
            double u = units(e.getKey());
            total += u * e.getValue();
            if (u > 0.0000001) positions.append("\n").append(e.getKey()).append("  ").append(String.format(Locale.US, "%.6f", u));
        }
        portfolio.setText("Total " + money(total) + "\nCash " + money(cash()) +
                (positions.length() == 0 ? "\nNo paper positions yet." : positions.toString()));
    }
    private String money(double value) { return String.format(Locale.US, "€%,.2f", value); }

    private LinearLayout card(LinearLayout parent) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(22, 18, 22, 18);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.rgb(28, 23, 38));
        bg.setCornerRadius(24f);
        bg.setStroke(2, Color.rgb(74, 53, 96));
        c.setBackground(bg);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.setMargins(0, 12, 0, 12);
        parent.addView(c, p);
        return c;
    }
    private TextView text(LinearLayout root, String value, int size, int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color);
        t.setPadding(0, 7, 0, 9); root.addView(t); return t;
    }
    private void title(LinearLayout root, String value) { text(root, value, 26, PURPLE); }
    private Button button(LinearLayout root, String label, View.OnClickListener listener) {
        Button b = new Button(this); b.setText(label); b.setAllCaps(false); b.setOnClickListener(listener); root.addView(b); return b;
    }
}
