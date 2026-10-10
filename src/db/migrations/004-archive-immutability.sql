-- Document versions are immutable after registration.
CREATE TRIGGER archive_document_versions_no_update
BEFORE UPDATE ON archive_document_versions
BEGIN
  SELECT RAISE(ABORT, 'Document versions are immutable');
END;

CREATE TRIGGER archive_document_versions_no_delete
BEFORE DELETE ON archive_document_versions
BEGIN
  SELECT RAISE(ABORT, 'Document versions cannot be deleted');
END;

-- Audit events are append-only through ordinary SQL operations.
CREATE TRIGGER archive_audit_events_no_update
BEFORE UPDATE ON archive_audit_events
BEGIN
  SELECT RAISE(ABORT, 'Audit events are immutable');
END;

CREATE TRIGGER archive_audit_events_no_delete
BEFORE DELETE ON archive_audit_events
BEGIN
  SELECT RAISE(ABORT, 'Audit events cannot be deleted');
END;
