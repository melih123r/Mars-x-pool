'use strict';
// DEMO ONLY. In-memory backend contract for the SDK-free Play build.
// No signing, broadcast, custody, token transfer, seed phrase or private key handling.
const {createHash}=require('node:crypto');
const {validateDemoWithdrawal,validateDestination}=require('./wallet-validation');

const DEMO_FLAGS=Object.freeze({
  isDemo:true,
  payoutsEnabled:false,
  trafficEnabled:false,
  signingEnabled:false,
  broadcastEnabled:false
});

function requireIdentifier(value,name) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{3,80}$/.test(value)) {
    throw new Error('INVALID_'+name.toUpperCase());
  }
  return value;
}

function requireVerificationToken(value) {
  if(typeof value!=='string'||value.length<8||value.length>256) {
    throw new Error('INVALID_VERIFICATION_TOKEN');
  }
}

function requireMinor(value,name,{allowZero=true}={}) {
  if(!Number.isSafeInteger(value)||value<0||(!allowZero&&value===0)) {
    throw new Error('INVALID_'+name.toUpperCase());
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function maskAddress(address) {
  return address.length<=12?'***':address.slice(0,6)+'…'+address.slice(-6);
}

function freezeRecord(value) {
  return Object.freeze({...value});
}

function createDemoWithdrawalService({now=()=>new Date().toISOString()}={}) {
  const destinations=new Map();
  const destinationIdempotency=new Map();
  const withdrawals=new Map();
  const withdrawalIdempotency=new Map();
  const cancellationIdempotency=new Map();
  const balances=new Map();
  const auditEvents=[];
  let destinationSequence=0;
  let withdrawalSequence=0;
  let auditSequence=0;

  const appendAudit=(userId,action,objectId,metadata={})=>{
    const event=freezeRecord({
      id:'audit-'+(++auditSequence),
      userId,
      action,
      objectId,
      at:now(),
      metadata:Object.freeze({...metadata}),
      isDemo:true
    });
    auditEvents.push(event);
    return event;
  };

  const walletState=userId=>{
    requireIdentifier(userId,'user_id');
    const state=balances.get(userId)||{pendingMinor:0,settledMinor:0,reservedMinor:0};
    return freezeRecord({
      pendingMinor:state.pendingMinor,
      settledMinor:state.settledMinor,
      reservedMinor:state.reservedMinor,
      availableMinor:state.settledMinor-state.reservedMinor,
      asset:'USDT',
      ...DEMO_FLAGS
    });
  };

  const setDemoBalance=(userId,value)=>{
    requireIdentifier(userId,'user_id');
    const previous=balances.get(userId)||{reservedMinor:0};
    const normalized=typeof value==='number'
      ?{pendingMinor:0,settledMinor:requireMinor(value,'settled_minor')}
      :{
        pendingMinor:requireMinor(value?.pendingMinor??0,'pending_minor'),
        settledMinor:requireMinor(value?.settledMinor??0,'settled_minor')
      };
    if(normalized.settledMinor<previous.reservedMinor) {
      throw new Error('SETTLED_BELOW_RESERVED');
    }
    balances.set(userId,{
      ...normalized,
      reservedMinor:previous.reservedMinor
    });
    appendAudit(userId,'demo_balance_set',userId,{
      pendingMinor:normalized.pendingMinor,
      settledMinor:normalized.settledMinor
    });
    return walletState(userId);
  };

  const registerDestination=({userId,idempotencyKey,network,address,verificationToken})=>{
    requireIdentifier(userId,'user_id');
    requireIdentifier(idempotencyKey,'idempotency_key');
    requireVerificationToken(verificationToken);
    if(!validateDestination(network,address)) throw new Error('INVALID_DESTINATION');
    const composite=userId+':'+idempotencyKey;
    const requestFingerprint=fingerprint({network,address});
    const previous=destinationIdempotency.get(composite);
    if(previous) {
      if(previous.fingerprint!==requestFingerprint) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return destinations.get(previous.destinationId);
    }

    const record=freezeRecord({
      id:'demo-destination-'+(++destinationSequence),
      userId,
      asset:'USDT',
      network,
      publicAddress:address,
      maskedAddress:maskAddress(address),
      verification:'DEMO_ACCOUNT_TOKEN_ACCEPTED',
      ownershipVerified:false,
      revokedAt:null,
      createdAt:now(),
      ...DEMO_FLAGS
    });
    destinations.set(record.id,record);
    destinationIdempotency.set(composite,{
      fingerprint:requestFingerprint,
      destinationId:record.id
    });
    appendAudit(userId,'destination_registered',record.id,{
      network,
      maskedAddress:record.maskedAddress,
      ownershipVerified:false
    });
    return record;
  };

  const listDestinations=userId=>{
    requireIdentifier(userId,'user_id');
    return [...destinations.values()].filter(record=>record.userId===userId);
  };

  const revokeDestination=({userId,destinationId,idempotencyKey})=>{
    requireIdentifier(userId,'user_id');
    requireIdentifier(destinationId,'destination_id');
    requireIdentifier(idempotencyKey,'idempotency_key');
    const record=destinations.get(destinationId);
    if(!record||record.userId!==userId) throw new Error('DESTINATION_NOT_FOUND');
    const composite=userId+':'+idempotencyKey;
    const previous=cancellationIdempotency.get(composite);
    if(previous&&previous!==destinationId) throw new Error('IDEMPOTENCY_CONFLICT');
    if(record.revokedAt) {
      cancellationIdempotency.set(composite,destinationId);
      return record;
    }
    const revoked=freezeRecord({...record,revokedAt:now()});
    destinations.set(destinationId,revoked);
    cancellationIdempotency.set(composite,destinationId);
    appendAudit(userId,'destination_revoked',destinationId,{network:record.network});
    return revoked;
  };

  const requestWithdrawal=({
    userId,idempotencyKey,destinationId,asset='USDT',amountMinor
  })=>{
    requireIdentifier(userId,'user_id');
    requireIdentifier(idempotencyKey,'idempotency_key');
    requireIdentifier(destinationId,'destination_id');
    const destination=destinations.get(destinationId);
    if(!destination||destination.userId!==userId) throw new Error('DESTINATION_NOT_FOUND');
    if(destination.revokedAt) throw new Error('DESTINATION_REVOKED');
    validateDemoWithdrawal({
      network:destination.network,
      address:destination.publicAddress,
      asset,
      amountMinor
    });

    const composite=userId+':'+idempotencyKey;
    const requestFingerprint=fingerprint({destinationId,asset,amountMinor});
    const previous=withdrawalIdempotency.get(composite);
    if(previous) {
      if(previous.fingerprint!==requestFingerprint) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return withdrawals.get(previous.withdrawalId);
    }

    const state=balances.get(userId)||{pendingMinor:0,settledMinor:0,reservedMinor:0};
    const availableMinor=state.settledMinor-state.reservedMinor;
    if(amountMinor>availableMinor) throw new Error('INSUFFICIENT_SETTLED_DEMO_BALANCE');

    const record=freezeRecord({
      id:'demo-withdrawal-'+(++withdrawalSequence),
      userId,
      destinationId,
      network:destination.network,
      maskedAddress:destination.maskedAddress,
      asset,
      amountMinor,
      status:'DEMO_RESERVED',
      createdAt:now(),
      updatedAt:now(),
      transactionId:null,
      broadcast:false,
      ...DEMO_FLAGS
    });
    balances.set(userId,{
      ...state,
      reservedMinor:state.reservedMinor+amountMinor
    });
    withdrawals.set(record.id,record);
    withdrawalIdempotency.set(composite,{
      fingerprint:requestFingerprint,
      withdrawalId:record.id
    });
    appendAudit(userId,'withdrawal_reserved',record.id,{
      destinationId,
      network:record.network,
      amountMinor
    });
    return record;
  };

  const cancelWithdrawal=({userId,withdrawalId,idempotencyKey})=>{
    requireIdentifier(userId,'user_id');
    requireIdentifier(withdrawalId,'withdrawal_id');
    requireIdentifier(idempotencyKey,'idempotency_key');
    const record=withdrawals.get(withdrawalId);
    if(!record||record.userId!==userId) throw new Error('WITHDRAWAL_NOT_FOUND');
    const composite=userId+':cancel:'+idempotencyKey;
    const previous=cancellationIdempotency.get(composite);
    if(previous&&previous!==withdrawalId) throw new Error('IDEMPOTENCY_CONFLICT');
    if(record.status==='DEMO_CANCELLED') {
      cancellationIdempotency.set(composite,withdrawalId);
      return record;
    }
    if(record.status!=='DEMO_RESERVED') throw new Error('INVALID_WITHDRAWAL_STATE');
    const state=balances.get(userId);
    const cancelled=freezeRecord({
      ...record,
      status:'DEMO_CANCELLED',
      updatedAt:now()
    });
    balances.set(userId,{
      ...state,
      reservedMinor:state.reservedMinor-record.amountMinor
    });
    withdrawals.set(withdrawalId,cancelled);
    cancellationIdempotency.set(composite,withdrawalId);
    appendAudit(userId,'withdrawal_reservation_released',withdrawalId,{
      amountMinor:record.amountMinor
    });
    return cancelled;
  };

  const listWithdrawals=userId=>{
    requireIdentifier(userId,'user_id');
    return [...withdrawals.values()].filter(record=>record.userId===userId);
  };

  const getAuditEvents=userId=>{
    requireIdentifier(userId,'user_id');
    return auditEvents.filter(event=>event.userId===userId);
  };

  return {
    setDemoBalance,
    getWalletState:walletState,
    getDemoBalance:userId=>walletState(userId).availableMinor,
    registerDestination,
    listDestinations,
    revokeDestination,
    requestWithdrawal,
    cancelWithdrawal,
    listWithdrawals,
    getAuditEvents,
    flags:DEMO_FLAGS
  };
}

module.exports={createDemoWithdrawalService,DEMO_FLAGS};
