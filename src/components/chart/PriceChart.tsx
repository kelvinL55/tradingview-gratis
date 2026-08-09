"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines, subscribeExchangeWS, parseSymbolKey } from "@/lib/exchanges/router";
import type { Candle, Timeframe } from "@/lib/exchanges/types";
import { ema, rsi, calculateSMA, calculateEMA, adxDmi, rci, stochastic, squeezeMomentum } from "@/lib/indicators";
import { ExchangeBadge } from "@/components/ui/exchange-badge";
import {
  INDICATOR_COLORS,
  useChartStore,
  type IndicatorKey,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import { cn } from "@/lib/utils";

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

const RIGHT_OFFSET = 20;

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
  bg: "#0b0e14",
  panel: "#151924",
  border: "#282e3f",
  text: "#f0f3f8",
  textMuted: "#939bb0",
  green: "#089981",
  red: "#f23645",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#161b26",
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
  volume?: number;
  rsi?: number;
  rsiMa?: number;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  rci1?: number;
  rci2?: number;
  rci3?: number;
  stochK?: number;
  stochD?: number;
  sqzmom?: number;
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
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiBgRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const rsiOversoldRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const rsiOverboughtRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiMaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const adxRef = useRef<ISeriesApi<"Line"> | null>(null);
  const plusDIRef = useRef<ISeriesApi<"Line"> | null>(null);
  const minusDIRef = useRef<ISeriesApi<"Line"> | null>(null);
  const adxKeyLevelRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rci1Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rci2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rci3Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rciOverboughtRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rciOversoldRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochKRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochDRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const stoch80Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzmomHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzmomSqzRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stochPaneTracker = useRef<{ paneIdx: number; scaleId: string } | null>(null);
  const rsiPaneTracker = useRef<{ paneIdx: number; scaleId: string } | null>(null);
  const sqzmomPaneTracker = useRef<{ paneIdx: number; scaleId: string } | null>(null);
  const adxPaneTracker = useRef<{ paneIdx: number; scaleId: string } | null>(null);
  const rciPaneTracker = useRef<{ paneIdx: number; scaleId: string } | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const isLiveFollowingRef = useRef(true);
  const loadReqIdRef = useRef(0);

  // Drawing tools state and refs
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawings, setDrawings] = useState<{
    id: string;
    type: "brush" | "highlighter" | "rectangle" | "circle" | "arrow" | "triangle";
    points: { time: number; price: number }[];
    color: string;
    lineWidth: number;
  }[]>([]);
  const isDrawingRef = useRef(false);
  const currentDrawingRef = useRef<{
    id: string;
    type: "brush" | "highlighter" | "rectangle" | "circle" | "arrow" | "triangle";
    points: { time: number; price: number }[];
    color: string;
    lineWidth: number;
  } | null>(null);
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
  const indicatorPanes = useChartStore((s) => s.indicatorPanes);
  const setIndicatorPane = useChartStore((s) => s.setIndicatorPane);

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

  // Dynamic pane calculations based on indicatorPanes numbers
  const activePaneNums = new Set<number>();
  if (indicators.stoch) activePaneNums.add(indicatorPanes.stoch);
  if (indicators.rsi) activePaneNums.add(indicatorPanes.rsi);
  if (indicators.sqzmom) activePaneNums.add(indicatorPanes.sqzmom);
  if (indicators.adx) activePaneNums.add(indicatorPanes.adx);
  if (indicators.rci) activePaneNums.add(indicatorPanes.rci);

  const sortedActivePanes = Array.from(activePaneNums).sort((a, b) => a - b);

  const getPaneIndexForNum = (paneNum: number) => {
    const idx = sortedActivePanes.indexOf(paneNum);
    return idx === -1 ? 0 : idx + 1; // 1 + index para dejar el 0 al precio principal
  };

  const stochPaneIdx = indicators.stoch ? getPaneIndexForNum(indicatorPanes.stoch) : 0;
  const rsiPaneIdx = indicators.rsi ? getPaneIndexForNum(indicatorPanes.rsi) : 0;
  const sqzmomPaneIdx = indicators.sqzmom ? getPaneIndexForNum(indicatorPanes.sqzmom) : 0;
  const adxPaneIdx = indicators.adx ? getPaneIndexForNum(indicatorPanes.adx) : 0;
  const rciPaneIdx = indicators.rci ? getPaneIndexForNum(indicatorPanes.rci) : 0;

  // Escala izquierda o derecha según si hay indicadores superpuestos en el mismo panel
  const getScaleId = (key: "stoch" | "rsi" | "sqzmom" | "adx" | "rci") => {
    if (!indicators[key]) return "right";
    const paneNum = indicatorPanes[key];
    // Cuando Squeeze Momentum y ADX/DMI comparten panel, el ADX/DMI se asigna al eje Y derecho (visible, para leer niveles como 23, 20, 40)
    // y Squeeze Momentum se asigna al eje Y izquierdo de forma independiente para que coexistan armónicamente sin deformarse.
    if (key === "sqzmom" && indicators.adx && indicatorPanes.adx === paneNum) {
      return "left";
    }
    if (key === "adx" && indicators.sqzmom && indicatorPanes.sqzmom === paneNum) {
      return "right";
    }
    const siblings: ("stoch" | "rsi" | "sqzmom" | "adx" | "rci")[] = [];
    if (indicators.stoch && indicatorPanes.stoch === paneNum) siblings.push("stoch");
    if (indicators.rsi && indicatorPanes.rsi === paneNum) siblings.push("rsi");
    if (indicators.sqzmom && indicatorPanes.sqzmom === paneNum) siblings.push("sqzmom");
    if (indicators.adx && indicatorPanes.adx === paneNum) siblings.push("adx");
    if (indicators.rci && indicatorPanes.rci === paneNum) siblings.push("rci");

    const idx = siblings.indexOf(key);
    return idx <= 0 ? "right" : "left";
  };

  const stochScaleId = getScaleId("stoch");
  const rsiScaleId = getScaleId("rsi");
  const sqzmomScaleId = getScaleId("sqzmom");
  const adxScaleId = getScaleId("adx");
  const rciScaleId = getScaleId("rci");
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
        fontSize: 13,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.blue },
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
        textColor: TV_COLORS.text,
      },
      leftPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.text,
        visible: true,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: RIGHT_OFFSET,
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
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: TV_COLORS.blue,
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
    const logicalRangeHandler = (range: { from: number; to: number } | null) => {
      setRenderTick((t) => t + 1);
      if (range && candlesRef.current.length > 0) {
        const totalBars = candlesRef.current.length;
        if (range.to >= totalBars - 15) {
          isLiveFollowingRef.current = true;
        } else if (range.to < totalBars - 25) {
          isLiveFollowingRef.current = false;
        }
      }
    };
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
      rsiBgRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
      adxRef.current = null;
      plusDIRef.current = null;
      minusDIRef.current = null;
      adxKeyLevelRef.current = null;
      stochKRef.current = null;
      stochDRef.current = null;
      stoch20Ref.current = null;
      stoch50Ref.current = null;
      stoch80Ref.current = null;
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

  // PANEL 1: Estocástico (Stoch) independiente
  useEffect(() => {
    if (!chartRef.current) return;
    const paneOrScaleChanged = stochPaneTracker.current && (stochPaneTracker.current.paneIdx !== stochPaneIdx || stochPaneTracker.current.scaleId !== stochScaleId);
    if ((!indicators.stoch || paneOrScaleChanged) && stochKRef.current && chartRef.current) {
      chartRef.current.removeSeries(stochKRef.current);
      if (stochDRef.current) chartRef.current.removeSeries(stochDRef.current);
      if (stoch80Ref.current) chartRef.current.removeSeries(stoch80Ref.current);
      if (stoch20Ref.current) chartRef.current.removeSeries(stoch20Ref.current);
      if (stoch50Ref.current) chartRef.current.removeSeries(stoch50Ref.current);
      stochKRef.current = null;
      stochDRef.current = null;
      stoch80Ref.current = null;
      stoch20Ref.current = null;
      stoch50Ref.current = null;
      stochPaneTracker.current = null;
    }
    if (indicators.stoch && !stochKRef.current) {
      const kColor = configRef.current.stochKColor ?? "#ffffff";
      const dColor = configRef.current.stochDColor ?? "#ffb74d";

      const kSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: kColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: stochScaleId,
        },
        stochPaneIdx,
      );
      const dSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: dColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: stochScaleId,
        },
        stochPaneIdx,
      );
      const s80 = chartRef.current.addSeries(
        LineSeries,
        {
          color: "#ffb74d",
          lineWidth: 1,
          lineStyle: 0, // solid
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: stochScaleId,
        },
        stochPaneIdx,
      );
      const s20 = chartRef.current.addSeries(
        LineSeries,
        {
          color: "#ffb74d",
          lineWidth: 1,
          lineStyle: 0, // solid
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: stochScaleId,
        },
        stochPaneIdx,
      );
      const s50 = chartRef.current.addSeries(
        LineSeries,
        {
          color: `${TV_COLORS.textMuted}80`,
          lineWidth: 1,
          lineStyle: 2, // dotted
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: stochScaleId,
        },
        stochPaneIdx,
      );

      stochKRef.current = kSeries;
      stochDRef.current = dSeries;
      stoch80Ref.current = s80;
      stoch20Ref.current = s20;
      stoch50Ref.current = s50;
      stochPaneTracker.current = { paneIdx: stochPaneIdx, scaleId: stochScaleId };

      try {
        if (stochPaneIdx > 0) {
          chartRef.current.panes()[stochPaneIdx]?.setStretchFactor(1);
        }
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateStoch();
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.stoch, stochPaneIdx, stochScaleId, indicatorPanes.stoch]);

  // PANEL 2: RSI independiente (sin fusionarse con estocástico ni ADX)
  useEffect(() => {
    if (!chartRef.current) return;
    const paneOrScaleChanged = rsiPaneTracker.current && (rsiPaneTracker.current.paneIdx !== rsiPaneIdx || rsiPaneTracker.current.scaleId !== rsiScaleId);
    if ((!indicators.rsi || paneOrScaleChanged) && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsiBgRef.current) chartRef.current.removeSeries(rsiBgRef.current);
      if (rsiOversoldRef.current) chartRef.current.removeSeries(rsiOversoldRef.current);
      if (rsiOverboughtRef.current) chartRef.current.removeSeries(rsiOverboughtRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi50Ref.current) chartRef.current.removeSeries(rsi50Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      if (rsiMaRef.current) chartRef.current.removeSeries(rsiMaRef.current);
      rsiRef.current = null;
      rsiBgRef.current = null;
      rsiOversoldRef.current = null;
      rsiOverboughtRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
      rsiPaneTracker.current = null;
    }
    if (indicators.rsi && !rsiRef.current) {
      const rColor = configRef.current.rsiColor ?? "#ffffff";
      const rMaColor = configRef.current.rsiMaColor ?? "#26c6da";

      // 1. Relleno de sobreventa (Baseline en 30) - Se agrega primero para quedar al fondo
      const rOversold = chartRef.current.addSeries(
        BaselineSeries,
        {
          baseValue: { type: "price", price: 30 },
          topLineColor: "rgba(0,0,0,0)",
          bottomLineColor: "rgba(0,0,0,0)",
          topFillColor1: "rgba(0,0,0,0)",
          topFillColor2: "rgba(0,0,0,0)",
          bottomFillColor1: "rgba(220, 60, 70, 0.28)",
          bottomFillColor2: "rgba(220, 60, 70, 0.28)",
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );

      // 2. Fondo de canal lila (Baseline)
      const rBg = chartRef.current.addSeries(
        BaselineSeries,
        {
          baseValue: { type: "price", price: 70 },
          topLineColor: "rgba(0,0,0,0)",
          bottomLineColor: "rgba(0,0,0,0)",
          topFillColor1: "rgba(0,0,0,0)",
          topFillColor2: "rgba(0,0,0,0)",
          bottomFillColor1: "rgba(126, 87, 194, 0.15)",
          bottomFillColor2: "rgba(126, 87, 194, 0.15)",
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );

      // 3. Relleno de sobrecompra (Baseline en 70) - Se agrega después para quedar encima
      const rOverbought = chartRef.current.addSeries(
        BaselineSeries,
        {
          baseValue: { type: "price", price: 70 },
          topLineColor: "rgba(0,0,0,0)",
          bottomLineColor: "rgba(0,0,0,0)",
          topFillColor1: "rgba(40, 180, 110, 0.28)",
          topFillColor2: "rgba(40, 180, 110, 0.28)",
          bottomFillColor1: "rgba(0,0,0,0)",
          bottomFillColor2: "rgba(0,0,0,0)",
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );

      // 3. Línea blanca principal del RSI (LineSeries)
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: rColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );
      const r50 = chartRef.current.addSeries(
        LineSeries,
        {
          color: `${TV_COLORS.textMuted}80`, // 50% opacidad
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );
      const rma = chartRef.current.addSeries(
        LineSeries,
        {
          color: rMaColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: rsiScaleId,
        },
        rsiPaneIdx,
      );
      rsiRef.current = r;
      rsiBgRef.current = rBg;
      rsiOversoldRef.current = rOversold;
      rsiOverboughtRef.current = rOverbought;
      rsi30Ref.current = r30;
      rsi50Ref.current = r50;
      rsi70Ref.current = r70;
      rsiMaRef.current = rma;
      rsiPaneTracker.current = { paneIdx: rsiPaneIdx, scaleId: rsiScaleId };
      try {
        if (rsiPaneIdx > 0) {
          chartRef.current.panes()[rsiPaneIdx]?.setStretchFactor(1);
        }
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi, rsiPaneIdx, rsiScaleId, indicatorPanes.rsi]);

  // PANEL 3 (COMBINADO - FONDO): Squeeze Momentum pane
  // Se inicializa antes de ADX para que el histograma actúe como base/fondo en el canvas
  useEffect(() => {
    if (!chartRef.current) return;
    const paneOrScaleChanged = sqzmomPaneTracker.current && (sqzmomPaneTracker.current.paneIdx !== sqzmomPaneIdx || sqzmomPaneTracker.current.scaleId !== sqzmomScaleId);
    if ((!indicators.sqzmom || paneOrScaleChanged) && sqzmomHistRef.current && chartRef.current) {
      chartRef.current.removeSeries(sqzmomHistRef.current);
      if (sqzmomSqzRef.current) chartRef.current.removeSeries(sqzmomSqzRef.current);
      sqzmomHistRef.current = null;
      sqzmomSqzRef.current = null;
      sqzmomPaneTracker.current = null;
    }
    if (indicators.sqzmom && !sqzmomHistRef.current) {
      const histSeries = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: sqzmomScaleId,
        },
        sqzmomPaneIdx,
      );

      const sqzSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: "transparent",
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: sqzmomScaleId,
        },
        sqzmomPaneIdx,
      );

      sqzmomHistRef.current = histSeries;
      sqzmomSqzRef.current = sqzSeries;
      sqzmomPaneTracker.current = { paneIdx: sqzmomPaneIdx, scaleId: sqzmomScaleId };

      try {
        if (sqzmomPaneIdx > 0) {
          chartRef.current.panes()[sqzmomPaneIdx]?.setStretchFactor(1);
        }
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateSqzMom();
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.sqzmom, sqzmomPaneIdx, sqzmomScaleId, indicatorPanes.sqzmom]);

  // PANEL 3 (COMBINADO - SUPERPOSICIÓN): ADX/DMI pane
  // Se inicializa después del histograma para que la línea blanca gruesa se renderice sobre el Squeeze Momentum
  useEffect(() => {
    if (!chartRef.current) return;
    const paneOrScaleChanged = adxPaneTracker.current && (adxPaneTracker.current.paneIdx !== adxPaneIdx || adxPaneTracker.current.scaleId !== adxScaleId);
    if ((!indicators.adx || paneOrScaleChanged) && adxRef.current && chartRef.current) {
      chartRef.current.removeSeries(adxRef.current);
      if (plusDIRef.current) chartRef.current.removeSeries(plusDIRef.current);
      if (minusDIRef.current) chartRef.current.removeSeries(minusDIRef.current);
      if (adxKeyLevelRef.current) chartRef.current.removeSeries(adxKeyLevelRef.current);
      adxRef.current = null;
      plusDIRef.current = null;
      minusDIRef.current = null;
      adxKeyLevelRef.current = null;
      adxPaneTracker.current = null;
    }
    if (indicators.adx && !adxRef.current) {
      const aColor = configRef.current.adxColor ?? "#ffffff";
      const pColor = configRef.current.plusDIColor ?? "#2196f3";
      const mColor = configRef.current.minusDIColor ?? "#787b86";

      const adxSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: aColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceScaleId: adxScaleId,
        },
        adxPaneIdx,
      );
      const plusDISeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: pColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: adxScaleId,
        },
        adxPaneIdx,
      );
      const minusDISeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: mColor,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: adxScaleId,
        },
        adxPaneIdx,
      );
      const adxKeyLevelSeries = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.adxKeyLevelColor ?? "#ffffff",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: adxScaleId,
        },
        adxPaneIdx,
      );

      adxRef.current = adxSeries;
      plusDIRef.current = plusDISeries;
      minusDIRef.current = minusDISeries;
      adxKeyLevelRef.current = adxKeyLevelSeries;
      adxPaneTracker.current = { paneIdx: adxPaneIdx, scaleId: adxScaleId };

      try {
        if (adxPaneIdx > 0) {
          chartRef.current.panes()[adxPaneIdx]?.setStretchFactor(1);
        }
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateADX();
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.adx, adxPaneIdx, adxScaleId, indicatorPanes.adx]);

  // PANEL 4: RCI pane independiente
  useEffect(() => {
    if (!chartRef.current) return;
    const paneOrScaleChanged = rciPaneTracker.current && (rciPaneTracker.current.paneIdx !== rciPaneIdx || rciPaneTracker.current.scaleId !== rciScaleId);
    if ((!indicators.rci || paneOrScaleChanged) && rci1Ref.current && chartRef.current) {
      chartRef.current.removeSeries(rci1Ref.current);
      if (rci2Ref.current) chartRef.current.removeSeries(rci2Ref.current);
      if (rci3Ref.current) chartRef.current.removeSeries(rci3Ref.current);
      if (rciOverboughtRef.current) chartRef.current.removeSeries(rciOverboughtRef.current);
      if (rciOversoldRef.current) chartRef.current.removeSeries(rciOversoldRef.current);
      rci1Ref.current = null;
      rci2Ref.current = null;
      rci3Ref.current = null;
      rciOverboughtRef.current = null;
      rciOversoldRef.current = null;
      rciPaneTracker.current = null;
    }
    if (indicators.rci && !rci1Ref.current) {
      const rci1 = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rciColor1 ?? "#ef5350",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rciScaleId,
        },
        rciPaneIdx,
      );

      const rci2 = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rciColor2 ?? "#2196f3",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rciScaleId,
        },
        rciPaneIdx,
      );

      const rci3 = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rciColor3 ?? "#ab47bc",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rciScaleId,
        },
        rciPaneIdx,
      );

      const ob = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rciOverboughtColor ?? "#2a2e39",
          lineWidth: 1,
          lineStyle: 3,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rciScaleId,
        },
        rciPaneIdx,
      );

      const os = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rciOversoldColor ?? "#2a2e39",
          lineWidth: 1,
          lineStyle: 3,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: rciScaleId,
        },
        rciPaneIdx,
      );

      rci1Ref.current = rci1;
      rci2Ref.current = rci2;
      rci3Ref.current = rci3;
      rciOverboughtRef.current = ob;
      rciOversoldRef.current = os;
      rciPaneTracker.current = { paneIdx: rciPaneIdx, scaleId: rciScaleId };

      try {
        if (rciPaneIdx > 0) {
          chartRef.current.panes()[rciPaneIdx]?.setStretchFactor(1);
        }
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRCI();
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rci, rciPaneIdx, rciScaleId, indicatorPanes.rci]);

  // Recompute offsets when indicator visibility or pane assignment changes
  useEffect(() => {
    const timer = setTimeout(() => {
      recomputePaneOffsets();
    }, 50);
    return () => clearTimeout(timer);
  }, [indicators, indicatorPanes]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    const rsiMaType = config.rsiMaType ?? "SMA";
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsiBgRef.current) rsiBgRef.current.applyOptions({ visible: v("rsi") && (config.rsiShowBg ?? true) });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi50Ref.current) rsi50Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (rsiMaRef.current) rsiMaRef.current.applyOptions({ visible: v("rsi") && rsiMaType !== "None" });

    if (adxRef.current) adxRef.current.applyOptions({ visible: v("adx") && (config.adxShowLine ?? true) });
    if (plusDIRef.current) plusDIRef.current.applyOptions({ visible: v("adx") && (config.adxShowPlusDI ?? true) });
    if (minusDIRef.current) minusDIRef.current.applyOptions({ visible: v("adx") && (config.adxShowMinusDI ?? true) });
    if (adxKeyLevelRef.current) adxKeyLevelRef.current.applyOptions({ visible: v("adx") && (config.adxShowKeyLevel ?? true) });

    if (rci1Ref.current) rci1Ref.current.applyOptions({ visible: v("rci") && (config.rciShow1 ?? true) });
    if (rci2Ref.current) rci2Ref.current.applyOptions({ visible: v("rci") && (config.rciShow2 ?? true) });
    if (rci3Ref.current) rci3Ref.current.applyOptions({ visible: v("rci") && (config.rciShow3 ?? false) });
    if (rciOverboughtRef.current) rciOverboughtRef.current.applyOptions({ visible: v("rci") });
    if (rciOversoldRef.current) rciOversoldRef.current.applyOptions({ visible: v("rci") });

    if (stochKRef.current) stochKRef.current.applyOptions({ visible: v("stoch") });
    if (stochDRef.current) stochDRef.current.applyOptions({ visible: v("stoch") });
    if (stoch80Ref.current) stoch80Ref.current.applyOptions({ visible: v("stoch") });
    if (stoch20Ref.current) stoch20Ref.current.applyOptions({ visible: v("stoch") });
    if (stoch50Ref.current) stoch50Ref.current.applyOptions({ visible: v("stoch") });

    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
    if (sqzmomHistRef.current) sqzmomHistRef.current.applyOptions({ visible: v("sqzmom") && (config.sqzmomShowHist ?? true) });
    if (sqzmomSqzRef.current) sqzmomSqzRef.current.applyOptions({ visible: v("sqzmom") && (config.sqzmomShowSqz ?? true) });
  }, [
    indicators,
    hidden,
    config.rsiMaType,
    config.rsiShowBg,
    config.adxShowLine,
    config.adxShowPlusDI,
    config.adxShowMinusDI,
    config.adxShowKeyLevel,
    config.rciShow1,
    config.rciShow2,
    config.rciShow3,
    config.sqzmomShowHist,
    config.sqzmomShowSqz,
  ]);

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
    const rBgColor = config.rsiBgColor ?? "#7e57c2";
    const rShowBg = config.rsiShowBg ?? true;
    if (rsiRef.current) {
      rsiRef.current.applyOptions({
        color: rColor,
      });
    }
    if (rsiMaRef.current) {
      rsiMaRef.current.applyOptions({
        color: rMaColor,
      });
    }
    if (rsiBgRef.current) {
      rsiBgRef.current.applyOptions({
        bottomFillColor1: hexToRgba(rBgColor, 0.15),
        bottomFillColor2: hexToRgba(rBgColor, 0.15),
        visible: rShowBg && indicators.rsi && !hidden.rsi,
      });
    }
  }, [config.rsiColor, config.rsiMaColor, config.rsiBgColor, config.rsiShowBg, indicators.rsi, hidden.rsi]);



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

  useEffect(() => {
    updateRCI();
  }, [config.rciLength1, config.rciLength2, config.rciLength3, config.rciOverbought, config.rciOversold]);

  useEffect(() => {
    if (rci1Ref.current) rci1Ref.current.applyOptions({ color: config.rciColor1 });
    if (rci2Ref.current) rci2Ref.current.applyOptions({ color: config.rciColor2 });
    if (rci3Ref.current) rci3Ref.current.applyOptions({ color: config.rciColor3 });
    if (rciOverboughtRef.current) rciOverboughtRef.current.applyOptions({ color: config.rciOverboughtColor });
    if (rciOversoldRef.current) rciOversoldRef.current.applyOptions({ color: config.rciOversoldColor });
  }, [config.rciColor1, config.rciColor2, config.rciColor3, config.rciOverboughtColor, config.rciOversoldColor]);

  useEffect(() => {
    updateStoch();
  }, [config.stochPeriodK, config.stochSmoothK, config.stochPeriodD]);

  useEffect(() => {
    if (stochKRef.current) stochKRef.current.applyOptions({ color: config.stochKColor });
    if (stochDRef.current) stochDRef.current.applyOptions({ color: config.stochDColor });
  }, [config.stochKColor, config.stochDColor]);

  useEffect(() => {
    updateSqzMom();
  }, [
    config.sqzmomLength,
    config.sqzmomMult,
    config.sqzmomLengthKC,
    config.sqzmomMultKC,
    config.sqzmomUseTrueRange,
    config.sqzmomColor0,
    config.sqzmomColor1,
    config.sqzmomColor2,
    config.sqzmomColor3,
    config.sqzmomSqzNo,
    config.sqzmomSqzOn,
    config.sqzmomSqzOff,
  ]);

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

    const rsiData = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));

    rsiRef.current.setData(rsiData);
    if (rsiBgRef.current) {
      rsiBgRef.current.setData(
        rsiData.map((p) => ({ time: p.time, value: 30 })),
      );
    }
    if (rsiOversoldRef.current) rsiOversoldRef.current.setData(rsiData);
    if (rsiOverboughtRef.current) rsiOverboughtRef.current.setData(rsiData);

    if (rsi30Ref.current && rsiData.length > 0)
      rsi30Ref.current.setData([
        { time: rsiData[0].time, value: 30 },
        { time: rsiData[rsiData.length - 1].time, value: 30 },
      ]);
    if (rsi50Ref.current && rsiData.length > 0)
      rsi50Ref.current.setData([
        { time: rsiData[0].time, value: 50 },
        { time: rsiData[rsiData.length - 1].time, value: 50 },
      ]);
    if (rsi70Ref.current && rsiData.length > 0)
      rsi70Ref.current.setData([
        { time: rsiData[0].time, value: 70 },
        { time: rsiData[rsiData.length - 1].time, value: 70 },
      ]);

    // Calcular MA de suavizado
    const rsiMaType = cfg.rsiMaType ?? "SMA";
    const rsiMaLength = cfg.rsiMaLength ?? 14;
    let rsiMaData: { time: UTCTimestamp; value: number }[] = [];
    if (rsiMaType !== "None" && rsiData.length > 0) {
      const maPoints = rsiMaType === "EMA"
        ? calculateEMA(rsiData, rsiMaLength)
        : calculateSMA(rsiData, rsiMaLength);
      rsiMaData = maPoints.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      }));
    }
    if (rsiMaRef.current) {
      rsiMaRef.current.setData(rsiMaData);
      rsiMaRef.current.applyOptions({ visible: rsiMaType !== "None" && !hidden.rsi });
    }

    setLastValues((prev) => ({
      ...prev,
      rsi: rsiData.at(-1)?.value,
      rsiMa: rsiMaType !== "None" ? rsiMaData.at(-1)?.value : undefined,
    }));
  }



  function updateRCI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rci1Ref.current) return;
    const cfg = configRef.current;
    
    const r1 = rci(c, cfg.rciLength1);
    const r2 = rci(c, cfg.rciLength2);
    const r3 = rci(c, cfg.rciLength3);

    rci1Ref.current.setData(
      r1.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    );
    if (rci2Ref.current) {
      rci2Ref.current.setData(
        r2.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    }
    if (rci3Ref.current) {
      rci3Ref.current.setData(
        r3.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    }

    const firstValidRci = r1.length > 0 ? r1 : (r2.length > 0 ? r2 : r3);
    if (firstValidRci.length > 0) {
      const times = firstValidRci.map((p) => p.time as UTCTimestamp);
      if (rciOverboughtRef.current) {
        rciOverboughtRef.current.setData([
          { time: times[0], value: cfg.rciOverbought },
          { time: times[times.length - 1], value: cfg.rciOverbought },
        ]);
      }
      if (rciOversoldRef.current) {
        rciOversoldRef.current.setData([
          { time: times[0], value: cfg.rciOversold },
          { time: times[times.length - 1], value: cfg.rciOversold },
        ]);
      }
    }

    setLastValues((prev) => ({
      ...prev,
      rci1: r1.at(-1)?.value,
      rci2: r2.at(-1)?.value,
      rci3: r3.at(-1)?.value,
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

  function updateStoch() {
    const c = candlesRef.current;
    if (c.length === 0 || !stochKRef.current) return;
    const cfg = configRef.current;
    const data = stochastic(c, cfg.stochPeriodK, cfg.stochSmoothK, cfg.stochPeriodD);

    if (data.length === 0) return;

    stochKRef.current.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.k })),
    );
    stochDRef.current?.setData(
      data.map((p) => ({ time: p.time as UTCTimestamp, value: p.d })),
    );

    // Horizontal level lines (80, 20, 50)
    if (stoch80Ref.current && data.length > 0) {
      stoch80Ref.current.setData([
        { time: data[0].time as UTCTimestamp, value: 80 },
        { time: data[data.length - 1].time as UTCTimestamp, value: 80 },
      ]);
    }
    if (stoch20Ref.current && data.length > 0) {
      stoch20Ref.current.setData([
        { time: data[0].time as UTCTimestamp, value: 20 },
        { time: data[data.length - 1].time as UTCTimestamp, value: 20 },
      ]);
    }
    if (stoch50Ref.current && data.length > 0) {
      stoch50Ref.current.setData([
        { time: data[0].time as UTCTimestamp, value: 50 },
        { time: data[data.length - 1].time as UTCTimestamp, value: 50 },
      ]);
    }

    const last = data.at(-1);
    setLastValues((prev) => ({
      ...prev,
      stochK: last?.k,
      stochD: last?.d,
    }));
  }

  function updateSqzMom() {
    const c = candlesRef.current;
    if (c.length === 0 || !sqzmomHistRef.current) return;
    const cfg = configRef.current;
    const points = squeezeMomentum(
      c,
      cfg.sqzmomLength,
      cfg.sqzmomMult,
      cfg.sqzmomLengthKC,
      cfg.sqzmomMultKC,
      cfg.sqzmomUseTrueRange
    );

    // Mapear histograma con colores dinámicos
    const histData = points.map((p, i) => {
      const val = p.val;
      const prevVal = i > 0 ? points[i - 1].val : val;
      let color = cfg.sqzmomColor0; // verde brillante
      if (val > 0) {
        if (val > prevVal) {
          color = cfg.sqzmomColor0; // verde brillante
        } else {
          color = cfg.sqzmomColor1; // verde oscuro
        }
      } else {
        if (val < prevVal) {
          color = cfg.sqzmomColor2; // rojo brillante
        } else {
          color = cfg.sqzmomColor3; // rojo oscuro
        }
      }
      return {
        time: p.time as UTCTimestamp,
        value: val,
        color,
      };
    });

    sqzmomHistRef.current.setData(histData);

    // Mapear cruces de squeeze en 0
    if (sqzmomSqzRef.current) {
      const sqzData = points.map((p) => ({
        time: p.time as UTCTimestamp,
        value: 0,
      }));
      sqzmomSqzRef.current.setData(sqzData);

      // Marcadores (noSqz = azul, sqzOn = negro, sqzOff = gris)
      const markers = points.map((p) => {
        let color = cfg.sqzmomSqzNo;
        if (p.isSqzOn) {
          color = cfg.sqzmomSqzOn;
        } else if (p.isSqzOff) {
          color = cfg.sqzmomSqzOff;
        }
        return {
          time: p.time as UTCTimestamp,
          position: "inSeries" as const,
          shape: "circle" as const,
          color,
          size: 0.5,
        };
      });
      (sqzmomSqzRef.current as any).setMarkers(markers);
    }

    const last = points.at(-1);
    setLastValues((prev) => ({
      ...prev,
      sqzmom: last?.val,
    }));
  }

  // Helpers para extender las líneas de nivel al llegar una vela nueva
  // Solo actualizan el segundo punto (el último) de cada línea de dos puntos
  function updateRSI_levelLines() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const lastT = c[c.length - 1].time as UTCTimestamp;
    rsi30Ref.current?.update({ time: lastT, value: 30 });
    rsi50Ref.current?.update({ time: lastT, value: 50 });
    rsi70Ref.current?.update({ time: lastT, value: 70 });
  }

  function updateADX_keyLevel() {
    const c = candlesRef.current;
    if (c.length === 0 || !adxKeyLevelRef.current) return;
    const cfg = configRef.current;
    const lastT = c[c.length - 1].time as UTCTimestamp;
    adxKeyLevelRef.current.update({ time: lastT, value: cfg.adxKeyLevel });
  }

  function updateStoch_levelLines() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const lastT = c[c.length - 1].time as UTCTimestamp;
    stoch80Ref.current?.update({ time: lastT, value: 80 });
    stoch20Ref.current?.update({ time: lastT, value: 20 });
    stoch50Ref.current?.update({ time: lastT, value: 50 });
  }

  function updateRCI_levelLines() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    const lastT = c[c.length - 1].time as UTCTimestamp;
    rciOverboughtRef.current?.update({ time: lastT, value: cfg.rciOverbought });
    rciOversoldRef.current?.update({ time: lastT, value: cfg.rciOversold });
  }

  // Versiones ligeras para actualización en tiempo real (solo último punto)
  // Se usan en el callback del WS para evitar llamar setData() completo en cada tick
  function updateLastEMAs(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0) return {};
    const cfg = configRef.current;
    const patch: Partial<LastValues> = {};
    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      const last = data.at(-1);
      if (last) ema20Ref.current.update({ time: last.time as UTCTimestamp, value: last.value });
      patch.ema20 = last?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      const last = data.at(-1);
      if (last) ema50Ref.current.update({ time: last.time as UTCTimestamp, value: last.value });
      patch.ema50 = last?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      const last = data.at(-1);
      if (last) ema200Ref.current.update({ time: last.time as UTCTimestamp, value: last.value });
      patch.ema200 = last?.value;
    }
    patch.volume = c.at(-1)?.volume;
    return patch;
  }

  function updateLastRSI(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return {};
    const cfg = configRef.current;
    const rsiData = rsi(c, cfg.rsi);
    const last = rsiData.at(-1);
    if (!last) return {};

    rsiRef.current.update({ time: last.time as UTCTimestamp, value: last.value });
    if (rsiBgRef.current) rsiBgRef.current.update({ time: last.time as UTCTimestamp, value: 30 });
    if (rsiOversoldRef.current) rsiOversoldRef.current.update({ time: last.time as UTCTimestamp, value: last.value });
    if (rsiOverboughtRef.current) rsiOverboughtRef.current.update({ time: last.time as UTCTimestamp, value: last.value });

    const patch: Partial<LastValues> = { rsi: last.value };
    const rsiMaType = cfg.rsiMaType ?? "SMA";
    const rsiMaLength = cfg.rsiMaLength ?? 14;
    if (rsiMaType !== "None" && rsiMaRef.current) {
      const maPoints = rsiMaType === "EMA"
        ? calculateEMA(rsiData, rsiMaLength)
        : calculateSMA(rsiData, rsiMaLength);
      const lastMa = maPoints.at(-1);
      if (lastMa) rsiMaRef.current.update({ time: lastMa.time as UTCTimestamp, value: lastMa.value });
      patch.rsiMa = lastMa?.value;
    }
    return patch;
  }

  function updateLastADX(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0 || !adxRef.current) return {};
    const cfg = configRef.current;
    const data = adxDmi(c, cfg.dmiLength, cfg.adxLength);
    const last = data.at(-1);
    if (!last) return {};

    adxRef.current.update({ time: last.time as UTCTimestamp, value: last.adx });
    plusDIRef.current?.update({ time: last.time as UTCTimestamp, value: last.plusDI });
    minusDIRef.current?.update({ time: last.time as UTCTimestamp, value: last.minusDI });
    return { adx: last.adx, plusDI: last.plusDI, minusDI: last.minusDI };
  }

  function updateLastRCI(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0 || !rci1Ref.current) return {};
    const cfg = configRef.current;
    const r1 = rci(c, cfg.rciLength1);
    const r2 = rci(c, cfg.rciLength2);
    const r3 = rci(c, cfg.rciLength3);
    const l1 = r1.at(-1);
    const l2 = r2.at(-1);
    const l3 = r3.at(-1);
    if (l1) rci1Ref.current.update({ time: l1.time as UTCTimestamp, value: l1.value });
    if (l2 && rci2Ref.current) rci2Ref.current.update({ time: l2.time as UTCTimestamp, value: l2.value });
    if (l3 && rci3Ref.current) rci3Ref.current.update({ time: l3.time as UTCTimestamp, value: l3.value });
    return { rci1: l1?.value, rci2: l2?.value, rci3: l3?.value };
  }

  function updateLastStoch(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0 || !stochKRef.current) return {};
    const cfg = configRef.current;
    const data = stochastic(c, cfg.stochPeriodK, cfg.stochSmoothK, cfg.stochPeriodD);
    const last = data.at(-1);
    if (!last) return {};
    stochKRef.current.update({ time: last.time as UTCTimestamp, value: last.k });
    stochDRef.current?.update({ time: last.time as UTCTimestamp, value: last.d });
    return { stochK: last.k, stochD: last.d };
  }

  function updateLastSqzMom(): Partial<LastValues> {
    const c = candlesRef.current;
    if (c.length === 0 || !sqzmomHistRef.current) return {};
    const cfg = configRef.current;
    const points = squeezeMomentum(c, cfg.sqzmomLength, cfg.sqzmomMult, cfg.sqzmomLengthKC, cfg.sqzmomMultKC, cfg.sqzmomUseTrueRange);
    const last = points.at(-1);
    const prev = points.at(-2);
    if (!last) return {};

    let color = cfg.sqzmomColor0;
    if (last.val > 0) {
      color = last.val > (prev?.val ?? last.val) ? cfg.sqzmomColor0 : cfg.sqzmomColor1;
    } else {
      color = last.val < (prev?.val ?? last.val) ? cfg.sqzmomColor2 : cfg.sqzmomColor3;
    }
    sqzmomHistRef.current.update({ time: last.time as UTCTimestamp, value: last.val, color });
    if (sqzmomSqzRef.current) sqzmomSqzRef.current.update({ time: last.time as UTCTimestamp, value: 0 });
    return { sqzmom: last.val };
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    const currentReqId = ++loadReqIdRef.current;
    isLiveFollowingRef.current = true;

    // Limpieza inmediata de datos viejos para una transición fluida al cambiar de moneda/timeframe
    if (chartRef.current) {
      candleSeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
      rsiRef.current?.setData([]);
      if (rsiBgRef.current) rsiBgRef.current.setData([]);
      rsiOversoldRef.current?.setData([]);
      rsiOverboughtRef.current?.setData([]);
      rsi30Ref.current?.setData([]);
      rsi50Ref.current?.setData([]);
      rsi70Ref.current?.setData([]);
      rsiMaRef.current?.setData([]);
      adxRef.current?.setData([]);
      plusDIRef.current?.setData([]);
      minusDIRef.current?.setData([]);
      adxKeyLevelRef.current?.setData([]);
      rci1Ref.current?.setData([]);
      rci2Ref.current?.setData([]);
      rci3Ref.current?.setData([]);
      stochKRef.current?.setData([]);
      stochDRef.current?.setData([]);
      sqzmomHistRef.current?.setData([]);
      sqzmomSqzRef.current?.setData([]);
      candlesRef.current = [];
    }

    async function load() {
      try {
        const klines = await fetchKlines(symbol, timeframe, 1000);
        if (cancelled || currentReqId !== loadReqIdRef.current) return;
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
        updateADX();
        updateRCI();
        updateStoch();
        updateSqzMom();

        // Smart auto-fit: show a tailored number of recent bars so the chart
        // looks well-proportioned regardless of timeframe or symbol.
        if (chartRef.current && klines.length > 0) {
          const barsToShow = VISIBLE_BARS[timeframe] ?? 200;
          const totalBars = klines.length;
          const from = Math.max(totalBars - barsToShow, 0);
          const to = totalBars - 1 + RIGHT_OFFSET; // right offset for live candles & drawings

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!chartRef.current || currentReqId !== loadReqIdRef.current) return;
              chartRef.current.timeScale().setVisibleLogicalRange({ from, to });

              // Reset all price scales so they auto-fit vertically to the visible data
              candleSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
              rsiRef.current?.priceScale().applyOptions({ autoScale: true });
              adxRef.current?.priceScale().applyOptions({ autoScale: true });
              rci1Ref.current?.priceScale().applyOptions({ autoScale: true });
              stochKRef.current?.priceScale().applyOptions({ autoScale: true });
              sqzmomHistRef.current?.priceScale().applyOptions({ autoScale: true });
            });
          });
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

        unsub = subscribeExchangeWS(symbol, timeframe, (k) => {
          if (!candleSeriesRef.current || currentReqId !== loadReqIdRef.current) return;
          const arr = candlesRef.current;
          const lastCandle = arr[arr.length - 1];
          const isNewCandle = !lastCandle || k.time > lastCandle.time;
          if (lastCandle && lastCandle.time === k.time) {
            arr[arr.length - 1] = k;
          } else if (isNewCandle) {
            arr.push(k);
            if (arr.length > 2000) arr.shift();
          } else {
            return;
          }

          // 1. Actualizar la vela en tiempo real
          candleSeriesRef.current.update({
            time: k.time as UTCTimestamp,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
          });

          // Actualizar el color de la línea del precio actual (verde alcista / rojo bajista)
          candleSeriesRef.current.applyOptions({
            priceLineColor: k.close >= k.open ? TV_COLORS.green : TV_COLORS.red,
          });

          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            });
          }

          // 2. Si estamos en modo Live Follow y llega un tick o vela nueva,
          // mantener autoScale activado en la escala Y y desplazar suavemente el rango visible si es necesario
          if (isLiveFollowingRef.current && chartRef.current) {
            candleSeriesRef.current.priceScale().applyOptions({ autoScale: true });

            if (isNewCandle) {
              const ts = chartRef.current.timeScale();
              const visibleRange = ts.getVisibleLogicalRange();
              if (visibleRange) {
                const barsToShow = visibleRange.to - visibleRange.from;
                const newTo = arr.length - 1 + RIGHT_OFFSET;
                const newFrom = newTo - barsToShow;
                ts.setVisibleLogicalRange({ from: newFrom, to: newTo });
              }
            }
          }

          // 3. Actualización atómica de todos los parches de indicadores en un solo dispatch de React
          const pEma = updateLastEMAs();
          const pRsi = updateLastRSI();
          const pAdx = updateLastADX();
          const pRci = updateLastRCI();
          const pStoch = updateLastStoch();
          const pSqz = updateLastSqzMom();

          // Extender líneas de nivel (RSI 30/50/70, ADX keylevel, Stoch 20/50/80, RCI ob/os)
          updateRSI_levelLines();
          updateADX_keyLevel();
          updateStoch_levelLines();
          updateRCI_levelLines();

          setLastValues((prev) => ({
            ...prev,
            ...pEma,
            ...pRsi,
            ...pAdx,
            ...pRci,
            ...pStoch,
            ...pSqz,
          }));

          const prev = arr[arr.length - 2] ?? lastCandle;
          setLastPrice({
            value: k.close,
            pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
          });
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



  const getTimeX = (time: number): number | null => {
    if (!chartRef.current) return null;
    const ts = chartRef.current.timeScale();
    const directX = ts.timeToCoordinate(time as any);
    if (directX !== null) return directX;

    const arr = candlesRef.current;
    if (arr.length === 0) return null;
    const lastCandle = arr[arr.length - 1];
    if (!lastCandle) return null;

    const secPerBar = TF_SECONDS[timeframeRef.current] ?? 60;
    const lastLogical = arr.length - 1;
    const deltaSeconds = time - lastCandle.time;
    const deltaLogical = deltaSeconds / secPerBar;
    const logicalIndex = lastLogical + deltaLogical;
    return ts.logicalToCoordinate(logicalIndex as any);
  };

  // Helper para obtener tiempo en la coordenada X, con extrapolación fluida para el área futura
  const getTimeForCoordinate = (x: number): number | null => {
    if (!chartRef.current) return null;
    const ts = chartRef.current.timeScale();
    const t = ts.coordinateToTime(x) as number | null;
    if (t !== null) return t;
    // Extrapolación: usamos la posición lógica (bar index) y la última vela
    const arr = candlesRef.current;
    if (arr.length === 0) return null;
    const logical = ts.coordinateToLogical(x);
    if (logical === null) return null;
    const lastIdx = arr.length - 1;
    const lastTime = arr[lastIdx].time;
    const secPerBar = TF_SECONDS[timeframeRef.current] ?? 60;
    return lastTime + (logical - lastIdx) * secPerBar;
  };

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const aX = getTimeX(measure.a.time);
    const bX = getTimeX(measure.b.time);
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

  // Clear drawings when price lines are cleared
  useEffect(() => {
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    if (linesForThisSymbol.length === 0) {
      setDrawings([]);
    }
  }, [priceLines, symbol]);

  // Mouse event handlers for the canvas drawing layer
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };



  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const coords = getCanvasCoords(e);
    if (!coords || !chartRef.current || !candleSeriesRef.current) return;

    // Bug 2: usar extrapolación si estamos en área futura
    const time = getTimeForCoordinate(coords.x);
    const price = candleSeriesRef.current.coordinateToPrice(coords.y);
    if (time === null || price === null) return;

    isDrawingRef.current = true;
    let strokeColor = "#2196f3"; // Blue
    let strokeWidth = 2;

    if (tool === "highlighter") {
      strokeColor = "#ffd54f"; // Yellow
      strokeWidth = 10;
    }

    const newItem = {
      id: Math.random().toString(36).substring(7),
      type: tool as any,
      points: [{ time, price }],
      color: strokeColor,
      lineWidth: strokeWidth,
    };

    currentDrawingRef.current = newItem;
    setRenderTick((t) => t + 1);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentDrawingRef.current || !chartRef.current || !candleSeriesRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Bug 2: usar extrapolación si estamos en área futura
    const time = getTimeForCoordinate(coords.x);
    const price = candleSeriesRef.current.coordinateToPrice(coords.y);
    if (time === null || price === null) return;

    const cur = currentDrawingRef.current;
    if (["brush", "highlighter"].includes(cur.type)) {
      cur.points.push({ time, price });
    } else {
      if (cur.points.length === 1) {
        cur.points.push({ time, price });
      } else {
        cur.points[1] = { time, price };
      }
    }
    setRenderTick((t) => t + 1);
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (currentDrawingRef.current) {
      const cur = currentDrawingRef.current;
      if (cur.points.length > 1 || cur.type === "brush" || cur.type === "highlighter") {
        setDrawings((prev) => [...prev, cur]);
      }
    }
    currentDrawingRef.current = null;
    setRenderTick((t) => t + 1);
  };

  // Sync canvas dimensions and redraw loop
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || !chartRef.current || !candleSeriesRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;

    const drawOne = (item: any) => {
      if (item.points.length === 0) return;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (item.type === "brush" || item.type === "highlighter") {
        ctx.beginPath();
        let first = true;
        for (const pt of item.points) {
          const x = getTimeX(pt.time);
          const y = candleSeries.priceToCoordinate(pt.price);
          if (x !== null && y !== null) {
            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.stroke();
      } else if (item.type === "rectangle" && item.points.length >= 2) {
        const p1 = item.points[0];
        const p2 = item.points[1];
        const x1 = getTimeX(p1.time);
        const y1 = candleSeries.priceToCoordinate(p1.price);
        const x2 = getTimeX(p2.time);
        const y2 = candleSeries.priceToCoordinate(p2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
           ctx.beginPath();
           ctx.rect(x1, y1, x2 - x1, y2 - y1);
           ctx.fillStyle = hexToRgba(item.color, item.type === "highlighter" ? 0.35 : 0.15);
           ctx.fill();
           ctx.stroke();
        }
      } else if (item.type === "circle" && item.points.length >= 2) {
        const p1 = item.points[0];
        const p2 = item.points[1];
        const x1 = getTimeX(p1.time);
        const y1 = candleSeries.priceToCoordinate(p1.price);
        const x2 = getTimeX(p2.time);
        const y2 = candleSeries.priceToCoordinate(p2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
           const rx = Math.abs(x2 - x1);
           const ry = Math.abs(y2 - y1);
           ctx.beginPath();
           ctx.ellipse(x1, y1, rx, ry, 0, 0, 2 * Math.PI);
           ctx.fillStyle = hexToRgba(item.color, 0.15);
           ctx.fill();
           ctx.stroke();
        }
      } else if (item.type === "arrow" && item.points.length >= 2) {
        const p1 = item.points[0];
        const p2 = item.points[1];
        const x1 = getTimeX(p1.time);
        const y1 = candleSeries.priceToCoordinate(p1.price);
        const x2 = getTimeX(p2.time);
        const y2 = candleSeries.priceToCoordinate(p2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
           ctx.beginPath();
           ctx.moveTo(x1, y1);
           ctx.lineTo(x2, y2);
           ctx.stroke();

           const angle = Math.atan2(y2 - y1, x2 - x1);
           ctx.beginPath();
           ctx.moveTo(x2, y2);
           ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
           ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
           ctx.closePath();
           ctx.fillStyle = item.color;
           ctx.fill();
        }
      } else if (item.type === "triangle" && item.points.length >= 2) {
        const p1 = item.points[0];
        const p2 = item.points[1];
        const x1 = getTimeX(p1.time);
        const y1 = candleSeries.priceToCoordinate(p1.price);
        const x2 = getTimeX(p2.time);
        const y2 = candleSeries.priceToCoordinate(p2.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
           ctx.beginPath();
           ctx.moveTo(x1, y1);
           ctx.lineTo(x2, y2);
           ctx.lineTo(x1 - (x2 - x1), y2);
           ctx.closePath();
           ctx.fillStyle = hexToRgba(item.color, 0.15);
           ctx.fill();
           ctx.stroke();
        }
      }
    };

    drawings.forEach(drawOne);
    if (currentDrawingRef.current) {
      drawOne(currentDrawingRef.current);
    }
  }, [drawings, renderTick]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      
      {/* Absolute canvas layer for brush drawings and shapes */}
      <canvas
        ref={drawingCanvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={cn(
          "absolute inset-0 z-20 h-full w-full",
          ["brush", "highlighter", "rectangle", "circle", "arrow", "triangle"].includes(tool)
            ? "pointer-events-auto cursor-crosshair"
            : "pointer-events-none"
        )}
      />

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
          {(() => {
            const parsed = parseSymbolKey(symbol);
            return (
              <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                <span className="text-tv-text">{parsed.symbol}</span>
                <span className="text-tv-text-muted">·</span>
                <span className="uppercase text-tv-text-muted">{timeframe}</span>
                <span className="text-tv-text-muted">·</span>
                <ExchangeBadge exchange={parsed.exchange} />
              </div>
            );
          })()}
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
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
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
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
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
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
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
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
          {indicators.stoch && stochPaneIdx === 0 && (
            <IndicatorPill
              name={`Stoch ${config.stochPeriodK}, ${config.stochSmoothK}, ${config.stochPeriodD}`}
              value={
                lastValues.stochK !== undefined ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span style={{ color: config.stochKColor ?? "#ffffff" }}>
                      %K {lastValues.stochK.toFixed(2)}
                    </span>
                    <span style={{ color: config.stochDColor ?? "#ffb74d" }}>
                      %D {(lastValues.stochD ?? 0).toFixed(2)}
                    </span>
                  </span>
                ) : undefined
              }
              color={INDICATOR_COLORS.stoch}
              hidden={hidden.stoch}
              onToggleHide={() => toggleHidden("stoch")}
              onSettings={() => setSettingsTarget("stoch")}
              onRemove={() => removeIndicator("stoch")}
              order={indicatorPanes.stoch}
              onChangeOrder={(num) => setIndicatorPane("stoch", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
          {indicators.rsi && rsiPaneIdx === 0 && (
            <IndicatorPill
              name={`RSI ${config.rsi}`}
              value={
                lastValues.rsi !== undefined ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span style={{ color: config.rsiColor ?? "#ffffff" }}>
                      {lastValues.rsi.toFixed(2)}
                    </span>
                    {lastValues.rsiMa !== undefined && config.rsiMaType !== "None" && (
                      <span style={{ color: config.rsiMaColor ?? "#26c6da" }}>
                        {lastValues.rsiMa.toFixed(2)}
                      </span>
                    )}
                  </span>
                ) : undefined
              }
              color={INDICATOR_COLORS.rsi}
              hidden={hidden.rsi}
              onToggleHide={() => toggleHidden("rsi")}
              onSettings={() => setSettingsTarget("rsi")}
              onRemove={() => removeIndicator("rsi")}
              order={indicatorPanes.rsi}
              onChangeOrder={(num) => setIndicatorPane("rsi", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
          {indicators.sqzmom && sqzmomPaneIdx === 0 && (
            <IndicatorPill
              name={`SQZMOM_LB`}
              value={
                lastValues.sqzmom !== undefined
                  ? lastValues.sqzmom.toFixed(4)
                  : undefined
              }
              color={INDICATOR_COLORS.sqzmom}
              hidden={hidden.sqzmom}
              onToggleHide={() => toggleHidden("sqzmom")}
              onSettings={() => setSettingsTarget("sqzmom")}
              onRemove={() => removeIndicator("sqzmom")}
              order={indicatorPanes.sqzmom}
              onChangeOrder={(num) => setIndicatorPane("sqzmom", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
          {indicators.adx && adxPaneIdx === 0 && (
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
              order={indicatorPanes.adx}
              onChangeOrder={(num) => setIndicatorPane("adx", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
          {indicators.rci && rciPaneIdx === 0 && (
            <IndicatorPill
              name={`RCI ${config.rciLength1}, ${config.rciLength2}, ${config.rciLength3}`}
              value={
                lastValues.rci1 !== undefined
                  ? `RCI(1): ${lastValues.rci1.toFixed(1)}${lastValues.rci2 !== undefined ? ` | RCI(2): ${lastValues.rci2.toFixed(1)}` : ""}`
                  : undefined
              }
              color={INDICATOR_COLORS.rci}
              hidden={hidden.rci}
              onToggleHide={() => toggleHidden("rci")}
              onSettings={() => setSettingsTarget("rci")}
              onRemove={() => removeIndicator("rci")}
              order={indicatorPanes.rci}
              onChangeOrder={(num) => setIndicatorPane("rci", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          )}
        </div>
      </div>

      {/* Dynamic Pane Indicator Containers for sub-panes */}
      {paneOffsets.map((offset, paneIdx) => {
        if (paneIdx === 0) return null;

        const indicatorsInPane: React.ReactNode[] = [];

        if (indicators.stoch && stochPaneIdx === paneIdx) {
          indicatorsInPane.push(
            <IndicatorPill
              key="stoch"
              name={`Stoch ${config.stochPeriodK}, ${config.stochSmoothK}, ${config.stochPeriodD}`}
              value={
                lastValues.stochK !== undefined ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span style={{ color: config.stochKColor ?? "#ffffff" }}>
                      %K {lastValues.stochK.toFixed(2)}
                    </span>
                    <span style={{ color: config.stochDColor ?? "#ffb74d" }}>
                      %D {(lastValues.stochD ?? 0).toFixed(2)}
                    </span>
                  </span>
                ) : undefined
              }
              color={INDICATOR_COLORS.stoch}
              hidden={hidden.stoch}
              onToggleHide={() => toggleHidden("stoch")}
              onSettings={() => setSettingsTarget("stoch")}
              onRemove={() => removeIndicator("stoch")}
              order={indicatorPanes.stoch}
              onChangeOrder={(num) => setIndicatorPane("stoch", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          );
        }

        if (indicators.rsi && rsiPaneIdx === paneIdx) {
          indicatorsInPane.push(
            <IndicatorPill
              key="rsi"
              name={`RSI ${config.rsi}`}
              value={
                lastValues.rsi !== undefined ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span style={{ color: config.rsiColor ?? "#ffffff" }}>
                      {lastValues.rsi.toFixed(2)}
                    </span>
                    {lastValues.rsiMa !== undefined && config.rsiMaType !== "None" && (
                      <span style={{ color: config.rsiMaColor ?? "#26c6da" }}>
                        {lastValues.rsiMa.toFixed(2)}
                      </span>
                    )}
                  </span>
                ) : undefined
              }
              color={INDICATOR_COLORS.rsi}
              hidden={hidden.rsi}
              onToggleHide={() => toggleHidden("rsi")}
              onSettings={() => setSettingsTarget("rsi")}
              onRemove={() => removeIndicator("rsi")}
              order={indicatorPanes.rsi}
              onChangeOrder={(num) => setIndicatorPane("rsi", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          );
        }

        if (indicators.sqzmom && sqzmomPaneIdx === paneIdx) {
          indicatorsInPane.push(
            <IndicatorPill
              key="sqzmom"
              name={`SQZMOM_LB`}
              value={
                lastValues.sqzmom !== undefined
                  ? lastValues.sqzmom.toFixed(4)
                  : undefined
              }
              color={INDICATOR_COLORS.sqzmom}
              hidden={hidden.sqzmom}
              onToggleHide={() => toggleHidden("sqzmom")}
              onSettings={() => setSettingsTarget("sqzmom")}
              onRemove={() => removeIndicator("sqzmom")}
              order={indicatorPanes.sqzmom}
              onChangeOrder={(num) => setIndicatorPane("sqzmom", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          );
        }

        if (indicators.adx && adxPaneIdx === paneIdx) {
          indicatorsInPane.push(
            <IndicatorPill
              key="adx"
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
              order={indicatorPanes.adx}
              onChangeOrder={(num) => setIndicatorPane("adx", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          );
        }

        if (indicators.rci && rciPaneIdx === paneIdx) {
          indicatorsInPane.push(
            <IndicatorPill
              key="rci"
              name={`RCI ${config.rciLength1}, ${config.rciLength2}, ${config.rciLength3}`}
              value={
                lastValues.rci1 !== undefined
                  ? `RCI(1): ${lastValues.rci1.toFixed(1)}${lastValues.rci2 !== undefined ? ` | RCI(2): ${lastValues.rci2.toFixed(1)}` : ""}`
                  : undefined
              }
              color={INDICATOR_COLORS.rci}
              hidden={hidden.rci}
              onToggleHide={() => toggleHidden("rci")}
              onSettings={() => setSettingsTarget("rci")}
              onRemove={() => removeIndicator("rci")}
              order={indicatorPanes.rci}
              onChangeOrder={(num) => setIndicatorPane("rci", num)}
              onToggleMinimize={() => requestAnimationFrame(() => recomputePaneOffsets())}
            />
          );
        }

        if (indicatorsInPane.length === 0) return null;

        return (
          <div
            key={`pane-pills-${paneIdx}`}
            style={{ top: offset.top + 6, left: 12 }}
            className="pointer-events-none absolute z-10 flex flex-col items-start gap-1"
          >
            {indicatorsInPane}
          </div>
        );
      })}
    </div>
  );
}
