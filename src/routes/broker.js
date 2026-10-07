import { Router } from "express";
import {
  addBrokerActivity,
  getBrokerActivities,
  closeBrokerDeal,
  cancelBrokerDeal
} from "../services/broker.js";

const router = Router();

/*
  ADD BROKER ACTIVITY

  Examples:
  MESSAGE
  QUOTE_REQUEST
  QUOTE_RECEIVED
  NEGOTIATION
  FOLLOW_UP
  PRICE_AGREED
  TERMS_AGREED
  NOTE
*/

router.post("/activities", (req, res) => {
  try {
    const activity = addBrokerActivity(req.body);

    res.status(201).json({
      activity
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

/*
  BROKER ACTIVITY HISTORY
*/

router.get("/requests/:requestId/activities", (req, res) => {
  try {
    const activities = getBrokerActivities(
      req.params.requestId,
      req.query.offerId || null
    );

    res.json({
      requestId: req.params.requestId,
      activities
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

/*
  CLOSE BROKER DEAL
*/

router.post("/requests/:requestId/offers/:offerId/close", (req, res) => {
  try {
    const result = closeBrokerDeal({
      requestId: req.params.requestId,
      offerId: req.params.offerId,
      actorType: req.body.actorType || "agent",
      actorId: req.body.actorId || null,
      message: req.body.message || "Brokerage deal closed"
    });

    res.json({
      ok: true,
      activity: result
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

/*
  CANCEL BROKER DEAL
*/

router.post("/requests/:requestId/offers/:offerId/cancel", (req, res) => {
  try {
    const result = cancelBrokerDeal({
      requestId: req.params.requestId,
      offerId: req.params.offerId,
      actorType: req.body.actorType || "agent",
      actorId: req.body.actorId || null,
      message: req.body.message || "Brokerage deal cancelled"
    });

    res.json({
      ok: true,
      activity: result
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      error: error.message
    });
  }
});

export default router;
