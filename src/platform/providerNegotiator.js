import { PROVIDER_STATUS } from "./providerContracts.js";

export class ProviderNegotiator {
  constructor(registry) {
    this.registry = registry;
  }

  discover(requirements = {}) {
    const {
      capability,
      region,
      maxPrice,
    } = requirements;

    if (!capability) {
      throw new Error("Negotiation capability is required");
    }

    let providers = this.registry.findByCapability(capability);

    if (region) {
      providers = providers.filter(
        (provider) =>
          !provider.regions?.length ||
          provider.regions.includes(region)
      );
    }

    if (maxPrice != null) {
      providers = providers.filter(
        (provider) =>
          provider.pricing?.price == null ||
          provider.pricing.price <= maxPrice
      );
    }

    return providers;
  }

  evaluate(provider, requirements = {}) {
    const reasons = [];
    let score = 0;

    if (provider.status === PROVIDER_STATUS.ACTIVE) {
      score += 40;
      reasons.push("provider is active");
    }

    if (provider.status === PROVIDER_STATUS.DISCOVERED) {
      score += 10;
      reasons.push("provider is discoverable");
    }

    if (
      requirements.region &&
      provider.regions?.includes(requirements.region)
    ) {
      score += 20;
      reasons.push("region supported");
    }

    if (
      requirements.maxPrice != null &&
      provider.pricing?.price != null &&
      provider.pricing.price <= requirements.maxPrice
    ) {
      score += 20;
      reasons.push("price within budget");
    }

    if (provider.sla?.availability) {
      score += Number(provider.sla.availability) * 10;
      reasons.push("SLA availability supplied");
    }

    return {
      providerId: provider.id,
      score,
      reasons,
      status: provider.status,
    };
  }

  createNegotiationRequest({
    providerId,
    capability,
    requirements = {},
  }) {
    return {
      id: crypto.randomUUID(),
      providerId,
      capability,
      requirements,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
