import { db } from "../db/database.js";
import { id } from "../utils.js";

import {
  createOpportunity,
  addVerification,
  transitionOpportunity,
  addFollowup,
  updateFollowup,
  getOpportunityDetails
} from "../services/agentOpportunityEngine.js";

export function runAgentOpportunityTest() {
  const agentId = id("agent");

  db.prepare(`
    INSERT INTO agents (
      id,
      name,
      type,
      specialization,
      capabilities
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    agentId,
    "Medical Procurement Agent",
    "ai",
    "medical_equipment",
    JSON.stringify([
      "market_discovery",
      "supplier_verification",
      "buyer_verification",
      "negotiation",
      "follow_up"
    ])
  );

  const opportunity = createOpportunity({
    agentId,
    sourceType: "simulated_external_source",
    sourceUrl: "https://example.invalid/medical-request",
    title: "Hospital requires ICU ventilators",
    description: "Procurement request for ICU ventilators",
    category: "medical_equipment",
    counterpartyName: "Example Hospital",
    counterpartyType: "hospital",
    contactName: "Procurement Department",
    direction: "BUY",
    transactionModel: "COMMISSION",
    estimatedValue: 50000,
    currency: "USD",
    confidence: 0.35
  });

  const discovered = opportunity.status === "discovered";

  transitionOpportunity(
    opportunity.id,
    "verifying"
  );

  const companyVerification = addVerification({
    opportunityId: opportunity.id,
    agentId,
    verificationType: "counterparty_identity",
    subject: "Example Hospital",
    sourceType: "simulated_registry",
    claim: "Hospital identity and procurement department verified",
    evidence: "SIMULATED_EVIDENCE",
    result: "verified",
    confidence: 0.90
  });

  const requestVerification = addVerification({
    opportunityId: opportunity.id,
    agentId,
    verificationType: "commercial_request",
    subject: opportunity.id,
    sourceType: "simulated_procurement_source",
    claim: "Procurement request appears commercially actionable",
    evidence: "SIMULATED_REQUEST_EVIDENCE",
    result: "verified",
    confidence: 0.85
  });

  transitionOpportunity(
    opportunity.id,
    "verified"
  );

  const followup = addFollowup({
    opportunityId: opportunity.id,
    agentId,
    channel: "email",
    contact: "Procurement Department",
    action: "initial_contact",
    message: "Requesting specifications, quantity and delivery terms."
  });

  updateFollowup(
    followup.id,
    "sent"
  );

  transitionOpportunity(
    opportunity.id,
    "contacted"
  );

  updateFollowup(
    followup.id,
    "replied",
    "Buyer provided specifications and requested supplier quotations."
  );

  transitionOpportunity(
    opportunity.id,
    "negotiating"
  );

  transitionOpportunity(
    opportunity.id,
    "qualified"
  );

  const details = getOpportunityDetails(
    opportunity.id
  );

  return {
    agentId,
    opportunityId: opportunity.id,

    checks: {
      discovered,
      companyVerified:
        companyVerification.result === "verified",
      requestVerified:
        requestVerification.result === "verified",
      followupReplied:
        details.followups.some(
          x => x.status === "replied"
        ),
      qualified:
        details.opportunity.status === "qualified"
    },

    opportunity: details.opportunity,
    verifications: details.verifications,
    followups: details.followups
  };
}
