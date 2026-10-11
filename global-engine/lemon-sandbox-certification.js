import { LemonBrokerAdapter } from "./adapters/lemon-markets.js";

const PHASES=["authentication","agreements","instruments","product_contracts","account_snapshot","kyc_snapshot","sca_snapshot"];
const mark=(report,phase,status,reason)=>{report.phases[phase]={status,...(reason?{reason}:{})};};
const providerReason=(error)=>{
  const match=/^lemon\.markets HTTP (\d{3})$/.exec(String(error?.message||""));
  return match?`PROVIDER_HTTP_${match[1]}`:"SANDBOX_READ_VALIDATION_FAILED";
};
const nonEmptyObject=(value)=>value&&typeof value==="object"&&!Array.isArray(value);
const listShape=(value)=>Array.isArray(value)||Array.isArray(value?.results)||Array.isArray(value?.data);

export async function certifyLemonSandboxReadOnly({
  adapter=new LemonBrokerAdapter(),
  accountId=process.env.MARSX_LEMON_SANDBOX_ACCOUNT_ID,
  principal="marsx-sandbox-certification"
}={}){
  const report={
    provider:"lemon.markets",
    scope:"READ_ONLY_SANDBOX_CONNECTIVITY",
    certified:false,
    liveExecution:false,
    withdrawals:false,
    custody:false,
    writesPerformed:false,
    phases:Object.fromEntries(PHASES.map(name=>[name,{status:"NOT_RUN"}]))
  };
  if(!adapter.configured()){
    mark(report,"authentication","BLOCKED","CREDENTIALS_NOT_CONFIGURED");
    return report;
  }
  const ctx={principal,justification:"sandbox.certification"};
  let phase="authentication";
  try{
    // First request proves the credential can reach a documented read endpoint.
    const agreements=await adapter.getAgreements(ctx);
    mark(report,"authentication","PASS");

    phase="agreements";
    if(!listShape(agreements)&&!nonEmptyObject(agreements)) throw new Error("Invalid agreements response");
    mark(report,phase,"PASS");

    phase="instruments";
    const instruments=await adapter.listInstruments({limit:1},ctx);
    if(!listShape(instruments)) throw new Error("Invalid instruments response");
    mark(report,phase,"PASS");

    phase="product_contracts";
    const contracts=await adapter.listProductContracts({type:"brokerage",limit:1},ctx);
    if(!listShape(contracts)) throw new Error("Invalid product contracts response");
    mark(report,phase,"PASS");

    phase="account_snapshot";
    if(!accountId){
      mark(report,phase,"BLOCKED","SANDBOX_ACCOUNT_ID_REQUIRED");
      return report;
    }
    if(typeof accountId!=="string"||accountId.length<1||accountId.length>128) throw new Error("Invalid Sandbox account id");
    const account=await adapter.getAccount(accountId,ctx);
    if(!nonEmptyObject(account)) throw new Error("Invalid account response");
    const returnedId=account.id??account.data?.id;
    if(returnedId!==undefined&&String(returnedId)!==accountId) throw new Error("Sandbox account mismatch");
    mark(report,phase,"PASS");

    phase="kyc_snapshot";
    const checks=await adapter.getOnboardingChecks(accountId,ctx);
    if(!listShape(checks)&&!nonEmptyObject(checks)) throw new Error("Invalid onboarding checks response");
    mark(report,phase,"PASS");

    phase="sca_snapshot";
    const authenticators=await adapter.listAuthenticators(accountId,{limit:25},ctx);
    if(!listShape(authenticators)) throw new Error("Invalid authenticators response");
    mark(report,phase,"PASS");

    report.certified=PHASES.every(name=>report.phases[name].status==="PASS");
    return report;
  }catch(error){
    mark(report,phase,"FAIL",providerReason(error));
    return report;
  }
}
