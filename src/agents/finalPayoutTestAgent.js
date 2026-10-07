import {
  calculateFinalAgentPayout
} from "../services/finalPayoutEngine.js";

export function runFinalPayoutTests() {
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
    Agent B

    Agent Pool:
      70

    Attribution:
      40%

    Earned:
      70 × 40% = 28

    Performance:
      95%

    Final:
      28 × 95% = 26.60

    Retention:
      28 - 26.60 = 1.40
  */

  const result =
    calculateFinalAgentPayout({
      transactionId: "txn_test_001",
      agentId: "agent_b",
      role: "NEGOTIATOR",
      earnedAmount: 28,
      performanceScore: 95,
      milestoneType: "COMPLEX"
    });

  test(
    "Earned amount = 28",
    result.earnedAmount,
    28
  );

  test(
    "Performance multiplier = 0.95",
    result.performanceMultiplier,
    0.95
  );

  test(
    "Final payout = 26.60",
    result.finalPayout,
    26.60
  );

  test(
    "performanceRetention = 1.40",
    result.performanceRetention,
    1.40
  );

  test(
    "Signing milestone = 7.98",
    result.milestones[0].amount,
    7.98
  );

  test(
    "Midpoint milestone = 10.64",
    result.milestones[1].amount,
    10.64
  );

  test(
    "Completion milestone = 7.98",
    result.milestones[2].amount,
    7.98
  );

  test(
    "Milestones total = 26.60",
    result.milestones.reduce(
      (sum, milestone) =>
        sum + milestone.amount,
      0
    ),
    26.60
  );

  test(
    "Agent allocation preserved = 28",
    result.totalAgentAllocation,
    28
  );

  test(
    "Financial allocation valid",
    result.valid,
    true
  );

  /*
    Perfect performance:
    No retention.
  */

  const perfect =
    calculateFinalAgentPayout({
      transactionId: "txn_test_002",
      agentId: "agent_a",
      role: "DISCOVERER",
      earnedAmount: 21,
      performanceScore: 100,
      milestoneType: "SIMPLE"
    });

  test(
    "Score 100 => final payout 21",
    perfect.finalPayout,
    21
  );

  test(
    "Score 100 => retention 0",
    perfect.performanceRetention,
    0
  );

  test(
    "Score 100 => allocation valid",
    perfect.valid,
    true
  );

  /*
    Blocked agent:
    Entire earned amount retained.
  */

  const blocked =
    calculateFinalAgentPayout({
      transactionId: "txn_test_003",
      agentId: "agent_c",
      role: "EXECUTOR",
      earnedAmount: 21,
      performanceScore: 39,
      milestoneType: "SIMPLE"
    });

  test(
    "Score 39 => final payout 0",
    blocked.finalPayout,
    0
  );

  test(
    "Score 39 => retention 21",
    blocked.performanceRetention,
    21
  );

  test(
    "Score 39 => allocation preserved",
    blocked.totalAgentAllocation,
    21
  );

  test(
    "Score 39 => valid",
    blocked.valid,
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
