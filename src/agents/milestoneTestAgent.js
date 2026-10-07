import {
  getMilestoneRules,
  validateMilestoneRules,
  calculateMilestonePayouts
} from "../services/milestoneEngine.js";

export function runMilestoneTests() {
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
    SIMPLE
    100% on completion
  */

  const simple =
    calculateMilestonePayouts({
      earnedAmount: 26.60,
      type: "SIMPLE"
    });

  test(
    "SIMPLE => one milestone",
    simple.payouts.length,
    1
  );

  test(
    "SIMPLE => completion 100%",
    simple.payouts[0].percentage,
    1
  );

  test(
    "SIMPLE => payout 26.60",
    simple.payouts[0].amount,
    26.60
  );

  test(
    "SIMPLE => total allocation 26.60",
    simple.totalAllocated,
    26.60
  );

  test(
    "SIMPLE => valid",
    simple.valid,
    true
  );

  /*
    COMPLEX
    30% signing
    40% midpoint
    30% completion
  */

  const complex =
    calculateMilestonePayouts({
      earnedAmount: 26.60,
      type: "COMPLEX"
    });

  test(
    "COMPLEX => three milestones",
    complex.payouts.length,
    3
  );

  test(
    "COMPLEX => signing 30%",
    complex.payouts[0].percentage,
    0.30
  );

  test(
    "COMPLEX => signing payout 7.98",
    complex.payouts[0].amount,
    7.98
  );

  test(
    "COMPLEX => midpoint 40%",
    complex.payouts[1].percentage,
    0.40
  );

  test(
    "COMPLEX => midpoint payout 10.64",
    complex.payouts[1].amount,
    10.64
  );

  test(
    "COMPLEX => completion 30%",
    complex.payouts[2].percentage,
    0.30
  );

  test(
    "COMPLEX => completion payout 7.98",
    complex.payouts[2].amount,
    7.98
  );

  test(
    "COMPLEX => total allocation 26.60",
    complex.totalAllocated,
    26.60
  );

  test(
    "COMPLEX => valid",
    complex.valid,
    true
  );

  /*
    Rule validation
  */

  const simpleRules =
    validateMilestoneRules("SIMPLE");

  test(
    "SIMPLE rules sum to 100%",
    simpleRules.totalPercentage,
    1
  );

  test(
    "SIMPLE rules valid",
    simpleRules.valid,
    true
  );

  const complexRules =
    validateMilestoneRules("COMPLEX");

  test(
    "COMPLEX rules sum to 100%",
    complexRules.totalPercentage,
    1
  );

  test(
    "COMPLEX rules valid",
    complexRules.valid,
    true
  );

  /*
    Invalid type
  */

  let invalidTypeRejected = false;

  try {
    getMilestoneRules("INVALID");
  } catch(error) {
    invalidTypeRejected =
      error.message ===
      "Unsupported milestone type: INVALID";
  }

  test(
    "Reject invalid milestone type",
    invalidTypeRejected,
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
