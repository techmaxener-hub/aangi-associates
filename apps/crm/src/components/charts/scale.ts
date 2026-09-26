/** Round axis maximum split into 4 equal steps. `integer` keeps steps whole numbers (counts). */
export function niceScale(raw: number, integer = true): { max: number; step: number } {
  const target = Math.max(raw, 1) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  let step = pow * 10;
  for (const c of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const cand = c * pow;
    if (cand >= target && (!integer || Number.isInteger(cand))) {
      step = cand;
      break;
    }
  }
  return { max: step * 4, step };
}
