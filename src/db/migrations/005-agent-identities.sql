-- Agent identity foundation.
-- Identity registration does not imply verification or economic permission.

CREATE TABLE agent_identities (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  controller_type TEXT NOT NULL
    CHECK (controller_type IN ('developer', 'organization', 'self')),
  controller_reference TEXT,
  identity_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending', 'verified', 'suspended', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE TABLE agent_identity_keys (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  algorithm TEXT NOT NULL DEFAULT 'Ed25519'
    CHECK (algorithm = 'Ed25519'),
  key_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (key_status IN ('pending', 'active', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE INDEX idx_agent_identity_keys_agent
  ON agent_identity_keys(agent_id);

CREATE TABLE agent_identity_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_reference TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE INDEX idx_agent_identity_events_agent_time
  ON agent_identity_events(agent_id, created_at);

CREATE TRIGGER agent_identity_events_no_update
BEFORE UPDATE ON agent_identity_events
BEGIN
  SELECT RAISE(ABORT, 'Agent identity events are immutable');
END;

CREATE TRIGGER agent_identity_events_no_delete
BEFORE DELETE ON agent_identity_events
BEGIN
  SELECT RAISE(ABORT, 'Agent identity events cannot be deleted');
END;
