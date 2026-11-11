'use strict';
// SDK-free demo wallet validation. Public receiving addresses only; NO signing.
const NETWORKS = Object.freeze({TRON:'TRON', SOLANA:'SOLANA'});
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function decodeBase58(s) {
  if (typeof s !== 'string' || !s.length || [...s].some(c=>!B58.includes(c))) throw new Error('INVALID_BASE58');
  let n=0n; for (const c of s) n=n*58n+BigInt(B58.indexOf(c));
  let hex=n.toString(16); if(hex.length%2) hex='0'+hex;
  const payload=n===0n?Buffer.alloc(0):Buffer.from(hex,'hex');
  const leading=s.match(/^1*/)[0].length;
  return Buffer.concat([Buffer.alloc(leading),payload]);
}
function validateDestination(network,address) {
  if(typeof address!=='string'||address.trim()!==address) return false;
  let bytes; try{bytes=decodeBase58(address);}catch{return false;}
  if(network===NETWORKS.SOLANA) return bytes.length===32;
  if(network===NETWORKS.TRON) {
    if(bytes.length!==25||bytes[0]!==0x41) return false;
    const crypto=require('node:crypto');
    const hash=b=>crypto.createHash('sha256').update(b).digest();
    const checksum=hash(hash(bytes.subarray(0,21))).subarray(0,4);
    return checksum.equals(bytes.subarray(21));
  }
  return false;
}
function validateDemoWithdrawal({network,address,asset,amountMinor}) {
  if(asset!=='USDT') throw new Error('UNSUPPORTED_ASSET');
  if(!validateDestination(network,address)) throw new Error('INVALID_DESTINATION');
  if(!Number.isSafeInteger(amountMinor)||amountMinor<=0) throw new Error('INVALID_AMOUNT');
  return {network,address,asset,amountMinor,mode:'DEMO',broadcast:false};
}
module.exports={NETWORKS,validateDestination,validateDemoWithdrawal};
