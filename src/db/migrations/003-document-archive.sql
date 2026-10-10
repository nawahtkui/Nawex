-- Nawex document archive schema.
-- This migration creates metadata tables only.
-- It does not store files or implement encryption.

CREATE TABLE archive_documents (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  classification TEXT NOT NULL DEFAULT 'confidential'
    CHECK (classification IN (
      'internal', 'confidential', 'restricted'
    )),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review', 'verified', 'rejected',
      'expired', 'archived'
    )),
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_archive_documents_owner
  ON archive_documents(owner_user_id);

CREATE INDEX idx_archive_documents_type_status
  ON archive_documents(document_type, status);

CREATE TABLE archive_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  original_filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sha256_hex TEXT
    CHECK (sha256_hex IS NULL OR length(sha256_hex) = 64),
  storage_key TEXT UNIQUE,
  encryption_algorithm TEXT,
  encryption_key_id TEXT,
  uploaded_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (document_id, version_number),
  FOREIGN KEY (document_id) REFERENCES archive_documents(id),
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_archive_versions_document
  ON archive_document_versions(document_id, version_number);

CREATE TABLE archive_evidence_links (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN (
      'user', 'agent', 'opportunity', 'verification',
      'transaction', 'order', 'service_order',
      'fulfillment_task', 'buyer_request', 'shipment'
    )),
  entity_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES archive_documents(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_archive_evidence_entity
  ON archive_evidence_links(entity_type, entity_id);

CREATE INDEX idx_archive_evidence_document
  ON archive_evidence_links(document_id);

CREATE TABLE archive_verification_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_id TEXT,
  verification_type TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN (
      'pending', 'verified', 'failed', 'inconclusive'
    )),
  source_type TEXT,
  source_reference TEXT,
  claim TEXT NOT NULL,
  notes TEXT,
  verifier_user_id TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (document_id) REFERENCES archive_documents(id),
  FOREIGN KEY (version_id) REFERENCES archive_document_versions(id),
  FOREIGN KEY (verifier_user_id) REFERENCES users(id)
);

CREATE INDEX idx_archive_verification_document
  ON archive_verification_events(document_id, created_at);

CREATE INDEX idx_archive_verification_result
  ON archive_verification_events(result);

CREATE TABLE archive_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('success', 'denied', 'error')),
  request_id TEXT,
  details_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX idx_archive_audit_resource
  ON archive_audit_events(resource_type, resource_id, occurred_at);

CREATE INDEX idx_archive_audit_actor
  ON archive_audit_events(actor_user_id, occurred_at);

CREATE INDEX idx_archive_audit_outcome
  ON archive_audit_events(outcome, occurred_at);
