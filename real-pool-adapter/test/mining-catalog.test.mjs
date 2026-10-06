import test from "node:test";
import assert from "node:assert/strict";
import {routeMiningWork,assertUserVisibleMining} from "../compute/mining-catalog.mjs";

test("routes ARM CPU without pretending assets are live",()=>{
 const r=routeMiningWork({arm:true,cpu:true}).map(x=>x.asset);
 assert.equal(r[0],"VRSC");
 assert.ok(r.includes("XMR"));
 assert.throws(()=>assertUserVisibleMining("VRSC"),/not live/);
});
test("routes Scrypt ASIC to LTC and DOGE",()=>{
 assert.deepEqual(routeMiningWork({scryptAsic:true}).map(x=>x.asset),["LTC","DOGE"]);
});
