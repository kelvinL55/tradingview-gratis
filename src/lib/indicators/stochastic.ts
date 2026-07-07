import type { Candle } from "@/lib/binance/types";

export interface StochPoint {
  time: number;
  k: number;
  d: number;
}

/**
 * Stochastic Oscillator
 *
 * %K = SMA( (close - lowest(low, periodK)) / (highest(high, periodK) - lowest(low, periodK)) * 100, smoothK )
 * %D = SMA(%K, periodD)
 *
 * Defaults: periodK=14, smoothK=1, periodD=3
 */
export function stochastic(
  candles: Candle[],
  periodK = 14,
  smoothK = 1,
  periodD = 3,
): StochPoint[] {
  if (candles.length < periodK) return [];

  // 1. Raw stochastic values
  const rawStoch: { time: number; value: number }[] = [];
  for (let i = periodK - 1; i < candles.length; i++) {
    let lowestLow = Infinity;
    let highestHigh = -Infinity;
    for (let j = i - periodK + 1; j <= i; j++) {
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
    }
    const range = highestHigh - lowestLow;
    const stochVal = range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100;
    rawStoch.push({ time: candles[i].time, value: stochVal });
  }

  // 2. Smooth %K with SMA(smoothK)
  const kValues = smaSmooth(rawStoch, smoothK);
  if (kValues.length < periodD) return [];

  // 3. %D = SMA(%K, periodD)
  const dValues = smaSmooth(kValues, periodD);

  // 4. Align: only output points where both K and D exist
  const dByTime = new Map(dValues.map((p) => [p.time, p.value]));
  const out: StochPoint[] = [];
  for (const kp of kValues) {
    const dVal = dByTime.get(kp.time);
    if (dVal !== undefined) {
      out.push({ time: kp.time, k: kp.value, d: dVal });
    }
  }

  return out;
}

/** Simple SMA helper for smoothing indicator point arrays */
function smaSmooth(
  data: { time: number; value: number }[],
  period: number,
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  if (data.length < period) return out;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].value;
    if (i >= period) sum -= data[i - period].value;
    if (i >= period - 1) {
      out.push({ time: data[i].time, value: sum / period });
    }
  }
  return out;
}
