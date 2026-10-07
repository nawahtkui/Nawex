import { Router } from "express";
import { executeBuyerTask } from "../agents/buyerAgent.js";

const router = Router();

router.post("/request", (req, res) => {
const {
buyerId,
title,
description,
category,
budget,
currency
} = req.body;

if (!buyerId || !title || !description) {
return res.status(400).json({
error: "buyerId, title and description are required"
});
}

const result = executeBuyerTask({
buyerId,
title,
description,
category,
budget,
currency
});

res.status(201).json({
agent: "buyer-agent",
...result
});
});

export default router;
