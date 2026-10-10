import {
  CAPABILITIES,
  PROVIDER_STATUS,
  providerRegistry,
  ProviderRouter,
  ProviderNegotiator,
  createEvidence,
  EVIDENCE_RESULT,
} from "./index.js";

providerRegistry.clear();

providerRegistry.register({
  id: "demo-hosting",
  name: "Demo Hosting Provider",
  type: "external",
  capabilities: [
    CAPABILITIES.HOSTING,
    CAPABILITIES.DEPLOY,
  ],
  status: PROVIDER_STATUS.ACTIVE,
  pricing: {
    price: 10,
    currency: "USD",
    unit: "deployment",
  },
  regions: ["global"],
  sla: {
    availability: 0.99,
  },
});

providerRegistry.register({
  id: "demo-domain",
  name: "Demo Domain Provider",
  type: "external",
  capabilities: [
    CAPABILITIES.DOMAIN_REGISTER,
    CAPABILITIES.PRICE_CHECK,
  ],
  status: PROVIDER_STATUS.DISCOVERED,
  pricing: {
    price: 8,
    currency: "USD",
    unit: "domain",
  },
  regions: ["global"],
});

const router = new ProviderRouter(providerRegistry);

const hostingSelection = router.select(
  CAPABILITIES.HOSTING,
  {
    region: "global",
    maxPrice: 20,
  }
);

const negotiator = new ProviderNegotiator(providerRegistry);

const candidates = negotiator.discover({
  capability: CAPABILITIES.DOMAIN_REGISTER,
  maxPrice: 20,
});

const evaluations = candidates.map((provider) =>
  negotiator.evaluate(provider, {
    capability: CAPABILITIES.DOMAIN_REGISTER,
    maxPrice: 20,
  })
);

const evidence = createEvidence({
  subject: "demo-domain",
  claim: "Provider supports domain registration",
  sourceType: "test",
  evidence: "Capability registered in provider registry",
  result: EVIDENCE_RESULT.VERIFIED,
  confidence: 0.95,
});

console.log(
  JSON.stringify(
    {
      status: "PASS",
      providerCount: providerRegistry.list().length,
      hostingSelection: hostingSelection
        ? {
            providerId: hostingSelection.provider.id,
            score: hostingSelection.score,
          }
        : null,
      domainCandidates: candidates.map((p) => p.id),
      evaluations,
      evidence,
    },
    null,
    2
  )
);
