import {
  createServiceOrder,
  executeServiceOrder
} from "../services/executionEngine.js";

import {
  createFulfillmentTask,
  completeTask
} from "../services/fulfillmentEngine.js";

import { db } from "../db/database.js";

import {
  DemoMarketProvider
} from "../providers/demoMarketProvider.js";


const opportunity =
  db.prepare(`
    SELECT *
    FROM agent_opportunities
    WHERE status='qualified'
    ORDER BY created_at DESC
    LIMIT 1
  `).get();


if (!opportunity) {
  throw new Error("No qualified opportunity found");
}


const provider =
  new DemoMarketProvider();


const order =
  createServiceOrder({
    opportunity,
    agentId: opportunity.agent_id,
    providerId: provider.name
  });


const executedOrder =
  await executeServiceOrder({
    orderId: order.id,
    provider
  });


const task =
  createFulfillmentTask({
    orderId: executedOrder.id,
    providerId: provider.name,
    taskType: "execution"
  });


const providerStatus =
  await provider.getOrderStatus(
    executedOrder.external_order_id
  );


const completedTask =
  completeTask(
    task.id,
    providerStatus
  );


console.log(
  JSON.stringify(
    {
      status: "PASS",
      provider: provider.name,

      opportunity: {
        id: opportunity.id,
        status: opportunity.status,
        title: opportunity.title
      },

      order: executedOrder,
      fulfillment: completedTask,
      providerStatus
    },
    null,
    2
  )
);
