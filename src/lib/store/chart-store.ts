"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume"
  | "adx";

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  rsiMaLength: number;
  rsiMaType: "None" | "SMA" | "EMA";
  rsiColor: string;
  rsiMaColor: string;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  adxLength: number;
  dmiLength: number;
  adxKeyLevel: number;
  adxColor: string;
  plusDIColor: string;
  minusDIColor: string;
  adxKeyLevelColor: string;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  rsiMaLength: 14,
  rsiMaType: "SMA",
  rsiColor: "#ffffff",
  rsiMaColor: "#26c6da",
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  adxLength: 14,
  dmiLength: 14,
  adxKeyLevel: 23,
  adxColor: "#ef5350",
  plusDIColor: "#2196f3",
  minusDIColor: "#787b86",
  adxKeyLevelColor: "#ffffff",
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
  adx: "#ef5350",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
];

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: string[];
  timezone: "UTC" | "Local";

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
  setTimezone: (tz: "UTC" | "Local") => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        rsi: true,
        macd: false,
        volume: true,
        adx: false,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        macd: false,
        volume: false,
        adx: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      timezone: "UTC",
      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
      setTimezone: (timezone) => set({ timezone }),
    }),
    {
      name: "tv-gratis-chart-state",
      version: 2,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        if (version < 1) {
          if (state && state.config) {
            if (state.config.rsiColor === "#7e57c2") {
              state.config.rsiColor = "#ffffff";
            }
            if (state.config.rsiMaColor === "#ffb74d") {
              state.config.rsiMaColor = "#26c6da";
            }
          }
        }
        if (version < 2) {
          if (state) {
            if (state.indicators && state.indicators.adx === undefined) {
              state.indicators = { ...state.indicators, adx: false };
            }
            if (state.hidden && state.hidden.adx === undefined) {
              state.hidden = { ...state.hidden, adx: false };
            }
            if (state.config) {
              state.config = {
                ...state.config,
                adxLength: 14,
                dmiLength: 14,
                adxKeyLevel: 23,
                adxColor: "#ef5350",
                plusDIColor: "#2196f3",
                minusDIColor: "#787b86",
                adxKeyLevelColor: "#ffffff",
              };
            }
          }
        }
        return state;
      },
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
        timezone: s.timezone,
      }),
    },
  ),
);
