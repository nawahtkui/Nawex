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

export default router;
