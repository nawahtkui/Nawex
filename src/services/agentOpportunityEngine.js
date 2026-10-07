import { db } from "../db/database.js";
import { id } from "../utils.js";

const STATUSES = [
  "discovered",
  "verifying",
  "verified",
  "contacted",
  "negotiating",
  "qualified",
  "converted",
  "lost",
  "rejected"
];

const TRANSITIONS = {
  discovered: ["verifying", "rejected"],
  verifying: ["verified", "rejected"],
  verified: ["contacted", "rejected"],
  contacted: ["negotiating", "qualified", "lost"],
  negotiating: ["qualified", "lost"],
  qualified: ["converted", "lost"],
  converted: [],
  lost: [],
  rejected: []
};

function getOpportunity(opportunityId) {
  const row = db.prepare(`
    SELECT *
    FROM agent_opportunities
    WHERE id = ?
  `).get(opportunityId);

  if (!row) {
    throw new Error("Agent opportunity not found");
  }

  return row;
}

function requireAgent(agentId) {
  const agent = db.prepare(`
    SELECT *
    FROM agents
    WHERE id = ?
      AND active = 1
  `).get(agentId);

  if (!agent) {
    throw new Error("Active agent not found");
  }

  return agent;
}

export function createOpportunity({
  agentId,
  sourceType,
  sourceUrl = null,
  title,
  description = null,
  category = null,
  counterpartyName = null,
  counterpartyType = null,
  contactName = null,
  contactEmail = null,
  contactPhone = null,
  externalReference = null,
  direction,
  transactionModel = null,
  estimatedValue = null,
  currency = "USD",
  confidence = 0
}) {
  requireAgent(agentId);

  if (!sourceType) {
    throw new Error("sourceType is required");
  }

  if (!title) {
    throw new Error("title is required");
  }

  if (!["BUY", "SELL", "BROKER", "SERVICE"].includes(direction)) {
    throw new Error("Invalid opportunity direction");
  }

  if (
    transactionModel !== null &&
    ![
      "COMMISSION",
      "BROKER",
      "BUY_AND_RESELL",
      "SERVICE",
      "EXECUTION_FEE"
    ].includes(transactionModel)
  ) {
    throw new Error("Invalid transaction model");
  }

  if (confidence < 0 || confidence > 1) {
    throw new Error("confidence must be between 0 and 1");
  }

  const opportunityId = id("opp");

  db.prepare(`
    INSERT INTO agent_opportunities (
      id,
      agent_id,
      source_type,
      source_url,
      title,
      description,
      category,
      counterparty_name,
      counterparty_type,
      contact_name,
      contact_email,
      contact_phone,
      external_reference,
      direction,
      transaction_model,
      estimated_value,
      currency,
      confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opportunityId,
    agentId,
    sourceType,
    sourceUrl,
    title,
    description,
    category,
    counterpartyName,
    counterpartyType,
    contactName,
    contactEmail,
    contactPhone,
    externalReference,
    direction,
    transactionModel,
    estimatedValue,
    currency,
    confidence
  );

  return getOpportunity(opportunityId);
}

export function addVerification({
  opportunityId,
  agentId,
  verificationType,
  subject,
  sourceType = null,
  sourceUrl = null,
  claim,
  evidence = null,
  result = "pending",
  confidence = 0
}) {
  const opportunity = getOpportunity(opportunityId);

  if (opportunity.agent_id !== agentId) {
    throw new Error("Agent does not own opportunity");
  }

  requireAgent(agentId);

  if (!verificationType) {
    throw new Error("verificationType is required");
  }

  if (!subject) {
    throw new Error("subject is required");
  }

  if (!claim) {
    throw new Error("claim is required");
  }

  if (!["pending", "verified", "failed", "inconclusive"].includes(result)) {
    throw new Error("Invalid verification result");
  }

  if (
    typeof confidence !== "number" ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error("confidence must be between 0 and 1");
  }

  const verificationId = id("ver");

  const verifiedAt =
    result === "verified"
      ? new Date().toISOString()
      : null;

  db.prepare(`
    INSERT INTO agent_verifications (
      id,
      opportunity_id,
      agent_id,
      verification_type,
      subject,
      source_type,
      source_url,
      claim,
      evidence,
      result,
      confidence,
      verified_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    verificationId,
    opportunityId,
    agentId,
    verificationType,
    subject,
    sourceType,
    sourceUrl,
    claim,
    evidence,
    result,
    confidence,
    verifiedAt
  );

  return db.prepare(`
    SELECT *
    FROM agent_verifications
    WHERE id = ?
  `).get(verificationId);
}

export function transitionOpportunity(
  opportunityId,
  nextStatus
) {
  const opportunity = getOpportunity(opportunityId);

  if (!STATUSES.includes(nextStatus)) {
    throw new Error("Invalid opportunity status");
  }

  const allowed =
    TRANSITIONS[opportunity.status] || [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid opportunity transition: ${opportunity.status} -> ${nextStatus}`
    );
  }

  const verifiedAt =
    nextStatus === "verified"
      ? new Date().toISOString()
      : opportunity.verified_at;

  const convertedAt =
    nextStatus === "converted"
      ? new Date().toISOString()
      : opportunity.converted_at;

  db.prepare(`
    UPDATE agent_opportunities
    SET status = ?,
        verified_at = ?,
        converted_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nextStatus,
    verifiedAt,
    convertedAt,
    opportunityId
  );

  return getOpportunity(opportunityId);
}

export function addFollowup({
  opportunityId,
  agentId,
  channel,
  contact = null,
  action,
  message = null,
  scheduledAt = null
}) {
  const opportunity = getOpportunity(opportunityId);

  if (opportunity.agent_id !== agentId) {
    throw new Error("Agent does not own opportunity");
  }

  requireAgent(agentId);

  if (!channel) {
    throw new Error("channel is required");
  }

  if (!action) {
    throw new Error("action is required");
  }

  const followupId = id("follow");

  db.prepare(`
    INSERT INTO agent_followups (
      id,
      opportunity_id,
      agent_id,
      channel,
      contact,
      action,
      message,
      scheduled_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    followupId,
    opportunityId,
    agentId,
    channel,
    contact,
    action,
    message,
    scheduledAt
  );

  return db.prepare(`
    SELECT *
    FROM agent_followups
    WHERE id = ?
  `).get(followupId);
}

export function updateFollowup(
  followupId,
  status,
  response = null
) {
  const followup = db.prepare(`
    SELECT *
    FROM agent_followups
    WHERE id = ?
  `).get(followupId);

  if (!followup) {
    throw new Error("Follow-up not found");
  }

  const allowed = [
    "pending",
    "sent",
    "replied",
    "no_response",
    "failed",
    "cancelled"
  ];

  if (!allowed.includes(status)) {
    throw new Error("Invalid follow-up status");
  }

  const executedAt =
    status === "sent" ||
    status === "replied" ||
    status === "no_response" ||
    status === "failed"
      ? new Date().toISOString()
      : followup.executed_at;

  db.prepare(`
    UPDATE agent_followups
    SET status = ?,
        response = ?,
        executed_at = ?
    WHERE id = ?
  `).run(
    status,
    response,
    executedAt,
    followupId
  );

  return db.prepare(`
    SELECT *
    FROM agent_followups
    WHERE id = ?
  `).get(followupId);
}

export function getOpportunityDetails(opportunityId) {
  const opportunity = getOpportunity(opportunityId);

  const verifications = db.prepare(`
    SELECT *
    FROM agent_verifications
    WHERE opportunity_id = ?
    ORDER BY created_at ASC
  `).all(opportunityId);

  const followups = db.prepare(`
    SELECT *
    FROM agent_followups
    WHERE opportunity_id = ?
    ORDER BY created_at ASC
  `).all(opportunityId);

  return {
    opportunity,
    verifications,
    followups
  };
}
