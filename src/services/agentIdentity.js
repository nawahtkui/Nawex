import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPublicKey,
} from "node:crypto";

const ALGORITHM = "ed25519";

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export function generateAgentKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync(ALGORITHM);

  return {
    algorithm: ALGORITHM,
    publicKey: publicKey.export({
      type: "spki",
      format: "pem",
    }),
    privateKey: privateKey.export({
      type: "pkcs8",
      format: "pem",
    }),
  };
}

export function signAgentMessage(message, privateKeyPem) {
  requireString(message, "message");
  requireString(privateKeyPem, "privateKeyPem");

  const signature = cryptoSign(
    null,
    Buffer.from(message, "utf8"),
    privateKeyPem,
  );

  return signature.toString("base64url");
}

export function verifyAgentSignature(message, signature, publicKeyPem) {
  requireString(message, "message");
  requireString(signature, "signature");
  requireString(publicKeyPem, "publicKeyPem");

  try {
    const publicKey = createPublicKey(publicKeyPem);

    if (publicKey.asymmetricKeyType !== ALGORITHM) {
      return false;
    }

    const signatureBytes = Buffer.from(signature, "base64url");

    if (
      signatureBytes.length !== 64 ||
      signatureBytes.toString("base64url") !== signature
    ) {
      return false;
    }

    return cryptoVerify(
      null,
      Buffer.from(message, "utf8"),
      publicKey,
      signatureBytes,
    );
  } catch {
    return false;
  }
}

import { randomUUID } from "node:crypto";
import { db } from "../db/database.js";

function newIdentityId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

export function registerAgentIdentity({
  agentId,
  controllerType,
  controllerReference = null,
  publicKeyPem,
  actorReference = null,
}) {
  requireString(agentId, "agentId");
  requireString(publicKeyPem, "publicKeyPem");

  if (!["developer", "organization", "self"].includes(controllerType)) {
    throw new TypeError("Invalid controllerType");
  }

  if (
    controllerReference !== null &&
    typeof controllerReference !== "string"
  ) {
    throw new TypeError("controllerReference must be a string or null");
  }

  const keyObject = createPublicKey(publicKeyPem);
  if (keyObject.asymmetricKeyType !== ALGORITHM) {
    throw new TypeError("Public key must use Ed25519");
  }

  const canonicalPublicKey = keyObject.export({
    type: "spki",
    format: "pem",
  });

  const agent = db.prepare(
    "SELECT id FROM agents WHERE id = ? AND active = 1",
  ).get(agentId);

  if (!agent) {
    throw new Error("Agent not found or inactive");
  }

  const identityId = newIdentityId("identity");
  const keyId = newIdentityId("agentkey");
  const eventId = newIdentityId("identityevent");

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO agent_identities
        (id, agent_id, controller_type, controller_reference)
      VALUES (?, ?, ?, ?)
    `).run(identityId, agentId, controllerType, controllerReference);

    db.prepare(`
      INSERT INTO agent_identity_keys
        (id, agent_id, public_key, algorithm, key_status)
      VALUES (?, ?, ?, 'Ed25519', 'pending')
    `).run(keyId, agentId, canonicalPublicKey);

    db.prepare(`
      INSERT INTO agent_identity_events
        (id, agent_id, event_type, actor_reference, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      eventId,
      agentId,
      "identity_registered",
      actorReference,
      JSON.stringify({
        identityId,
        keyId,
        controllerType,
        keyAlgorithm: "Ed25519",
        identityStatus: "pending",
        keyStatus: "pending",
      }),
    );

    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }

  return {
    identityId,
    agentId,
    keyId,
    controllerType,
    identityStatus: "pending",
    keyStatus: "pending",
    algorithm: "Ed25519",
  };
}

export function getAgentIdentity(agentId) {
  requireString(agentId, "agentId");

  const identity = db.prepare(`
    SELECT id, agent_id, controller_type, controller_reference,
           identity_status, created_at, updated_at, revoked_at
    FROM agent_identities
    WHERE agent_id = ?
  `).get(agentId);

  if (!identity) return null;

  const keys = db.prepare(`
    SELECT id, algorithm, public_key, key_status, created_at, revoked_at
    FROM agent_identity_keys
    WHERE agent_id = ?
    ORDER BY created_at, id
  `).all(agentId);

  const events = db.prepare(`
    SELECT id, event_type, actor_reference, details_json, created_at
    FROM agent_identity_events
    WHERE agent_id = ?
    ORDER BY created_at, id
  `).all(agentId);

  return { ...identity, keys, events };
}
