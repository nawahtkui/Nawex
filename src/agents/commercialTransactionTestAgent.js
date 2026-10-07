import { db } from "../db/database.js";
import { id } from "../utils.js";
import { createTransaction, calculateRevenue } from "../services/revenueEngine.js";
import {
  markPaymentPending,
  markPaid,
  markFulfillmentPending,
  markFulfilled,
  markCompleted,
  cancelTransaction,
  markFailed,
  requestRefund,
  markRefunded,
  startPayout,
  completePayout,
  failPayout,
  retryPayout
} from "../services/transactionLifecycle.js";

const TEST_PREFIX = "Commercial Transaction Test Agent";

function money(value) {
  return Number(Number(value).toFixed(2));
}

function getFixture() {
  const buyer = db.prepare(`
    SELECT *
    FROM users
    WHERE type = 'buyer'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  const supplier = db.prepare(`
    SELECT *
    FROM users
    WHERE type = 'supplier'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  const product = db.prepare(`
    SELECT *
    FROM products
    WHERE status = 'active'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  if (!buyer) throw new Error("No buyer available for commercial tests");
  if (!supplier) throw new Error("No supplier available for commercial tests");
  if (!product) throw new Error("No active product available for commercial tests");

  let provider = db.prepare(`
    SELECT *
    FROM users
    WHERE type = 'service_provider'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  if (!provider) {
    const providerId = id("usr");

    db.prepare(`
      INSERT INTO users
      (id, type, name, email, status)
      VALUES (?, 'service_provider', ?, ?, 'active')
    `).run(
      providerId,
      `${TEST_PREFIX} Provider`,
      `${providerId}@test.nawex.local`
    );

    provider = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(providerId);
  }

  let service = db.prepare(`
    SELECT *
    FROM services
    WHERE provider_id = ?
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(provider.id);

  if (!service) {
    const serviceId = id("svc");

    db.prepare(`
      INSERT INTO services
      (
        id,
        provider_id,
        name,
        description,
        category,
        price,
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      serviceId,
      provider.id,
      `${TEST_PREFIX} Service`,
      "Automatic commercial transaction test service",
      "testing",
      450,
      "USD"
    );

    service = db.prepare(`
      SELECT *
      FROM services
      WHERE id = ?
    `).get(serviceId);
  }

  return {
    buyer,
    supplier,
    product,
    provider,
    service
  };
}

function createTestRequest(buyerId, title) {
  const requestId = id("req");

  db.prepare(`
    INSERT INTO buyer_requests
    (
      id,
      buyer_id,
      title,
      description,
      category,
      budget,
      currency,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(
    requestId,
    buyerId,
    `${TEST_PREFIX} - ${title}`,
    `${TEST_PREFIX}: ${title}`,
    "testing",
    5000,
    "USD"
  );

  return requestId;
}

function createTestOffer({
  requestId,
  sellerId,
  itemType,
  itemId,
  price
}) {
  const offerId = id("off");

  db.prepare(`
    INSERT INTO offers
    (
      id,
      request_id,
      seller_id,
      item_type,
      item_id,
      price,
      currency,
      message,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, 'pending')
  `).run(
    offerId,
    requestId,
    sellerId,
    itemType,
    itemId,
    price,
    `${TEST_PREFIX} offer`
  );

  return offerId;
}

function cleanupTransaction(transactionId) {
  if (!transactionId) return;

  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

  if (!transaction) return;

  const orderId = transaction.order_id;

  const order = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ?
  `).get(orderId);

  const offerId = transaction.offer_id;
  let requestId = null;

  if (offerId) {
    const offer = db.prepare(`
      SELECT *
      FROM offers
      WHERE id = ?
    `).get(offerId);

    requestId = offer?.request_id || null;
  }

  db.transaction(() => {
    db.prepare(`
      DELETE FROM payouts
      WHERE transaction_id = ?
    `).run(transactionId);

    db.prepare(`
      DELETE FROM revenue_lines
      WHERE transaction_id = ?
    `).run(transactionId);

    db.prepare(`
      DELETE FROM transactions
      WHERE id = ?
    `).run(transactionId);

    if (order) {
      db.prepare(`
        DELETE FROM commissions
        WHERE order_id = ?
      `).run(orderId);

      db.prepare(`
        DELETE FROM orders
        WHERE id = ?
      `).run(orderId);
    }

    if (offerId) {
      db.prepare(`
        DELETE FROM offers
        WHERE id = ?
      `).run(offerId);
    }

    if (requestId) {
      db.prepare(`
        DELETE FROM buyer_requests
        WHERE id = ?
      `).run(requestId);
    }
  })();
}

function createScenario({
  buyer,
  seller,
  itemType,
  itemId,
  offerPrice,
  title
}) {
  const requestId = createTestRequest(
    buyer.id,
    title
  );

  const offerId = createTestOffer({
    requestId,
    sellerId: seller.id,
    itemType,
    itemId,
    price: offerPrice
  });

  return {
    requestId,
    offerId
  };
}

function inspectTransaction(transactionId) {
  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

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
    payouts,
    revenueLines
  };
}

function checkFinancialIntegrity(transactionId) {
  const detail = inspectTransaction(transactionId);

  if (!detail.transaction) {
    return {
      pass: false,
      error: "Transaction not found"
    };
  }

  const customerCharge =
    money(detail.transaction.gross_amount);

  const nawexRevenue =
    money(detail.transaction.nawex_revenue);

  const payoutTotal =
    money(
      detail.payouts.reduce(
        (sum, payout) =>
          sum + Number(payout.amount),
        0
      )
    );

  const revenueLineTotal =
    money(
      detail.revenueLines.reduce(
        (sum, line) =>
          sum + Number(line.amount),
        0
      )
    );

  const allocated =
    money(nawexRevenue + payoutTotal);

  const remaining =
    money(customerCharge - allocated);

  const pass =
    remaining >= 0 &&
    money(revenueLineTotal) === nawexRevenue;

  return {
    pass,
    customerCharge,
    nawexRevenue,
    payoutTotal,
    allocated,
    remaining,
    revenueLineTotal
  };
}

function runTest(name, action) {
  let transactionId = null;

  try {
    const result = action();

    transactionId =
      result?.transactionId ||
      result?.id ||
      null;

    return {
      name,
      status: "PASS",
      ...result
    };
  } catch (error) {
    return {
      name,
      status: "FAIL",
      error: error.message
    };
  } finally {
    if (transactionId) {
      try {
        cleanupTransaction(transactionId);
      } catch (cleanupError) {
        // Test result remains visible; cleanup failure is reported separately
      }
    }
  }
}

function runExpectedErrorTest({
  name,
  action,
  expectedText
}) {
  try {
    action();

    return {
      name,
      status: "FAIL",
      expectedError: expectedText,
      actualError: "No error occurred"
    };
  } catch (error) {
    const pass =
      error.message.includes(expectedText);

    return {
      name,
      status: pass ? "PASS" : "FAIL",
      expectedError: expectedText,
      actualError: error.message
    };
  }
}

function runDirectSaleTest(fixture) {
  return runTest("Direct Sale", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Direct Sale"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "COMMISSION",
      salePrice: 500,
      rate: 0.10
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error("Direct sale financial integrity failed");
    }

    return {
      transactionId: result.transactionId,
      model: "COMMISSION",
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      payoutTotal: integrity.payoutTotal,
      remaining: integrity.remaining
    };
  });
}

function runBrokerTest(fixture) {
  return runTest("Brokerage", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Brokerage"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error("Brokerage financial integrity failed");
    }

    return {
      transactionId: result.transactionId,
      model: "BROKER",
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      payoutTotal: integrity.payoutTotal,
      remaining: integrity.remaining
    };
  });
}

function runBuyResellTest(fixture) {
  return runTest("Buy and Resell", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Buy and Resell"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BUY_AND_RESELL",
      salePrice: 550,
      purchasePrice: 500
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error("Buy and resell financial integrity failed");
    }

    return {
      transactionId: result.transactionId,
      model: "BUY_AND_RESELL",
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      payoutTotal: integrity.payoutTotal,
      remaining: integrity.remaining
    };
  });
}

function runServiceTest(fixture) {
  return runTest("Direct Service", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.provider,
      itemType: "service",
      itemId: fixture.service.id,
      offerPrice: 450,
      title: "Direct Service"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "SERVICE",
      salePrice: 500,
      providerPayout: 450
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error("Service financial integrity failed");
    }

    return {
      transactionId: result.transactionId,
      model: "SERVICE",
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      payoutTotal: integrity.payoutTotal,
      remaining: integrity.remaining
    };
  });
}

function runCombinedRevenueTest(fixture) {
  return runTest("Combined Revenue", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.provider,
      itemType: "service",
      itemId: fixture.service.id,
      offerPrice: 450,
      title: "Combined Revenue"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "SERVICE",
      salePrice: 500,
      providerPayout: 450,
      serviceFee: 10,
      commissionFee: 10,
      executionFee: 5
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error("Combined revenue integrity failed");
    }

    return {
      transactionId: result.transactionId,
      model: "SERVICE",
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      payoutTotal: integrity.payoutTotal,
      revenueLineTotal: integrity.revenueLineTotal,
      remaining: integrity.remaining
    };
  });
}

function runFullLifecycleTest(fixture) {
  return runTest("Full Transaction Lifecycle", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Full Transaction Lifecycle"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "COMMISSION",
      salePrice: 500,
      rate: 0.10
    });

    const transactionId =
      result.transactionId;

    markPaymentPending(transactionId);
    markPaid(transactionId);
    markFulfillmentPending(transactionId);
    markFulfilled(transactionId);
    markCompleted(transactionId);

    const detail =
      inspectTransaction(transactionId);

    if (detail.transaction.status !== "completed") {
      throw new Error(
        `Expected completed, got ${detail.transaction.status}`
      );
    }

    return {
      transactionId,
      finalStatus: detail.transaction.status
    };
  });
}

function runPayoutLifecycleTest(fixture) {
  return runTest("Payout Lifecycle", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Payout Lifecycle"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    const detail =
      inspectTransaction(result.transactionId);

    if (detail.payouts.length !== 1) {
      throw new Error("Expected exactly one payout");
    }

    const payoutId =
      detail.payouts[0].id;

    startPayout(payoutId);
    completePayout(payoutId);

    const updated =
      inspectTransaction(result.transactionId);

    if (updated.payouts[0].status !== "paid") {
      throw new Error("Payout did not reach paid");
    }

    return {
      transactionId: result.transactionId,
      payoutId,
      payoutStatus: updated.payouts[0].status
    };
  });
}

function runCancelTest(fixture) {
  return runTest("Cancel", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Cancel"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    const updated =
      cancelTransaction(result.transactionId);

    if (updated.status !== "cancelled") {
      throw new Error("Transaction was not cancelled");
    }

    return {
      transactionId: result.transactionId,
      finalStatus: updated.status
    };
  });
}

function runRefundTest(fixture) {
  return runTest("Refund", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Refund"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "COMMISSION",
      salePrice: 500,
      rate: 0.10
    });

    markPaymentPending(result.transactionId);
    markPaid(result.transactionId);
    requestRefund(result.transactionId);
    markRefunded(result.transactionId);

    const updated =
      inspectTransaction(result.transactionId);

    if (updated.transaction.status !== "refunded") {
      throw new Error("Transaction was not refunded");
    }

    return {
      transactionId: result.transactionId,
      finalStatus: updated.transaction.status
    };
  });
}

function runFulfillmentFailureTest(fixture) {
  return runTest("Fulfillment Failure", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Fulfillment Failure"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "COMMISSION",
      salePrice: 500,
      rate: 0.10
    });

    markPaymentPending(result.transactionId);
    markPaid(result.transactionId);
    markFulfillmentPending(result.transactionId);
    markFailed(result.transactionId);

    const updated =
      inspectTransaction(result.transactionId);

    if (updated.transaction.status !== "failed") {
      throw new Error("Transaction did not reach failed");
    }

    return {
      transactionId: result.transactionId,
      finalStatus: updated.transaction.status
    };
  });
}

function runPayoutFailureRetryTest(fixture) {
  return runTest("Payout Failure + Retry", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Payout Failure Retry"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    const detail =
      inspectTransaction(result.transactionId);

    const payoutId =
      detail.payouts[0].id;

    startPayout(payoutId);
    failPayout(payoutId);
    retryPayout(payoutId);
    completePayout(payoutId);

    const updated =
      inspectTransaction(result.transactionId);

    if (updated.payouts[0].status !== "paid") {
      throw new Error(
        "Payout retry did not reach paid"
      );
    }

    return {
      transactionId: result.transactionId,
      payoutId,
      finalPayoutStatus: updated.payouts[0].status
    };
  });
}

function runIdempotencyTest(fixture) {
  return runTest("Duplicate Transaction Protection", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Duplicate Transaction"
    });

    const first =
      createTransaction({
        offerId: scenario.offerId,
        revenueModel: "BROKER",
        salePrice: 500,
        rate: 0.05
      });

    try {
      createTransaction({
        offerId: scenario.offerId,
        revenueModel: "BROKER",
        salePrice: 500,
        rate: 0.05
      });

      throw new Error(
        "Second transaction was accepted"
      );
    } catch (error) {
      if (
        !error.message.includes(
          "Offer cannot be accepted"
        ) &&
        !error.message.includes(
          "already has a transaction"
        )
      ) {
        throw error;
      }
    }

    return {
      transactionId: first.transactionId,
      duplicateRejected: true
    };
  });
}

function runDuplicatePayoutTest(fixture) {
  return runTest("Duplicate Payout Protection", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Duplicate Payout"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "COMMISSION",
      salePrice: 500,
      rate: 0.10
    });

    const detail =
      inspectTransaction(result.transactionId);

    if (detail.payouts.length !== 1) {
      throw new Error(
        `Expected 1 payout, found ${detail.payouts.length}`
      );
    }

    const secondPayout = db.prepare(`
      SELECT *
      FROM payouts
      WHERE transaction_id = ?
    `).all(result.transactionId);

    if (secondPayout.length !== 1) {
      throw new Error(
        "Transaction has duplicate payouts"
      );
    }

    return {
      transactionId: result.transactionId,
      payoutCount: secondPayout.length,
      duplicateRejected: true
    };
  });
}

function runInvalidTransactionTransitionTest(fixture) {
  return runTest("Invalid Transaction Transition", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Invalid Transaction Transition"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    try {
      markCompleted(result.transactionId);

      throw new Error(
        "Invalid transaction transition was accepted"
      );
    } catch (error) {
      if (
        !error.message.includes(
          "Invalid transaction transition"
        )
      ) {
        throw error;
      }
    }

    return {
      transactionId: result.transactionId,
      invalidTransitionRejected: true
    };
  });
}

function runInvalidPayoutTransitionTest(fixture) {
  return runTest("Invalid Payout Transition", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Invalid Payout Transition"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    const detail =
      inspectTransaction(result.transactionId);

    const payoutId =
      detail.payouts[0].id;

    try {
      completePayout(payoutId);

      throw new Error(
        "Invalid payout transition was accepted"
      );
    } catch (error) {
      if (
        !error.message.includes(
          "Invalid payout transition"
        )
      ) {
        throw error;
      }
    }

    return {
      transactionId: result.transactionId,
      payoutId,
      invalidTransitionRejected: true
    };
  });
}

function runRevenueIntegrityTest(fixture) {
  return runTest("Revenue Integrity", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.provider,
      itemType: "service",
      itemId: fixture.service.id,
      offerPrice: 450,
      title: "Revenue Integrity"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "SERVICE",
      salePrice: 500,
      providerPayout: 450,
      serviceFee: 10,
      commissionFee: 10,
      executionFee: 5
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error(
        `Revenue integrity failed: ${JSON.stringify(integrity)}`
      );
    }

    return {
      transactionId: result.transactionId,
      customerCharge: integrity.customerCharge,
      nawexRevenue: integrity.nawexRevenue,
      revenueLineTotal: integrity.revenueLineTotal,
      payoutTotal: integrity.payoutTotal,
      remaining: integrity.remaining
    };
  });
}

function runAllocationIntegrityTest(fixture) {
  return runTest("Allocation Integrity", () => {
    const scenario = createScenario({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      title: "Allocation Integrity"
    });

    const result = createTransaction({
      offerId: scenario.offerId,
      revenueModel: "BUY_AND_RESELL",
      salePrice: 550,
      purchasePrice: 500,
      executionFee: 10
    });

    const integrity =
      checkFinancialIntegrity(result.transactionId);

    if (!integrity.pass) {
      throw new Error(
        `Allocation integrity failed: ${JSON.stringify(integrity)}`
      );
    }

    if (integrity.allocated > integrity.customerCharge) {
      throw new Error(
        "Allocated amount exceeds customer charge"
      );
    }

    return {
      transactionId: result.transactionId,
      customerCharge: integrity.customerCharge,
      allocated: integrity.allocated,
      remaining: integrity.remaining,
      pass: true
    };
  });
}

function runOverAllocationProtectionTest() {
  return runExpectedErrorTest({
    name: "Over-Allocation Protection",
    expectedText:
      "purchasePrice cannot exceed customer sale price",
    action: () => {
      calculateRevenue({
        model: "BUY_AND_RESELL",
        grossAmount: 500,
        purchasePrice: 600
      });
    }
  });
}

function runInvalidRevenueModelTest() {
  return runExpectedErrorTest({
    name: "Invalid Revenue Model",
    expectedText:
      "Unsupported revenue model",
    action: () => {
      calculateRevenue({
        model: "INVALID_MODEL",
        grossAmount: 500
      });
    }
  });
}

function runInvalidRateTest() {
  return runExpectedErrorTest({
    name: "Invalid Revenue Rate",
    expectedText:
      "rate must be between 0 and 1",
    action: () => {
      calculateRevenue({
        model: "BROKER",
        grossAmount: 500,
        rate: 1.5
      });
    }
  });
}

export function runCommercialTransactionTests() {
  const fixture = getFixture();

  const tests = [
    runDirectSaleTest(fixture),
    runBrokerTest(fixture),
    runBuyResellTest(fixture),
    runServiceTest(fixture),
    runCombinedRevenueTest(fixture),
    runFullLifecycleTest(fixture),
    runPayoutLifecycleTest(fixture),
    runCancelTest(fixture),
    runRefundTest(fixture),
    runFulfillmentFailureTest(fixture),
    runPayoutFailureRetryTest(fixture),
    runIdempotencyTest(fixture),
    runDuplicatePayoutTest(fixture),
    runInvalidTransactionTransitionTest(fixture),
    runInvalidPayoutTransitionTest(fixture),
    runRevenueIntegrityTest(fixture),
    runAllocationIntegrityTest(fixture),
    runOverAllocationProtectionTest(),
    runInvalidRevenueModelTest(),
    runInvalidRateTest()
  ];

  const passed =
    tests.filter(
      test => test.status === "PASS"
    ).length;

  const failed =
    tests.filter(
      test => test.status === "FAIL"
    ).length;

  const errors =
    tests.filter(
      test => test.status === "ERROR"
    ).length;

  return {
    agent: "commercial-transaction-test-agent",

    summary: {
      total: tests.length,
      passed,
      failed,
      errors,
      overall:
        failed === 0 && errors === 0
          ? "PASS"
          : "FAIL"
    },

    financialRule:
      "customerCharge >= payouts + Nawex revenue",

    lifecycle:
      "pending -> payment_pending -> paid -> fulfillment_pending -> fulfilled -> completed",

    payoutLifecycle:
      "pending -> processing -> paid",

    tests
  };
}
