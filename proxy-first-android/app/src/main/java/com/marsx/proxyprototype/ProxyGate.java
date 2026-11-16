package com.marsx.proxyprototype;
final class ProxyGate { private boolean consent; void consent(){consent=true;} void revoke(){consent=false;} boolean hasConsent(){return consent;} boolean canStart(boolean explicitStart,boolean reviewed,boolean credentials,boolean safe){return consent&&explicitStart&&reviewed&&credentials&&safe;} }
