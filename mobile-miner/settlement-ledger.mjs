// Durable reconciliation records, not spendable balances. No transfer methods.
import {DatabaseSync} from 'node:sqlite';
import {vrscAtoms,formatVrsc} from './commission-preview.mjs';
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v);
export function openSettlementLedger(path,{verifyEvidence}={}) {
 if(typeof verifyEvidence!=='function')throw new TypeError('independent-evidence-verifier-required');
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settlements (
 provider TEXT NOT NULL, settlement_id TEXT NOT NULL, account_id TEXT NOT NULL,
 wallet TEXT NOT NULL, transaction_id TEXT NOT NULL, atoms TEXT NOT NULL,
 confirmed_at INTEGER NOT NULL, evidence_hash TEXT NOT NULL,
 PRIMARY KEY(provider,settlement_id));`);
 const find=db.prepare('SELECT * FROM settlements WHERE provider=? AND settlement_id=?');
 const insert=db.prepare('INSERT INTO settlements VALUES (?,?,?,?,?,?,?,?)');
 return Object.freeze({
  record(event,evidence){
   if(!event||!['provider','settlementId','accountId','wallet','transactionId'].every(k=>identifier(event[k])))
    throw new TypeError('invalid-settlement-identity');
   const atoms=vrscAtoms(event.amountVrsc);
   if(atoms<=0n||!Number.isSafeInteger(event.confirmedAtMs)||event.confirmedAtMs<=0||event.confirmedAtMs>Date.now())
    throw new RangeError('invalid-settlement-amount-or-time');
   // A caller supplied providerConfirmed flag is never sufficient. The verifier
   // must bind authenticated evidence to all identity, amount and time fields.
   const proof=verifyEvidence(Object.freeze({...event}),evidence);
   if(!proof||proof.verified!==true||typeof proof.evidenceHash!=='string'||!/^[a-f0-9]{64}$/.test(proof.evidenceHash))
    throw new Error('independent-evidence-not-verified');
   db.exec('BEGIN IMMEDIATE');
   try {
    const old=find.get(event.provider,event.settlementId);
    if(old){
     const same=old.account_id===event.accountId&&old.wallet===event.wallet&&old.transaction_id===event.transactionId&&old.atoms===atoms.toString()&&old.confirmed_at===event.confirmedAtMs;
     if(!same)throw new Error('conflicting-settlement-replay');
     db.exec('COMMIT');return {inserted:false,duplicate:true,creditEnabled:false};
    }
    insert.run(event.provider,event.settlementId,event.accountId,event.wallet,event.transactionId,atoms.toString(),event.confirmedAtMs,proof.evidenceHash);
    db.exec('COMMIT');return {inserted:true,duplicate:false,creditEnabled:false};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  review(accountId){
   if(!identifier(accountId))throw new TypeError('invalid-account');
   const rows=db.prepare('SELECT atoms FROM settlements WHERE account_id=?').all(accountId);
   const total=rows.reduce((n,r)=>n+BigInt(r.atoms),0n);
   return {recordedVrsc:formatVrsc(total),settlementCount:rows.length,spendableVrsc:'0.00000000',creditEnabled:false,withdrawalEnabled:false};
  },
  close(){db.close();}
 });
}
