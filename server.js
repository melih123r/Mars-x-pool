import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
const workers = new Map();
const port = Number(process.env.PORT || 3000);
const token = process.env.WORKER_TOKEN;
const json = (res,status,data) => {res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data));};
function authorized(req) {
  if (!token) return false;
  const actual = req.headers.authorization || "";
  const expected = "Bearer " + token;
  const a=Buffer.from(actual), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
const server=http.createServer(async(req,res)=>{
  if(req.url==="/health" && req.method==="GET") return json(res,200,{ok:true,service:"marsx-pool-worker-api"});
  if(!authorized(req)) return json(res,401,{error:"unauthorized"});
  if(req.url==="/workers" && req.method==="GET") return json(res,200,{workers:[...workers.values()]});
  if(req.url==="/summary" && req.method==="GET") return json(res,200,{registered:workers.size,online:[...workers.values()].filter(w=>Date.now()-Date.parse(w.lastSeen)<120000).length});
  if(req.method==="POST" && ["/register","/heartbeat"].includes(req.url)){
    let body="";try{for await(const chunk of req){body+=chunk;if(body.length>8192)throw Error("payload too large");}
      const data=JSON.parse(body);if(typeof data.workerId!=="string"||!/^[-_a-zA-Z0-9]{3,64}$/.test(data.workerId))return json(res,400,{error:"invalid workerId"});
      const old=workers.get(data.workerId);
      if(req.url==="/heartbeat"&&!old)return json(res,404,{error:"register first"});
      const w={workerId:data.workerId,label:String(data.label||old?.label||"worker").slice(0,80),platform:String(data.platform||old?.platform||"unknown").slice(0,40),cpuPercent:Number.isFinite(data.cpuPercent)?Math.min(100,Math.max(0,data.cpuPercent)):old?.cpuPercent??null,lastSeen:new Date().toISOString(),sessionId:old?.sessionId||randomUUID()};
      workers.set(data.workerId,w);return json(res,200,{ok:true,worker:w});
    }catch(e){return json(res,400,{error:"invalid payload"});}
  }
  return json(res,404,{error:"not found"});
});
server.listen(port,"0.0.0.0",()=>console.log("MARS-X API listening",port));
