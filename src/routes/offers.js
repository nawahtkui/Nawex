import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";

const router = Router();

router.post("/", (req, res) => {
const {
requestId,
sellerId,
itemType,
itemId,
price,
currency = "USD",
message = ""
} = req.body;

if (
!requestId ||
!sellerId ||
!itemType ||
!itemId ||
price == null
) {
return res.status(400).json({
error: "missing offer fields"
});
}

const offerId = id("off");

db.prepare(`
INSERT INTO offers
(id, request_id, seller_id, item_type, item_id, price, currency, message)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
offerId,
requestId,
sellerId,
itemType,
itemId,
price,
currency,
message
);

res.status(201).json(
db.prepare(`SELECT * FROM offers WHERE id = ?`).get(offerId)
);
});

router.get("/:requestId", (req, res) => {
res.json(
db.prepare(`
SELECT
o.*,
u.name AS seller_name
FROM offers o
JOIN users u ON u.id = o.seller_id
WHERE o.request_id = ?
ORDER BY o.price ASC
`).all(req.params.requestId)
);
});

export default router;
