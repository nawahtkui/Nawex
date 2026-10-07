import { db } from "../db/database.js";

const AGENT_PAYOUT_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["paid", "failed"],
  failed: ["processing"],
  paid: [],
  cancelled: []
};

function _getAgentPayout(payoutId) {
  const payout = db.prepare(`
    SELECT *
    FROM agent_payouts
    WHERE id = ?
  `).get(payoutId);

  if (!payout) {
    throw new Error("Agent payout not found");
  }

  return payout;
}

export function transitionAgentPayout(
  payoutId,
  nextStatus
) {
  const payout = _getAgentPayout(payoutId);

  const allowed =
    AGENT_PAYOUT_TRANSITIONS[payout.status] || [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid agent payout transition: ${payout.status} -> ${nextStatus}`
    );
  }

  if (nextStatus === "paid") {
    db.prepare(`
      UPDATE agent_payouts
      SET status = ?,
          paid_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextStatus, payoutId);
  } else {
    db.prepare(`
      UPDATE agent_payouts
      SET status = ?
      WHERE id = ?
    `).run(nextStatus, payoutId);
  }

  return _getAgentPayout(payoutId);
}

export function startAgentPayout(payoutId) {
  return transitionAgentPayout(
    payoutId,
    "processing"
  );
}

export function completeAgentPayout(payoutId) {
  return transitionAgentPayout(
    payoutId,
    "paid"
  );
}

export function failAgentPayout(payoutId) {
  return transitionAgentPayout(
    payoutId,
    "failed"
  );
}

export function retryAgentPayout(payoutId) {
  return transitionAgentPayout(
    payoutId,
    "processing"
  );
}

export function cancelAgentPayout(payoutId) {
  return transitionAgentPayout(
    payoutId,
    "cancelled"
  );
}

export function getAgentPayout(payoutId) {
  return _getAgentPayout(payoutId);
}

export function getAgentPayoutsForTransaction(
  transactionId
) {
  return db.prepare(`
    SELECT *
    FROM agent_payouts
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);
}
