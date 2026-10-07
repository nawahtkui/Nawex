import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";
import { createCommission } from "../services/commission.js";

const router = Router();

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

const tx = db.transaction(() => {
db.prepare(`
INSERT INTO orders
(id, buyer_id, seller_id, offer_id, total, currency)
VALUES (?, ?, ?, ?, ?, ?)
`).run(
orderId,
buyerId,
sellerId,
offerId || null,
total,
currency
);

createCommission(orderId, Number(total), 0.10);
});

tx();

res.status(201).json({
order: db.prepare(`
SELECT * FROM orders WHERE id = ?
`).get(orderId),

commission: db.prepare(`
SELECT * FROM commissions WHERE order_id = ?
`).get(orderId)
});
});

router.get("/", (req, res) => {
res.json(db.prepare(`
SELECT
o.*,
b.name AS buyer_name,
s.name AS seller_name,
c.amount AS nawex_commission
FROM orders o
JOIN users b ON b.id = o.buyer_id
JOIN users s ON s.id = o.seller_id
LEFT JOIN commissions c ON c.order_id = o.id
ORDER BY o.created_at DESC
`).all());
});

export default router;
