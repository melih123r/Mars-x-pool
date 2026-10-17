package com.marsx.pool;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class LemonScaKeyManagerTest {
    @Test
    public void aliasIsDeterministicAndDoesNotExposeAccountId() {
        String id = "cusa_20323d55bb264d42b0b225d293591049";
        String first = LemonScaKeyManager.aliasFor(id);
        String second = LemonScaKeyManager.aliasFor(id);
        assertEquals(first, second);
        assertTrue(first.startsWith("marsx_lemon_sca_"));
        assertFalse(first.contains(id));
        assertEquals("marsx_lemon_sca_".length() + 32, first.length());
    }

    @Test
    public void aliasRejectsMissingOrOversizedAccountIds() {
        assertThrows(IllegalArgumentException.class, () -> LemonScaKeyManager.aliasFor(""));
        assertThrows(IllegalArgumentException.class, () -> LemonScaKeyManager.aliasFor("x".repeat(256)));
    }
}
