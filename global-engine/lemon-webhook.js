import crypto from "node:crypto";

const HEX64=/^[0-9a-f]{64}$/i;

export function verifyLemonWebhookSignature({body,header,secret,nowSec=Math.floor(Date.now()/1000),toleranceSec=300}={}){
  if(typeof body!=="string") throw new Error("invalid Lemon webhook body");
  if(typeof header!=="string"||header.length<1||header.length>512) throw new Error("invalid Lemon signature header");
  if(typeof secret!=="string"||secret.length<16||secret.length>512) throw new Error("invalid Lemon signature secret");
  if(!Number.isInteger(nowSec)||nowSec<0) throw new Error("invalid Lemon signature clock");
  if(!Number.isInteger(toleranceSec)||toleranceSec<0||toleranceSec>3600) throw new Error("invalid Lemon signature tolerance");

  const parts=Object.fromEntries(header.split(",").map(piece=>{
    const index=piece.indexOf("="); if(index<1) return ["", ""];
    return [piece.slice(0,index).trim(),piece.slice(index+1).trim()];
  }).filter(([k])=>k));
  if(!/^\d{1,12}$/.test(parts.t||"")||!HEX64.test(parts.v1||"")) throw new Error("invalid Lemon signature header");
  const timestamp=Number(parts.t);
  if(Math.abs(nowSec-timestamp)>toleranceSec) return Object.freeze({valid:false,reason:"TIMESTAMP_OUT_OF_WINDOW"});
  const expected=crypto.createHmac("sha256",secret).update(String(timestamp)).update(".").update(body).digest("hex");
  const a=Buffer.from(expected,"hex"), b=Buffer.from(parts.v1.toLowerCase(),"hex");
  const valid=a.length===b.length&&crypto.timingSafeEqual(a,b);
  return Object.freeze({valid,reason:valid?null:"SIGNATURE_MISMATCH"});
}

export function parseLemonWebhookEvent(body){
  if(typeof body!=="string"||body.length<2||body.length>256*1024) throw new Error("invalid Lemon webhook body");
  let event; try{event=JSON.parse(body);}catch{throw new Error("invalid Lemon webhook JSON");}
  if(!event||typeof event!=="object"||Array.isArray(event)) throw new Error("invalid Lemon webhook event");
  return event;
}
