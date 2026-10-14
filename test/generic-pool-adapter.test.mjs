import test from "node:test";
import assert from "node:assert/strict";
import {createGenericPoolAdapter,normalizeGenericSettlement} from "../pool/generic-pool-adapter.mjs";

test("generic adapter supports candidate CPU/ARM assets",()=>{
 for(const asset of ["VRSC","XMR","ZEPH","QUBIC"]) assert.equal(createGenericPoolAdapter({asset,baseUrl:"https://pool.invalid",apiKey:"k",fetchImpl:async()=>({ok:true,json:async()=>({})})}).asset,asset);
});
test("generic settlement requires provider reference and positive amount",()=>{
 assert.throws(()=>normalizeGenericSettlement({asset:"XMR",workerId:"w",row:{grossUnits:"1"}}));
 const s=normalizeGenericSettlement({asset:"VRSC",workerId:"w",row:{reference:"r1",grossUnits:"2"}});
 assert.equal(s.source,"provider_settlement"); assert.equal(s.grossUnits,2n);
});
