import { db } from "../db/database.js";
import { id } from "../utils.js";

const ACTIVITY_TYPES = new Set([
  "MESSAGE",
  "QUOTE_REQUEST",
  "QUOTE_RECEIVED",
  "NEGOTIATION",
  "FOLLOW_UP",
  "PRICE_AGREED",
  "TERMS_AGREED",
  "DEAL_CLOSED",
  "DEAL_CANCELLED",
  "NOTE"
]);

function getRequest(requestId) {
  const request = db.prepare(`
    SELECT *
    FROM buyer_requests
    WHERE id = ?
  `).get(requestId);

  if (!request) {
    throw new Error("Buyer request not found");
  }

  return request;
}

function getOffer(offerId) {
  if (!offerId) return null;

  const offer = db.prepare(`
    SELECT *
    FROM offers
    WHERE id = ?
  `).get(offerId);

  if (!offer) {
    throw new Error("Offer not found");
  }

  return offer;
}

export function addBrokerActivity({
  requestId,
  offerId = null,
  actorType = "agent",
  actorId = null,
  activityType,
  message = "",
  status = "open"
}) {
  getRequest(requestId);
  getOffer(offerId);

  const type = String(activityType || "").toUpperCase();

  if (!ACTIVITY_TYPES.has(type)) {
    throw new Error(`Unsupported broker activity type: ${type}`);
  }

  const activityId = id("brk");

  db.prepare(`
    INSERT INTO broker_activities
    (
      id,
      request_id,
      offer_id,
      actor_type,
      actor_id,
      activity_type,
      message,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    activityId,
    requestId,
    offerId,
    actorType,
    actorId,
    type,
    message,
    status
  );

  return db.prepare(`
    SELECT *
    FROM broker_activities
    WHERE id = ?
  `).get(activityId);
}

export function getBrokerActivities(requestId, offerId = null) {
  getRequest(requestId);

  if (offerId) {
    getOffer(offerId);
  }

  if (offerId) {
    return db.prepare(`
      SELECT *
      FROM broker_activities
      WHERE request_id = ?
        AND offer_id = ?
      ORDER BY created_at ASC
    `).all(requestId, offerId);
  }

  return db.prepare(`
    SELECT *
    FROM broker_activities
    WHERE request_id = ?
    ORDER BY created_at ASC
  `).all(requestId);
}

export function closeBrokerDeal({
  requestId,
  offerId,
  actorType = "agent",
  actorId = null,
  message = "Brokerage deal closed"
}) {
  const offer = getOffer(offerId);

  if (!offer || offer.request_id !== requestId) {
    throw new Error("Offer does not belong to request");
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE offers
      SET status = 'accepted'
      WHERE id = ?
        AND status = 'pending'
    `).run(offerId);

    return addBrokerActivity({
      requestId,
      offerId,
      actorType,
      actorId,
      activityType: "DEAL_CLOSED",
      message,
      status: "closed"
    });
  });

  return tx();
}

export function cancelBrokerDeal({
  requestId,
  offerId,
  actorType = "agent",
  actorId = null,
  message = "Brokerage deal cancelled"
}) {
  getOffer(offerId);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE offers
      SET status = 'cancelled'
      WHERE id = ?
    `).run(offerId);

    return addBrokerActivity({
      requestId,
      offerId,
      actorType,
      actorId,
      activityType: "DEAL_CANCELLED",
      message,
      status: "cancelled"
    });
  });

  return tx();
}
