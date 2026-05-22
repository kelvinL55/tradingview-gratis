"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { ema, rsi, macd, calculateSMA, calculateEMA, adxDmi } from "@/lib/indicators";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

// Number of bars to show in the visible area when auto-fitting, per timeframe.
// Smaller timeframes show fewer bars (they're denser), bigger ones show more.
const VISIBLE_BARS: Record<string, number> = {
  "1m": 120,
  "5m": 150,
  "15m": 200,
  "1h": 200,
  "4h": 200,
  "1d": 300,
  "1w": 200,
};

// Seconds per bar for each timeframe — used to extrapolate time in the empty area
const TF_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

/** Format a unix-seconds timestamp for the crosshair label */
function formatCrosshairTime(ts: number, tf: string, timezone: "UTC" | "Local"): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  
  const isLocal = timezone === "Local";
  const yyyy = isLocal ? d.getFullYear() : d.getUTCFullYear();
  const MM = pad(isLocal ? (d.getMonth() + 1) : (d.getUTCMonth() + 1));
  const dd = pad(isLocal ? d.getDate() : d.getUTCDate());
  const hh = pad(isLocal ? d.getHours() : d.getUTCHours());
  const mm = pad(isLocal ? d.getMinutes() : d.getUTCMinutes());
  
  if (tf === "1d" || tf === "1w") return `${yyyy}-${MM}-${dd}`;
  return `${yyyy}-${MM}-${dd}  ${hh}:${mm}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
}

interface PaneOffset {
  top: number;
  height: number;
}

function getPriceFormatForValue(price: number) {
  if (price >= 1000) {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  } else if (price >= 1) {
    return { type: "price" as const, precision: 2, minMove: 0.01 };
  } else if (price >= 0.1) {
    return { type: "price" as const, precision: 4, minMove: 0.0001 };
  } else if (price >= 0.01) {
    return { type: "price" as const, precision: 5, minMove: 0.00001 };
  } else if (price >= 0.001) {
    return { type: "price" as const, precision: 6, minMove: 0.000001 };
  } else {
    return { type: "price" as const, precision: 8, minMove: 0.00000001 };
  }
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Area"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiMaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const adxRef = useRef<ISeriesApi<"Line"> | null>(null);
  const plusDIRef = useRef<ISeriesApi<"Line"> | null>(null);
  const minusDIRef = useRef<ISeriesApi<"Line"> | null>(null);
  const adxKeyLevelRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const priceLines = useChartStore((s) => s.priceLines);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);
  const timezone = useChartStore((s) => s.timezone);

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [renderTick, setRenderTick] = useState(0);
  const [extraLabel, setExtraLabel] = useState<{ x: number; text: string } | null>(null);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  const timezoneRef = useRef(timezone);
  timezoneRef.current = timezone;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      localization: {
        timeFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000);
          const isLocal = timezoneRef.current === "Local";
          const pad = (n: number) => n.toString().padStart(2, "0");
          const yyyy = isLocal ? d.getFullYear() : d.getUTCFullYear();
          const MM = pad(isLocal ? (d.getMonth() + 1) : (d.getUTCMonth() + 1));
          const dd = pad(isLocal ? d.getDate() : d.getUTCDate());
          const hh = pad(isLocal ? d.getHours() : d.getUTCHours());
          const mm = pad(isLocal ? d.getMinutes() : d.getUTCMinutes());
          return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
        }
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: TV_COLORS.textMuted,
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: TV_COLORS.blue,
        },
        horzLine: {
          color: TV_COLORS.textMuted,
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: TV_COLORS.blue,
        },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
          const d = new Date(time * 1000);
          const isLocal = timezoneRef.current === "Local";
          const pad = (n: number) => n.toString().padStart(2, "0");
          const hh = pad(isLocal ? d.getHours() : d.getUTCHours());
          const mm = pad(isLocal ? d.getMinutes() : d.getUTCMinutes());
          const MM = pad(isLocal ? (d.getMonth() + 1) : (d.getUTCMonth() + 1));
          const dd = pad(isLocal ? d.getDate() : d.getUTCDate());
          if (tickMarkType === 2) {
            return `${MM}-${dd}`;
          }
          return `${hh}:${mm}`;
        }
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;

    // Click handler — add horizontal price line when hline tool is active
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null || !isFinite(price)) return;

      if (toolRef.current === "hline") {
        addPriceLineRef.current(price, symbolRef.current);
        return;
      }

      if (toolRef.current === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        } else if (current.phase === "placing") {
          setMeasure({
            phase: "done",
            a: current.a,
            b: { time, price },
          });
        } else {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        }
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (
        toolRef.current === "measure" &&
        measureRef.current.phase === "placing" &&
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price !== null && isFinite(price)) {
          const time = Number(param.time);
          setMeasure((prev) =>
            prev.phase === "placing" ? { ...prev, b: { time, price } } : prev,
          );
        }
      }

      // When cursor is over data, the built-in label handles it — clear custom label
      if (param.time && candleSeriesRef.current) {
        setExtraLabel(null);
        const data = param.seriesData.get(candleSeriesRef.current);
        const vol = volumeSeriesRef.current
          ? param.seriesData.get(volumeSeriesRef.current)
          : null;
        if (data && "open" in data) {
          const o = data.open as number;
          const c = data.close as number;
          setHover({
            o,
            h: data.high as number,
            l: data.low as number,
            c,
            v: vol && "value" in vol ? (vol.value as number) : 0,
            time: Number(param.time),
            pct: o === 0 ? 0 : ((c - o) / o) * 100,
          });
        }
        return;
      }

      // Cursor is in the empty area past the last candle — extrapolate time
      setHover(null);
      if (param.point && chartRef.current && candlesRef.current.length > 0) {
        const logical = chartRef.current.timeScale().coordinateToLogical(param.point.x);
        if (logical !== null) {
          const arr = candlesRef.current;
          const lastIdx = arr.length - 1;
          const lastTime = arr[lastIdx].time;
          const secPerBar = TF_SECONDS[timeframeRef.current] ?? 60;
          const extrapolatedTime = lastTime + Math.round(logical - lastIdx) * secPerBar;
          const text = formatCrosshairTime(extrapolatedTime, timeframeRef.current, timezoneRef.current);
          setExtraLabel({ x: param.point.x, text });
        } else {
          setExtraLabel(null);
        }
      } else {
        setExtraLabel(null);
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      adxRef.current = null;
      plusDIRef.current = null;
      minusDIRef.current = null;
      adxKeyLevelRef.current = null;
    };
  }, []);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const rColor = configRef.current.rsiColor ?? "#7e57c2";
      const rMaColor = configRef.current.rsiMaColor ?? "#ffb74d";

      const r = chartRef.current.addSeries(
        AreaSeries,
        {
          lineColor: rColor,
          lineWidth: 1,
          topColor: hexToRgba(rColor, 0.12), // Relleno superior degradado sutil
          bottomColor: hexToRgba(rColor, 0.0), // Desvanecido a transparente
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r50 = chartRef.current.addSeries(
        LineSeries,
        {
          color: `${TV_COLORS.textMuted}80`, // 50% opacidad
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const rma = chartRef.current.addSeries(
        LineSeries,
        {
          color: rMaColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi50Ref.current = r50;
      rsi70Ref.current = r70;
      rsiMaRef.current = rma;
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi50Ref.current) chartRef.current.removeSeries(rsi50Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      if (rsiMaRef.current) chartRef.current.removeSeries(rsiMaRef.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // ADX/DMI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.adx && !adxRef.current) {
      const paneIndex = 1 + (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
      const aColor = configRef.current.adxColor ?? "#ef5350";
      const pColor = configRef.current.plusDIColor ?? "#2196f3";
      const mColor = configRef.current.minusDIColor ?? "#787b86";

      const adxSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: aColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );

      const plusDISeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: pColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );

      const minusDISeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: mColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );

      const adxKeyLevelSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.adxKeyLevelColor ?? "#ffffff",
          lineWidth: 1,
          lineStyle: 2, // Discontinua
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );

      adxRef.current = adxSeries;
      plusDIRef.current = plusDISeries;
      minusDIRef.current = minusDISeries;
      adxKeyLevelRef.current = adxKeyLevelSeries;

      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateADX();
    } else if (!indicators.adx && adxRef.current && chartRef.current) {
      chartRef.current.removeSeries(adxRef.current);
      if (plusDIRef.current) chartRef.current.removeSeries(plusDIRef.current);
      if (minusDIRef.current) chartRef.current.removeSeries(minusDIRef.current);
      if (adxKeyLevelRef.current) chartRef.current.removeSeries(adxKeyLevelRef.current);
      adxRef.current = null;
      plusDIRef.current = null;
      minusDIRef.current = null;
      adxKeyLevelRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.adx, indicators.rsi, indicators.macd]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    const rsiMaType = config.rsiMaType ?? "SMA";
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi50Ref.current) rsi50Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (rsiMaRef.current) rsiMaRef.current.applyOptions({ visible: v("rsi") && rsiMaType !== "None" });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (adxRef.current) adxRef.current.applyOptions({ visible: v("adx") });
    if (plusDIRef.current) plusDIRef.current.applyOptions({ visible: v("adx") });
    if (minusDIRef.current) minusDIRef.current.applyOptions({ visible: v("adx") });
    if (adxKeyLevelRef.current) adxKeyLevelRef.current.applyOptions({ visible: v("adx") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden, config.rsiMaType]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi, config.rsiMaLength, config.rsiMaType]);

  // Sync colors reactively on the RSI and RSI-based MA series
  useEffect(() => {
    const rColor = config.rsiColor ?? "#7e57c2";
    const rMaColor = config.rsiMaColor ?? "#ffb74d";
    if (rsiRef.current) {
      rsiRef.current.applyOptions({
        lineColor: rColor,
        topColor: hexToRgba(rColor, 0.12),
        bottomColor: hexToRgba(rColor, 0.0),
      });
    }
    if (rsiMaRef.current) {
      rsiMaRef.current.applyOptions({
        color: rMaColor,
      });
    }
  }, [config.rsiColor, config.rsiMaColor]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  useEffect(() => {
    updateADX();
  }, [config.adxLength, config.dmiLength, config.adxKeyLevel]);

  useEffect(() => {
    const aColor = config.adxColor ?? "#ef5350";
    const pColor = config.plusDIColor ?? "#2196f3";
    const mColor = config.minusDIColor ?? "#787b86";
    const kColor = config.adxKeyLevelColor ?? "#ffffff";

    if (adxRef.current) {
      adxRef.current.applyOptions({ color: aColor });
    }
    if (plusDIRef.current) {
      plusDIRef.current.applyOptions({ color: pColor });
    }
    if (minusDIRef.current) {
      minusDIRef.current.applyOptions({ color: mColor });
    }
    if (adxKeyLevelRef.current) {
      adxKeyLevelRef.current.applyOptions({ color: kColor });
    }
  }, [config.adxColor, config.plusDIColor, config.minusDIColor, config.adxKeyLevelColor]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Cursor style when drawing tools are active + reset measure on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        tool === "hline" || tool === "measure" ? "crosshair" : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
  }, [tool]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0)
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    if (rsi50Ref.current && data.length > 0)
      rsi50Ref.current.setData([
        { time: data[0].time, value: 50 },
        { time: data[data.length - 1].time, value: 50 },
      ]);
    if (rsi70Ref.current && data.length > 0)
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);

    // Calcular MA de suavizado
    const rsiMaType = cfg.rsiMaType ?? "SMA";
    const rsiMaLength = cfg.rsiMaLength ?? 14;
    let rsiMaData: { time: UTCTimestamp; value: number }[] = [];
    if (rsiMaType !== "None" && data.length > 0) {
      const maPoints = rsiMaType === "EMA"
        ? calculateEMA(data, rsiMaLength)
        : calculateSMA(data, rsiMaLength);
      rsiMaData = maPoints.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      }));
    }
    if (rsiMaRef.current) {
      rsiMaRef.current.setData(rsiMaData);
      rsiMaRef.current.applyOptions({ visible: rsiMaType !== "None" && !hidden.rsi });
    }

    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  function updateADX() {
    const c = candlesRef.current;
    if (c.length === 0 || !adxRef.current) return;
    const cfg = configRef.current;
    const data = adxDmi(c, cfg.dmiLength, cfg.adxLength);
    
    if (data.length === 0) return;

    adxRef.current.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.adx }))
    );
    plusDIRef.current?.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.plusDI }))
    );
    minusDIRef.current?.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.minusDI }))
    );
    if (adxKeyLevelRef.current) {
      adxKeyLevelRef.current.setData([
        { time: data[0].time as UTCTimestamp, value: cfg.adxKeyLevel },
        { time: data[data.length - 1].time as UTCTimestamp, value: cfg.adxKeyLevel },
      ]);
    }

    const last = data.at(-1);
    setLastValues((prev) => ({
      ...prev,
      adx: last?.adx,
      plusDI: last?.plusDI,
      minusDI: last?.minusDI,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function load() {
      try {
        const klines = await fetchKlines(symbol, timeframe, 1000);
        if (cancelled) return;
        candlesRef.current = klines;
        if (candleSeriesRef.current) {
          if (klines.length > 0) {
            const lastCandle = klines[klines.length - 1];
            const priceFormat = getPriceFormatForValue(lastCandle.close);
            candleSeriesRef.current.applyOptions({ priceFormat });
          }
          candleSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            })),
          );
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            })),
          );
        }
        updateEMAs();
        updateRSI();
        updateMACD();
        updateADX();

        // Smart auto-fit: show a tailored number of recent bars so the chart
        // looks well-proportioned regardless of timeframe or symbol.
        if (chartRef.current && klines.length > 0) {
          const barsToShow = VISIBLE_BARS[timeframe] ?? 200;
          const totalBars = klines.length;
          const from = Math.max(totalBars - barsToShow, 0);
          const to = totalBars - 1 + 12; // +12 right offset for live candles
          chartRef.current.timeScale().setVisibleLogicalRange({ from, to });

          // Reset all price scales so they auto-fit vertically to the visible data
          candleSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
          rsiRef.current?.priceScale().applyOptions({ autoScale: true });
          macdRef.current?.priceScale().applyOptions({ autoScale: true });
          adxRef.current?.priceScale().applyOptions({ autoScale: true });
        }
        requestAnimationFrame(() => recomputePaneOffsets());

        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          const prev = klines[klines.length - 2] ?? last;
          setLastPrice({
            value: last.close,
            pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
          });
        }

        const ws = getBinanceWS();
        unsub = ws.subscribeKline({
          symbol,
          interval: timeframe,
          onCandle: (k) => {
            if (!candleSeriesRef.current) return;
            const arr = candlesRef.current;
            const lastCandle = arr[arr.length - 1];
            if (lastCandle && lastCandle.time === k.time) {
              arr[arr.length - 1] = k;
            } else if (!lastCandle || k.time > lastCandle.time) {
              arr.push(k);
              if (arr.length > 2000) arr.shift();
            } else {
              return;
            }
            candleSeriesRef.current.update({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            });
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                value: k.volume,
                color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
              });
            }
            updateEMAs();
            updateRSI();
            updateMACD();
            updateADX();
            const prev = arr[arr.length - 2] ?? lastCandle;
            setLastPrice({
              value: k.close,
              pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
            });
          },
        });
      } catch (e) {
        console.error("Failed to load chart data:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;
  const adxPaneIdx = 1 + (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  void renderTick;

  // Sync timezone change reactively on the chart options
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000);
          const isLocal = timezone === "Local";
          const pad = (n: number) => n.toString().padStart(2, "0");
          const yyyy = isLocal ? d.getFullYear() : d.getUTCFullYear();
          const MM = pad(isLocal ? (d.getMonth() + 1) : (d.getUTCMonth() + 1));
          const dd = pad(isLocal ? d.getDate() : d.getUTCDate());
          const hh = pad(isLocal ? d.getHours() : d.getUTCHours());
          const mm = pad(isLocal ? d.getMinutes() : d.getUTCMinutes());
          return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
        }
      },
      timeScale: {
        tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
          const d = new Date(time * 1000);
          const isLocal = timezone === "Local";
          const pad = (n: number) => n.toString().padStart(2, "0");
          const hh = pad(isLocal ? d.getHours() : d.getUTCHours());
          const mm = pad(isLocal ? d.getMinutes() : d.getUTCMinutes());
          const MM = pad(isLocal ? (d.getMonth() + 1) : (d.getUTCMonth() + 1));
          const dd = pad(isLocal ? d.getDate() : d.getUTCDate());
          if (tickMarkType === 2) {
            return `${MM}-${dd}`;
          }
          return `${hh}:${mm}`;
        }
      }
    });
  }, [timezone]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {measureRender}

      {/* Custom extrapolated time label — shows when cursor is past last candle */}
      {extraLabel && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: extraLabel.x,
            bottom: 0,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: TV_COLORS.blue }}
          >
            {extraLabel.text}
          </div>
        </div>
      )}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{symbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">Binance</span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}

      {/* ADX pane label */}
      {indicators.adx && paneOffsets[adxPaneIdx] && (
        <div
          style={{ top: paneOffsets[adxPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`DMI/ADX ${config.dmiLength}, ${config.adxLength}`}
            value={
              lastValues.adx !== undefined
                ? `ADX ${lastValues.adx.toFixed(2)} | +DI ${lastValues.plusDI !== undefined ? lastValues.plusDI.toFixed(2) : ""} | -DI ${lastValues.minusDI !== undefined ? lastValues.minusDI.toFixed(2) : ""}`
                : undefined
            }
            color={INDICATOR_COLORS.adx}
            hidden={hidden.adx}
            onToggleHide={() => toggleHidden("adx")}
            onSettings={() => setSettingsTarget("adx")}
            onRemove={() => removeIndicator("adx")}
          />
        </div>
      )}
    </div>
  );
}
