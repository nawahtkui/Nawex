import { providerRegistry, CAPABILITIES } from "./index.js";
import { DemoMarketProvider } from "../providers/demoMarketProvider.js";
import { discoverExternalOpportunities } from "../services/externalMarketService.js";

const agent = providerRegistry.get("demo-agent");

if (!agent) {
  console.log(
    "NOTE: provider registry does not contain an agent; using database agent."
  );
}

const provider = new DemoMarketProvider();

const result = await discoverExternalOpportunities({
  agentId: process.env.TEST_AGENT_ID,
  provider,
  query: {
    query: "website development",
    category: "web-development",
    budget: 500,
    currency: "USD"
  }
});

console.log(
  JSON.stringify(
    {
      status: "PASS",
      capability: CAPABILITIES.SEARCH,
      provider: provider.name,
      result
    },
    null,
    2
  )
);
