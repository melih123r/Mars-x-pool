package com.marsx.mobileminer;
import android.content.Context;
import android.os.Build;
import java.io.*;
import java.util.Arrays;
public final class EngineArtifact {
    public static final String ENGINE_SHA = "08d8a731b3427d521733ef68c697a01b7b6ee42bbdd538d26586d25db7a3a617";
    public static final String RUNTIME_SHA = "f9992c4ba6b7c5a716e3a202fceb1ce029d6a2b0605838ac6b3219f489dd7970";
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
            return NativeEngineSession.matches(binary(context), ENGINE_SHA) &&
                NativeEngineSession.matches(new File(context.getApplicationInfo().nativeLibraryDir, "libc++_shared.so"), RUNTIME_SHA);
        } catch (Exception error) { return false; }
    }
    private EngineArtifact() {}
}
