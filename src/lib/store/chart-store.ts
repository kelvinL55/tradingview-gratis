"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "volume"
  | "adx"
  | "rci"
  | "stoch"
  | "sqzmom";

export type DrawingTool =
  | "cursor"
  | "hline"
  | "measure"
  | "eraser"
  | "brush"
  | "highlighter"
  | "rectangle"
  | "circle"
  | "arrow"
  | "triangle";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface ChartProfile {
  id: string;
  name: string;
  symbol: string;
  timeframe: Timeframe;
  indicators: Record<IndicatorKey, boolean>;
  hidden: Record<IndicatorKey, boolean>;
  config: IndicatorConfig;
  timezone: "UTC" | "Local";
  indicatorPanes: Record<"rsi" | "adx" | "rci" | "stoch" | "sqzmom", number>;
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
  rsiShowBg: boolean;
  rsiBgColor: string;
  adxLength: number;
  dmiLength: number;
  adxKeyLevel: number;
  adxColor: string;
  plusDIColor: string;
  minusDIColor: string;
  adxKeyLevelColor: string;
  // DMI/ADX individual line visibilities
  adxShowLine: boolean;
  adxShowPlusDI: boolean;
  adxShowMinusDI: boolean;
  adxShowKeyLevel: boolean;
  // RCI (Rank Correlation Index) configuration
  rciLength1: number;
  rciLength2: number;
  rciLength3: number;
  rciColor1: string;
  rciColor2: string;
  rciColor3: string;
  rciShow1: boolean;
  rciShow2: boolean;
  rciShow3: boolean;
  rciOverbought: number;
  rciOversold: number;
  rciOverboughtColor: string;
  rciOversoldColor: string;
  // Stochastic configuration
  stochPeriodK: number;
  stochSmoothK: number;
  stochPeriodD: number;
  stochEma1Len: number;
  stochEma2Len: number;
  stochKColor: string;
  stochDColor: string;
  // Squeeze Momentum configuration
  sqzmomLength: number;
  sqzmomMult: number;
  sqzmomLengthKC: number;
  sqzmomMultKC: number;
  sqzmomUseTrueRange: boolean;
  sqzmomShowHist: boolean;
  sqzmomColor0: string;
  sqzmomColor1: string;
  sqzmomColor2: string;
  sqzmomColor3: string;
  sqzmomShowSqz: boolean;
  sqzmomSqzNo: string;
  sqzmomSqzOn: string;
  sqzmomSqzOff: string;
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
  rsiShowBg: true,
  rsiBgColor: "#7e57c2",
  adxLength: 14,
  dmiLength: 14,
  adxKeyLevel: 23,
  adxColor: "#ef5350",
  plusDIColor: "#2196f3",
  minusDIColor: "#787b86",
  adxKeyLevelColor: "#ffffff",
  // ADX/DMI visibilities
  adxShowLine: true,
  adxShowPlusDI: true,
  adxShowMinusDI: true,
  adxShowKeyLevel: true,
  // RCI defaults
  rciLength1: 9,
  rciLength2: 26,
  rciLength3: 52,
  rciColor1: "#ef5350",
  rciColor2: "#2196f3",
  rciColor3: "#ab47bc",
  rciShow1: true,
  rciShow2: true,
  rciShow3: false,
  rciOverbought: 80,
  rciOversold: -80,
  rciOverboughtColor: "#2a2e39",
  rciOversoldColor: "#2a2e39",
  // Stochastic defaults
  stochPeriodK: 14,
  stochSmoothK: 1,
  stochPeriodD: 3,
  stochEma1Len: 55,
  stochEma2Len: 200,
  stochKColor: "#ffffff",
  stochDColor: "#ffb74d",
  // Squeeze Momentum defaults
  sqzmomLength: 20,
  sqzmomMult: 2.0,
  sqzmomLengthKC: 20,
  sqzmomMultKC: 1.5,
  sqzmomUseTrueRange: true,
  sqzmomShowHist: true,
  sqzmomColor0: "#00e676", // verde brillante
  sqzmomColor1: "#1b5e20", // verde oscuro
  sqzmomColor2: "#ff5252", // rojo brillante
  sqzmomColor3: "#8e0000", // rojo oscuro
  sqzmomShowSqz: true,
  sqzmomSqzNo: "#0000ff",  // azul (noSqz)
  sqzmomSqzOn: "#000000",  // negro (sqzOn)
  sqzmomSqzOff: "#808080", // gris (sqzOff)
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  volume: "#787b86",
  adx: "#ef5350",
  rci: "#26c6da",
  stoch: "#ffb74d",
  sqzmom: "#00e676",
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
  indicatorPanes: Record<"rsi" | "adx" | "rci" | "stoch" | "sqzmom", number>;
  profiles: Record<string, ChartProfile | null>;
  activeProfileId: string | null;

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
  setIndicatorPane: (key: "rsi" | "adx" | "rci" | "stoch" | "sqzmom", paneNum: number) => void;
  saveProfile: (id: string) => void;
  loadProfile: (id: string) => void;
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
        volume: true,
        adx: false,
        rci: false,
        stoch: false,
        sqzmom: false,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        volume: false,
        adx: false,
        rci: false,
        stoch: false,
        sqzmom: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      timezone: "UTC",
      indicatorPanes: {
        rsi: 1,
        adx: 2,   // mismo panel que sqzmom por defecto
        rci: 3,
        stoch: 4,
        sqzmom: 2, // comparte panel con adx
      },
      profiles: {
        "1": null,
        "2": null,
        "3": null,
        "4": null,
      },
      activeProfileId: null,
      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => {
          const nowEnabled = !s.indicators[key];
          const newIndicators = { ...s.indicators, [key]: nowEnabled };
          const newHidden = nowEnabled ? { ...s.hidden, [key]: false } : s.hidden;
          // Bug 4: cuando se activa ADX, sincronizarlo al mismo panel que SQZMOM
          let newPanes = s.indicatorPanes;
          if (key === 'adx' && nowEnabled) {
            newPanes = { ...s.indicatorPanes, adx: s.indicatorPanes.sqzmom };
          }
          // Y cuando se activa SQZMOM, sincronizar adx al nuevo pane
          if (key === 'sqzmom' && nowEnabled && s.indicators.adx) {
            newPanes = { ...s.indicatorPanes, adx: s.indicatorPanes.sqzmom };
          }
          return {
            indicators: newIndicators,
            hidden: newHidden,
            indicatorPanes: newPanes,
          };
        }),
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
      setIndicatorPane: (key, paneNum) =>
        set((s) => ({
          indicatorPanes: { ...s.indicatorPanes, [key]: paneNum },
        })),
      saveProfile: (id) =>
        set((s) => {
          const profile: ChartProfile = {
            id,
            name: `Perfil ${id}`,
            symbol: s.symbol,
            timeframe: s.timeframe,
            indicators: { ...s.indicators },
            hidden: { ...s.hidden },
            config: { ...s.config },
            timezone: s.timezone,
            indicatorPanes: { ...s.indicatorPanes },
          };
          return {
            profiles: { ...s.profiles, [id]: profile },
            activeProfileId: id,
          };
        }),
      loadProfile: (id) =>
        set((s) => {
          const profile = s.profiles[id];
          if (!profile) return {};
          return {
            symbol: profile.symbol,
            timeframe: profile.timeframe,
            indicators: { ...profile.indicators },
            hidden: { ...profile.hidden },
            config: { ...profile.config },
            timezone: profile.timezone,
            indicatorPanes: profile.indicatorPanes ?? { rsi: 1, adx: 2, rci: 3, stoch: 4, sqzmom: 5 },
            activeProfileId: id,
          };
        }),
    }),
    {
      name: "tv-gratis-chart-state",
      version: 10,
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
        if (version < 3) {
          if (state) {
            if (!state.indicatorPanes) {
              state.indicatorPanes = {
                rsi: "rsi",
                macd: "macd",
                adx: "adx",
              };
            }
          }
        }
        if (version < 4) {
          if (state) {
            if (!state.profiles) {
              state.profiles = {
                "1": null,
                "2": null,
                "3": null,
                "4": null,
              };
            }
            if (state.activeProfileId === undefined) {
              state.activeProfileId = null;
            }
          }
        }
        if (version < 5) {
          if (state) {
            if (state.indicators && state.indicators.rci === undefined) {
              state.indicators = { ...state.indicators, rci: false };
            }
            if (state.hidden && state.hidden.rci === undefined) {
              state.hidden = { ...state.hidden, rci: false };
            }
            if (state.indicatorPanes && state.indicatorPanes.rci === undefined) {
              state.indicatorPanes = { ...state.indicatorPanes, rci: "rci" };
            }
            if (state.config) {
              state.config = {
                ...DEFAULT_CONFIG,
                ...state.config,
              };
            }
          }
        }
        if (version < 6) {
          if (state) {
            if (state.indicators && state.indicators.stoch === undefined) {
              state.indicators = { ...state.indicators, stoch: false };
            }
            if (state.hidden && state.hidden.stoch === undefined) {
              state.hidden = { ...state.hidden, stoch: false };
            }
            if (state.indicatorPanes && state.indicatorPanes.stoch === undefined) {
              state.indicatorPanes = { ...state.indicatorPanes, stoch: "stoch" };
            }
            if (state.config) {
              state.config = {
                ...DEFAULT_CONFIG,
                ...state.config,
              };
            }
          }
        }
        if (version < 7) {
          if (state) {
            if (state.indicators && state.indicators.sqzmom === undefined) {
              state.indicators = { ...state.indicators, sqzmom: false };
            }
            if (state.hidden && state.hidden.sqzmom === undefined) {
              state.hidden = { ...state.hidden, sqzmom: false };
            }
            if (state.indicatorPanes && state.indicatorPanes.sqzmom === undefined) {
              state.indicatorPanes = { ...state.indicatorPanes, sqzmom: "sqzmom" };
            }
            if (state.config) {
              state.config = {
                ...DEFAULT_CONFIG,
                ...state.config,
              };
            }
          }
        }
        if (version < 8) {
          if (state) {
            // Eliminar macd de los indicadores y de los ocultos
            if (state.indicators) {
              delete state.indicators.macd;
            }
            if (state.hidden) {
              delete state.hidden.macd;
            }
            // Inicializar oscillatorOrder por defecto
            if (state.oscillatorOrder === undefined) {
              state.oscillatorOrder = ["rsi", "adx", "rci", "stoch", "sqzmom"];
            }
            // Limpiar config de cualquier propiedad macd residual si la hubiera
            if (state.config) {
              const cleanedConfig = { ...DEFAULT_CONFIG, ...state.config };
              const macdKeys = [
                "macdFast", "macdSlow", "macdSignal", "macdShowMACD",
                "macdShowSignal", "macdShowHist", "macdShowMountain",
                "macdMountainOpacity", "macdColor", "macdSignalColor",
                "macdBullishStrongColor", "macdBullishWeakColor",
                "macdBearishStrongColor", "macdBearishWeakColor"
              ];
              for (const key of macdKeys) {
                delete (cleanedConfig as any)[key];
              }
              state.config = cleanedConfig;
            }
            // Eliminar indicatorPanes
            delete state.indicatorPanes;

            // Limpiar perfiles
            if (state.profiles) {
              for (const key of Object.keys(state.profiles)) {
                const profile = state.profiles[key];
                if (profile) {
                  if (profile.indicators) delete profile.indicators.macd;
                  if (profile.hidden) delete profile.hidden.macd;
                  profile.oscillatorOrder = ["rsi", "adx", "rci", "stoch", "sqzmom"];
                  delete profile.indicatorPanes;
                }
              }
            }
          }
        }
        if (version < 9) {
          if (state) {
            // Eliminar oscillatorOrder y restaurar indicatorPanes
            delete state.oscillatorOrder;
            if (state.indicatorPanes === undefined) {
              state.indicatorPanes = {
                rsi: 1,
                adx: 2,
                rci: 3,
                stoch: 4,
                sqzmom: 2, // mismo pane que adx
              };
            }
            if (state.config) {
              state.config = {
                ...DEFAULT_CONFIG,
                ...state.config,
                rsiShowBg: state.config.rsiShowBg ?? true,
                rsiBgColor: state.config.rsiBgColor ?? "#7e57c2",
              };
            }
            if (state.profiles) {
              for (const key of Object.keys(state.profiles)) {
                const profile = state.profiles[key];
                if (profile) {
                  delete profile.oscillatorOrder;
                  profile.indicatorPanes = profile.indicatorPanes ?? { rsi: 1, adx: 2, rci: 3, stoch: 4, sqzmom: 2 };
                }
              }
            }
          }
        }
        if (version < 10) {
          // Forzar sqzmom al mismo pane que adx (pane 2)
          if (state && state.indicatorPanes) {
            state.indicatorPanes = {
              ...state.indicatorPanes,
              sqzmom: state.indicatorPanes.adx ?? 2,
            };
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
        indicatorPanes: s.indicatorPanes,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
      }),
    },
  ),
);
