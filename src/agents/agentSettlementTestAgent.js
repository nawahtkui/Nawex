import { db } from "../db/database.js";
import { id } from "../utils.js";
import {
  settleAgentAllocation
} from "../services/agentSettlementEngine.js";

function test(name, expected, actual) {
  const pass =
    JSON.stringify(expected) ===
    JSON.stringify(actual);

  return {
    name,
    status: pass ? "PASS" : "FAIL",
    expected,
    actual
  };
}

export function runAgentSettlementTests() {
  const results = [];

  const userId = id("usr");
  const sellerId = id("usr");
  const offerId = id("off");
  const orderId = id("ord");
  const transactionId = id("txn");
  const agentId = id("agent");

  db.prepare(`
    INSERT INTO users
    (
      id,
      type,
      name
    )
    VALUES (?, 'buyer', 'Settlement Test Buyer')
  `).run(userId);

  db.prepare(`
    INSERT INTO users
    (
      id,
      type,
      name
    )
    VALUES (?, 'supplier', 'Settlement Test Supplier')
  `).run(sellerId);

  db.prepare(`
    INSERT INTO buyer_requests
    (
      id,
      buyer_id,
      title,
      description
    )
    VALUES (?, ?, 'Settlement Test', 'Settlement Test')
  `).run(
    id("req"),
    userId
  );

  const requestId =
    db.prepare(`
      SELECT id
      FROM buyer_requests
      WHERE buyer_id = ?
      ORDER BY rowid DESC
      LIMIT 1
    `).get(userId).id;

  db.prepare(`
    INSERT INTO offers
    (
      id,
      request_id,
      seller_id,
      item_type,
      item_id,
      price,
      currency
    )
    VALUES (?, ?, ?, 'product', 'test-product', 500, 'USD')
  `).run(
    offerId,
    requestId,
    sellerId
  );

  db.prepare(`
    INSERT INTO orders
    (
      id,
      buyer_id,
      seller_id,
      offer_id,
      total,
      currency
    )
    VALUES (?, ?, ?, ?, 500, 'USD')
  `).run(
    orderId,
    userId,
    sellerId,
    offerId
  );

  db.prepare(`
    INSERT INTO transactions
    (
      id,
      order_id,
      buyer_id,
      seller_id,
      offer_id,
      revenue_model,
      gross_amount,
      purchase_amount,
      nawex_revenue,
      seller_payout,
      currency
    )
    VALUES (?, ?, ?, ?, ?, 'BUY_AND_RESELL', 500, 400, 30, 400, 'USD')
  `).run(
    transactionId,
    orderId,
    userId,
    sellerId,
    offerId
  );

  db.prepare(`
    INSERT INTO agents
    (
      id,
      name,
      type,
      specialization
    )
    VALUES (?, 'Settlement Test Agent', 'ai', 'NEGOTIATOR')
  `).run(agentId);

  const settlement =
    settleAgentAllocation({
      transactionId,
      agentId,
      role: "NEGOTIATOR",
      shareRate: 0.40,
      earnedAmount: 28,
      performanceScore: 95,
      finalPayout: 26.60,
      performanceRetention: 1.40,
      carryForward: 0,
      milestones: [
        {
          milestone: "SIGNING",
          percentage: 0.30,
          amount: 7.98
        },
        {
          milestone: "MIDPOINT",
          percentage: 0.40,
          amount: 10.64
        },
        {
          milestone: "COMPLETION",
          percentage: 0.30,
          amount: 7.98
        }
      ]
    });

  results.push(
    test(
      "Settlement balanced",
      true,
      settlement.ledger.balanced
    )
  );

  results.push(
    test(
      "Final payout",
      26.60,
      settlement.ledger.finalPayout
    )
  );

  results.push(
    test(
      "Performance retention",
      1.40,
      settlement.ledger.performanceRetention
    )
  );

  results.push(
    test(
      "Settlement status",
      "READY_FOR_PAYOUT",
      settlement.settlementStatus
    )
  );

  results.push(
    test(
      "Performance row",
      1,
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM agent_performance
        WHERE transaction_id = ?
          AND agent_id = ?
      `).get(
        transactionId,
        agentId
      ).count
    )
  );

  results.push(
    test(
      "Ledger row",
      1,
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM agent_ledger
        WHERE transaction_id = ?
          AND agent_id = ?
      `).get(
        transactionId,
        agentId
      ).count
    )
  );

  results.push(
    test(
      "Milestone rows",
      3,
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM agent_milestones
        WHERE transaction_id = ?
          AND agent_id = ?
      `).get(
        transactionId,
        agentId
      ).count
    )
  );

  results.push(
    test(
      "Attribution share rate",
      0.40,
      db.prepare(`
        SELECT share_rate
        FROM agent_attributions
        WHERE transaction_id = ?
          AND agent_id = ?
          AND role = ?
      `).get(
        transactionId,
        agentId,
        "NEGOTIATOR"
      ).share_rate
    )
  );

  results.push(
    test(
      "Agent payout rows",
      3,
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM agent_payouts
        WHERE transaction_id = ?
          AND agent_id = ?
      `).get(
        transactionId,
        agentId
      ).count
    )
  );

  results.push(
    test(
      "Agent payout total",
      26.60,
      Number(
        db.prepare(`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM agent_payouts
          WHERE transaction_id = ?
            AND agent_id = ?
        `).get(
          transactionId,
          agentId
        ).total.toFixed(2)
      )
    )
  );

  results.push(
    test(
      "Agent attribution row",
      1,
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM agent_attributions
        WHERE transaction_id = ?
          AND agent_id = ?
          AND role = ?
      `).get(
        transactionId,
        agentId,
        "NEGOTIATOR"
      ).count
    )
  );

  const passed =
    results.filter(
      item => item.status === "PASS"
    ).length;

  const failed =
    results.filter(
      item => item.status === "FAIL"
    ).length;

  return {
    tests: results,
    summary: {
      total: results.length,
      passed,
      failed,
      overall:
        failed === 0
          ? "PASS"
          : "FAIL"
    }
  };
}
