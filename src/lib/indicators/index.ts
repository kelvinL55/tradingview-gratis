import type { Candle } from "@/lib/binance/types";

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
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
 * MACD — fast EMA, slow EMA, signal EMA of the MACD line.
 * Defaults: 12 / 26 / 9.
 */
export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  if (candles.length < slow + signal) return [];
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  // align: emaSlow starts later
  const slowStartTime = emaSlow[0].time;
  const fastByTime = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = [];
  for (const p of emaSlow) {
    const f = fastByTime.get(p.time);
    if (f !== undefined) macdLine.push({ time: p.time, value: f - p.value });
  }
  // signal = EMA of MACD line. Build synthetic candles for ema()
  const synth: Candle[] = macdLine.map((p) => ({
    time: p.time,
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0,
  }));
  const sig = ema(synth, signal);
  const sigByTime = new Map(sig.map((p) => [p.time, p.value]));
  const out: MACDPoint[] = [];
  for (const p of macdLine) {
    const s = sigByTime.get(p.time);
    if (s === undefined) continue;
    out.push({ time: p.time, macd: p.value, signal: s, histogram: p.value - s });
  }
  void slowStartTime;
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

