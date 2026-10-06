export class VenueAdapter {
  constructor(name, assetClasses=[]) { this.name=name; this.assetClasses=assetClasses; this.mode="read-only"; }
  supports(instrument) { return this.assetClasses.includes(instrument.assetClass); }
  async getQuote() { throw new Error("getQuote not implemented"); }
  async placeOrder() { throw new Error("placeOrder not implemented"); }
}

export class PaperVenue extends VenueAdapter {
  constructor(name, assetClasses, quoteProvider) { super(name,assetClasses); this.mode="paper"; this.quoteProvider=quoteProvider; }
  async getQuote(order) { return this.quoteProvider(order); }
  async placeOrder(order, q) {
    return { executionId:crypto.randomUUID(), orderId:order.id, venue:this.name, status:"FILLED", price:q.price, fee:q.fee, amount:order.amount, paper:true, executedAt:new Date().toISOString() };
  }
}
