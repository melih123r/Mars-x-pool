'use strict';
// DEMO request adapter. It exposes contract-shaped responses without opening a socket
// and deliberately has no signer, broadcaster, RPC client or private-key input.
const {createDemoWithdrawalService,DEMO_FLAGS}=require('./demo-withdrawal-service.cjs');

function publicDestination(record) {
  return {
    id:record.id,
    asset:record.asset,
    network:record.network,
    maskedAddress:record.maskedAddress,
    verification:record.verification,
    ownershipVerified:record.ownershipVerified,
    revokedAt:record.revokedAt,
    createdAt:record.createdAt,
    ...DEMO_FLAGS
  };
}

function publicWithdrawal(record) {
  return {
    id:record.id,
    destinationId:record.destinationId,
    network:record.network,
    maskedAddress:record.maskedAddress,
    asset:record.asset,
    amountMinor:record.amountMinor,
    status:record.status,
    createdAt:record.createdAt,
    updatedAt:record.updatedAt,
    transactionId:null,
    ...DEMO_FLAGS
  };
}

function errorStatus(message) {
  if(/NOT_FOUND/.test(message)) return 404;
  if(/CONFLICT|REVOKED|INSUFFICIENT|BELOW_RESERVED|INVALID_WITHDRAWAL_STATE/.test(message)) {
    return 409;
  }
  if(/INVALID|UNSUPPORTED|UNAUTHORIZED|MISSING/.test(message)) return 400;
  return 500;
}

function createDemoWalletApi(service=createDemoWithdrawalService()) {
  const handle=async({method,path,userId,body={}})=>{
    try {
      if(method==='GET'&&path==='/network/wallet') {
        return {status:200,body:service.getWalletState(userId)};
      }
      if(method==='POST'&&path==='/network/wallet-destinations') {
        const record=service.registerDestination({userId,...body});
        return {status:201,body:publicDestination(record)};
      }
      if(method==='GET'&&path==='/network/wallet-destinations') {
        return {
          status:200,
          body:{
            destinations:service.listDestinations(userId).map(publicDestination),
            ...DEMO_FLAGS
          }
        };
      }
      const destinationMatch=path.match(/^\/network\/wallet-destinations\/([^/]+)$/);
      if(method==='DELETE'&&destinationMatch) {
        const record=service.revokeDestination({
          userId,
          destinationId:destinationMatch[1],
          idempotencyKey:body.idempotencyKey
        });
        return {status:200,body:publicDestination(record)};
      }
      if(method==='POST'&&path==='/network/withdrawals') {
        const record=service.requestWithdrawal({userId,...body});
        return {status:201,body:publicWithdrawal(record)};
      }
      if(method==='GET'&&path==='/network/withdrawals') {
        return {
          status:200,
          body:{
            withdrawals:service.listWithdrawals(userId).map(publicWithdrawal),
            ...DEMO_FLAGS
          }
        };
      }
      const cancelMatch=path.match(/^\/network\/withdrawals\/([^/]+)\/cancel$/);
      if(method==='POST'&&cancelMatch) {
        const record=service.cancelWithdrawal({
          userId,
          withdrawalId:cancelMatch[1],
          idempotencyKey:body.idempotencyKey
        });
        return {status:200,body:publicWithdrawal(record)};
      }
      return {status:404,body:{error:'NOT_FOUND',...DEMO_FLAGS}};
    } catch(error) {
      const message=String(error?.message||'INTERNAL_ERROR');
      return {
        status:errorStatus(message),
        body:{error:message,...DEMO_FLAGS}
      };
    }
  };

  return {handle,service,flags:DEMO_FLAGS};
}

module.exports={createDemoWalletApi};
