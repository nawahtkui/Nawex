import { Router } from "express";
import { db } from "../db/database.js";
import { id, json } from "../utils.js";

const router = Router();

router.post("/tasks", (req, res) => {
const {
agent,
taskType,
input
} = req.body;

if (!agent || !taskType || input == null) {
return res.status(400).json({
error: "agent, taskType and input are required"
});
}

const taskId = id("task");

db.prepare(`
INSERT INTO agent_tasks
(id, agent, task_type, input)
VALUES (?, ?, ?, ?)
`).run(
taskId,
agent,
taskType,
json(input)
);

res.status(201).json({
id: taskId,
agent,
taskType,
status: "pending"
});
});

router.get("/tasks", (req, res) => {
res.json(
db.prepare(`
SELECT * FROM agent_tasks
ORDER BY created_at DESC
`).all()
);
});

export default router;
