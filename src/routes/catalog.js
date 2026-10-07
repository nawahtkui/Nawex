import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";

const router = Router();

router.post("/products", (req, res) => {
const {
supplierId,
name,
description,
category,
price,
currency = "USD",
stock
} = req.body;

if (!supplierId || !name || !category) {
return res.status(400).json({
error: "supplierId, name and category are required"
});
}

const productId = id("prd");

db.prepare(`
INSERT INTO products
(id, supplier_id, name, description, category, price, currency, stock)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
productId,
supplierId,
name,
description || "",
category,
price ?? null,
currency,
stock ?? null
);

res.status(201).json(
db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId)
);
});

router.post("/services", (req, res) => {
const {
providerId,
name,
description,
category,
price,
currency = "USD"
} = req.body;

if (!providerId || !name || !category) {
return res.status(400).json({
error: "providerId, name and category are required"
});
}

const serviceId = id("svc");

db.prepare(`
INSERT INTO services
(id, provider_id, name, description, category, price, currency)
VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
serviceId,
providerId,
name,
description || "",
category,
price ?? null,
currency
);

res.status(201).json(
db.prepare(`SELECT * FROM services WHERE id = ?`).get(serviceId)
);
});

router.get("/products", (req, res) => {
res.json(db.prepare(`
SELECT
p.*,
u.name AS supplier_name
FROM products p
JOIN users u ON u.id = p.supplier_id
WHERE p.status = 'active'
ORDER BY p.created_at DESC
`).all());
});

router.get("/services", (req, res) => {
res.json(db.prepare(`
SELECT
s.*,
u.name AS provider_name
FROM services s
JOIN users u ON u.id = s.provider_id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
`).all());
});

export default router;
