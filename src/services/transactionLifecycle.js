import { db } from "../db/database.js";

const TRANSITIONS = {
  pending: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "cancelled"],
  paid: ["fulfillment_pending", "refund_pending", "cancelled"],
  fulfillment_pending: ["fulfilled", "failed"],
  fulfilled: ["completed", "failed"],
  completed: [],
  cancelled: [],
  failed: ["refund_pending"],
  refund_pending: ["refunded"],
  refunded: []
};

const PAYOUT_TRANSITIONS = {
  pending: ["processing", "cancelled"],
  processing: ["paid", "failed"],
  failed: ["processing"],
  paid: [],
  cancelled: []
};

function getTransaction(transactionId) {
  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  return transaction;
}

function getPayout(payoutId) {
  const payout = db.prepare(`
    SELECT *
    FROM payouts
    WHERE id = ?
  `).get(payoutId);

  if (!payout) {
    throw new Error("Payout not found");
  }

  return payout;
}

export function transitionTransaction(transactionId, nextStatus) {
  const transaction = getTransaction(transactionId);
  const allowed = TRANSITIONS[transaction.status] || [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid transaction transition: ${transaction.status} -> ${nextStatus}`
    );
  }

  db.prepare(`
    UPDATE transactions
    SET status = ?
    WHERE id = ?
  `).run(nextStatus, transactionId);

  const updated = getTransaction(transactionId);

  return updated;
}

export function markPaymentPending(transactionId) {
  return transitionTransaction(
    transactionId,
    "payment_pending"
  );
}

export function markPaid(transactionId) {
  return transitionTransaction(
    transactionId,
    "paid"
  );
}

export function markFulfillmentPending(transactionId) {
  return transitionTransaction(
    transactionId,
    "fulfillment_pending"
  );
}

export function markFulfilled(transactionId) {
  return transitionTransaction(
    transactionId,
    "fulfilled"
  );
}

export function markCompleted(transactionId) {
  return transitionTransaction(
    transactionId,
    "completed"
  );
}

export function cancelTransaction(transactionId) {
  return transitionTransaction(
    transactionId,
    "cancelled"
  );
}

export function markFailed(transactionId) {
  return transitionTransaction(
    transactionId,
    "failed"
  );
}

export function requestRefund(transactionId) {
  return transitionTransaction(
    transactionId,
    "refund_pending"
  );
}

export function markRefunded(transactionId) {
  return transitionTransaction(
    transactionId,
    "refunded"
  );
}

export function transitionPayout(payoutId, nextStatus) {
  const payout = getPayout(payoutId);
  const allowed = PAYOUT_TRANSITIONS[payout.status] || [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid payout transition: ${payout.status} -> ${nextStatus}`
    );
  }

  db.prepare(`
    UPDATE payouts
    SET status = ?
    WHERE id = ?
  `).run(nextStatus, payoutId);

  return getPayout(payoutId);
}

export function startPayout(payoutId) {
  return transitionPayout(
    payoutId,
    "processing"
  );
}

export function completePayout(payoutId) {
  return transitionPayout(
    payoutId,
    "paid"
  );
}

export function failPayout(payoutId) {
  return transitionPayout(
    payoutId,
    "failed"
  );
}

export function retryPayout(payoutId) {
  return transitionPayout(
    payoutId,
    "processing"
  );
}

export function cancelPayout(payoutId) {
  return transitionPayout(
    payoutId,
    "cancelled"
  );
}

export function getTransactionLifecycle(transactionId) {
  const transaction = getTransaction(transactionId);

  const order = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ?
  `).get(transaction.order_id);

  const payouts = db.prepare(`
    SELECT *
    FROM payouts
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);

  const revenueLines = db.prepare(`
    SELECT *
    FROM revenue_lines
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);

  return {
    transaction,
    order,
    payouts,
    revenueLines
  };
}
