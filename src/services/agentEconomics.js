import {
  calculateValuePool
} from "./valuePool.js";


import {
  calculateAttribution
} from "./attributionEngine.js";


/*
  Complete Agent Economics Flow

  Transaction
      ↓
  Value Pool
      ↓
  Attribution
      ↓
  Agent Rewards
*/


export function calculateAgentEconomics({
  customerCharge,
  supplierCost,
  agents,
  agentPoolPercentage = 0.70
}) {


  const valuePool =
    calculateValuePool({

      customerCharge,

      supplierCost,

      agentPoolPercentage

    });



  const attribution =
    calculateAttribution({

      agentPool:
        valuePool.agentPool,

      agents

    });



  return {

    valuePool,

    attribution

  };

}
