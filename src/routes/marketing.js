import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";

const router = Router();

router.post("/campaigns", (req, res) => {
const {
ownerId,
name,
objective,
budget,
currency = "USD"
} = req.body;

if (!ownerId || !name || !objective) {
return res.status(400).json({
error: "ownerId, name and objective are required"
});
}

const campaignId = id("cmp");

db.prepare(`
INSERT INTO campaigns
(id, owner_id, name, objective, budget, currency)
VALUES (?, ?, ?, ?, ?, ?)
`).run(
campaignId,
ownerId,
name,
objective,
budget ?? null,
currency
);

res.status(201).json(
db.prepare(`
SELECT * FROM campaigns WHERE id = ?
`).get(campaignId)
);
});

router.get("/campaigns", (req, res) => {
res.json(
db.prepare(`
SELECT
c.*,
u.name AS owner_name
FROM campaigns c
JOIN users u ON u.id = c.owner_id
ORDER BY c.created_at DESC
`).all()
);
});

export default router;
