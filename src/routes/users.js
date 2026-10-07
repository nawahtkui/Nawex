import { Router } from "express";
import { db } from "../db/database.js";
import { id } from "../utils.js";

const router = Router();

router.post("/", (req, res) => {
const { type, name, email } = req.body;

if (!type || !name) {
return res.status(400).json({
error: "type and name are required"
});
}

if (
![
"buyer",
"supplier",
"service_provider",
"admin"
].includes(type)
) {
return res.status(400).json({
error: "invalid user type"
});
}

const userId = id("usr");

db.prepare(`
INSERT INTO users (id, type, name, email)
VALUES (?, ?, ?, ?)
`).run(userId, type, name, email || null);

res.status(201).json(
db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId)
);
});

router.get("/", (req, res) => {
const type = req.query.type;

const users = type
? db.prepare(`SELECT * FROM users WHERE type = ?`).all(type)
: db.prepare(`SELECT * FROM users`).all();

res.json(users);
});

export default router;
