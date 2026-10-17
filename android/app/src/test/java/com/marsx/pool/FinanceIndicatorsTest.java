package com.marsx.pool;
import org.junit.Test;
import static org.junit.Assert.*;
public class FinanceIndicatorsTest {
 @Test public void smaWarmup(){double[] a=FinanceIndicators.sma(new double[]{1,2,3,4},3);assertTrue(Double.isNaN(a[0]));assertEquals(2,a[2],1e-9);assertEquals(3,a[3],1e-9);}
 @Test public void emaSeed(){double[] a=FinanceIndicators.ema(new double[]{1,2,3,4},3);assertTrue(Double.isNaN(a[1]));assertEquals(2,a[2],1e-9);assertEquals(3,a[3],1e-9);}
 @Test public void rsiFlat(){double[] a=FinanceIndicators.rsi(new double[]{10,10,10,10},2);assertEquals(50,a[2],1e-9);}
 @Test public void rsiRising(){double[] a=FinanceIndicators.rsi(new double[]{1,2,3,4},2);assertEquals(100,a[2],1e-9);}
 @Test(expected=IllegalArgumentException.class)public void rejectsBadPrice(){FinanceIndicators.ema(new double[]{1,Double.NaN},2);}
}
