import express from "express";
import { db } from "../db/database.js";
import { createTransaction } from "../services/revenueEngine.js";

const router = express.Router();


/*
  ACCEPT OFFER + CREATE TRANSACTION

  Revenue Engine now handles the entire operation
  atomically.
*/

router.post("/offers/:offerId/accept", (req, res) => {

  try {

    const {
      revenueModel = "COMMISSION",

      salePrice,

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
    } = req.body;


    const transaction = createTransaction({

      offerId: req.params.offerId,

      revenueModel:
        String(revenueModel).toUpperCase(),

      salePrice,

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


    return res
      .status(201)
      .json(transaction);


  } catch (error) {

    console.error(
      "TRANSACTION ERROR:",
      error
    );


    return res
      .status(error.statusCode || 400)
      .json({
        error: error.message
      });
  }
});


/*
  LIST TRANSACTIONS
*/

router.get("/", (req, res) => {

  const rows = db.prepare(`
    SELECT
      t.*,
      p.status AS payout_status
    FROM transactions t
    LEFT JOIN payouts p
      ON p.transaction_id = t.id
    ORDER BY t.created_at DESC
  `).all();


  res.json(rows);
});


/*
  TRANSACTION DETAIL
*/

router.get("/:id", (req, res) => {

  const transaction = db.prepare(`
    SELECT *
    FROM transactions
    WHERE id = ?
  `).get(req.params.id);


  if (!transaction) {

    return res.status(404).json({
      error: "Transaction not found"
    });
  }


  const revenue = db.prepare(`
    SELECT *
    FROM revenue_lines
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);


  const payouts = db.prepare(`
    SELECT *
    FROM payouts
    WHERE transaction_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);


  res.json({

    transaction,

    revenue,

    payouts
  });
});


export default router;
