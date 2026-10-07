import {
  createAgentLedgerEntry,
  validateAgentLedgerEntry
} from "../services/agentLedger.js";

export function runAgentLedgerTests() {
  const tests = [];

  function test(name, actual, expected) {
    tests.push({
      name,
      status:
        actual === expected
          ? "PASS"
          : "FAIL",
      expected,
      actual
    });
  }

  /*
    Normal performance case

    Earned:
      28

    Agent payout:
      26.60

    Retention:
      1.40

    Carry:
      0
  */

  const normal =
    createAgentLedgerEntry({
      transactionId: "txn_ledger_001",
      agentId: "agent_b",
      role: "NEGOTIATOR",
      earnedAmount: 28,
      finalPayout: 26.60,
      performanceRetention: 1.40,
      carryForward: 0,
      status: "PENDING"
    });

  test(
    "Normal ledger => earned 28",
    normal.earnedAmount,
    28
  );

  test(
    "Normal ledger => payout 26.60",
    normal.finalPayout,
    26.60
  );

  test(
    "Normal ledger => retention 1.40",
    normal.performanceRetention,
    1.40
  );

  test(
    "Normal ledger => carry 0",
    normal.carryForward,
    0
  );

  test(
    "Normal ledger => balanced",
    normal.balanced,
    true
  );

  test(
    "Normal ledger => accounted 28",
    normal.accountedAmount,
    28
  );

  /*
    Carry-forward case

    Earned:
      5.70

    Payout:
      0

    Carry:
      5.70
  */

  const carry =
    createAgentLedgerEntry({
      transactionId: "txn_ledger_002",
      agentId: "agent_a",
      role: "DISCOVERER",
      earnedAmount: 5.70,
      finalPayout: 0,
      performanceRetention: 0,
      carryForward: 5.70,
      status: "CARRY_FORWARD"
    });

  test(
    "Carry ledger => payout 0",
    carry.finalPayout,
    0
  );

  test(
    "Carry ledger => carry 5.70",
    carry.carryForward,
    5.70
  );

  test(
    "Carry ledger => balanced",
    carry.balanced,
    true
  );

  /*
    Performance retention case
  */

  const retained =
    createAgentLedgerEntry({
      transactionId: "txn_ledger_003",
      agentId: "agent_c",
      role: "EXECUTOR",
      earnedAmount: 21,
      finalPayout: 0,
      performanceRetention: 21,
      carryForward: 0,
      status: "BLOCKED"
    });

  test(
    "Blocked ledger => payout 0",
    retained.finalPayout,
    0
  );

  test(
    "Blocked ledger => retention 21",
    retained.performanceRetention,
    21
  );

  test(
    "Blocked ledger => balanced",
    retained.balanced,
    true
  );

  /*
    Validation
  */

  const validation =
    validateAgentLedgerEntry(normal);

  test(
    "Validation => difference 0",
    validation.difference,
    0
  );

  test(
    "Validation => balanced true",
    validation.balanced,
    true
  );

  /*
    Reject unbalanced ledger
  */

  let unbalancedRejected = false;

  try {
    createAgentLedgerEntry({
      transactionId: "txn_bad",
      agentId: "agent_bad",
      role: "TEST",
      earnedAmount: 28,
      finalPayout: 26,
      performanceRetention: 1,
      carryForward: 0
    });
  } catch(error) {
    unbalancedRejected =
      error.message ===
      "Ledger amounts do not balance";
  }

  test(
    "Reject unbalanced ledger",
    unbalancedRejected,
    true
  );

  /*
    Reject negative values
  */

  let negativeRejected = false;

  try {
    createAgentLedgerEntry({
      transactionId: "txn_negative",
      agentId: "agent_bad",
      role: "TEST",
      earnedAmount: -1,
      finalPayout: 0
    });
  } catch(error) {
    negativeRejected =
      error.message ===
      "earnedAmount cannot be negative";
  }

  test(
    "Reject negative earned amount",
    negativeRejected,
    true
  );

  return {
    tests,
    summary: {
      total: tests.length,
      passed:
        tests.filter(
          test => test.status === "PASS"
        ).length,
      failed:
        tests.filter(
          test => test.status === "FAIL"
        ).length,
      overall:
        tests.every(
          test => test.status === "PASS"
        )
        ? "PASS"
        : "FAIL"
    }
  };
}
