import type { Candle } from "@/lib/binance/types";

export interface IndicatorPoint {
  time: number;
  value: number;
}


/**
 * Simple Moving Average
 */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

/**
 * Exponential Moving Average — seeded with SMA of first `period` candles.
 */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += candles[i].close;
  prev /= period;
  out.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

/**
 * RSI (Wilder) — period typically 14.
 */
export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  let rs = loss === 0 ? 100 : gain / loss;
  out.push({ time: candles[period].time, value: 100 - 100 / (1 + rs) });
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    rs = loss === 0 ? 100 : gain / loss;
    out.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
  }
  return out;
}



/**
 * Calculate Simple Moving Average (SMA) on IndicatorPoint[] values (e.g. RSI results)
 */
export function calculateSMA(data: IndicatorPoint[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
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

/**
 * Calculate Exponential Moving Average (EMA) on IndicatorPoint[] values (e.g. RSI results)
 */
export function calculateEMA(data: IndicatorPoint[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (data.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += data[i].value;
  prev /= period;
  out.push({ time: data[period - 1].time, value: prev });
  for (let i = period; i < data.length; i++) {
    prev = data[i].value * k + prev * (1 - k);
    out.push({ time: data[i].time, value: prev });
  }
  return out;
}

export interface ADXPoint {
  time: number;
  adx: number;
  plusDI: number;
  minusDI: number;
}

export function adxDmi(
  candles: Candle[],
  dilen = 14,
  adxlen = 14,
): ADXPoint[] {
  if (candles.length < dilen + adxlen) return [];

  const n = candles.length;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const times: number[] = [];

  for (let i = 1; i < n; i++) {
    const highDiff = candles[i].high - candles[i - 1].high;
    const lowDiff = candles[i - 1].low - candles[i].low;
    
    const trVal = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    tr.push(trVal);

    const pDM = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
    const mDM = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;
    plusDM.push(pDM);
    minusDM.push(mDM);
    times.push(candles[i].time);
  }

  const rmaTR = rmaNumbers(tr, dilen);
  const rmaPlusDM = rmaNumbers(plusDM, dilen);
  const rmaMinusDM = rmaNumbers(minusDM, dilen);

  const dxValues: number[] = [];
  const plusDIValues: number[] = [];
  const minusDIValues: number[] = [];
  const rmaTimes: number[] = [];

  for (let j = 0; j < rmaTR.length; j++) {
    const trVal = rmaTR[j];
    const pDM = rmaPlusDM[j];
    const mDM = rmaMinusDM[j];

    const plusDI = trVal === 0 ? 0 : (100 * pDM) / trVal;
    const minusDI = trVal === 0 ? 0 : (100 * mDM) / trVal;

    plusDIValues.push(plusDI);
    minusDIValues.push(minusDI);

    const sum = plusDI + minusDI;
    const dx = 100 * Math.abs(plusDI - minusDI) / (sum === 0 ? 1 : sum);
    dxValues.push(dx);
    rmaTimes.push(times[j + dilen - 1]);
  }

  const adxValues = rmaNumbers(dxValues, adxlen);

  const out: ADXPoint[] = [];
  for (let k = 0; k < adxValues.length; k++) {
    const idx = k + adxlen - 1;
    out.push({
      time: rmaTimes[idx],
      adx: adxValues[k],
      plusDI: plusDIValues[idx],
      minusDI: minusDIValues[idx],
    });
  }

  return out;
}

function rmaNumbers(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length < period) return out;
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prev = sum / period;
  out.push(prev);
  
  for (let i = period; i < values.length; i++) {
    prev = (values[i] + prev * (period - 1)) / period;
    out.push(prev);
  }
  return out;
}

export { rci } from "./rci";
export { stochastic } from "./stochastic";
export type { StochPoint } from "./stochastic";

export interface SqzMomPoint {
  time: number;
  val: number;
  isSqzOn: boolean;
  isSqzOff: boolean;
  isNoSqz: boolean;
}

export function squeezeMomentum(
  candles: Candle[],
  lengthBB = 20,
  multBB = 2.0,
  lengthKC = 20,
  multKC = 1.5,
  useTrueRange = true
): SqzMomPoint[] {
  if (candles.length < Math.max(lengthBB, lengthKC)) return [];

  const n = candles.length;
  const out: SqzMomPoint[] = [];
  const closes = candles.map((c) => c.close);

  // 1. Calcular True Range o rango simple para el canal de Keltner
  const ranges: number[] = [];
  for (let i = 0; i < n; i++) {
    if (useTrueRange) {
      if (i === 0) {
        ranges.push(candles[i].high - candles[i].low);
      } else {
        const tr = Math.max(
          candles[i].high - candles[i].low,
          Math.abs(candles[i].high - candles[i - 1].close),
          Math.abs(candles[i].low - candles[i - 1].close)
        );
        ranges.push(tr);
      }
    } else {
      ranges.push(candles[i].high - candles[i].low);
    }
  }

  // 2. Bollinger Bands
  const bbBasis: number[] = [];
  const bbDev: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < lengthBB - 1) {
      bbBasis.push(0);
      bbDev.push(0);
      continue;
    }
    let sum = 0;
    for (let j = i - lengthBB + 1; j <= i; j++) {
      sum += closes[j];
    }
    const mean = sum / lengthBB;
    bbBasis.push(mean);

    let sumSq = 0;
    for (let j = i - lengthBB + 1; j <= i; j++) {
      sumSq += Math.pow(closes[j] - mean, 2);
    }
    const stdevVal = Math.sqrt(sumSq / lengthBB);
    bbDev.push(multBB * stdevVal);
  }

  // 3. Keltner Channel
  const kcMa: number[] = [];
  const kcRangeMa: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < lengthKC - 1) {
      kcMa.push(0);
      kcRangeMa.push(0);
      continue;
    }
    let sumClose = 0;
    let sumRange = 0;
    for (let j = i - lengthKC + 1; j <= i; j++) {
      sumClose += closes[j];
      sumRange += ranges[j];
    }
    kcMa.push(sumClose / lengthKC);
    kcRangeMa.push(sumRange / lengthKC);
  }

  // 4. Momentum Midline
  // midlineDiff = close - midline
  // midline = ( (highest(high, lengthKC) + lowest(low, lengthKC))/2 + sma(close, lengthKC) ) / 2
  const midlineDiffs: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < lengthKC - 1) {
      midlineDiffs.push(0);
      continue;
    }
    let highestHigh = candles[i].high;
    let lowestLow = candles[i].low;
    for (let j = i - lengthKC + 1; j <= i; j++) {
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
    }
    const highestLowestAvg = (highestHigh + lowestLow) / 2;
    const closeSma = kcMa[i]; // sma(close, lengthKC) es exactamente kcMa[i]
    const midline = (highestLowestAvg + closeSma) / 2;
    midlineDiffs.push(closes[i] - midline);
  }

  // 5. Linear Regression (linreg) of midlineDiffs
  const linregVals: number[] = [];
  for (let i = 0; i < n; i++) {
    const startIdx = i - lengthKC + 1;
    if (startIdx < 0) {
      linregVals.push(0);
      continue;
    }
    const len = lengthKC;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    for (let j = 0; j < len; j++) {
      const y = midlineDiffs[startIdx + j];
      sumX += j;
      sumY += y;
      sumXX += j * j;
      sumXY += j * y;
    }
    const m = (len * sumXY - sumX * sumY) / (len * sumXX - sumX * sumX);
    const yBar = sumY / len;
    const xBar = (len - 1) / 2;
    const yHat = yBar + m * xBar;
    linregVals.push(yHat);
  }

  // 6. Determinar estados de Squeeze y armar puntos de salida
  const startIdx = Math.max(lengthBB, lengthKC) - 1;
  for (let i = 0; i < n; i++) {
    if (i < startIdx) {
      out.push({
        time: candles[i].time,
        val: 0,
        isSqzOn: false,
        isSqzOff: false,
        isNoSqz: true,
      });
      continue;
    }

    const upperBB = bbBasis[i] + bbDev[i];
    const lowerBB = bbBasis[i] - bbDev[i];

    const upperKC = kcMa[i] + kcRangeMa[i] * multKC;
    const lowerKC = kcMa[i] - kcRangeMa[i] * multKC;

    const sqzOn = lowerBB > lowerKC && upperBB < upperKC;
    const sqzOff = lowerBB < lowerKC && upperBB > upperKC;
    const noSqz = !sqzOn && !sqzOff;

    out.push({
      time: candles[i].time,
      val: linregVals[i],
      isSqzOn: sqzOn,
      isSqzOff: sqzOff,
      isNoSqz: noSqz,
    });
  }

  return out;
}


