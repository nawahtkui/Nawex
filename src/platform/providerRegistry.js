import { isCapability } from "./capabilities.js";
import { createProviderDefinition } from "./providerContracts.js";

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(definition) {
    const provider = createProviderDefinition(definition);

    for (const capability of provider.capabilities) {
      if (!isCapability(capability)) {
        throw new Error(
          `Unsupported capability '${capability}' for provider '${provider.id}'`
        );
      }
    }

    this.providers.set(provider.id, provider);
    return provider;
  }

  unregister(providerId) {
    return this.providers.delete(providerId);
  }

  get(providerId) {
    return this.providers.get(providerId) || null;
  }

  list() {
    return [...this.providers.values()];
  }

  findByCapability(capability, { activeOnly = false } = {}) {
    if (!isCapability(capability)) {
      throw new Error(`Unsupported capability '${capability}'`);
    }

    return this.list().filter((provider) => {
      const supports = provider.capabilities.includes(capability);

      if (!activeOnly) {
        return supports;
      }

      return supports && provider.status === "active";
    });
  }

  update(providerId, patch) {
    const current = this.get(providerId);

    if (!current) {
      throw new Error(`Provider '${providerId}' not found`);
    }

    const updated = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };

    this.providers.set(providerId, updated);
    return updated;
  }

  clear() {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();
