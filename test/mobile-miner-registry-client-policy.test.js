import test from 'node:test'; import assert from 'node:assert/strict';
import {registryRequest,telemetryPayload} from '../mobile-miner/registry-client-policy.mjs';
const base={url:'https://worker-registry-production.up.railway.app/health',workerId:'worker_12345'};
test('only production HTTPS registry is allowed',()=>{
 assert.equal(registryRequest(base).allowed,true);
 assert.equal(registryRequest({...base,url:'http://worker-registry-production.up.railway.app/health'}).allowed,false);
 assert.equal(registryRequest({...base,url:'https://example.com/health'}).allowed,false);
});
test('POST requires pairing credential',()=>{
 assert.equal(registryRequest({...base,method:'POST'}).allowed,false);
 assert.equal(registryRequest({...base,method:'POST',pairingToken:'0123456789abcdef'}).allowed,true);
});
test('telemetry contains device safety state but no secrets',()=>{
 const p=telemetryPayload({workerId:'worker_12345',status:'RUNNING',batteryC:31,batteryPercent:90,thermalStatus:0,sampleMs:1});
 assert.equal(p.status,'RUNNING'); assert.equal('pairingToken' in p,false);
 assert.equal(telemetryPayload({workerId:'worker_12345',status:'BAD',batteryC:31,batteryPercent:90,thermalStatus:0,sampleMs:1}),null);
});
