package com.marsx.proxyprototype;
import org.junit.Test;
import static org.junit.Assert.*;
public class ProxyGateTest { @Test public void failClosed(){ProxyGate g=new ProxyGate();assertFalse(g.canStart(true,true,true,true));g.consent();assertFalse(g.canStart(false,true,true,true));assertFalse(g.canStart(true,false,true,true));assertFalse(g.canStart(true,true,false,true));assertFalse(g.canStart(true,true,true,false));g.revoke();assertFalse(g.canStart(true,true,true,true));} }
