import test from 'node:test';
import assert from 'node:assert/strict';
import { validAddress } from '../scripts/vrsc-operator-probe.mjs';
test('operator address validates version and checksum before authorization', () => {
  assert.equal(validAddress('RFnoU1UFxBqrJh3NWUUBRBKCNGSEgkQ5c7'), true);
  for (const address of [null, '', 'RFnoU1UFxBqrJh3NWUUBRBKCNGSEgkQ5c8', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'])
    assert.equal(validAddress(address), false);
});
