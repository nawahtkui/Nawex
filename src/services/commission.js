import { db } from "../db/database.js";
import { id } from "../utils.js";

export function createCommission(orderId, total, rate = 0.10) {
const amount = Number((total * rate).toFixed(2));

db.prepare(`
INSERT INTO commissions
(id, order_id, rate, amount)
VALUES (?, ?, ?, ?)
`).run(id("com"), orderId, rate, amount);

return {
rate,
amount
};
}
