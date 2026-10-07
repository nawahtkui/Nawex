import {
  getPerformanceMultiplier,
  getPerformanceTier,
  applyPerformanceAdjustment
} from "../services/performanceEngine.js";


export function runPerformanceTests() {

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
    SCORE 95
    28 × 0.95 = 26.60
  */

  const normal =
    applyPerformanceAdjustment({

      earnedAmount: 28,

      performanceScore: 95

    });


  test(
    "Score 95 => multiplier 0.95",
    normal.performanceMultiplier,
    0.95
  );


  test(
    "Score 95 => adjusted payout 26.60",
    normal.adjustedAmount,
    26.60
  );


  test(
    "Score 95 => NORMAL tier",
    normal.tier,
    "NORMAL"
  );


  /*
    SCORE 105
    multiplier = 1.05
  */

  const trusted =
    applyPerformanceAdjustment({

      earnedAmount: 28,

      performanceScore: 105

    });


  test(
    "Score 105 => multiplier 1.05",
    trusted.performanceMultiplier,
    1.05
  );


  test(
    "Score 105 => adjusted payout 29.40",
    trusted.adjustedAmount,
    29.40
  );


  test(
    "Score 105 => TRUSTED tier",
    trusted.tier,
    "TRUSTED"
  );


  /*
    SCORE 50
    fixed multiplier 0.40
  */

  test(
    "Score 50 => multiplier 0.40",
    getPerformanceMultiplier(50),
    0.40
  );


  test(
    "Score 50 => LOW tier",
    getPerformanceTier(50),
    "LOW"
  );


  /*
    SCORE 39
    blocked
  */

  const blocked =
    applyPerformanceAdjustment({

      earnedAmount: 28,

      performanceScore: 39

    });


  test(
    "Score 39 => multiplier 0",
    blocked.performanceMultiplier,
    0
  );


  test(
    "Score 39 => payout 0",
    blocked.adjustedAmount,
    0
  );


  test(
    "Score 39 => BLOCKED",
    blocked.tier,
    "BLOCKED"
  );


  return {

    tests,

    summary: {

      total:
        tests.length,

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
