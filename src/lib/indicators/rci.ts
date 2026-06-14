import type { Candle } from "@/lib/binance/types";
import type { IndicatorPoint } from "./index";

/**
 * Helper to calculate fractional ranks for a set of values (handles ties)
 */
function getRanks(values: number[]): number[] {
  const sorted = values
    .map((v, i) => ({ val: v, idx: i }))
    .sort((a, b) => a.val - b.val);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].val === sorted[i].val) {
      j++;
    }
    // Average rank of the tied values: (first_rank + last_rank) / 2
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].idx] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Rank Correlation Index (RCI)
 * Calculates the Spearman rank correlation between price and time.
 * Value range: -100 to +100
 */
export function rci(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period || period < 2) return out;

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const prices = slice.map((c) => c.close);
    const ranks = getRanks(prices);

    let sumDiffSq = 0;
    for (let k = 0; k < period; k++) {
      const dateRank = k + 1; // 1 to N
      const priceRank = ranks[k];
      const diff = dateRank - priceRank;
      sumDiffSq += diff * diff;
    }

    const value = (1 - (6 * sumDiffSq) / (period * (period * period - 1))) * 100;
    out.push({
      time: candles[i].time,
      value: value,
    });
  }
  return out;
}
