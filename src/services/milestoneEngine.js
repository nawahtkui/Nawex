/*
  Nawex Milestone Engine

  SIMPLE:
    100% on completion

  COMPLEX:
    30% signing
    40% midpoint
    30% completion
*/

function money(value) {
  return Number(Number(value).toFixed(2));
}

const MILESTONE_RULES = {
  SIMPLE: [
    {
      milestone: "COMPLETION",
      percentage: 1.00
    }
  ],

  COMPLEX: [
    {
      milestone: "SIGNING",
      percentage: 0.30
    },
    {
      milestone: "MIDPOINT",
      percentage: 0.40
    },
    {
      milestone: "COMPLETION",
      percentage: 0.30
    }
  ]
};

export function getMilestoneRules(type) {
  const normalizedType =
    String(type || "").toUpperCase();

  const rules =
    MILESTONE_RULES[normalizedType];

  if (!rules) {
    throw new Error(
      `Unsupported milestone type: ${type}`
    );
  }

  return rules.map(rule => ({
    ...rule
  }));
}

export function validateMilestoneRules(type) {
  const rules =
    getMilestoneRules(type);

  const total =
    rules.reduce(
      (sum, rule) =>
        sum + rule.percentage,
      0
    );

  return {
    type: String(type).toUpperCase(),
    totalPercentage: money(total),
    valid: money(total) === 1
  };
}

export function calculateMilestonePayouts({
  earnedAmount,
  type
}) {
  const earned =
    money(earnedAmount);

  if (earned < 0) {
    throw new Error(
      "earnedAmount cannot be negative"
    );
  }

  const rules =
    getMilestoneRules(type);

  const payouts =
    rules.map(rule => ({
      milestone: rule.milestone,
      percentage: rule.percentage,
      amount: money(
        earned * rule.percentage
      ),
      status: "pending"
    }));

  const allocated =
    money(
      payouts.reduce(
        (sum, payout) =>
          sum + payout.amount,
        0
      )
    );

  return {
    earnedAmount: earned,
    type: String(type).toUpperCase(),
    payouts,
    totalAllocated: allocated,
    valid: allocated === earned
  };
}
