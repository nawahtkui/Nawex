import { db } from "../db/database.js";
import { id } from "../utils.js";

function money(value) {
  return Number(Number(value).toFixed(2));
}

export function settleAgentAllocation({
  transactionId,
  agentId,
  role,
  shareRate,
  earnedAmount,
  performanceScore,
  finalPayout,
  performanceRetention = 0,
  carryForward = 0,
  milestones = [],
  currency = "USD"
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

  const share = Number(shareRate);

  if (!Number.isFinite(share) || share < 0 || share > 1) {
    throw new Error(
      "shareRate must be between 0 and 1"
    );
  }

  const earned = money(earnedAmount);
  const payout = money(finalPayout);
  const retention = money(performanceRetention);
  const carry = money(carryForward);

  const accounted = money(
    payout +
    retention +
    carry
  );

  if (accounted !== earned) {
    throw new Error(
      "Settlement amounts do not balance"
    );
  }

  const milestoneTotal = money(
    milestones.reduce(
      (sum, milestone) =>
        sum + Number(milestone.amount),
      0
    )
  );

  if (milestoneTotal !== payout) {
    throw new Error(
      "Milestones must equal final payout"
    );
  }

  const transaction =
    db.prepare(`
      SELECT id
      FROM transactions
      WHERE id = ?
    `).get(transactionId);

  if (!transaction) {
    throw new Error(
      "Transaction not found: " + transactionId
    );
  }

  const agent =
    db.prepare(`
      SELECT id
      FROM agents
      WHERE id = ?
    `).get(agentId);

  if (!agent) {
    throw new Error(
      "Agent not found: " + agentId
    );
  }

  const existing =
    db.prepare(`
      SELECT id
      FROM agent_ledger
      WHERE transaction_id = ?
        AND agent_id = ?
        AND role = ?
      LIMIT 1
    `).get(
      transactionId,
      agentId,
      role
    );

  if (existing) {
    throw new Error(
      "Agent settlement already exists"
    );
  }

  const performanceMultiplier =
    earned === 0
      ? 0
      : money(payout / earned);

  const score =
    Number(performanceScore);

  const tier =
    score >= 100
      ? "TRUSTED"
      : score >= 70
        ? "NORMAL"
        : score >= 40
          ? "LOW"
          : "BLOCKED";

  db.exec("BEGIN");

  try {
    /*
      PERFORMANCE
    */

    db.prepare(`
      INSERT INTO agent_performance
      (
        id,
        agent_id,
        transaction_id,
        score,
        multiplier,
        tier
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id("perf"),
      agentId,
      transactionId,
      score,
      performanceMultiplier,
      tier
    );

    /*
      ATTRIBUTION

      shareRate comes directly from the
      attribution decision.
    */

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
      VALUES (?, ?, ?, ?, ?, ?, ?, 'earned_pending')
    `).run(
      id("attr"),
      transactionId,
      agentId,
      role,
      share,
      earned,
      currency
    );

    /*
      LEDGER
    */

    const ledgerId = id("ledger");

    db.prepare(`
      INSERT INTO agent_ledger
      (
        id,
        transaction_id,
        agent_id,
        role,
        earned_amount,
        final_payout,
        performance_retention,
        carry_forward,
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ledgerId,
      transactionId,
      agentId,
      role,
      earned,
      payout,
      retention,
      carry,
      currency,
      carry > 0
        ? "CARRY_FORWARD"
        : payout > 0
          ? "PAYABLE"
          : "BLOCKED"
    );

    /*
      MILESTONES + AGENT PAYOUTS
    */

    for (const milestone of milestones) {
      const amount =
        money(milestone.amount);

      db.prepare(`
        INSERT INTO agent_milestones
        (
          id,
          transaction_id,
          agent_id,
          milestone,
          percentage,
          amount,
          currency,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        id("mile"),
        transactionId,
        agentId,
        milestone.milestone,
        Number(milestone.percentage),
        amount,
        currency
      );

      db.prepare(`
        INSERT INTO agent_payouts
        (
          id,
          transaction_id,
          agent_id,
          ledger_id,
          milestone,
          amount,
          currency,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        id("apay"),
        transactionId,
        agentId,
        ledgerId,
        milestone.milestone,
        amount,
        currency
      );
    }

    db.exec("COMMIT");

    return {
      transactionId,
      agentId,
      role,

      attribution: {
        shareRate: share,
        earnedAmount: earned
      },

      performance: {
        score,
        multiplier: performanceMultiplier,
        tier
      },

      ledger: {
        id: ledgerId,
        earnedAmount: earned,
        finalPayout: payout,
        performanceRetention: retention,
        carryForward: carry,
        status:
          carry > 0
            ? "CARRY_FORWARD"
            : payout > 0
              ? "PAYABLE"
              : "BLOCKED",
        balanced: accounted === earned
      },

      milestones,

      settlementStatus:
        carry > 0
          ? "CARRY_FORWARD"
          : payout > 0
            ? "READY_FOR_PAYOUT"
            : "BLOCKED"
    };

  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
