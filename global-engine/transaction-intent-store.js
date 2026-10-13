// Transaction intent registry. This module never calls a payment provider.
// Requires a PostgreSQL connection pool; uniqueness is enforced by the database.
export async function initializeTransactionIntentStore(pool) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("PostgreSQL pool required");
  await pool.query(`CREATE TABLE IF NOT EXISTS marsx_transaction_intents (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    status text NOT NULL DEFAULT 'reserved',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id,idempotency_key),
    CHECK(status IN ('reserved','cancelled','review_required'))
  )`);
  return {
    async reserve({userId,idempotencyKey,payloadHash}) {
      if (typeof userId !== "string" || !/^[a-zA-Z0-9:_-]{3,128}$/.test(userId))
        throw new TypeError("authenticated userId required");
      if (typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9:_-]{16,128}$/.test(idempotencyKey))
        throw new TypeError("idempotencyKey must be a random 16-128 character token");
      if (typeof payloadHash !== "string" || !/^[a-f0-9]{64}$/.test(payloadHash))
        throw new TypeError("SHA-256 payloadHash required");
      const result=await pool.query(`INSERT INTO marsx_transaction_intents(user_id,idempotency_key,payload_hash)
        VALUES($1,$2,$3) ON CONFLICT(user_id,idempotency_key) DO NOTHING
        RETURNING id,status,created_at`,[userId,idempotencyKey,payloadHash]);
      if(result.rows.length) return {created:true,...result.rows[0]};
      const existing=await pool.query(`SELECT id,payload_hash,status,created_at FROM marsx_transaction_intents
        WHERE user_id=$1 AND idempotency_key=$2`,[userId,idempotencyKey]);
      if(!existing.rows.length) throw new Error("reservation_conflict_retry_required");
      const row=existing.rows[0];
      if(row.payload_hash!==payloadHash) return {created:false,conflict:true,reason:"idempotency_payload_mismatch"};
      return {created:false,conflict:false,id:row.id,status:row.status,created_at:row.created_at};
    }
  };
}
