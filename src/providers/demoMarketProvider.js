import { ProviderAdapter } from "./providerAdapter.js";

export class DemoMarketProvider extends ProviderAdapter {
  constructor() {
    super("demo-market");
  }

  async search(query = {}) {
    const text =
      typeof query === "string"
        ? query
        : query.query || query.title || "";

    return [
      {
        provider: this.name,
        externalReference: `demo-${crypto.randomUUID()}`,
        sourceType: "external_market",
        sourceUrl: "https://example.com/demo-market",
        title: `Market opportunity for ${text || "digital service"}`,
        description:
          "Demo external-market opportunity returned through ProviderAdapter.",
        category: query.category || "digital-service",
        counterpartyName: "Demo Buyer",
        counterpartyType: "buyer",
        contactName: "Demo Contact",
        contactEmail: "demo@example.com",
        direction: "BUY",
        transactionModel: "COMMISSION",
        estimatedValue: Number(query.budget || 100),
        currency: query.currency || "USD",
        confidence: 0.80,
        evidence: {
          claim: "Opportunity returned by external market provider",
          result: "verified",
          confidence: 0.80
        }
      }
    ];
  }

  async createOrder(order) {
    return {
      provider: this.name,
      externalReference: `order-${crypto.randomUUID()}`,
      status: "created",
      order
    };
  }

  async getOrderStatus(orderId) {
    return {
      provider: this.name,
      orderId,
      status: "created"
    };
  }
}
