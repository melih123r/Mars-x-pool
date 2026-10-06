import test from "node:test";
import assert from "node:assert/strict";
import { normalizePoolSnapshot, settleSnapshot, quoteWithdrawal, verifyProviderSettlement } from "../pool/settlement.mjs";

test("LTC/DOGE snapshots only and 10% pool fee", () => {
  const s = normalizePoolSnapshot({provider:"provider",asset:"DOGE",workerId:"worker_001",hashrate:12,acceptedShares:9,rejectedShares:1,grossUnits:100000n,providerReference:"settlement-1"});
  const x = settleSnapshot(s);
  assert.equal(x.feeUnits, 10000n);
  assert.equal(x.netUnits, 90000n);
  assert.equal(verifyProviderSettlement(x,s), true);
});

test("withdrawal quote applies 2% service fee plus explicit network fee", () => {
  const q = quoteWithdrawal({balanceUnits:100000n,amountUnits:50000n,networkFeeUnits:1000n});
  assert.equal(q.serviceFeeUnits,1000n);
  assert.equal(q.userReceivesUnits,48000n);
});

test("rejects unsupported or invalid inputs", () => {
  assert.throws(()=>normalizePoolSnapshot({asset:"BTC",workerId:"worker_001",hashrate:1,acceptedShares:1,rejectedShares:0,grossUnits:1n}));
  assert.throws(()=>quoteWithdrawal({balanceUnits:1n,amountUnits:2n}));
});
