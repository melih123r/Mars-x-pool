package com.marsx.pool;

import org.junit.Test;
import java.util.Arrays;
import static org.junit.Assert.*;

public class FinanceCorrelationTest {
    @Test public void perfectPositiveAndNegative() {
        assertEquals(1.0, FinanceCorrelation.pearson(
            Arrays.asList(1d,2d,3d), Arrays.asList(2d,4d,6d)), 1e-10);
        assertEquals(-1.0, FinanceCorrelation.pearson(
            Arrays.asList(1d,2d,3d), Arrays.asList(6d,4d,2d)), 1e-10);
    }

    @Test public void matrixIsSymmetric() {
        double[][] m = FinanceCorrelation.matrix(Arrays.asList(
            Arrays.asList(1d,2d,3d), Arrays.asList(3d,2d,1d)));
        assertEquals(1.0, m[0][0], 1e-10);
        assertEquals(-1.0, m[0][1], 1e-10);
        assertEquals(m[0][1], m[1][0], 0);
    }

    @Test(expected = IllegalArgumentException.class)
    public void constantSeriesRejected() {
        FinanceCorrelation.pearson(Arrays.asList(1d,1d,1d), Arrays.asList(1d,2d,3d));
    }

    @Test(expected = IllegalArgumentException.class)
    public void nonFiniteRejected() {
        FinanceCorrelation.pearson(Arrays.asList(1d,Double.NaN), Arrays.asList(2d,3d));
    }

    @Test(expected = IllegalArgumentException.class)
    public void unalignedRejected() {
        FinanceCorrelation.pearson(Arrays.asList(1d,2d), Arrays.asList(1d,2d,3d));
    }
}
