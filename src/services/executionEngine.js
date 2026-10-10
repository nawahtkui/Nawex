import { db } from "../db/database.js";
import { id } from "../utils.js";

const EXECUTABLE_STATUSES = [
  "qualified"
];

export function evaluateExecution(opportunity) {
  if (!EXECUTABLE_STATUSES.includes(opportunity.status)) {
    return {
      executable: false,
      reason: "Opportunity is not ready"
    };
  }

  if (!opportunity.estimated_value) {
    return {
      executable: false,
      reason: "Missing value"
    };
  }

  return {
    executable: true,
    reason: "Ready for execution"
  };
}

export function createServiceOrder({
  opportunity,
  agentId,
  orderType = "SERVICE",
  providerId = null
}) {
  const decision = evaluateExecution(opportunity);

  if (!decision.executable) {
    throw new Error(decision.reason);
  }

  const orderId = id("order");

  db.prepare(`
    INSERT INTO service_orders
    (
      id,
      opportunity_id,
      agent_id,
      order_type,
      title,
      description,
      amount,
      currency,
      provider_id
    )
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    orderId,
    opportunity.id,
    agentId,
    orderType,
    opportunity.title,
    opportunity.description,
    opportunity.estimated_value,
    opportunity.currency,
    providerId
  );

  return db.prepare(`
    SELECT *
    FROM service_orders
    WHERE id=?
  `).get(orderId);
}

export async function executeServiceOrder({
  orderId,
  provider
}) {
  if (!provider) {
    throw new Error("Provider is required");
  }

  const order = db.prepare(`
    SELECT *
    FROM service_orders
    WHERE id=?
  `).get(orderId);

  if (!order) {
    throw new Error(
      `Service order '${orderId}' not found`
    );
  }

  if (order.status !== "created") {
    throw new Error(
      `Service order '${orderId}' is not executable`
    );
  }

  const result =
    await provider.createOrder({
      orderId: order.id,
      opportunityId: order.opportunity_id,
      agentId: order.agent_id,
      orderType: order.order_type,
      title: order.title,
      description: order.description,
      amount: order.amount,
      currency: order.currency
    });

  const externalOrderId =
    result.externalReference ||
    result.externalOrderId ||
    result.orderId ||
    null;

  if (!externalOrderId) {
    throw new Error(
      "Provider did not return an external order id"
    );
  }

  db.prepare(`
    UPDATE service_orders
    SET
      status=?,
      provider_id=?,
      external_order_id=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    result.status || "submitted",
    provider.name,
    externalOrderId,
    order.id
  );

  return db.prepare(`
    SELECT *
    FROM service_orders
    WHERE id=?
  `).get(order.id);
}
