/** Network settlement accounting — no live payment or provider calls.
 * Invariant: a partner receipt can be credited only once; per-user shares
 * must sum to exactly 80% of that receipt's settled fiat minor units.
 */
export function splitReceipt(totalMinor, allocations) {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('invalid total');
  if (!Array.isArray(allocations) || allocations.length === 0) throw new Error('missing allocations');
  const platformMinor = Math.floor(totalMinor / 5);
  const usersMinor = totalMinor - platformMinor;
  let sum = 0;
  const seen = new Set();
  for (const a of allocations) {
    if (!a || typeof a.userId !== 'string' || !a.userId.trim() || seen.has(a.userId)) throw new Error('invalid/duplicate user');
    if (!Number.isSafeInteger(a.amountMinor) || a.amountMinor < 0) throw new Error('invalid amount');
    seen.add(a.userId);
    sum += a.amountMinor;
    if (!Number.isSafeInteger(sum)) throw new Error('overflow');
  }
  if (sum !== usersMinor) throw new Error('allocations must equal 80% user share');
  return {platformMinor,usersMinor,allocations};
}
export async function recordSettledReceipt(pool, receipt, allocations) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('database required');
  if (!receipt || typeof receipt.receiptId !== 'string' || !receipt.receiptId ||
      typeof receipt.partnerId !== 'string' || !receipt.partnerId ||
      typeof receipt.partnerReference !== 'string' || !receipt.partnerReference ||
      !['EUR','USD'].includes(receipt.currency)) throw new Error('invalid receipt');
  const split=splitReceipt(receipt.settledMinor,allocations);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    // Unique receipt reference makes retries idempotent across workers.
    const insert=await client.query(
      `INSERT INTO network_revenue_receipts
       (receipt_id,partner_id,partner_reference,currency,settled_minor,platform_minor,users_minor)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (partner_id,partner_reference) DO NOTHING RETURNING receipt_id`,
      [receipt.receiptId,receipt.partnerId,receipt.partnerReference,receipt.currency,
       receipt.settledMinor,split.platformMinor,split.usersMinor]);
    if (insert.rowCount===0) {
      // Reject a duplicate key whose contents differ from the original.
      const old=await client.query(
        'SELECT receipt_id,currency,settled_minor,platform_minor,users_minor FROM network_revenue_receipts WHERE partner_id=$1 AND partner_reference=$2',
        [receipt.partnerId,receipt.partnerReference]);
      const o=old.rows[0];
      if (!o || o.receipt_id!==receipt.receiptId || o.currency!==receipt.currency ||
          Number(o.settled_minor)!==receipt.settledMinor ||
          Number(o.platform_minor)!==split.platformMinor ||
          Number(o.users_minor)!==split.usersMinor) throw new Error('conflicting duplicate receipt');
      const entries=await client.query(
        "SELECT user_id,amount_minor FROM network_ledger_entries WHERE receipt_id=$1 AND entry_type='settled_credit'",
        [receipt.receiptId]);
      const expected=new Map(allocations.filter(a=>a.amountMinor>0).map(a=>[a.userId,a.amountMinor]));
      if(entries.rows.length!==expected.size ||
         entries.rows.some(e=>expected.get(e.user_id)!==Number(e.amount_minor)))
        throw new Error('conflicting duplicate allocations');
      await client.query('COMMIT');
      return {duplicate:true,...split};
    }
    for (const a of allocations) {
      if(a.amountMinor===0) continue;
      await client.query('INSERT INTO network_accounts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[a.userId]);
      await client.query(
        `INSERT INTO network_ledger_entries
         (entry_id,user_id,receipt_id,idempotency_key,currency,amount_minor,entry_type)
         VALUES($1,$2,$3,$4,$5,$6,'settled_credit')`,
        [receipt.receiptId+':'+a.userId,a.userId,receipt.receiptId,
         'receipt:'+receipt.receiptId+':'+a.userId,receipt.currency,a.amountMinor]);
    }
    await client.query('COMMIT');
    return {duplicate:false,...split};
  } catch(e) { await client.query('ROLLBACK');throw e; }
  finally {client.release();}
}
