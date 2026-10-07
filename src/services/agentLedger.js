/*
  Nawex Agent Ledger

  Records the financial lifecycle of an agent allocation.

  EARNED
    ↓
  PERFORMANCE_RETENTION
    ↓
  MILESTONE_PENDING
    ↓
  PAYOUT / CARRY_FORWARD
    ↓
  SETTLEMENT

  Ledger invariant:

  earnedAmount =
    paidAmount
    + performanceRetention
    + carryForward
*/

function money(value) {
  return Number(Number(value).toFixed(2));
}

export function createAgentLedgerEntry({
  transactionId,
  agentId,
  role,
  earnedAmount,
  finalPayout,
  performanceRetention = 0,
  carryForward = 0,
  status = "PENDING"
}) {
  if (!transactionId) {
    throw new Error("transactionId is required");
  }

  if (!agentId) {
    throw new Error("agentId is required");
  }

  const earned = money(earnedAmount);
  const payout = money(finalPayout);
  const retention = money(performanceRetention);
  const carry = money(carryForward);

  if (earned < 0) {
    throw new Error(
      "earnedAmount cannot be negative"
    );
  }

  if (payout < 0) {
    throw new Error(
      "finalPayout cannot be negative"
    );
  }

  if (retention < 0) {
    throw new Error(
      "performanceRetention cannot be negative"
    );
  }

  if (carry < 0) {
    throw new Error(
      "carryForward cannot be negative"
    );
  }

  const accounted =
    money(
      payout +
      retention +
      carry
    );

  if (accounted !== earned) {
    throw new Error(
      "Ledger amounts do not balance"
    );
  }

  return {
    transactionId,
    agentId,
    role,

    earnedAmount: earned,

    finalPayout: payout,

    performanceRetention:
      retention,

    carryForward: carry,

    status,

    balanced:
      accounted === earned,

    accountedAmount:
      accounted
  };
}

export function validateAgentLedgerEntry(entry) {
  const earned =
    money(entry.earnedAmount);

  const accounted =
    money(
      entry.finalPayout +
      entry.performanceRetention +
      entry.carryForward
    );

  return {
    earnedAmount: earned,
    accountedAmount: accounted,
    difference:
      money(earned - accounted),
    balanced:
      earned === accounted
  };
}
