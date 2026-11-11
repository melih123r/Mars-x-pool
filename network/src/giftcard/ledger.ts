/** Prototype withdrawal state machine. Persistence, transactions and provider API are required for production. */
import type { Quote } from './quote';
export type Status = 'reserved' | 'submitted' | 'settled' | 'failed' | 'manual_review';
export type Withdrawal = { id: string; quote: Quote; status: Status };
export class RedemptionLedger {
  private availableMinor: number;
  private withdrawals = new Map<string, Withdrawal>();
  constructor(initialSettledBalanceMinor: number) {
    if (!Number.isSafeInteger(initialSettledBalanceMinor) || initialSettledBalanceMinor < 0) throw new Error('invalid settled balance');
    this.availableMinor = initialSettledBalanceMinor;
  }
  available(): number { return this.availableMinor; }
  get(id: string): Withdrawal | undefined { const x=this.withdrawals.get(id); return x && {...x,quote:{...x.quote}}; }
  reserve(id: string, quote: Quote): Withdrawal {
    if (!id || !Number.isSafeInteger(quote.totalDebitMinor) || quote.totalDebitMinor < 1) throw new Error('invalid withdrawal');
    const previous = this.withdrawals.get(id);
    if (previous) {
      if (JSON.stringify(previous.quote)!==JSON.stringify(quote)) throw new Error('idempotency conflict');
      return this.get(id)!;
    }
    if (quote.totalDebitMinor > this.availableMinor) throw new Error('insufficient settled funds');
    this.availableMinor -= quote.totalDebitMinor;
    const entry: Withdrawal={id,quote:{...quote},status:'reserved'};
    this.withdrawals.set(id,entry); return this.get(id)!;
  }
  transition(id: string, status: Status): Withdrawal {
    const entry=this.withdrawals.get(id);
    if (!entry) throw new Error('withdrawal missing');
    if (entry.status===status) return this.get(id)!;
    const allowed: Record<Status,Status[]> = {
      reserved:['submitted','failed','manual_review'],
      submitted:['settled','failed','manual_review'],
      settled:[], failed:[], manual_review:['settled','failed']
    };
    if (!allowed[entry.status].includes(status)) throw new Error('invalid transition');
    if (status==='failed') this.availableMinor+=entry.quote.totalDebitMinor;
    entry.status=status; return this.get(id)!;
  }
}
