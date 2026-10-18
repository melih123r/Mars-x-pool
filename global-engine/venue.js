export class VenueAdapter {
  constructor(name, assetClasses=[]) { this.name=name; this.assetClasses=assetClasses; this.mode="read-only"; }
  supports(instrument) { return this.assetClasses.includes(instrument.assetClass); }
  async getQuote() { throw new Error("getQuote not implemented"); }
  async placeOrder() { throw new Error("placeOrder not implemented"); }
}
