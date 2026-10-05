package com.marsx.mobileminer;
import android.content.Context;
import android.os.Build;
import java.io.*;
import java.util.Arrays;
public final class EngineArtifact {
    public static final String ENGINE_SHA = "ad03ad902f5696d71daebbfa9d7d03157723af916d35a673e4de3e8a74c182ad";
    public static File binary(Context context) {
        return new File(context.getApplicationInfo().nativeLibraryDir, "libmarsxminer.so");
    }
    public static boolean ready(Context context) {
        if (!Arrays.asList(Build.SUPPORTED_ABIS).contains("arm64-v8a")) return false;
        try {
            StringBuilder features = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
                String line; while ((line = reader.readLine()) != null && features.length() < 65536) features.append(line).append(' ');
            }
            if (!features.toString().matches("(?s).*\\baes\\b.*")) return false;
            return NativeEngineSession.matches(binary(context), ENGINE_SHA);
        } catch (Exception error) { return false; }
    }
    private EngineArtifact() {}
}
