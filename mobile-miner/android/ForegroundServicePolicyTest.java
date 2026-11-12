import java.nio.file.*; public final class ForegroundServicePolicyTest {
 static void ok(boolean v,String m){if(!v)throw new AssertionError(m);}
 public static void main(String[]a)throws Exception{
  String m=Files.readString(Path.of("mobile-miner/android/AndroidManifest.xml"));
  String s=Files.readString(Path.of("mobile-miner/android/src/com/marsx/mobileminer/WorkerForegroundService.java"));
  ok(m.contains("android:exported=\"false\""),"service must not be exported");
  ok(s.contains("START_NOT_STICKY"),"must not auto restart");
  ok(s.contains("ACTION_START"),"explicit start required");
  ok(s.contains("ACTION_STOP"),"explicit stop action required");
  ok(s.contains("onTaskRemoved"),"task removal must stop session");
  System.out.println("foreground service policy checks passed");
 }
}