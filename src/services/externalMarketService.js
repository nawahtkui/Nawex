import {
  createOpportunity,
  addVerification
} from "./agentOpportunityEngine.js";

function normalizeResults(response, providerName) {
  // Internal providers already return opportunities
  if (Array.isArray(response)) {
    return response;
  }

  // External search providers
  if (response && Array.isArray(response.results)) {
    return response.results.map((item) => ({
      sourceType: "external_market",
      sourceUrl: item.url || null,

      title:
        item.title ||
        `Opportunity from ${providerName}`,

      description:
        item.content ||
        item.raw_content ||
        null,

      category: "discovered",

      counterpartyName: null,
      counterpartyType: "unknown",

      contactName: null,
      contactEmail: null,

      contactPhone: null,

      externalReference:
        item.url ||
        `${providerName}-${Date.now()}`,

      direction: "BUY",

      transactionModel: "COMMISSION",

      estimatedValue: null,

      currency: "USD",

      confidence: 0.5,

      evidence: {
        claim:
          "Opportunity discovered through external provider",
        result: "verified",
        confidence: 0.5
      }
    }));
  }

  throw new Error(
    "Unsupported provider response format"
  );
}


export async function discoverExternalOpportunities({
  agentId,
  provider,
  query
}) {
  if (!provider) {
    throw new Error("Provider is required");
  }

  if (!agentId) {
    throw new Error("Agent id is required");
  }

  const response =
    await provider.search(query);

  const results =
    normalizeResults(
      response,
      provider.name
    );

  const opportunities = [];

  for (const result of results) {

    const opportunity =
      createOpportunity({
        agentId,

        sourceType:
          result.sourceType ||
          "external_market",

        sourceUrl:
          result.sourceUrl ||
          null,

        title:
          result.title,

        description:
          result.description ||
          null,

        category:
          result.category ||
          null,

        counterpartyName:
          result.counterpartyName ||
          null,

        counterpartyType:
          result.counterpartyType ||
          null,

        contactName:
          result.contactName ||
          null,

        contactEmail:
          result.contactEmail ||
          null,

        contactPhone:
          result.contactPhone ||
          null,

        externalReference:
          result.externalReference ||
          null,

        direction:
          result.direction ||
          "BUY",

        transactionModel:
          result.transactionModel ||
          null,

        estimatedValue:
          result.estimatedValue ??
          null,

        currency:
          result.currency ||
          "USD",

        confidence:
          result.confidence ||
          0
      });


    const evidence =
      result.evidence || {};


    const verification =
      addVerification({

        opportunityId:
          opportunity.id,

        agentId,

        verificationType:
          "provider_result",

        subject:
          result.title,

        sourceType:
          result.sourceType ||
          "external_market",

        sourceUrl:
          result.sourceUrl ||
          null,

        claim:
          evidence.claim ||
          "Opportunity returned by provider",

        evidence:
          JSON.stringify(result),

        result:
          evidence.result ||
          "verified",

        confidence:
          evidence.confidence ??
          result.confidence ??
          0
      });


    opportunities.push({
      opportunity,
      verification
    });
  }

  return opportunities;
}
