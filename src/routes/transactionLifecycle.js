import { Router } from "express";

import {
  markPaymentPending,
  markPaid,
  markFulfillmentPending,
  markFulfilled,
  markCompleted,
  cancelTransaction,
  markFailed,
  requestRefund,
  markRefunded,
  startPayout,
  completePayout,
  failPayout,
  retryPayout,
  cancelPayout,
  getTransactionLifecycle
} from "../services/transactionLifecycle.js";

import {
  startAgentPayout,
  completeAgentPayout,
  failAgentPayout,
  retryAgentPayout,
  cancelAgentPayout,
  getAgentPayout,
  getAgentPayoutsForTransaction
} from "../services/agentPayoutLifecycle.js";

const router = Router();

function action(fn) {
  return (req, res) => {
    try {
      const result = fn(req.params.id);

      res.json({
        ok: true,
        ...result
      });

    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  };
}

router.get("/:id/lifecycle", (req, res) => {
  try {
    res.json(
      getTransactionLifecycle(req.params.id)
    );
  } catch (error) {
    res.status(404).json({
      error: error.message
    });
  }
});

router.post(
  "/:id/payment-pending",
  action(markPaymentPending)
);

router.post(
  "/:id/paid",
  action(markPaid)
);

router.post(
  "/:id/fulfillment-pending",
  action(markFulfillmentPending)
);

router.post(
  "/:id/fulfilled",
  action(markFulfilled)
);

router.post(
  "/:id/completed",
  action(markCompleted)
);

router.post(
  "/:id/cancel",
  action(cancelTransaction)
);

router.post(
  "/:id/failed",
  action(markFailed)
);

router.post(
  "/:id/refund",
  action(requestRefund)
);

router.post(
  "/:id/refunded",
  action(markRefunded)
);

router.post(
  "/payout/:id/processing",
  action(startPayout)
);

router.post(
  "/payout/:id/paid",
  action(completePayout)
);

router.post(
  "/payout/:id/failed",
  action(failPayout)
);

router.post(
  "/payout/:id/retry",
  action(retryPayout)
);

router.post(
  "/payout/:id/cancel",
  action(cancelPayout)
);

router.post(
  "/agent-payout/:id/processing",
  action(startAgentPayout)
);

router.post(
  "/agent-payout/:id/paid",
  action(completeAgentPayout)
);

router.post(
  "/agent-payout/:id/failed",
  action(failAgentPayout)
);

router.post(
  "/agent-payout/:id/retry",
  action(retryAgentPayout)
);

router.post(
  "/agent-payout/:id/cancel",
  action(cancelAgentPayout)
);

router.get(
  "/agent-payout/:id",
  (req, res) => {
    try {
      res.json({
        ok: true,
        payout: getAgentPayout(req.params.id)
      });
    } catch (error) {
      res.status(404).json({
        ok: false,
        error: error.message
      });
    }
  }
);

router.get(
  "/:id/agent-payouts",
  (req, res) => {
    try {
      res.json({
        ok: true,
        transaction_id: req.params.id,
        payouts:
          getAgentPayoutsForTransaction(
            req.params.id
          )
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

export default router;
