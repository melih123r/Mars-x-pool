import com.marsx.mobileminer.SafetyPolicy;
public final class SafetyPolicyTest {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  public static void main(String[] args) {
    check(SafetyPolicy.veto(true,true,true,30,90,0,true,true,0,1000) == null);
    check(SafetyPolicy.veto(true,true,true,38,90,0,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,Double.NaN,90,0,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,2,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,-1,true,true,0,1000) != null);
    check(SafetyPolicy.veto(false,true,true,30,90,0,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,false,30,90,0,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,79,0,true,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,0,false,true,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,0,true,false,0,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,0,true,true,5001,1000) != null);
    check(SafetyPolicy.veto(true,true,true,30,90,0,true,true,0,600000) != null);
    System.out.println("12 Java policy checks passed");
  }
}
