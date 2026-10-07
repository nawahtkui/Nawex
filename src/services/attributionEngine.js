/*
  Nawex Agent Attribution Engine

  Splits Agent Pool by contribution weights.
*/

function money(value) {
  return Number(Number(value).toFixed(2));
}


export function calculateAttribution({
  agentPool,
  agents
}) {


  const totalWeight =
    agents.reduce(
      (sum, agent) =>
        sum + Number(agent.weight),
      0
    );


  if (
    Math.abs(totalWeight - 1) > 0.001
  ) {

    throw new Error(
      "Agent weights must sum to 1.0"
    );

  }


  const allocations =
    agents.map(agent => ({

      agentId:
        agent.agentId,

      role:
        agent.role,

      weight:
        agent.weight,

      earnedAmount:
        money(
          agentPool *
          agent.weight
        ),

      status:
        "earned_pending"

    }));


  return {

    totalWeight,

    totalEarned:
      money(
        allocations.reduce(
          (sum,item)=>
            sum + item.earnedAmount,
          0
        )
      ),

    allocations

  };

}
