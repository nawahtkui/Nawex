export const PROVIDER_STATUS = Object.freeze({
  DISCOVERED: "discovered",
  EVALUATING: "evaluating",
  NEGOTIATING: "negotiating",
  PENDING_ACTIVATION: "pending_activation",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
  REJECTED: "rejected",
});

export const PROVIDER_TYPES = Object.freeze({
  INTERNAL: "internal",
  EXTERNAL: "external",
  MARKETPLACE: "marketplace",
  API: "api",
  HUMAN: "human",
});

export function createProviderDefinition({
  id,
  name,
  type = PROVIDER_TYPES.EXTERNAL,
  capabilities = [],
  status = PROVIDER_STATUS.DISCOVERED,
  pricing = {},
  regions = [],
  limits = {},
  sla = {},
  metadata = {},
  adapter = null,
}) {
  if (!id) throw new Error("Provider id is required");
  if (!name) throw new Error("Provider name is required");

  return {
    id,
    name,
    type,
    capabilities: [...new Set(capabilities)],
    status,
    pricing,
    regions,
    limits,
    sla,
    metadata,
    adapter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
