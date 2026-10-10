export const EVIDENCE_RESULT = Object.freeze({
  PENDING: "pending",
  VERIFIED: "verified",
  FAILED: "failed",
  INCONCLUSIVE: "inconclusive",
});

export function createEvidence({
  subject,
  claim,
  sourceType = "unknown",
  sourceUrl = null,
  evidence = null,
  result = EVIDENCE_RESULT.PENDING,
  confidence = 0,
  metadata = {},
}) {
  if (!subject) throw new Error("Evidence subject is required");
  if (!claim) throw new Error("Evidence claim is required");

  if (confidence < 0 || confidence > 1) {
    throw new Error("Evidence confidence must be between 0 and 1");
  }

  return {
    id: crypto.randomUUID(),
    subject,
    claim,
    sourceType,
    sourceUrl,
    evidence,
    result,
    confidence,
    metadata,
    createdAt: new Date().toISOString(),
    verifiedAt:
      result === EVIDENCE_RESULT.VERIFIED
        ? new Date().toISOString()
        : null,
  };
}

export function calculateConfidence(evidenceList = []) {
  if (!evidenceList.length) return 0;

  const verified = evidenceList.filter(
    (item) => item.result === EVIDENCE_RESULT.VERIFIED
  );

  if (!verified.length) return 0;

  return Math.min(
    1,
    verified.reduce((sum, item) => sum + Number(item.confidence || 0), 0) /
      evidenceList.length
  );
}
