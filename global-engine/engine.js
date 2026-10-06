import { selectBest } from "./router.js";
import { filterFreshQuotes, normalizeQuotes } from "./quality.js";

export class MarsXGlobalEngine {
  constructor(adapters=[], options={}) { this.adapters=adapters; this.maxQuoteAgeMs=options.maxQuoteAgeMs ?? 15000; }
  register(adapter) { this.adapters.push(adapter); return this; }

  async quotes(order) {
    const eligible=this.adapters.filter(v=>v.supports(order.instrument));
    const settled=await Promise.allSettled(eligible.map(v=>v.getQuote(order)));
    const raw=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);
    return filterFreshQuotes(normalizeQuotes(raw),{maxAgeMs:this.maxQuoteAgeMs});
  }

  async route(order) {
    const quotes=await this.quotes(order);
    const best=selectBest(order,quotes);
    return { best, quotes };
  }

  async paperExecute(order) {
    const {best,quotes}=await this.route(order);
    const venue=this.adapters.find(v=>v.name.toLowerCase()===best.venue);
    if (!venue) throw new Error("winning venue unavailable");
    if (venue.constructor.name !== "PaperVenue") throw new Error("paper execution requires a PaperVenue; live execution is disabled");
    const execution=await venue.placeOrder(order,best);
    return { order, best, quotes, execution };
  }
}
