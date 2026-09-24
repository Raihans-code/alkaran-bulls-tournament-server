/** "18.4" -> 112 legal balls. Throws on invalid input (e.g. "3.7"). */
export function oversToBalls(overs) {
  if (overs === undefined || overs === null || overs === '') return 0;
  const [o, b = '0'] = String(overs).split('.');
  const overNum = Number(o);
  const ballNum = Number(b);
  if (!Number.isInteger(overNum) || !Number.isInteger(ballNum) || ballNum > 5 || overNum < 0) {
    throw new Error('Invalid overs value');
  }
  return overNum * 6 + ballNum;
}

/** 112 -> "18.4" */
export const ballsToOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
