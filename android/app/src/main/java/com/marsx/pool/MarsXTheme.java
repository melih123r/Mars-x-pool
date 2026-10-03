package com.marsx.pool;

import android.graphics.Color;

public final class MarsXTheme {
    public enum Module { CORE, POOL, BROKER, WALLET, PROTECT, ENGINE }
    public static final int BACKGROUND = Color.rgb(13, 15, 20);
    public static final int SURFACE = Color.rgb(24, 27, 34);
    public static final int TEXT_PRIMARY = Color.rgb(245, 247, 250);
    public static final int TEXT_SECONDARY = Color.rgb(174, 181, 194);

    public static final class Palette {
        public final int primary, secondary, glow;
        private Palette(int primary, int secondary, int glow) {
            this.primary = primary; this.secondary = secondary; this.glow = glow;
        }
    }

    private MarsXTheme() {}

    public static Palette forModule(Module module) {
        switch (module) {
            case POOL: return new Palette(Color.rgb(255,122,24), Color.rgb(255,74,32), Color.rgb(122,62,28));
            case BROKER: return new Palette(Color.rgb(157,78,221), Color.rgb(224,64,251), Color.rgb(74,53,96));
            case WALLET: return new Palette(Color.rgb(0,210,211), Color.rgb(34,211,238), Color.rgb(28,92,96));
            case PROTECT: return new Palette(Color.rgb(245,166,35), Color.rgb(255,193,7), Color.rgb(105,78,25));
            case ENGINE: return new Palette(Color.rgb(99,102,241), Color.rgb(124,58,237), Color.rgb(55,48,105));
            case CORE:
            default: return new Palette(Color.rgb(139,92,246), Color.rgb(34,211,238), Color.rgb(62,58,108));
        }
    }
}
