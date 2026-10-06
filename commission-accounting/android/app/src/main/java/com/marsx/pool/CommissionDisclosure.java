package com.marsx.pool;

import android.app.AlertDialog;
import android.content.Context;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

/** Displays the bundled policy; neither collects consent for a charge nor sends funds. */
public final class CommissionDisclosure {
    public static void show(Context context) {
        String message;
        try (InputStream input = context.getAssets().open("commission-policy.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > 16_384) throw new IllegalStateException("policy_size");
                bytes.write(buffer, 0, count);
            }
            JSONObject policy = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            if (policy.getInt("schemaVersion") != 1 || policy.getBoolean("collectionEnabled"))
                throw new IllegalStateException("policy_state");
            message = context.getString(R.string.commission_policy_body,
                percent(policy.getInt("poolFeeBps")), percent(policy.getInt("withdrawalFeeBps")),
                percent(policy.getInt("referralShareOfWithdrawalFeeBps")), policy.getString("policyId"));
        } catch (Exception error) { message = context.getString(R.string.commission_policy_unavailable); }
        new AlertDialog.Builder(context).setTitle(R.string.commission_policy_title)
            .setMessage(message).setPositiveButton(R.string.close_button, null).show();
    }
    private static String percent(int bps) {
        if (bps < 0 || bps > 10_000) throw new IllegalArgumentException("bps");
        return BigDecimal.valueOf(bps, 2).stripTrailingZeros().toPlainString();
    }
    private CommissionDisclosure() {}
}
