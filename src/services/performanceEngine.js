/*
  Nawex Performance Engine

  Converts an Agent performance score
  into a payout multiplier.

  Tiers:

  >= 100
    Base 1.00 + bonus

  70 - 99
    score / 100

  40 - 69
    fixed 0.40

  < 40
    blocked => 0
*/


function money(value) {
  return Number(Number(value).toFixed(2));
}


export function getPerformanceMultiplier(score) {

  const currentScore = Number(score);

  if (!Number.isFinite(currentScore)) {
    throw new Error(
      "performance score must be a valid number"
    );
  }


  if (currentScore >= 100) {

    return money(
      1 + ((currentScore - 100) * 0.01)
    );

  }


  if (currentScore >= 70) {

    return money(
      currentScore / 100
    );

  }


  if (currentScore >= 40) {

    return 0.40;

  }


  return 0;
}


export function getPerformanceTier(score) {

  const currentScore = Number(score);


  if (currentScore < 40) {
    return "BLOCKED";
  }


  if (currentScore < 70) {
    return "LOW";
  }


  if (currentScore <= 100) {
    return "NORMAL";
  }


  return "TRUSTED";
}


export function applyPerformanceAdjustment({
  earnedAmount,
  performanceScore
}) {

  const earned =
    money(earnedAmount);


  if (earned < 0) {
    throw new Error(
      "earnedAmount cannot be negative"
    );
  }


  const multiplier =
    getPerformanceMultiplier(
      performanceScore
    );


  const adjustedAmount =
    money(
      earned * multiplier
    );


  return {

    earnedAmount: earned,

    performanceScore:
      Number(performanceScore),

    performanceMultiplier:
      multiplier,

    adjustedAmount,

    tier:
      getPerformanceTier(
        performanceScore
      ),

    blocked:
      multiplier === 0

  };

}
