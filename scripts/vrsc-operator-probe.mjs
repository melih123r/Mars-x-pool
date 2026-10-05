import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';

export function validAddress(address) {
  if (typeof address !== 'string' || !/^R[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of address) n = n * 58n + BigInt(alphabet.indexOf(c));
  const bytes = Buffer.from(n.toString(16).padStart(50, '0'), 'hex');
  const hash = b => createHash('sha256').update(b).digest();
  return bytes.length === 25 && bytes[0] === 60 && hash(hash(bytes.subarray(0, 21))).subarray(0, 4).equals(bytes.subarray(21));
}

export function probe(host, address) {
  return new Promise(resolve => {
    const result = { host, port: 3958, tlsVerified: false, subscribed: false, authorized: false,
      acceptedShareVerified: false, settlementVerified: false };
    let buffer = '', done = false;
    const socket = tls.connect({ host, port: 3958, servername: host, rejectUnauthorized: true });
    const finish = error => {
      if (done) return; done = true;
      clearTimeout(timer); socket.destroy();
      resolve({ ...result, ...(error ? { error } : {}) });
    };
    const timer = setTimeout(() => finish('timeout'), 12000);
    socket.on('secureConnect', () => {
      if (!socket.authorized) return finish('certificate-not-verified');
      result.tlsVerified = true;
      socket.write(JSON.stringify({ id: 1, method: 'mining.subscribe', params: ['MARS-X-probe'] }) + '\n');
    });
    socket.on('data', chunk => {
      buffer += chunk.toString();
      if (buffer.length > 65536) return finish('response-too-large');
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        let message;
        try { message = JSON.parse(line); } catch { return finish('invalid-json'); }
        if (message.id === 1) {
          if (message.error || !Array.isArray(message.result)) return finish('subscription-rejected');
          result.subscribed = true;
          socket.write(JSON.stringify({ id: 2, method: 'mining.authorize', params: [address + '.marsx_probe', 'X'] }) + '\n');
        } else if (message.id === 2) {
          result.authorized = message.result === true && !message.error;
          finish(result.authorized ? undefined : 'authorization-rejected');
        }
      }
    });
    socket.on('error', error => finish(error.code || 'connection-failed'));
    socket.on('end', () => finish('connection-ended'));
  });
}

export async function run() {
  const config = JSON.parse(await readFile(new URL('../config/vrsc-operator.json', import.meta.url)));
  const address = process.env.VRSC_PAYOUT_ADDRESS || config.payoutAddress;
  if (!validAddress(address)) throw new Error('invalid-payout-address-checksum');
  const endpoints = await Promise.all(['eu.luckpool.net', 'na.luckpool.net', 'ap.luckpool.net'].map(host => probe(host, address)));
  // Authorization proves protocol response only. No work is computed or submitted.
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), address, endpoints,
    creditEnabled: false, withdrawalsEnabled: false }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
