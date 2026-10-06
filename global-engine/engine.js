import { selectBest } from "./router.js";

export class MarsXGlobalEngine {
  constructor(adapters=[]) { this.adapters=adapters; }
  register(adapter) { this.adapters.push(adapter); return this; }

  async quotes(order) {
    const eligible=this.adapters.filter(v=>v.supports(order.instrument));
    const settled=await Promise.allSettled(eligible.map(v=>v.getQuote(order)));
    return settled.filter(x=>x.status==="fulfilled").map(x=>x.value);
  }

  async route(order) {
    const quotes=await this.quotes(order);
    const best=selectBest(order,quotes);
    return { best, quotes };
  }

  async paperExecute(order) {
    const {best,quotes}=await this.route(order);
    const venue=this.adapters.find(v=>v.name===best.venue);
    if (!venue) throw new Error("winning venue unavailable");
    const execution=await venue.placeOrder(order,best);
    return { order, best, quotes, execution };
  }
}
