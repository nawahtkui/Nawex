export class ProviderRouter {
  constructor(registry) {
    this.registry = registry;
  }

  score(provider, request = {}) {
    let score = 0;

    if (provider.status === "active") score += 50;
    if (provider.status === "pending_activation") score += 20;

    if (request.region && provider.regions?.includes(request.region)) {
      score += 15;
    }

    if (
      request.maxPrice != null &&
      provider.pricing?.price != null &&
      provider.pricing.price <= request.maxPrice
    ) {
      score += 15;
    }

    if (request.preferredProviderId === provider.id) {
      score += 100;
    }

    if (provider.sla?.availability) {
      score += Number(provider.sla.availability) * 10;
    }

    return score;
  }

  select(capability, request = {}) {
    const providers = this.registry.findByCapability(capability);

    if (!providers.length) {
      return null;
    }

    return providers
      .map((provider) => ({
        provider,
        score: this.score(provider, request),
      }))
      .sort((a, b) => b.score - a.score)[0];
  }

  explain(capability, request = {}) {
    const providers = this.registry.findByCapability(capability);

    return providers
      .map((provider) => ({
        providerId: provider.id,
        providerName: provider.name,
        status: provider.status,
        score: this.score(provider, request),
        capabilities: provider.capabilities,
        pricing: provider.pricing,
        regions: provider.regions,
        sla: provider.sla,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
