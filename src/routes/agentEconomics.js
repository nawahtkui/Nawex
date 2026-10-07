import { Router } from "express";

import {
  createAgent,
  attributeAgent,
  getTransactionAgentEconomics,
  reverseAgentAttribution
} from "../services/agentRevenue.js";

const router = Router();


router.post("/agents", (req, res) => {
  try {
    const agent = createAgent(req.body);

    res.status(201).json({
      ok: true,
      agent
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});


router.post("/transactions/:transactionId/agents", (req, res) => {
  try {
    const attribution = attributeAgent({
      transactionId: req.params.transactionId,
      ...req.body
    });

    res.status(201).json({
      ok: true,
      attribution
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});


router.get("/transactions/:transactionId/agents", (req, res) => {
  try {
    const economics =
      getTransactionAgentEconomics(
        req.params.transactionId
      );

    res.json({
      ok: true,
      ...economics
    });
  } catch (error) {
    res.status(404).json({
      ok: false,
      error: error.message
    });
  }
});


router.post("/attributions/:id/reverse", (req, res) => {
  try {
    const attribution =
      reverseAgentAttribution(req.params.id);

    res.json({
      ok: true,
      attribution
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});


export default router;
