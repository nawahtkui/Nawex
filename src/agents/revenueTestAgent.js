import { db } from "../db/database.js";
import { id } from "../utils.js";
import { createTransaction, calculateRevenue } from "../services/revenueEngine.js";

const TEST_PREFIX = "Revenue Test Agent";

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

  if (!buyer) throw new Error("No buyer available for test");
  if (!supplier) throw new Error("No supplier available for test");
  if (!product) throw new Error("No active product available for test");

  return { buyer, supplier, product };
}

function ensureServiceFixture() {
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
      "Automatic revenue engine test service",
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

  return { provider, service };
}

function createTestRequest({
  buyerId,
  title,
  budget = 2000
}) {
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
    title,
    `${TEST_PREFIX}: ${title}`,
    "testing",
    budget,
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

function inspectTransaction(transactionId) {
  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(transactionId);

  const revenue = db.prepare(`
    SELECT *
    FROM revenue_lines
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);

  const payouts = db.prepare(`
    SELECT *
    FROM payouts
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(transactionId);

  return {
    transaction,
    revenue,
    payouts
  };
}

function checkBalance(detail) {
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

  const allocated =
    money(nawexRevenue + payoutTotal);

  const remaining =
    money(customerCharge - allocated);

  const pass = remaining >= 0;

  return {
    customerCharge,
    nawexRevenue,
    payoutTotal,
    allocated,
    remaining,
    pass
  };
}

function runOneTest({
  name,
  model,
  buyer,
  seller,
  itemType,
  itemId,
  offerPrice,
  salePrice,
  purchasePrice,
  providerPayout,
  rate,
  fixedFee,
  serviceFee,
  commissionFee,
  brokerageFee,
  executionFee
}) {
  try {
    const requestId = createTestRequest({
      buyerId: buyer.id,
      title: `${TEST_PREFIX} - ${name}`,
      budget: 3000
    });

    const offerId = createTestOffer({
      requestId,
      sellerId: seller.id,
      itemType,
      itemId,
      price: offerPrice
    });

    const result = createTransaction({
      offerId,
      revenueModel: model,
      salePrice,
      purchasePrice,
      providerPayout,
      rate,
      fixedFee,
      serviceFee,
      commissionFee,
      brokerageFee,
      executionFee
    });

    const detail =
      inspectTransaction(result.transactionId);

    const balance =
      checkBalance(detail);

    return {
      name,
      model,
      status: balance.pass ? "PASS" : "FAIL",
      transactionId: result.transactionId,
      requestId,
      offerId,
      customerCharge: balance.customerCharge,
      nawexRevenue: balance.nawexRevenue,
      payoutTotal: balance.payoutTotal,
      allocated: balance.allocated,
      remaining: balance.remaining,
      revenueLines:
        detail.revenue.map(row => ({
          type: row.type,
          amount: Number(row.amount)
        })),
      payouts:
        detail.payouts.map(row => ({
          recipientId: row.recipient_id,
          amount: Number(row.amount),
          status: row.status
        }))
    };

  } catch (error) {
    return {
      name,
      model,
      status: "ERROR",
      error: error.message
    };
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
      error: `Expected error containing "${expectedText}" but no error occurred`
    };

  } catch (error) {
    const matched =
      error.message.includes(expectedText);

    return {
      name,
      status: matched ? "PASS" : "FAIL",
      expectedError: expectedText,
      actualError: error.message
    };
  }
}

function runIdempotencyTest({
  buyer,
  seller,
  itemType,
  itemId
}) {
  const name = "Idempotency";

  try {
    const requestId = createTestRequest({
      buyerId: buyer.id,
      title: `${TEST_PREFIX} - ${name}`
    });

    const offerId = createTestOffer({
      requestId,
      sellerId: seller.id,
      itemType,
      itemId,
      price: 500
    });

    const first = createTransaction({
      offerId,
      revenueModel: "BROKER",
      salePrice: 500,
      rate: 0.05
    });

    try {
      createTransaction({
        offerId,
        revenueModel: "BROKER",
        salePrice: 500,
        rate: 0.05
      });

      return {
        name,
        status: "FAIL",
        error: "Second transaction was accepted"
      };

    } catch (error) {
      const pass =
        error.message.includes("Offer cannot be accepted") ||
        error.message.includes("already has a transaction");

      return {
        name,
        status: pass ? "PASS" : "FAIL",
        firstTransactionId: first.transactionId,
        expectedError:
          "Offer cannot be accepted / already has a transaction",
        actualError: error.message
      };
    }

  } catch (error) {
    return {
      name,
      status: "ERROR",
      error: error.message
    };
  }
}

export function runRevenueTests() {
  const fixture = getFixture();
  const serviceFixture = ensureServiceFixture();

  const tests = [];

  /*
    1. COMMISSION
  */

  tests.push(
    runOneTest({
      name: "Commission 10%",
      model: "COMMISSION",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 500,
      rate: 0.10
    })
  );

  /*
    2. BROKER
  */

  tests.push(
    runOneTest({
      name: "Broker 5%",
      model: "BROKER",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 500,
      rate: 0.05
    })
  );

  /*
    3. BUY AND RESELL
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500
    })
  );

  /*
    4. SERVICE
  */

  tests.push(
    runOneTest({
      name: "Service Margin",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450
    })
  );

  /*
    5. EXECUTION FEE
  */

  tests.push(
    runOneTest({
      name: "Execution Fee",
      model: "EXECUTION_FEE",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 500,
      fixedFee: 25
    })
  );

  /*
    6. BROKER + COMMISSION
  */

  tests.push(
    runOneTest({
      name: "Broker + Commission",
      model: "BROKER",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 500,
      rate: 0.05,
      commissionFee: 25
    })
  );

  /*
    7. BUY AND RESELL + SERVICE FEE
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell + Service Fee",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500,
      serviceFee: 10
    })
  );

  /*
    8. SERVICE + EXECUTION FEE
  */

  tests.push(
    runOneTest({
      name: "Service + Execution Fee",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450,
      executionFee: 10
    })
  );

  /*
    9. BUY AND RESELL + COMMISSION
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell + Commission",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500,
      commissionFee: 10
    })
  );

  /*
    10. BUY AND RESELL + BROKERAGE
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell + Brokerage",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500,
      brokerageFee: 10
    })
  );

  /*
    11. BUY AND RESELL + EXECUTION FEE
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell + Execution Fee",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500,
      executionFee: 10
    })
  );

  /*
    12. SERVICE + COMMISSION
  */

  tests.push(
    runOneTest({
      name: "Service + Commission",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450,
      commissionFee: 10
    })
  );

  /*
    13. SERVICE + BROKERAGE
  */

  tests.push(
    runOneTest({
      name: "Service + Brokerage",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450,
      brokerageFee: 10
    })
  );

  /*
    14. SERVICE + EXECUTION FEE
  */

  tests.push(
    runOneTest({
      name: "Service + Execution Fee",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450,
      executionFee: 10
    })
  );

  /*
    15. BUY AND RESELL + MULTIPLE FEES
  */

  tests.push(
    runOneTest({
      name: "Buy and Resell + Multiple Fees",
      model: "BUY_AND_RESELL",
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id,
      offerPrice: 500,
      salePrice: 550,
      purchasePrice: 500,
      serviceFee: 10,
      commissionFee: 10,
      executionFee: 5
    })
  );

  /*
    16. SERVICE + MULTIPLE FEES
  */

  tests.push(
    runOneTest({
      name: "Service + Multiple Fees",
      model: "SERVICE",
      buyer: fixture.buyer,
      seller: serviceFixture.provider,
      itemType: "service",
      itemId: serviceFixture.service.id,
      offerPrice: 450,
      salePrice: 500,
      providerPayout: 450,
      serviceFee: 10,
      commissionFee: 10,
      executionFee: 5
    })
  );

  /*
    17. OVER-ALLOCATION PROTECTION
  */

  tests.push(
    runExpectedErrorTest({
      name: "Reject Over-Allocation",
      expectedText:
        "purchasePrice cannot exceed customer sale price",
      action: () => {
        calculateRevenue({
          model: "BUY_AND_RESELL",
          grossAmount: 500,
          purchasePrice: 600
        });
      }
    })
  );

  /*
    18. IDEMPOTENCY
  */

  tests.push(
    runIdempotencyTest({
      buyer: fixture.buyer,
      seller: fixture.supplier,
      itemType: "product",
      itemId: fixture.product.id
    })
  );

  /*
    19. INVALID REVENUE MODEL
  */

  tests.push(
    runExpectedErrorTest({
      name: "Reject Invalid Revenue Model",
      expectedText:
        "Unsupported revenue model",
      action: () => {
        calculateRevenue({
          model: "INVALID_MODEL",
          grossAmount: 500
        });
      }
    })
  );

  /*
    20. INVALID RATE
  */

  tests.push(
    runExpectedErrorTest({
      name: "Reject Invalid Rate",
      expectedText:
        "rate must be between 0 and 1",
      action: () => {
        calculateRevenue({
          model: "BROKER",
          grossAmount: 500,
          rate: 1.5
        });
      }
    })
  );

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
    agent: "revenue-test-agent",

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

    rule:
      "customerCharge >= payouts + Nawex revenue",

    tests
  };
}
