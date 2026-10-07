import { db } from "../db/database.js";

export function createOffer({
requestId,
sellerId,
itemType,
itemId,
price,
currency = "USD",
message = ""
}) {
const id = `offer_${crypto.randomUUID()}`;

db.prepare(`
INSERT INTO offers
(id, request_id, seller_id, item_type, item_id, price, currency, message)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
id,
requestId,
sellerId,
itemType,
itemId,
price,
currency,
message
);

return db.prepare(`
SELECT * FROM offers WHERE id = ?
`).get(id);
}
