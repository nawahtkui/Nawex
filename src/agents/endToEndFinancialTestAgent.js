/*
  Nawex End-to-End Financial Test Agent

  Full financial pipeline:

  Customer
      ↓
  Supplier Cost
      ↓
  Margin
      ↓
  Value Pool
      ↓
  Agent Attribution
      ↓
  Performance
      ↓
  Milestones
      ↓
  Payout Threshold
      ↓
  Agent Ledger
      ↓
  Final Financial Reconciliation

  Core invariant:

  Customer Charge
    =
  Supplier Payout
    +
  Nawex Base Revenue
    +
  Agent Allocation

  Agent Allocation
    =
  Final Agent Payout
    +
  Performance Retention
    +
  Carry Forward
*/

import {
  calculateValuePool
} from "../services/valuePool.js";

import {
  calculateAttribution
} from "../services/attributionEngine.js";

import {
  calculateFinalAgentPayout
} from "../services/finalPayoutEngine.js";

import {
  evaluatePayoutThreshold
} from "../services/payoutThresholdEngine.js";

import {
  createAgentLedgerEntry
} from "../services/agentLedger.js";


function money(value) {
  return Number(
    Number(value).toFixed(2)
  );
}


function assertEqual(
  name,
  expected,
  actual,
  tests
) {

  const pass =
    expected === actual;

  tests.push({
    name,
    status: pass ? "PASS" : "FAIL",
    expected,
    actual
  });

  if (!pass) {
    throw new Error(
      `${name}: expected ${expected}, got ${actual}`
    );
  }
}


function assertTrue(
  name,
  actual,
  tests
) {

  const pass =
    actual === true;

  tests.push({
    name,
    status: pass ? "PASS" : "FAIL",
    expected: true,
    actual
  });

  if (!pass) {
    throw new Error(
      `${name}: expected true, got ${actual}`
    );
  }
}


function runScenario({
  name,
  performanceScores
}) {

  const tests = [];


  /*
    STEP 1
    Customer pays $500
    Supplier cost is $400
  */

  const customerCharge = 500;
  const supplierCost = 400;


  /*
    STEP 2
    Value Pool

    Margin = 100
    Agent Pool = 70
    Nawex = 30
  */

  const valuePool =
    calculateValuePool({
      customerCharge,
      supplierCost,
      agentPoolPercentage: 0.70
    });


  assertEqual(
    `${name}: margin`,
    100,
    valuePool.margin,
    tests
  );


  assertEqual(
    `${name}: agent pool`,
    70,
    valuePool.agentPool,
    tests
  );


  assertEqual(
    `${name}: Nawex revenue`,
    30,
    valuePool.nawexRevenue,
    tests
  );


  assertTrue(
    `${name}: value pool balanced`,
    valuePool.valid,
    tests
  );


  /*
    STEP 3
    Attribution

    Discoverer 30%
    Negotiator 40%
    Executor 30%
  */

  const attribution =
    calculateAttribution({
      agentPool:
        valuePool.agentPool,

      agents: [
        {
          agentId: "agent_discoverer",
          role: "DISCOVERER",
          weight: 0.30
        },
        {
          agentId: "agent_negotiator",
          role: "NEGOTIATOR",
          weight: 0.40
        },
        {
          agentId: "agent_executor",
          role: "EXECUTOR",
          weight: 0.30
        }
      ]
    });


  assertEqual(
    `${name}: attribution weight`,
    1,
    money(attribution.totalWeight),
    tests
  );


  assertEqual(
    `${name}: attributed agent pool`,
    70,
    attribution.totalEarned,
    tests
  );


  assertEqual(
    `${name}: discoverer earned`,
    21,
    attribution.allocations[0].earnedAmount,
    tests
  );


  assertEqual(
    `${name}: negotiator earned`,
    28,
    attribution.allocations[1].earnedAmount,
    tests
  );


  assertEqual(
    `${name}: executor earned`,
    21,
    attribution.allocations[2].earnedAmount,
    tests
  );


  /*
    STEP 4
    Performance + Final Payout
  */

  const finalAllocations = [];


  attribution.allocations.forEach(
    (allocation) => {

      const performanceScore =
        performanceScores[
          allocation.agentId
        ];


      const final =
        calculateFinalAgentPayout({
          transactionId:
            "txn_e2e_001",

          agentId:
            allocation.agentId,

          role:
            allocation.role,

          earnedAmount:
            allocation.earnedAmount,

          performanceScore,

          milestoneType:
            "COMPLEX"
        });


      finalAllocations.push(final);

    }
  );


  /*
    STEP 5
    Check agent allocation invariant
  */

  const totalEarned =
    money(
      finalAllocations.reduce(
        (sum, item) =>
          sum + item.earnedAmount,
        0
      )
    );


  const totalFinalPayout =
    money(
      finalAllocations.reduce(
        (sum, item) =>
          sum + item.finalPayout,
        0
      )
    );


  const totalRetention =
    money(
      finalAllocations.reduce(
        (sum, item) =>
          sum + item.performanceRetention,
        0
      )
    );


  assertEqual(
    `${name}: total earned`,
    70,
    totalEarned,
    tests
  );


  /*
    STEP 6
    Threshold + Ledger
  */

  const ledgerEntries = [];


  finalAllocations.forEach(
    (allocation) => {

      const threshold =
        evaluatePayoutThreshold({
          currentEarning:
            allocation.finalPayout,

          carryForward:
            0
        });


      const carryForward =
        threshold.carryForward;


      const ledger =
        createAgentLedgerEntry({
          transactionId:
            allocation.transactionId,

          agentId:
            allocation.agentId,

          role:
            allocation.role,

          earnedAmount:
            allocation.earnedAmount,

          finalPayout:
            allocation.finalPayout,

          performanceRetention:
            allocation.performanceRetention,

          carryForward
        });


      ledgerEntries.push(ledger);


      assertTrue(
        `${name}: ledger balanced ${allocation.role}`,
        ledger.balanced,
        tests
      );

    }
  );


  /*
    STEP 7
    Financial reconciliation

    Supplier
      400

    Nawex base revenue
      30

    Agent allocation
      70

    Total
      500
  */

  const supplierPayout =
    valuePool.supplierCost;


  const agentAllocation =
    money(
      totalFinalPayout +
      totalRetention
    );


  const totalCustomerAllocation =
    money(
      supplierPayout +
      valuePool.nawexRevenue +
      agentAllocation
    );


  assertEqual(
    `${name}: agent allocation`,
    70,
    agentAllocation,
    tests
  );


  assertEqual(
    `${name}: final customer allocation`,
    customerCharge,
    totalCustomerAllocation,
    tests
  );


  /*
    Important:

    Retention is NOT new revenue.

    It is part of the original Agent Pool
    that was earned but not paid because
    of performance adjustment.
  */

  const nawexRetainedTotal =
    money(
      valuePool.nawexRevenue +
      totalRetention
    );


  /*
    Final invariant:
  */

  const reconciliationDifference =
    money(
      customerCharge -
      totalCustomerAllocation
    );


  assertEqual(
    `${name}: reconciliation difference`,
    0,
    reconciliationDifference,
    tests
  );


  return {
    name,

    customerCharge,

    supplierCost,

    margin:
      valuePool.margin,

    agentPool:
      valuePool.agentPool,

    nawexBaseRevenue:
      valuePool.nawexRevenue,

    totalEarned,

    totalFinalPayout,

    totalPerformanceRetention:
      totalRetention,

    nawexRetainedTotal,

    supplierPayout,

    totalCustomerAllocation,

    reconciliationDifference,

    agents:
      finalAllocations,

    ledger:
      ledgerEntries,

    tests,

    passed:
      tests.every(
        test =>
          test.status === "PASS"
      )
  };

}


export function runEndToEndFinancialTests() {

  const scenarios = [];


  /*
    SCENARIO 1
    Perfect performance

    All agents score 100.
    Therefore:

    Earned = Final Payout
    Retention = 0
  */

  scenarios.push(
    runScenario({
      name:
        "E2E Perfect Performance",

      performanceScores: {
        agent_discoverer: 100,
        agent_negotiator: 100,
        agent_executor: 100
      }
    })
  );


  /*
    SCENARIO 2
    One agent has score 95.

    Negotiator:

    Earned = 28
    Multiplier = 0.95
    Final = 26.60
    Retention = 1.40

    Total Agent Allocation
    remains exactly $70.
  */

  scenarios.push(
    runScenario({
      name:
        "E2E Performance Retention",

      performanceScores: {
        agent_discoverer: 100,
        agent_negotiator: 95,
        agent_executor: 100
      }
    })
  );


  const allTests =
    scenarios.flatMap(
      scenario =>
        scenario.tests
    );


  const passed =
    allTests.filter(
      test =>
        test.status === "PASS"
    ).length;


  const failed =
    allTests.filter(
      test =>
        test.status === "FAIL"
    ).length;


  return {

    scenarios,

    summary: {

      total:
        allTests.length,

      passed,

      failed,

      overall:
        failed === 0
          ? "PASS"
          : "FAIL"

    }

  };

}
