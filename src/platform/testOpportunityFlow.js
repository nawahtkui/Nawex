import {
  db
} from "../db/database.js";

import {
  transitionOpportunity
} from "../services/agentOpportunityEngine.js";


const opportunity =
  db.prepare(`
    SELECT *
    FROM agent_opportunities
    ORDER BY created_at DESC
    LIMIT 1
  `).get();


if (!opportunity) {
  throw new Error("No opportunity found");
}


const transitions = [
  "verifying",
  "verified",
  "contacted",
  "qualified"
];


let current = opportunity;


for (const nextStatus of transitions) {

  current =
    transitionOpportunity(
      current.id,
      nextStatus
    );

  console.log(
    `${current.status}`
  );
}


console.log(
  JSON.stringify(
    {
      status: "PASS",
      opportunityId: current.id,
      finalStatus: current.status,
      title: current.title,
      estimatedValue: current.estimated_value,
      currency: current.currency
    },
    null,
    2
  )
);
