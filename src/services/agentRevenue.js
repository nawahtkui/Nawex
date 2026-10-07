import { db } from "../db/database.js";
import { id } from "../utils.js";

const DEFAULT_AGENT_RATE = 0.03;

export function createAgent({
  name,
  type = "ai",
  specialization = null,
  capabilities = [],
  tier = "STARTER",
  shareRate = DEFAULT_AGENT_RATE
}) {
  if (!name) {
    throw new Error("Agent name is required");
  }

  if (
    typeof shareRate !== "number" ||
    shareRate < 0 ||
    shareRate > 1
  ) {
    throw new Error("shareRate must be between 0 and 1");
  }

  const agentId = id("agent");

  db.prepare(`
    INSERT INTO agents
    (
      id,
      name,
      type,
      specialization,
      capabilities,
      tier,
      share_rate,
      active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    agentId,
    name,
    type,
    specialization,
    JSON.stringify(capabilities),
    tier,
    shareRate
  );

  return db.prepare(`
    SELECT * FROM agents WHERE id = ?
  `).get(agentId);
}


export function attributeAgent({
  transactionId,
  agentId,
  role,
  shareRate
}) {
  if (!transactionId) {
    throw new Error("transactionId is required");
  }

  if (!agentId) {
    throw new Error("agentId is required");
  }

  if (!role) {
    throw new Error("role is required");
  }

  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  const agent = db.prepare(`
    SELECT *
    FROM agents
    WHERE id = ?
      AND active = 1
  `).get(agentId);

  if (!agent) {
    throw new Error("Agent not found or inactive");
  }

  const rate =
    shareRate == null
      ? agent.share_rate
      : Number(shareRate);

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1
  ) {
    throw new Error("shareRate must be between 0 and 1");
  }

  const existing = db.prepare(`
    SELECT *
    FROM agent_attributions
    WHERE transaction_id = ?
      AND agent_id = ?
      AND role = ?
  `).get(
    transactionId,
    agentId,
    role
  );

  if (existing) {
    throw new Error("Duplicate agent attribution");
  }

  const current = db.prepare(`
    SELECT
      COALESCE(SUM(share_amount), 0) AS total
    FROM agent_attributions
    WHERE transaction_id = ?
      AND status != 'reversed'
  `).get(transactionId);

  const currentShares = Number(current?.total || 0);

  const nawexRevenue = Number(transaction.nawex_revenue || 0);

  const shareAmount = Number(
    (nawexRevenue * rate).toFixed(8)
  );

  if (
    currentShares + shareAmount >
    nawexRevenue + 0.00000001
  ) {
    throw new Error(
      "Agent shares exceed Nawex gross revenue"
    );
  }

  const attributionId = id("aat");

  db.prepare(`
    INSERT INTO agent_attributions
    (
      id,
      transaction_id,
      agent_id,
      role,
      share_rate,
      share_amount,
      currency,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    attributionId,
    transactionId,
    agentId,
    role,
    rate,
    shareAmount,
    transaction.currency
  );

  return db.prepare(`
    SELECT
      aa.*,
      a.name AS agent_name,
      a.tier AS agent_tier
    FROM agent_attributions aa
    JOIN agents a
      ON a.id = aa.agent_id
    WHERE aa.id = ?
  `).get(attributionId);
}


export function getTransactionAgentEconomics(transactionId) {
  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  const rows = db.prepare(`
    SELECT
      aa.*,
      a.name AS agent_name,
      a.type AS agent_type,
      a.tier AS agent_tier
    FROM agent_attributions aa
    JOIN agents a
      ON a.id = aa.agent_id
    WHERE aa.transaction_id = ?
    ORDER BY aa.created_at ASC
  `).all(transactionId);

  const agentShares = rows
    .filter(row => row.status !== "reversed")
    .reduce(
      (sum, row) => sum + Number(row.share_amount || 0),
      0
    );

  return {
    transaction_id: transactionId,
    nawex_gross_revenue: Number(transaction.nawex_revenue || 0),
    agent_shares: Number(agentShares.toFixed(8)),
    nawex_net_revenue: Number(
      (
        Number(transaction.nawex_revenue || 0) -
        agentShares
      ).toFixed(8)
    ),
    agents: rows
  };
}


export function reverseAgentAttribution(attributionId) {
  const attribution = db.prepare(`
    SELECT *
    FROM agent_attributions
    WHERE id = ?
  `).get(attributionId);

  if (!attribution) {
    throw new Error("Agent attribution not found");
  }

  if (attribution.status === "reversed") {
    throw new Error("Agent attribution already reversed");
  }

  db.prepare(`
    UPDATE agent_attributions
    SET
      status = 'reversed',
      reversed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(attributionId);

  return db.prepare(`
    SELECT *
    FROM agent_attributions
    WHERE id = ?
  `).get(attributionId);
}
