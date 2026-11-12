import test from "node:test";
import assert from "node:assert/strict";
import { assertSpendableCredit, miningEstimate } from "../pool/credit-policy.mjs";

test("only provider settlements can become spendable",()=>{
  assert.throws(()=>assertSpendableCredit({source:"client_hashrate",amountUnits:10n,providerReference:"x123"}));
  const x=assertSpendableCredit({source:"provider_settlement",asset:"DOGE",workerId:"w1",amountUnits:10n,providerReference:"pool-1234"});
  assert.equal(x.amountUnits,10n);
});

test("mining estimates are explicitly non-spendable",()=>{
  const x=miningEstimate({hashrate:2,unitsPerHash:0.5});
  assert.equal(x.spendable,false);
  assert.equal(x.label,"Tahmini");
});
