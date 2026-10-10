export function normalizeSearchResults({
  provider,
  query,
  results = []
}) {
  return results.map((item) => ({
    provider,
    sourceType: "external_market",
    sourceUrl: item.url || null,

    title:
      item.title ||
      `Opportunity from ${provider}`,

    description:
      item.content ||
      item.raw_content ||
      null,

    category: "discovered",

    counterpartyName: null,
    counterpartyType: "unknown",

    contactName: null,
    contactEmail: null,

    externalReference:
      item.url || `${provider}-${Date.now()}`,

    direction: "BUY",

    transactionModel: "COMMISSION",

    estimatedValue: null,

    currency: "USD",

    confidence: 0.5,

    evidence: {
      claim:
        "Opportunity discovered through external provider search",
      result: "verified",
      confidence: 0.5,
      raw: item
    }
  }));
}
