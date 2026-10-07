/*
  Nawex Value Pool Engine

  Customer Payment
        ↓
  Supplier Cost
        ↓
  Margin
        ↓
  Agent Pool + Nawex Net
*/

function money(value) {
  return Number(Number(value).toFixed(2));
}


export function calculateValuePool({
  customerCharge,
  supplierCost,
  agentPoolPercentage = 0.70
}) {

  const customer =
    money(customerCharge);

  const supplier =
    money(supplierCost);


  const margin =
    money(customer - supplier);


  if (margin < 0) {
    throw new Error(
      "supplierCost cannot exceed customerCharge"
    );
  }


  if (
    agentPoolPercentage < 0 ||
    agentPoolPercentage > 1
  ) {
    throw new Error(
      "agentPoolPercentage must be between 0 and 1"
    );
  }


  const agentPool =
    money(
      margin * agentPoolPercentage
    );


  const nawexRevenue =
    money(
      margin - agentPool
    );


  return {

    customerCharge: customer,

    supplierCost: supplier,

    margin,

    agentPoolPercentage,

    agentPool,

    nawexRevenue,

    totalAllocated:
      money(
        agentPool + nawexRevenue
      ),

    valid:
      money(
        agentPool + nawexRevenue
      ) === margin

  };

}
