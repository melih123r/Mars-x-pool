#!/usr/bin/env python3
"""Run deterministic indicator regression checks using the JDK (no Android SDK)."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path("android/app/src/main/java/com/marsx/pool/TechnicalIndicators.java")
HARNESS = """
import com.marsx.pool.TechnicalIndicators;
public class IndicatorChecks {
  static void near(double a, double b, double tol) {
    if (!Double.isFinite(a) || Math.abs(a-b)>tol)
      throw new AssertionError(a+" != "+b);
  }
  static void check(boolean ok) { if (!ok) throw new AssertionError(); }
  public static void main(String[] args) {
    double[] rising=new double[60],flat=new double[60],constant=new double[60];
    for(int i=0;i<60;i++){rising[i]=i+1;flat[i]=100;constant[i]=100;}
    double[] sma=TechnicalIndicators.sma(rising,5);
    check(Double.isNaN(sma[3])); near(sma[4],3,1e-9);near(sma[59],58,1e-9);
    double[] ema=TechnicalIndicators.ema(flat,10);
    check(Double.isNaN(ema[8]));near(ema[9],100,1e-9);near(ema[59],100,1e-9);
    double[] rsi=TechnicalIndicators.rsi(rising,14);
    check(Double.isNaN(rsi[13]));near(rsi[14],100,1e-9);
    near(TechnicalIndicators.rsi(constant,14)[59],50,1e-9);
    double[][] bb=TechnicalIndicators.bollinger(flat,20,2);
    near(bb[0][59],100,1e-9);near(bb[1][59],100,1e-9);near(bb[2][59],100,1e-9);
    double[][] macd=TechnicalIndicators.macd(flat);
    check(Double.isNaN(macd[1][32]));near(macd[0][59],0,1e-9);
    near(macd[1][59],0,1e-9);near(macd[2][59],0,1e-9);
    boolean rejected=false;
    try {TechnicalIndicators.sma(new double[]{Double.NaN},1);}
    catch(IllegalArgumentException expected){rejected=true;}
    check(rejected);
    System.out.println("PASS: SMA EMA RSI Bollinger MACD warmup/flat/rising/input checks");
  }
}
"""

def main():
    if not shutil.which("javac") or not shutil.which("java"):
        raise SystemExit("JDK required: install javac and java to run indicator checks")
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        harness = root / "IndicatorChecks.java"
        harness.write_text(HARNESS, encoding="utf-8")
        subprocess.run(["javac", "-d", str(root), str(SOURCE), str(harness)], check=True)
        subprocess.run(["java", "-cp", str(root), "IndicatorChecks"], check=True)

if __name__ == "__main__":
    main()
