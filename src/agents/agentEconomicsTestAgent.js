import { calculateAgentEconomics } from "../services/agentEconomics.js";


export function runAgentEconomicsTests() {

  const result = {
    tests: []
  };


  try {

    const economics =
      calculateAgentEconomics({

        customerCharge: 500,

        supplierCost: 400,

        agents: [

          {
            agentId: "agent_a",
            role: "DISCOVERER",
            weight: 0.30
          },

          {
            agentId: "agent_b",
            role: "NEGOTIATOR",
            weight: 0.40
          },

          {
            agentId: "agent_c",
            role: "EXECUTOR",
            weight: 0.30
          }

        ]

      });


    const pass =
      economics.valuePool.agentPool === 70 &&
      economics.valuePool.nawexRevenue === 30 &&
      economics.attribution.totalEarned === 70;


    result.tests.push({

      name:
        "Value Pool + Multi Agent Attribution",

      status:
        pass ? "PASS" : "FAIL",

      output:
        economics

    });


  } catch(error) {

    result.tests.push({

      name:
        "Value Pool + Multi Agent Attribution",

      status:
        "FAIL",

      error:
        error.message

    });

  }


  try {

    calculateAgentEconomics({

      customerCharge:500,

      supplierCost:400,

      agents:[

        {
          agentId:"agent_a",
          role:"DISCOVERER",
          weight:0.50
        },

        {
          agentId:"agent_b",
          role:"NEGOTIATOR",
          weight:0.30
        }

      ]

    });


    result.tests.push({

      name:
        "Reject Invalid Weights",

      status:
        "FAIL"

    });


  } catch(error) {

    result.tests.push({

      name:
        "Reject Invalid Weights",

      status:
        "PASS",

      error:
        error.message

    });

  }


  result.summary = {

    total:
      result.tests.length,

    passed:
      result.tests.filter(
        t => t.status === "PASS"
      ).length,

    overall:
      result.tests.every(
        t => t.status === "PASS"
      )
      ? "PASS"
      : "FAIL"

  };


  return result;

}
