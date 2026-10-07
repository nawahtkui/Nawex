import {
  getMinimumPayout,
  evaluatePayoutThreshold
} from "../services/payoutThresholdEngine.js";

export function runPayoutThresholdTests() {
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
    Exact minimum
  */

  test(
    "Minimum payout = 10",
    getMinimumPayout(),
    10
  );

  const exact =
    evaluatePayoutThreshold({
      currentEarning: 10
    });

  test(
    "$10.00 => PAYABLE",
    exact.status,
    "PAYABLE"
  );

  test(
    "$10.00 => payout 10",
    exact.payoutAmount,
    10
  );

  test(
    "$10.00 => carry forward 0",
    exact.carryForward,
    0
  );

  /*
    Below threshold
  */

  const below =
    evaluatePayoutThreshold({
      currentEarning: 9.99
    });

  test(
    "$9.99 => CARRY_FORWARD",
    below.status,
    "CARRY_FORWARD"
  );

  test(
    "$9.99 => payout 0",
    below.payoutAmount,
    0
  );

  test(
    "$9.99 => carry forward 9.99",
    below.carryForward,
    9.99
  );

  /*
    Carry forward reaches threshold
  */

  const accumulated =
    evaluatePayoutThreshold({
      currentEarning: 0.01,
      carryForward: 9.99
    });

  test(
    "$9.99 + $0.01 => PAYABLE",
    accumulated.status,
    "PAYABLE"
  );

  test(
    "Accumulated balance => payout 10",
    accumulated.payoutAmount,
    10
  );

  test(
    "Accumulated balance => carry forward 0",
    accumulated.carryForward,
    0
  );

  /*
    Carry forward remains below threshold
  */

  const stillBelow =
    evaluatePayoutThreshold({
      currentEarning: 3.20,
      carryForward: 2.50
    });

  test(
    "$2.50 + $3.20 => CARRY_FORWARD",
    stillBelow.status,
    "CARRY_FORWARD"
  );

  test(
    "Accumulated balance = 5.70",
    stillBelow.availableBalance,
    5.70
  );

  test(
    "5.70 => payout 0",
    stillBelow.payoutAmount,
    0
  );

  test(
    "5.70 => carry forward 5.70",
    stillBelow.carryForward,
    5.70
  );

  /*
    Existing carry + new earning
  */

  const carryExample =
    evaluatePayoutThreshold({
      currentEarning: 6.80,
      carryForward: 3.20
    });

  test(
    "$3.20 + $6.80 => PAYABLE",
    carryExample.status,
    "PAYABLE"
  );

  test(
    "Carry example => payout 10",
    carryExample.payoutAmount,
    10
  );

  test(
    "Carry example => carry forward 0",
    carryExample.carryForward,
    0
  );

  /*
    Above threshold
  */

  const above =
    evaluatePayoutThreshold({
      currentEarning: 26.60
    });

  test(
    "$26.60 => PAYABLE",
    above.status,
    "PAYABLE"
  );

  test(
    "$26.60 => payout 26.60",
    above.payoutAmount,
    26.60
  );

  test(
    "$26.60 => carry forward 0",
    above.carryForward,
    0
  );

  /*
    Invalid negative values
  */

  let negativeEarningRejected = false;

  try {
    evaluatePayoutThreshold({
      currentEarning: -1
    });
  } catch(error) {
    negativeEarningRejected =
      error.message ===
      "currentEarning cannot be negative";
  }

  test(
    "Reject negative earning",
    negativeEarningRejected,
    true
  );

  let negativeCarryRejected = false;

  try {
    evaluatePayoutThreshold({
      currentEarning: 5,
      carryForward: -1
    });
  } catch(error) {
    negativeCarryRejected =
      error.message ===
      "carryForward cannot be negative";
  }

  test(
    "Reject negative carry forward",
    negativeCarryRejected,
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
