import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDevicePolicy, assertComputeReceipt } from "../compute/device-policy.mjs";

const safe={explicitConsent:true,foreground:true,charging:true,batteryPercent:80,batteryTempC:35,unmeteredNetwork:true};

test("mobile compute requires explicit consent and safe device state",()=>{
  assert.equal(evaluateDevicePolicy(safe).allowed,true);
  assert.equal(evaluateDevicePolicy({...safe,explicitConsent:false}).reason,"consent_required");
  assert.equal(evaluateDevicePolicy({...safe,charging:false}).reason,"charging_required");
  assert.equal(evaluateDevicePolicy({...safe,batteryTempC:45}).reason,"thermal_limit");
});

test("compute receipt must be provider verified and never directly spendable",()=>{
  assert.throws(()=>assertComputeReceipt({source:"device_claim",acceptedUnits:10}));
  const x=assertComputeReceipt({source:"provider_verified_compute",jobId:"j1",workerId:"w1",providerReference:"p1",acceptedUnits:10});
  assert.equal(x.spendable,false);
});
