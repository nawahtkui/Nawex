import { Router } from "express";
import { db } from "../db/database.js";
import { id, json } from "../utils.js";
import { runRevenueTests } from "../agents/revenueTestAgent.js";
import { runCommercialTransactionTests } from "../agents/commercialTransactionTestAgent.js";
import { runAgentEconomicsTests } from "../agents/agentEconomicsTestAgent.js";

const router = Router();


/*
  CREATE AGENT TASK
*/

router.post("/tasks", (req, res) => {

  const {
    agent,
    taskType,
    input
  } = req.body;

  if (!agent || !taskType || input == null) {

    return res.status(400).json({
      error:
        "agent, taskType and input are required"
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


/*
  LIST AGENT TASKS
*/

router.get("/tasks", (req, res) => {

  res.json(
    db.prepare(`
      SELECT *
      FROM agent_tasks
      ORDER BY created_at DESC
    `).all()
  );

});


/*
  REVENUE TEST AGENT

  Executes the real Revenue Engine
  and checks the resulting database
  records and economic balance.
*/

router.post("/test-revenue", (req, res) => {

  try {

    const result =
      runRevenueTests();

    res.status(
      result.summary.overall === "PASS"
        ? 200
        : 422
    ).json(result);

  } catch (error) {

    console.error(
      "REVENUE TEST AGENT ERROR:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }

});


/*
  COMMERCIAL TRANSACTION TEST AGENT

  Tests the real Revenue Engine,
  Transaction Lifecycle,
  Payout Lifecycle,
  idempotency and financial integrity.
*/

router.post("/test-commercial", (req, res) => {

  try {

    const result =
      runCommercialTransactionTests();

    res.status(
      result.summary.overall === "PASS"
        ? 200
        : 422
    ).json(result);

  } catch (error) {

    console.error(
      "COMMERCIAL TRANSACTION TEST AGENT ERROR:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }

});





/*
  AGENT ECONOMICS TEST

  Tests:
  - Value Pool
  - Attribution
  - Multi Agent Revenue Sharing
*/

router.post("/test-economics", (req, res) => {

  try {

    const result =
      runAgentEconomicsTests();

    res.status(
      result.summary.overall === "PASS"
        ? 200
        : 422
    ).json(result);

  } catch(error) {

    res.status(500).json({
      error: error.message
    });

  }

});


export default router;
