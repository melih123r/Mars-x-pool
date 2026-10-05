import java.nio.file.*;public class PairingIntegrationTest{
 public static void main(String[]a)throws Exception{
  String activity=Files.readString(Path.of("src/com/marsx/mobileminer/MainActivity.java"));
  String service=Files.readString(Path.of("src/com/marsx/mobileminer/WorkerForegroundService.java"));
  String client=Files.readString(Path.of("src/com/marsx/mobileminer/PairingHeartbeatClient.java"));
  if(activity.contains("putString(\"pairingToken\"")||activity.contains("putString(\"worker_token\""))throw new AssertionError("pairing token persisted");
  if(!activity.contains("pairingToken=t;token.setText(\"\")"))throw new AssertionError("session-only token handling missing");
  if(!client.contains("https://")||!client.contains("ACTION_STOP"))throw new AssertionError("HTTPS STOP client missing");
  if(client.contains("ACTION_START"))throw new AssertionError("remote START must not exist");
  if(!service.contains("pairingClient.poll"))throw new AssertionError("heartbeat not wired");
  System.out.println("PairingIntegrationTest PASS");
 }
}