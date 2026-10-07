/*
  Nawex Payout Threshold Engine

  Minimum payout:
    $10.00

  Below threshold:
    carry forward

  At or above threshold:
    payable
*/

const MINIMUM_PAYOUT = 10;

function money(value) {
  return Number(Number(value).toFixed(2));
}

export function getMinimumPayout() {
  return MINIMUM_PAYOUT;
}

export function evaluatePayoutThreshold({
  currentEarning,
  carryForward = 0
}) {
  const earning = money(currentEarning);
  const previousCarry = money(carryForward);

  if (earning < 0) {
    throw new Error(
      "currentEarning cannot be negative"
    );
  }

  if (previousCarry < 0) {
    throw new Error(
      "carryForward cannot be negative"
    );
  }

  const availableBalance =
    money(
      earning + previousCarry
    );

  if (availableBalance >= MINIMUM_PAYOUT) {
    return {
      currentEarning: earning,
      previousCarryForward: previousCarry,
      availableBalance,
      minimumPayout: MINIMUM_PAYOUT,
      status: "PAYABLE",
      payoutAmount: availableBalance,
      carryForward: 0
    };
  }

  return {
    currentEarning: earning,
    previousCarryForward: previousCarry,
    availableBalance,
    minimumPayout: MINIMUM_PAYOUT,
    status: "CARRY_FORWARD",
    payoutAmount: 0,
    carryForward: availableBalance
  };
}
