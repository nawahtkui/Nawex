import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";

const router = Router();

/*
  ORDER = COMMERCIAL ORDER ONLY

  Revenue is NOT calculated here.

  Official financial path:
  Order
    ↓
  Transaction
    ↓
  Revenue Lines
    ↓
  Payouts
*/

router.post("/", (req, res) => {
  const {
    buyerId,
    sellerId,
    offerId,
    total,
    currency = "USD"
  } = req.body;

  if (!buyerId || !sellerId || total == null) {
    return res.status(400).json({
      error: "buyerId, sellerId and total are required"
    });
  }

  const orderId = id("ord");

  db.prepare(`
    INSERT INTO orders
    (id, buyer_id, seller_id, offer_id, total, currency)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    buyerId,
    sellerId,
    offerId || null,
    Number(total),
    currency
  );

  res.status(201).json({
    order: db.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
    `).get(orderId),

    revenue: {
      status: "pending_transaction",
      message: "Revenue is calculated by the Revenue Engine when the offer is accepted."
    }
  });
});

router.get("/", (req, res) => {
  res.json(
    db.prepare(`
      SELECT
        o.*,
        b.name AS buyer_name,
        s.name AS seller_name
      FROM orders o
      JOIN users b
        ON b.id = o.buyer_id
      JOIN users s
        ON s.id = o.seller_id
      ORDER BY o.created_at DESC
    `).all()
  );
});

export default router;
