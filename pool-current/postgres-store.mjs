import pg from "pg";
const { Pool } = pg;

export async function createPostgresStore(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const pool = new Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  await pool.query(`CREATE TABLE IF NOT EXISTS marsx_state (
    bucket text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(bucket,key)
  )`);
  const getJson=async(bucket,key)=>{const r=await pool.query("SELECT value FROM marsx_state WHERE bucket=$1 AND key=$2",[bucket,key]);return r.rows[0]?.value??null};
  const setJson=async(bucket,key,value)=>{await pool.query(`INSERT INTO marsx_state(bucket,key,value) VALUES($1,$2,$3::jsonb)
    ON CONFLICT(bucket,key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,[bucket,key,JSON.stringify(value)])};
  const all=async(bucket)=>{const r=await pool.query("SELECT value FROM marsx_state WHERE bucket=$1",[bucket]);return r.rows.map(x=>x.value)};
  const getUnits=async(bucket,key)=>Number((await getJson(bucket,key))?.units||0);
  const setUnits=async(bucket,key,units)=>setJson(bucket,key,{units});
  return {
    kind:"postgres",
    async ping(){await pool.query("SELECT 1");return true},
    async get(id){return getJson("workers",id)}, async set(v){await setJson("workers",v.workerId,v)}, async all(){return all("workers")},
    async bindLicenseDevice(licenseId,installId,maxDevices){const c=await pool.connect();try{await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[licenseId]);const cur=(await c.query("SELECT value FROM marsx_state WHERE bucket='license_devices' AND key=$1",[licenseId])).rows[0]?.value?.devices||[];if(!cur.includes(installId)&&cur.length>=maxDevices){await c.query("ROLLBACK");return false}const devices=[...new Set([...cur,installId])];await c.query(`INSERT INTO marsx_state(bucket,key,value) VALUES('license_devices',$1,$2::jsonb) ON CONFLICT(bucket,key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,[licenseId,JSON.stringify({devices})]);await c.query("COMMIT");return true}catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}},
    async getBalance(id){return getUnits("balances",id)}, async getDormantBalance(id){return getUnits("dormant",id)},
    async touchActivity(id,atMs){const w=await getJson("workers",id);if(!w)return{worker:null,restoredUnits:0};const restored=await getUnits("dormant",id);if(restored>0){await setUnits("dormant",id,0);await setUnits("balances",id,(await getUnits("balances",id))+restored)}const at=new Date(atMs).toISOString();if(w.dormantAt)w.reactivatedAt=at;w.dormantAt=null;w.lastActivityAt=at;w.lastActivityMs=atMs;await setJson("workers",id,w);return{worker:w,restoredUnits:restored}},
    async markDormant(id,cutoff,atMs){const w=await getJson("workers",id);const a=Number(w?.lastActivityMs)||Date.parse(w?.lastActivityAt||w?.lastSeen||w?.registeredAt||"");if(!w||w.dormantAt||!Number.isFinite(a)||a>cutoff)return{changed:false,movedUnits:0};const moved=await getUnits("balances",id);if(moved){await setUnits("balances",id,0);await setUnits("dormant",id,(await getUnits("dormant",id))+moved)}w.dormantAt=new Date(atMs).toISOString();await setJson("workers",id,w);return{changed:true,movedUnits:moved}},
    async sweepDormant(cutoff,atMs){let accountsMarked=0,movedUnits=0;for(const w of await all("workers")){const r=await this.markDormant(w.workerId,cutoff,atMs);if(r.changed)accountsMarked++;movedUnits+=r.movedUnits}return{accountsMarked,movedUnits}},
    async dormantSummary(){const ws=await all("workers"), ds=await all("dormant");return{dormantAccounts:ws.filter(w=>w.dormantAt).length,reservedUnits:ds.reduce((s,x)=>s+Number(x.units||0),0)}},
    async credit(id,amount,entry){const n=(await getUnits("balances",id))+amount;await setUnits("balances",id,n);const l=(await getJson("ledger",id))?.entries||[];l.push(entry);await setJson("ledger",id,{entries:l});return n},
    async createPayout(id,payout,key){const idem=await getJson("idempotency",id+":"+key);if(idem){const p=await getJson("payouts",idem.id);return{result:"existing",payout:p,balance:await getUnits("balances",id)}}const b=await getUnits("balances",id);if(b<payout.amountUnits)return{result:"insufficient",balance:b};await setUnits("balances",id,b-payout.amountUnits);await setJson("payouts",payout.id,payout);await setJson("idempotency",id+":"+key,{id:payout.id});return{result:"created",payout,balance:b-payout.amountUnits}},
    async payoutsFor(id){return (await all("payouts")).filter(p=>p.workerId===id).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))},
    async allPayouts(){return (await all("payouts")).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))},
    async updatePayout(id,status,updatedAt,reference=""){const p=await getJson("payouts",id);if(!p)return{result:"missing"};const allowed=p.status==="pending"?["approved","rejected","simulated_paid"]:p.status==="approved"?["rejected","simulated_paid"]:[];if(p.status===status)return{result:"existing",payout:p};if(!allowed.includes(status))return{result:"invalid",payout:p};p.status=status;p.updatedAt=updatedAt;if(reference)p.reference=reference;if(status==="rejected"&&!p.refunded){p.refunded=true;await setUnits("balances",p.workerId,(await getUnits("balances",p.workerId))+p.amountUnits)}await setJson("payouts",id,p);return{result:"updated",payout:p}},
    async close(){await pool.end()}
  };
}
