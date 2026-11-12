import test from "node:test";
import assert from "node:assert/strict";
import {rankMiningRoutes,chooseMiningRoute} from "../compute/profitability-router.mjs";

const routes=[{asset:"XMR",enabled:true},{asset:"VRSC",enabled:true}];
test("does not choose unverified profitability",()=>{
 assert.equal(chooseMiningRoute(routes,{XMR:{samples:2,providerVerified:true,confirmedRevenueUnits:10,energyWh:2,deviceHours:1}}).selected,null);
});
test("chooses best provider-verified net efficiency",()=>{
 const o={
  XMR:{samples:3,providerVerified:true,confirmedRevenueUnits:10,energyWh:5,deviceHours:1},
  VRSC:{samples:4,providerVerified:true,confirmedRevenueUnits:12,energyWh:3,deviceHours:1}
 };
 assert.equal(rankMiningRoutes(routes,o)[0].asset,"VRSC");
 assert.equal(chooseMiningRoute(routes,o).selected.asset,"VRSC");
});
