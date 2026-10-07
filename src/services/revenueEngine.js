import { db } from "../db/database.js";
import { id } from "../utils.js";

/*
  Nawex Revenue Engine

  Supported primary models:

  COMMISSION
  BROKER
  BUY_AND_RESELL
  SERVICE
  EXECUTION_FEE

  Additional revenue components can be combined:

  commissionFee
  brokerageFee
  serviceFee
  executionFee

  Economic meaning:

  customerCharge  = what the customer pays
  supplierCost    = what Nawex pays to acquire the item/service
  supplierPayout  = what supplier/provider receives
  nawexRevenue    = total gross revenue of Nawex

  Fee treatment:

  For BUY_AND_RESELL and SERVICE, additional fees are added to
  the customer charge because the supplier/provider cost remains
  fixed.

  For COMMISSION / BROKER / EXECUTION_FEE, additional fees are
  carved from the existing customer charge.
*/

const SUPPORTED_MODELS = new Set([
  "COMMISSION",
  "BROKER",
  "BUY_AND_RESELL",
  "SERVICE",
  "EXECUTION_FEE"
]);

function money(value) {
  return Number(Number(value).toFixed(2));
}

function requirePositiveAmount(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${field} must be greater than 0`);
  }

  return money(number);
}

function optionalRate(value, fallback) {
  const rate = value == null ? fallback : Number(value);

  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error("rate must be between 0 and 1");
  }

  return rate;
}

function feeFromRateOrFixed({
  gross,
  rate,
  fixedFee,
  defaultRate
}) {
  if (fixedFee != null && Number(fixedFee) > 0) {
    const fee = money(fixedFee);

    if (!Number.isFinite(fee) || fee > gross) {
      throw new Error("fixedFee cannot exceed gross amount");
    }

    return {
      amount: fee,
      rate: null,
      type: "fixed"
    };
  }

  const appliedRate = optionalRate(rate, defaultRate);
  const fee = money(gross * appliedRate);

  if (fee > gross) {
    throw new Error("Fee cannot exceed gross amount");
  }

  return {
    amount: fee,
    rate: appliedRate,
    type: "percentage"
  };
}

function additionalComponents({
  commissionFee,
  commissionRate,
  brokerageFee,
  brokerageRate,
  serviceFee,
  executionFee,
  executionRate
}) {
  const components = [];

  if (Number(commissionFee) > 0) {
    const amount = money(commissionFee);

    components.push({
      type: "COMMISSION",
      amount,
      rate:
        commissionRate == null
          ? null
          : optionalRate(commissionRate, 0)
    });
  }

  if (Number(brokerageFee) > 0) {
    const amount = money(brokerageFee);

    components.push({
      type: "BROKERAGE",
      amount,
      rate:
        brokerageRate == null
          ? null
          : optionalRate(brokerageRate, 0)
    });
  }

  if (Number(serviceFee) > 0) {
    const amount = money(serviceFee);

    components.push({
      type: "SERVICE_FEE",
      amount
    });
  }

  if (Number(executionFee) > 0) {
    const amount = money(executionFee);

    components.push({
      type: "EXECUTION_FEE",
      amount,
      rate:
        executionRate == null
          ? null
          : optionalRate(executionRate, 0)
    });
  }

  return components;
}

export function calculateRevenue({
  model,
  grossAmount,

  purchasePrice = null,
  providerPayout = null,

  rate = null,
  fixedFee = 0,

  commissionRate = null,
  commissionFee = 0,

  brokerageRate = null,
  brokerageFee = 0,

  serviceFee = 0,

  executionRate = null,
  executionFee = 0
}) {
  if (!SUPPORTED_MODELS.has(model)) {
    throw new Error(`Unsupported revenue model: ${model}`);
  }

  const baseGross = requirePositiveAmount(
    grossAmount,
    "grossAmount"
  );

  const components = [];

  let supplierCost = null;
  let supplierPayout = 0;

  let primaryRevenue = 0;
  let primaryRate = null;

  /*
    PRIMARY MODEL
  */

  switch (model) {
    case "COMMISSION": {
      const fee = feeFromRateOrFixed({
        gross: baseGross,
        rate,
        fixedFee,
        defaultRate: 0.10
      });

      primaryRevenue = fee.amount;
      primaryRate = fee.rate;

      components.push({
        type: "COMMISSION",
        amount: primaryRevenue,
        rate: primaryRate
      });

      break;
    }

    case "BROKER": {
      const fee = feeFromRateOrFixed({
        gross: baseGross,
        rate,
        fixedFee,
        defaultRate: 0.05
      });

      primaryRevenue = fee.amount;
      primaryRate = fee.rate;

      components.push({
        type: "BROKERAGE",
        amount: primaryRevenue,
        rate: primaryRate
      });

      break;
    }

    case "BUY_AND_RESELL": {
      supplierCost = requirePositiveAmount(
        purchasePrice,
        "purchasePrice"
      );

      if (supplierCost > baseGross) {
        throw new Error(
          "purchasePrice cannot exceed customer sale price"
        );
      }

      primaryRevenue = money(
        baseGross - supplierCost
      );

      supplierPayout = supplierCost;

      components.push({
        type: "RESELL_MARGIN",
        amount: primaryRevenue
      });

      break;
    }

    case "SERVICE": {
      supplierPayout = requirePositiveAmount(
        providerPayout,
        "providerPayout"
      );

      if (supplierPayout > baseGross) {
        throw new Error(
          "providerPayout cannot exceed customer charge"
        );
      }

      primaryRevenue = money(
        baseGross - supplierPayout
      );

      components.push({
        type: "SERVICE_MARGIN",
        amount: primaryRevenue
      });

      break;
    }

    case "EXECUTION_FEE": {
      const fee = feeFromRateOrFixed({
        gross: baseGross,
        rate,
        fixedFee,
        defaultRate: 0.05
      });

      primaryRevenue = fee.amount;
      primaryRate = fee.rate;

      components.push({
        type: "EXECUTION_FEE",
        amount: primaryRevenue,
        rate: primaryRate
      });

      break;
    }
  }

  /*
    ADDITIONAL REVENUE COMPONENTS
  */

  const extras = additionalComponents({
    commissionFee,
    commissionRate,
    brokerageFee,
    brokerageRate,
    serviceFee,
    executionFee,
    executionRate
  });

  components.push(...extras);

  const additionalRevenue = money(
    extras.reduce(
      (total, component) => total + component.amount,
      0
    )
  );

  /*
    CUSTOMER CHARGE

    For BUY_AND_RESELL and SERVICE, the additional fees are
    charged on top of the base sale/service price.

    Example:

      BUY_AND_RESELL
      base sale = 550
      supplier cost = 500
      service fee = 10

      customer pays = 560
      supplier gets = 500
      Nawex revenue = 60

    This keeps the economics balanced.
  */

  const customerCharge = money(
    (model === "BUY_AND_RESELL" || model === "SERVICE")
      ? baseGross + additionalRevenue
      : baseGross
  );

  /*
    TOTAL NAWEX REVENUE
  */

  const nawexGrossRevenue = money(
    components.reduce(
      (total, component) =>
        total + component.amount,
      0
    )
  );

  if (nawexGrossRevenue > customerCharge) {
    throw new Error(
      "Total Nawex revenue cannot exceed customer charge"
    );
  }

  /*
    SUPPLIER / PROVIDER PAYOUT

    Commission / broker / execution models:
      remaining customer money goes to seller.

    Buy-and-resell:
      supplier receives the acquisition cost.

    Service:
      provider receives the agreed provider payout.
  */

  if (
    model === "COMMISSION" ||
    model === "BROKER" ||
    model === "EXECUTION_FEE"
  ) {
    supplierPayout = money(
      customerCharge - nawexGrossRevenue
    );
  }

  if (model === "BUY_AND_RESELL") {
    supplierPayout = supplierCost;
  }

  if (model === "SERVICE") {
    supplierPayout = requirePositiveAmount(
      providerPayout,
      "providerPayout"
    );
  }

  /*
    FINAL BALANCE GUARD

    Money allocated from the customer charge must never exceed
    the actual customer charge.
  */

  const allocated = money(
    supplierPayout + nawexGrossRevenue
  );

  if (allocated > customerCharge) {
    throw new Error(
      "Transaction allocation exceeds customer charge"
    );
  }

  const remaining = money(
    customerCharge - allocated
  );

  return {
    model,

    customerCharge,

    supplierCost,

    supplierPayout,

    nawexGrossRevenue,

    remaining,

    /*
      Backward-compatible fields.
    */

    grossAmount: customerCharge,

    purchasePrice: supplierCost,

    nawexRevenue: nawexGrossRevenue,

    sellerPayout: supplierPayout,

    rate: primaryRate,

    components
  };
}


/*
  CREATE TRANSACTION

  Offer acceptance and transaction creation happen
  inside ONE database transaction.

  This prevents:

    offer = accepted
    transaction = failed
*/

export function createTransaction({
  offerId,
  revenueModel,

  salePrice,

  purchasePrice = null,
  providerPayout = null,

  rate = null,
  fixedFee = 0,

  commissionRate = null,
  commissionFee = 0,

  brokerageRate = null,
  brokerageFee = 0,

  serviceFee = 0,

  executionRate = null,
  executionFee = 0
}) {
  const offer = db.prepare(`
    SELECT
      o.*,
      br.buyer_id,
      br.status AS request_status
    FROM offers o
    JOIN buyer_requests br
      ON br.id = o.request_id
    WHERE o.id = ?
  `).get(offerId);

  if (!offer) {
    const error = new Error(
      "Offer not found"
    );

    error.statusCode = 404;

    throw error;
  }

  if (offer.status !== "pending") {
    const error = new Error(
      `Offer cannot be accepted from status ${offer.status}`
    );

    error.statusCode = 409;

    throw error;
  }

  if (offer.request_status !== "open") {
    const error = new Error(
      `Buyer request cannot be converted from status ${offer.request_status}`
    );

    error.statusCode = 409;

    throw error;
  }

  const finalSalePrice =
    salePrice == null
      ? Number(offer.price)
      : Number(salePrice);

  /*
    Calculate BEFORE opening the DB transaction.
  */

  const revenue = calculateRevenue({
    model: revenueModel,

    grossAmount: finalSalePrice,

    purchasePrice,

    providerPayout,

    rate,

    fixedFee,

    commissionRate,
    commissionFee,

    brokerageRate,
    brokerageFee,

    serviceFee,

    executionRate,
    executionFee
  });

  /*
    Idempotency protection.
  */

  const existingTransaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE offer_id = ?
  `).get(offerId);

  if (existingTransaction) {
    const error = new Error(
      "This offer already has a transaction"
    );

    error.statusCode = 409;

    throw error;
  }

  const transactionId = id("txn");
  const orderId = id("ord");

  db.exec("BEGIN");

  try {
    /*
      Accept offer atomically.
    */

    const offerUpdate = db.prepare(`
      UPDATE offers
      SET status = 'accepted'
      WHERE id = ?
        AND status = 'pending'
    `).run(offerId);

    if (offerUpdate.changes !== 1) {
      throw new Error(
        "Offer was already changed by another operation"
      );
    }

    /*
      Create order.
    */

    db.prepare(`
      INSERT INTO orders
      (
        id,
        buyer_id,
        seller_id,
        offer_id,
        total,
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      orderId,
      offer.buyer_id,
      offer.seller_id,
      offer.id,
      revenue.customerCharge,
      offer.currency
    );

    /*
      Create transaction.
    */

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
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      transactionId,
      orderId,
      offer.buyer_id,
      offer.seller_id,
      offer.id,
      revenueModel,
      revenue.customerCharge,
      revenue.supplierCost,
      revenue.nawexGrossRevenue,
      revenue.supplierPayout,
      offer.currency
    );

    /*
      Store every Nawex revenue component separately.
    */

    for (const component of revenue.components) {
      db.prepare(`
        INSERT INTO revenue_lines
        (
          id,
          transaction_id,
          type,
          amount,
          currency
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id("rev"),
        transactionId,
        component.type,
        component.amount,
        offer.currency
      );
    }

    /*
      Supplier/provider payout.
    */

    if (revenue.supplierPayout > 0) {
      db.prepare(`
        INSERT INTO payouts
        (
          id,
          transaction_id,
          recipient_id,
          amount,
          currency,
          status
        )
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(
        id("pay"),
        transactionId,
        offer.seller_id,
        revenue.supplierPayout,
        offer.currency
      );
    }

    /*
      Convert buyer request.
    */

    db.prepare(`
      UPDATE buyer_requests
      SET status = 'converted'
      WHERE id = ?
        AND status = 'open'
    `).run(offer.request_id);

    db.exec("COMMIT");

    return {
      transactionId,

      orderId,

      offerId,

      buyerId: offer.buyer_id,

      sellerId: offer.seller_id,

      currency: offer.currency,

      transaction: {
        customerCharge:
          revenue.customerCharge,

        supplierCost:
          revenue.supplierCost,

        supplierPayout:
          revenue.supplierPayout,

        nawexGrossRevenue:
          revenue.nawexGrossRevenue,

        remaining:
          revenue.remaining
      },

      revenue
    };

  } catch (error) {
    db.exec("ROLLBACK");

    throw error;
  }
}
