package com.marsx.pool;

import org.junit.Test;

import static org.junit.Assert.*;

public class NetworkWalletRulesTest {
    private static final String SOLANA = "FqxVPDjwwMyT4y2tRsQia2pXpwCcgGnH3J4HMhqAkwcU";
    private static final String TRON = "TT3RpGfvUScgAG3GYULcimxFXEUnPPNfGZ";

    @Test public void acceptsOnlyUsdtSolanaAndTronRoutes() {
        assertTrue(NetworkWalletRules.isSupportedRoute("USDT", "SOLANA"));
        assertTrue(NetworkWalletRules.isSupportedRoute("USDT", "TRON"));
        assertFalse(NetworkWalletRules.isSupportedRoute("USDC", "SOLANA"));
        assertFalse(NetworkWalletRules.isSupportedRoute("USDT", "POLYGON"));
    }

    @Test public void validatesChainSpecificPublicAddresses() {
        assertTrue(NetworkWalletRules.isValidPublicAddress("SOLANA", SOLANA));
        assertTrue(NetworkWalletRules.isValidPublicAddress("TRON", TRON));
        assertFalse(NetworkWalletRules.isValidPublicAddress("TRON", SOLANA));
        assertFalse(NetworkWalletRules.isValidPublicAddress("SOLANA", TRON));
        assertFalse(NetworkWalletRules.isValidPublicAddress("SOLANA", "seed phrase words must never be accepted"));
    }

    @Test public void masksPublicAddressWithoutExposingFullValue() {
        assertEquals("FqxVPD…AkwcU", NetworkWalletRules.maskAddress(SOLANA));
        assertFalse(NetworkWalletRules.maskAddress(SOLANA).contains(SOLANA));
    }

    @Test public void demoQuoteNeverBroadcastsAndSubtractsDisplayedFee() {
        NetworkWalletRules.DemoQuote quote =
                NetworkWalletRules.quoteDemo(1_000_000L, 100_000L);
        assertEquals(900_000L, quote.netMinor);
        assertEquals("DEMO_REQUESTED", quote.status);
        assertFalse(quote.broadcast);
    }

    @Test(expected = IllegalArgumentException.class)
    public void demoQuoteRejectsFeeAboveAmount() {
        NetworkWalletRules.quoteDemo(100L, 101L);
    }
}
