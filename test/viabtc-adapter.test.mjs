import test from "node:test";
import assert from "node:assert/strict";
import { createViaBtcAdapter, assertRealPoolEnabled } from "../pool/viabtc-adapter.mjs";

const env = { VIABTC_API_KEY:"key", VIABTC_API_SECRET:"secret", VIABTC_ACCOUNT:"marsx", VIABTC_API_BASE:"https://example.test" };

test("adapter keeps secrets out of normalized settlement", () => {
  const a=createViaBtcAdapter({env,fetchImpl:async()=>{throw new Error("unused")}});
  const s=a.normalizeSettlement({asset:"LTC",workerId:"worker_001",grossUnits:100n,acceptedShares:4,rejectedShares:0,hashrate:10,reference:"ref-1"});
  assert.equal(s.provider,"viabtc");
  assert.equal(Object.values(s).some(v => typeof v === "string" && v.includes("secret")),false);
  assert.equal("apiKey" in s,false);
  assert.equal("apiSecret" in s,false);
});

test("real pool gate defaults off and real payout gate remains blocked", () => {
  assert.throws(()=>assertRealPoolEnabled({}));
  assert.equal(assertRealPoolEnabled({REAL_POOL_ENABLED:"true",VIABTC_API_KEY:"key"}),true);
  assert.throws(()=>assertRealPoolEnabled({REAL_POOL_ENABLED:"true",VIABTC_API_KEY:"key",REAL_PAYOUTS_ENABLED:"true"}));
});

test("adapter requires credentials and https", () => {
  assert.throws(()=>createViaBtcAdapter({env:{}}));
  assert.throws(()=>createViaBtcAdapter({env:{...env,VIABTC_API_BASE:"http://example.test"}}));
});
