import { certifyLemonSandboxReadOnly } from "./lemon-sandbox-certification.js";

try{
  const report=await certifyLemonSandboxReadOnly();
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.certified?0:Object.values(report.phases).some(x=>x.status==="FAIL")?1:2;
}catch{
  console.log(JSON.stringify({
    provider:"lemon.markets",
    scope:"READ_ONLY_SANDBOX_CONNECTIVITY",
    certified:false,
    liveExecution:false,
    withdrawals:false,
    custody:false,
    reason:"INVALID_SANDBOX_CONFIGURATION"
  },null,2));
  process.exitCode=1;
}
