/*
  Nawex Final Payout Engine

  Pipeline:

  Attribution Earned Amount
        ↓
  Performance Adjustment
        ↓
  Final Agent Payout
        +
  performanceRetention
        ↓
  Milestone Distribution

  Important:
  performanceRetention is NOT new revenue.
  It is the unpaid portion of the agent's
  earned allocation retained by Nawex.
*/

import {
  applyPerformanceAdjustment
} from "./performanceEngine.js";

import {
  calculateMilestonePayouts
} from "./milestoneEngine.js";

function money(value) {
  return Number(Number(value).toFixed(2));
}

export function calculateFinalAgentPayout({
  transactionId,
  agentId,
  role,
  earnedAmount,
  performanceScore,
  milestoneType = "SIMPLE"
}) {
  if (!transactionId) {
    throw new Error(
      "transactionId is required"
    );
  }

  if (!agentId) {
    throw new Error(
      "agentId is required"
    );
  }

  if (!role) {
    throw new Error(
      "role is required"
    );
  }

  const earned =
    money(earnedAmount);

  if (earned < 0) {
    throw new Error(
      "earnedAmount cannot be negative"
    );
  }

  const performance =
    applyPerformanceAdjustment({
      earnedAmount: earned,
      performanceScore
    });

  const finalPayout =
    money(
      performance.adjustedAmount
    );

  const performanceRetention =
    money(
      earned - finalPayout
    );

  const milestones =
    calculateMilestonePayouts({
      earnedAmount: finalPayout,
      type: milestoneType
    });

  const totalAgentAllocation =
    money(
      milestones.totalAllocated
      + performanceRetention
    );

  return {
    transactionId,
    agentId,
    role,

    earnedAmount: earned,

    performanceScore:
      performance.performanceScore,

    performanceMultiplier:
      performance.performanceMultiplier,

    performanceTier:
      performance.tier,

    finalPayout,

    performanceRetention,

    milestoneType:
      milestones.type,

    milestones:
      milestones.payouts,

    totalAgentAllocation,

    valid:
      totalAgentAllocation === earned,

    blocked:
      performance.blocked
  };
}
