"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  type IndicatorKey,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20: "EMA — Slot 1",
  ema50: "EMA — Slot 2",
  ema200: "EMA — Slot 3",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  adx: "DMI / ADX / KEYLEVEL",
  rci: "RCI (Rank Correlation Index)",
  stoch: "Stoch + EMAs Replica",
  sqzmom: "SQZMOM_LB",
};

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="bg-tv-panel max-w-full md:max-w-sm md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 rounded-t-xl md:rounded-xl rounded-b-none border-t md:border border-tv-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            onSave={(patch) => {
              setConfig(patch);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  onSave: (patch: Partial<typeof DEFAULT_CONFIG>) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, onSave, onReset }: FormProps) {
  const [activeTab, setActiveTab] = useState<"inputs" | "style">("inputs");

  // Local draft state to avoid recalculating chart on every keystroke
  const [draft, setDraft] = useState({
    ema20: config.ema20,
    ema50: config.ema50,
    ema200: config.ema200,
    rsi: config.rsi,
    rsiMaLength: config.rsiMaLength ?? 14,
    rsiMaType: config.rsiMaType ?? "SMA",
    rsiColor: config.rsiColor ?? "#7e57c2",
    rsiMaColor: config.rsiMaColor ?? "#ffb74d",
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
    macdShowMACD: config.macdShowMACD ?? true,
    macdShowSignal: config.macdShowSignal ?? true,
    macdShowHist: config.macdShowHist ?? true,
    macdShowMountain: config.macdShowMountain ?? false,
    macdMountainOpacity: config.macdMountainOpacity ?? 0.1,
    macdColor: config.macdColor ?? "#2962ff",
    macdSignalColor: config.macdSignalColor ?? "#ffb74d",
    macdBullishStrongColor: config.macdBullishStrongColor ?? "#26a69a",
    macdBullishWeakColor: config.macdBullishWeakColor ?? "#1e6a5f",
    macdBearishStrongColor: config.macdBearishStrongColor ?? "#ef5350",
    macdBearishWeakColor: config.macdBearishWeakColor ?? "#953432",
    adxLength: config.adxLength ?? 14,
    dmiLength: config.dmiLength ?? 14,
    adxKeyLevel: config.adxKeyLevel ?? 23,
    adxColor: config.adxColor ?? "#ef5350",
    plusDIColor: config.plusDIColor ?? "#2196f3",
    minusDIColor: config.minusDIColor ?? "#787b86",
    adxKeyLevelColor: config.adxKeyLevelColor ?? "#ffffff",
    adxShowLine: config.adxShowLine ?? true,
    adxShowPlusDI: config.adxShowPlusDI ?? true,
    adxShowMinusDI: config.adxShowMinusDI ?? true,
    adxShowKeyLevel: config.adxShowKeyLevel ?? true,
    rciLength1: config.rciLength1 ?? 9,
    rciLength2: config.rciLength2 ?? 26,
    rciLength3: config.rciLength3 ?? 52,
    rciColor1: config.rciColor1 ?? "#ef5350",
    rciColor2: config.rciColor2 ?? "#2196f3",
    rciColor3: config.rciColor3 ?? "#ab47bc",
    rciShow1: config.rciShow1 ?? true,
    rciShow2: config.rciShow2 ?? true,
    rciShow3: config.rciShow3 ?? false,
    rciOverbought: config.rciOverbought ?? 80,
    rciOversold: config.rciOversold ?? -80,
    rciOverboughtColor: config.rciOverboughtColor ?? "#2a2e39",
    rciOversoldColor: config.rciOversoldColor ?? "#2a2e39",
    stochPeriodK: config.stochPeriodK ?? 14,
    stochSmoothK: config.stochSmoothK ?? 1,
    stochPeriodD: config.stochPeriodD ?? 3,
    stochEma1Len: config.stochEma1Len ?? 55,
    stochEma2Len: config.stochEma2Len ?? 200,
    stochKColor: config.stochKColor ?? "#ffffff",
    stochDColor: config.stochDColor ?? "#ffb74d",
    sqzmomLength: config.sqzmomLength ?? 20,
    sqzmomMult: config.sqzmomMult ?? 2.0,
    sqzmomLengthKC: config.sqzmomLengthKC ?? 20,
    sqzmomMultKC: config.sqzmomMultKC ?? 1.5,
    sqzmomUseTrueRange: config.sqzmomUseTrueRange ?? true,
    sqzmomShowHist: config.sqzmomShowHist ?? true,
    sqzmomColor0: config.sqzmomColor0 ?? "#00e676",
    sqzmomColor1: config.sqzmomColor1 ?? "#1b5e20",
    sqzmomColor2: config.sqzmomColor2 ?? "#ff5252",
    sqzmomColor3: config.sqzmomColor3 ?? "#8e0000",
    sqzmomShowSqz: config.sqzmomShowSqz ?? true,
    sqzmomSqzNo: config.sqzmomSqzNo ?? "#0000ff",
    sqzmomSqzOn: config.sqzmomSqzOn ?? "#000000",
    sqzmomSqzOff: config.sqzmomSqzOff ?? "#808080",
  });

  useEffect(() => {
    setDraft({
      ema20: config.ema20,
      ema50: config.ema50,
      ema200: config.ema200,
      rsi: config.rsi,
      rsiMaLength: config.rsiMaLength ?? 14,
      rsiMaType: config.rsiMaType ?? "SMA",
      rsiColor: config.rsiColor ?? "#7e57c2",
      rsiMaColor: config.rsiMaColor ?? "#ffb74d",
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
      macdShowMACD: config.macdShowMACD ?? true,
      macdShowSignal: config.macdShowSignal ?? true,
      macdShowHist: config.macdShowHist ?? true,
      macdShowMountain: config.macdShowMountain ?? false,
      macdMountainOpacity: config.macdMountainOpacity ?? 0.1,
      macdColor: config.macdColor ?? "#2962ff",
      macdSignalColor: config.macdSignalColor ?? "#ffb74d",
      macdBullishStrongColor: config.macdBullishStrongColor ?? "#26a69a",
      macdBullishWeakColor: config.macdBullishWeakColor ?? "#1e6a5f",
      macdBearishStrongColor: config.macdBearishStrongColor ?? "#ef5350",
      macdBearishWeakColor: config.macdBearishWeakColor ?? "#953432",
      adxLength: config.adxLength ?? 14,
      dmiLength: config.dmiLength ?? 14,
      adxKeyLevel: config.adxKeyLevel ?? 23,
      adxColor: config.adxColor ?? "#ef5350",
      plusDIColor: config.plusDIColor ?? "#2196f3",
      minusDIColor: config.minusDIColor ?? "#787b86",
      adxKeyLevelColor: config.adxKeyLevelColor ?? "#ffffff",
      adxShowLine: config.adxShowLine ?? true,
      adxShowPlusDI: config.adxShowPlusDI ?? true,
      adxShowMinusDI: config.adxShowMinusDI ?? true,
      adxShowKeyLevel: config.adxShowKeyLevel ?? true,
      rciLength1: config.rciLength1 ?? 9,
      rciLength2: config.rciLength2 ?? 26,
      rciLength3: config.rciLength3 ?? 52,
      rciColor1: config.rciColor1 ?? "#ef5350",
      rciColor2: config.rciColor2 ?? "#2196f3",
      rciColor3: config.rciColor3 ?? "#ab47bc",
      rciShow1: config.rciShow1 ?? true,
      rciShow2: config.rciShow2 ?? true,
      rciShow3: config.rciShow3 ?? false,
      rciOverbought: config.rciOverbought ?? 80,
      rciOversold: config.rciOversold ?? -80,
      rciOverboughtColor: config.rciOverboughtColor ?? "#2a2e39",
      rciOversoldColor: config.rciOversoldColor ?? "#2a2e39",
      stochPeriodK: config.stochPeriodK ?? 14,
      stochSmoothK: config.stochSmoothK ?? 1,
      stochPeriodD: config.stochPeriodD ?? 3,
      stochEma1Len: config.stochEma1Len ?? 55,
      stochEma2Len: config.stochEma2Len ?? 200,
      stochKColor: config.stochKColor ?? "#ffffff",
      stochDColor: config.stochDColor ?? "#ffb74d",
      sqzmomLength: config.sqzmomLength ?? 20,
      sqzmomMult: config.sqzmomMult ?? 2.0,
      sqzmomLengthKC: config.sqzmomLengthKC ?? 20,
      sqzmomMultKC: config.sqzmomMultKC ?? 1.5,
      sqzmomUseTrueRange: config.sqzmomUseTrueRange ?? true,
      sqzmomShowHist: config.sqzmomShowHist ?? true,
      sqzmomColor0: config.sqzmomColor0 ?? "#00e676",
      sqzmomColor1: config.sqzmomColor1 ?? "#1b5e20",
      sqzmomColor2: config.sqzmomColor2 ?? "#ff5252",
      sqzmomColor3: config.sqzmomColor3 ?? "#8e0000",
      sqzmomShowSqz: config.sqzmomShowSqz ?? true,
      sqzmomSqzNo: config.sqzmomSqzNo ?? "#0000ff",
      sqzmomSqzOn: config.sqzmomSqzOn ?? "#000000",
      sqzmomSqzOff: config.sqzmomSqzOff ?? "#808080",
    });
    setActiveTab("inputs");
  }, [config, target]);

  function save() {
    if (target === "ema20") onSave({ ema20: clamp(draft.ema20, 2, 500) });
    else if (target === "ema50") onSave({ ema50: clamp(draft.ema50, 2, 500) });
    else if (target === "ema200") onSave({ ema200: clamp(draft.ema200, 2, 500) });
    else if (target === "rsi")
      onSave({
        rsi: clamp(draft.rsi, 2, 100),
        rsiMaLength: clamp(draft.rsiMaLength, 2, 100),
        rsiMaType: draft.rsiMaType,
        rsiColor: draft.rsiColor,
        rsiMaColor: draft.rsiMaColor,
      });
    else if (target === "macd")
      onSave({
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
        macdShowMACD: draft.macdShowMACD,
        macdShowSignal: draft.macdShowSignal,
        macdShowHist: draft.macdShowHist,
        macdShowMountain: draft.macdShowMountain,
        macdMountainOpacity: clamp(draft.macdMountainOpacity, 0, 1),
        macdColor: draft.macdColor,
        macdSignalColor: draft.macdSignalColor,
        macdBullishStrongColor: draft.macdBullishStrongColor,
        macdBullishWeakColor: draft.macdBullishWeakColor,
        macdBearishStrongColor: draft.macdBearishStrongColor,
        macdBearishWeakColor: draft.macdBearishWeakColor,
      });
    else if (target === "adx")
      onSave({
        adxLength: clamp(draft.adxLength, 2, 100),
        dmiLength: clamp(draft.dmiLength, 2, 100),
        adxKeyLevel: clamp(draft.adxKeyLevel, 1, 100),
        adxColor: draft.adxColor,
        plusDIColor: draft.plusDIColor,
        minusDIColor: draft.minusDIColor,
        adxKeyLevelColor: draft.adxKeyLevelColor,
        adxShowLine: draft.adxShowLine,
        adxShowPlusDI: draft.adxShowPlusDI,
        adxShowMinusDI: draft.adxShowMinusDI,
        adxShowKeyLevel: draft.adxShowKeyLevel,
      });
    else if (target === "rci")
      onSave({
        rciLength1: clamp(draft.rciLength1, 2, 200),
        rciLength2: clamp(draft.rciLength2, 2, 200),
        rciLength3: clamp(draft.rciLength3, 2, 200),
        rciColor1: draft.rciColor1,
        rciColor2: draft.rciColor2,
        rciColor3: draft.rciColor3,
        rciShow1: draft.rciShow1,
        rciShow2: draft.rciShow2,
        rciShow3: draft.rciShow3,
        rciOverbought: clamp(draft.rciOverbought, 0, 100),
        rciOversold: clamp(draft.rciOversold, -100, 0),
        rciOverboughtColor: draft.rciOverboughtColor,
        rciOversoldColor: draft.rciOversoldColor,
      });
    else if (target === "stoch")
      onSave({
        stochPeriodK: clamp(draft.stochPeriodK, 2, 200),
        stochSmoothK: clamp(draft.stochSmoothK, 1, 50),
        stochPeriodD: clamp(draft.stochPeriodD, 1, 50),
        stochEma1Len: clamp(draft.stochEma1Len, 2, 500),
        stochEma2Len: clamp(draft.stochEma2Len, 2, 500),
        stochKColor: draft.stochKColor,
        stochDColor: draft.stochDColor,
      });
    else if (target === "sqzmom")
      onSave({
        sqzmomLength: clamp(draft.sqzmomLength, 2, 200),
        sqzmomMult: clamp(draft.sqzmomMult, 0.1, 10),
        sqzmomLengthKC: clamp(draft.sqzmomLengthKC, 2, 200),
        sqzmomMultKC: clamp(draft.sqzmomMultKC, 0.1, 10),
        sqzmomUseTrueRange: draft.sqzmomUseTrueRange,
        sqzmomShowHist: draft.sqzmomShowHist,
        sqzmomColor0: draft.sqzmomColor0,
        sqzmomColor1: draft.sqzmomColor1,
        sqzmomColor2: draft.sqzmomColor2,
        sqzmomColor3: draft.sqzmomColor3,
        sqzmomShowSqz: draft.sqzmomShowSqz,
        sqzmomSqzNo: draft.sqzmomSqzNo,
        sqzmomSqzOn: draft.sqzmomSqzOn,
        sqzmomSqzOff: draft.sqzmomSqzOff,
      });
    else if (target === "volume") onSave({});
  }

  return (
    <div className="flex flex-col gap-3 text-tv-text">
      {/* TradingView-like Tabs for RSI / ADX / MACD / RCI to divide Inputs vs Style */}
      {(target === "rsi" || target === "adx" || target === "macd" || target === "rci" || target === "stoch" || target === "sqzmom") && (
        <div className="flex border-b border-tv-border -mx-6 px-6 mb-2 text-xs">
          <button
            onClick={() => setActiveTab("inputs")}
            className={`pb-2 px-1 font-semibold border-b-2 mr-4 transition-all duration-150 cursor-pointer ${
              activeTab === "inputs"
                ? "border-tv-blue text-tv-text"
                : "border-transparent text-tv-text-muted hover:text-tv-text"
            }`}
          >
            Entradas de datos
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`pb-2 px-1 font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
              activeTab === "style"
                ? "border-tv-blue text-tv-text"
                : "border-transparent text-tv-text-muted hover:text-tv-text"
            }`}
          >
            Estilo
          </button>
        </div>
      )}

      {/* Inputs Tab content */}
      {activeTab === "inputs" && (
        <div className="flex flex-col gap-3">
          {(target === "ema20" || target === "ema50" || target === "ema200") && (
            <Field
              label="Período"
              value={draft[target]}
              onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
            />
          )}
          {target === "rsi" && (
            <div className="flex flex-col gap-3">
              <Field
                label="Período RSI"
                value={draft.rsi}
                onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
              />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
                  Tipo de MA de suavizado
                </span>
                <select
                  value={draft.rsiMaType}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      rsiMaType: e.target.value as "None" | "SMA" | "EMA",
                    }))
                  }
                  className="w-full rounded-md border border-tv-border bg-tv-bg px-3 py-2 text-xs text-tv-text focus:outline-none focus:ring-1 focus:ring-tv-blue"
                >
                  <option value="None">Ninguno</option>
                  <option value="SMA">SMA (Simple)</option>
                  <option value="EMA">EMA (Exponencial)</option>
                </select>
              </div>
              {draft.rsiMaType !== "None" && (
                <Field
                  label="Longitud de MA"
                  value={draft.rsiMaLength}
                  onChange={(n) => setDraft((d) => ({ ...d, rsiMaLength: n }))}
                />
              )}
            </div>
          )}
          {target === "macd" && (
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="Rápida"
                value={draft.macdFast}
                onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
              />
              <Field
                label="Lenta"
                value={draft.macdSlow}
                onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
              />
              <Field
                label="Señal"
                value={draft.macdSignal}
                onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
              />
            </div>
          )}
          {target === "adx" && (
            <div className="flex flex-col gap-3">
              <Field
                label="Suavizado ADX (ADX Smoothing)"
                value={draft.adxLength}
                onChange={(n) => setDraft((d) => ({ ...d, adxLength: n }))}
              />
              <Field
                label="Longitud DI (DI Length)"
                value={draft.dmiLength}
                onChange={(n) => setDraft((d) => ({ ...d, dmiLength: n }))}
              />
              <Field
                label="Nivel clave ADX (Key Level)"
                value={draft.adxKeyLevel}
                onChange={(n) => setDraft((d) => ({ ...d, adxKeyLevel: n }))}
              />
            </div>
          )}
          {target === "rci" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 rounded border border-tv-border/40 p-2">
                <div className="flex items-center justify-between">
                  <CheckboxField
                    label="Habilitar RCI 1"
                    checked={draft.rciShow1}
                    onChange={(b) => setDraft((d) => ({ ...d, rciShow1: b }))}
                  />
                  {draft.rciShow1 && (
                    <div className="w-24">
                      <Field
                        label=""
                        value={draft.rciLength1}
                        onChange={(n) => setDraft((d) => ({ ...d, rciLength1: n }))}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <CheckboxField
                    label="Habilitar RCI 2"
                    checked={draft.rciShow2}
                    onChange={(b) => setDraft((d) => ({ ...d, rciShow2: b }))}
                  />
                  {draft.rciShow2 && (
                    <div className="w-24">
                      <Field
                        label=""
                        value={draft.rciLength2}
                        onChange={(n) => setDraft((d) => ({ ...d, rciLength2: n }))}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <CheckboxField
                    label="Habilitar RCI 3"
                    checked={draft.rciShow3}
                    onChange={(b) => setDraft((d) => ({ ...d, rciShow3: b }))}
                  />
                  {draft.rciShow3 && (
                    <div className="w-24">
                      <Field
                        label=""
                        value={draft.rciLength3}
                        onChange={(n) => setDraft((d) => ({ ...d, rciLength3: n }))}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Field
                  label="Sobrecompra"
                  value={draft.rciOverbought}
                  onChange={(n) => setDraft((d) => ({ ...d, rciOverbought: n }))}
                />
                <Field
                  label="Sobreventa"
                  value={draft.rciOversold}
                  onChange={(n) => setDraft((d) => ({ ...d, rciOversold: n }))}
                />
              </div>
            </div>
          )}
          {target === "stoch" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Longitud %K"
                  value={draft.stochPeriodK}
                  onChange={(n) => setDraft((d) => ({ ...d, stochPeriodK: n }))}
                />
                <Field
                  label="Suavizado %K"
                  value={draft.stochSmoothK}
                  onChange={(n) => setDraft((d) => ({ ...d, stochSmoothK: n }))}
                />
                <Field
                  label="Suavizado %D"
                  value={draft.stochPeriodD}
                  onChange={(n) => setDraft((d) => ({ ...d, stochPeriodD: n }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Field
                  label="EMA 1 (referencia)"
                  value={draft.stochEma1Len}
                  onChange={(n) => setDraft((d) => ({ ...d, stochEma1Len: n }))}
                />
                <Field
                  label="EMA 2 (referencia)"
                  value={draft.stochEma2Len}
                  onChange={(n) => setDraft((d) => ({ ...d, stochEma2Len: n }))}
                />
              </div>
            </div>
          )}
          {target === "sqzmom" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="BB Length"
                  value={draft.sqzmomLength}
                  onChange={(n) => setDraft((d) => ({ ...d, sqzmomLength: n }))}
                />
                <DecimalField
                  label="BB MultFactor"
                  value={draft.sqzmomMult}
                  onChange={(n) => setDraft((d) => ({ ...d, sqzmomMult: n }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="KC Length"
                  value={draft.sqzmomLengthKC}
                  onChange={(n) => setDraft((d) => ({ ...d, sqzmomLengthKC: n }))}
                />
                <DecimalField
                  label="KC MultFactor"
                  value={draft.sqzmomMultKC}
                  onChange={(n) => setDraft((d) => ({ ...d, sqzmomMultKC: n }))}
                />
              </div>
              <div className="mt-1">
                <CheckboxField
                  label="Use TrueRange (KC)"
                  checked={draft.sqzmomUseTrueRange}
                  onChange={(b) => setDraft((d) => ({ ...d, sqzmomUseTrueRange: b }))}
                />
              </div>
            </div>
          )}
          {target === "volume" && (
            <p className="text-xs text-tv-text-muted">
              El indicador de volumen no tiene parámetros configurables en esta
              versión.
            </p>
          )}
        </div>
      )}

      {/* Style Tab content */}
      {activeTab === "style" && target === "rsi" && (
        <div className="flex flex-col gap-4 py-2 border-b border-tv-border/20">
          <ColorPicker
            value={draft.rsiColor}
            onChange={(color) => setDraft((d) => ({ ...d, rsiColor: color }))}
            label="Línea RSI"
          />
          {draft.rsiMaType !== "None" && (
            <ColorPicker
              value={draft.rsiMaColor}
              onChange={(color) => setDraft((d) => ({ ...d, rsiMaColor: color }))}
              label="Promedio Móvil (RSI-based MA)"
            />
          )}
        </div>
      )}

      {activeTab === "style" && target === "macd" && (
        <div className="flex flex-col gap-3 py-2 border-b border-tv-border/20 max-h-[250px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar MACD"
              checked={draft.macdShowMACD}
              onChange={(b) => setDraft((d) => ({ ...d, macdShowMACD: b }))}
            />
            {draft.macdShowMACD && (
              <ColorPicker
                value={draft.macdColor}
                onChange={(color) => setDraft((d) => ({ ...d, macdColor: color }))}
                label=""
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar Señal"
              checked={draft.macdShowSignal}
              onChange={(b) => setDraft((d) => ({ ...d, macdShowSignal: b }))}
            />
            {draft.macdShowSignal && (
              <ColorPicker
                value={draft.macdSignalColor}
                onChange={(color) => setDraft((d) => ({ ...d, macdSignalColor: color }))}
                label=""
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-tv-border/40 pt-2">
            <CheckboxField
              label="Mostrar Histograma"
              checked={draft.macdShowHist}
              onChange={(b) => setDraft((d) => ({ ...d, macdShowHist: b }))}
            />
            {draft.macdShowHist && (
              <div className="grid grid-cols-2 gap-2 pl-4 pt-1">
                <ColorPicker
                  value={draft.macdBullishStrongColor}
                  onChange={(color) => setDraft((d) => ({ ...d, macdBullishStrongColor: color }))}
                  label="Alcista Fuerte"
                />
                <ColorPicker
                  value={draft.macdBullishWeakColor}
                  onChange={(color) => setDraft((d) => ({ ...d, macdBullishWeakColor: color }))}
                  label="Alcista Débil"
                />
                <ColorPicker
                  value={draft.macdBearishStrongColor}
                  onChange={(color) => setDraft((d) => ({ ...d, macdBearishStrongColor: color }))}
                  label="Bajista Fuerte"
                />
                <ColorPicker
                  value={draft.macdBearishWeakColor}
                  onChange={(color) => setDraft((d) => ({ ...d, macdBearishWeakColor: color }))}
                  label="Bajista Débil"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 border-t border-tv-border/40 pt-2">
            <CheckboxField
              label="Gradiente Montaña MACD"
              checked={draft.macdShowMountain}
              onChange={(b) => setDraft((d) => ({ ...d, macdShowMountain: b }))}
            />
            {draft.macdShowMountain && (
              <div className="flex flex-col gap-1 pl-4 pt-1">
                <span className="text-[9px] text-tv-text-muted uppercase tracking-wider font-semibold">
                  Opacidad de montaña: {Math.round(draft.macdMountainOpacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={draft.macdMountainOpacity}
                  onChange={(e) => setDraft((d) => ({ ...d, macdMountainOpacity: parseFloat(e.target.value) }))}
                  className="w-full accent-tv-blue h-1.5 rounded-lg bg-tv-border cursor-pointer appearance-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "style" && target === "adx" && (
        <div className="flex flex-col gap-3 py-2 border-b border-tv-border/20">
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar ADX"
              checked={draft.adxShowLine}
              onChange={(b) => setDraft((d) => ({ ...d, adxShowLine: b }))}
            />
            {draft.adxShowLine && (
              <ColorPicker
                value={draft.adxColor}
                onChange={(color) => setDraft((d) => ({ ...d, adxColor: color }))}
                label=""
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar +DI"
              checked={draft.adxShowPlusDI}
              onChange={(b) => setDraft((d) => ({ ...d, adxShowPlusDI: b }))}
            />
            {draft.adxShowPlusDI && (
              <ColorPicker
                value={draft.plusDIColor}
                onChange={(color) => setDraft((d) => ({ ...d, plusDIColor: color }))}
                label=""
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar -DI"
              checked={draft.adxShowMinusDI}
              onChange={(b) => setDraft((d) => ({ ...d, adxShowMinusDI: b }))}
            />
            {draft.adxShowMinusDI && (
              <ColorPicker
                value={draft.minusDIColor}
                onChange={(color) => setDraft((d) => ({ ...d, minusDIColor: color }))}
                label=""
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <CheckboxField
              label="Mostrar Nivel Clave"
              checked={draft.adxShowKeyLevel}
              onChange={(b) => setDraft((d) => ({ ...d, adxShowKeyLevel: b }))}
            />
            {draft.adxShowKeyLevel && (
              <ColorPicker
                value={draft.adxKeyLevelColor}
                onChange={(color) => setDraft((d) => ({ ...d, adxKeyLevelColor: color }))}
                label=""
              />
            )}
          </div>
        </div>
      )}

      {activeTab === "style" && target === "rci" && (
        <div className="flex flex-col gap-3 py-2 border-b border-tv-border/20 max-h-[250px] overflow-y-auto pr-1">
          {draft.rciShow1 && (
            <ColorPicker
              value={draft.rciColor1}
              onChange={(color) => setDraft((d) => ({ ...d, rciColor1: color }))}
              label="Línea RCI 1"
            />
          )}
          {draft.rciShow2 && (
            <ColorPicker
              value={draft.rciColor2}
              onChange={(color) => setDraft((d) => ({ ...d, rciColor2: color }))}
              label="Línea RCI 2"
            />
          )}
          {draft.rciShow3 && (
            <ColorPicker
              value={draft.rciColor3}
              onChange={(color) => setDraft((d) => ({ ...d, rciColor3: color }))}
              label="Línea RCI 3"
            />
          )}
          <ColorPicker
            value={draft.rciOverboughtColor}
            onChange={(color) => setDraft((d) => ({ ...d, rciOverboughtColor: color }))}
            label="Línea Sobrecompra"
          />
          <ColorPicker
            value={draft.rciOversoldColor}
            onChange={(color) => setDraft((d) => ({ ...d, rciOversoldColor: color }))}
            label="Línea Sobreventa"
          />
        </div>
      )}

      {activeTab === "style" && target === "stoch" && (
        <div className="flex flex-col gap-4 py-2 border-b border-tv-border/20">
          <ColorPicker
            value={draft.stochKColor}
            onChange={(color) => setDraft((d) => ({ ...d, stochKColor: color }))}
            label="Línea %K"
          />
          <ColorPicker
            value={draft.stochDColor}
            onChange={(color) => setDraft((d) => ({ ...d, stochDColor: color }))}
            label="Línea %D"
          />
        </div>
      )}

      {activeTab === "style" && target === "sqzmom" && (
        <div className="flex flex-col gap-3 py-2 border-b border-tv-border/20 max-h-[250px] overflow-y-auto pr-1">
          {/* Primer trazado (Histograma) */}
          <div className="flex flex-col gap-1.5 pt-1">
            <CheckboxField
              label="Trazado del gráfico"
              checked={draft.sqzmomShowHist}
              onChange={(b) => setDraft((d) => ({ ...d, sqzmomShowHist: b }))}
            />
            {draft.sqzmomShowHist && (
              <div className="grid grid-cols-2 gap-2 pl-4 pt-1">
                <ColorPicker
                  value={draft.sqzmomColor0}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomColor0: color }))}
                  label="Color 0"
                />
                <ColorPicker
                  value={draft.sqzmomColor1}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomColor1: color }))}
                  label="Color 1"
                />
                <ColorPicker
                  value={draft.sqzmomColor2}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomColor2: color }))}
                  label="Color 2"
                />
                <ColorPicker
                  value={draft.sqzmomColor3}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomColor3: color }))}
                  label="Color 3"
                />
              </div>
            )}
          </div>

          {/* Segundo trazado (Cruces del Squeeze) */}
          <div className="flex flex-col gap-1.5 border-t border-tv-border/40 pt-2">
            <CheckboxField
              label="Trazado del gráfico"
              checked={draft.sqzmomShowSqz}
              onChange={(b) => setDraft((d) => ({ ...d, sqzmomShowSqz: b }))}
            />
            {draft.sqzmomShowSqz && (
              <div className="grid grid-cols-3 gap-1 pl-4 pt-1">
                <ColorPicker
                  value={draft.sqzmomSqzNo}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomSqzNo: color }))}
                  label="Color 0"
                />
                <ColorPicker
                  value={draft.sqzmomSqzOn}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomSqzOn: color }))}
                  label="Color 1"
                />
                <ColorPicker
                  value={draft.sqzmomSqzOff}
                  onChange={(color) => setDraft((d) => ({ ...d, sqzmomSqzOff: color }))}
                  label="Color 2"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text cursor-pointer"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90 cursor-pointer text-white">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-tv-text cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-tv-border bg-tv-bg text-tv-blue focus:ring-tv-blue accent-tv-blue"
      />
      <span>{label}</span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
          {label}
        </span>
      )}
      <Input
        type="number"
        min={-150}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums h-8 text-xs border-tv-border/60"
      />
    </label>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-6 w-6 rounded border border-tv-border cursor-pointer overflow-hidden transition-all duration-150 hover:scale-105 active:scale-95 flex items-center justify-center bg-tv-bg shadow-sm"
        style={{ borderColor: value }}
      >
        <div
          className="h-4 w-4 rounded-full transition-transform duration-100"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      {label && <span className="text-xs font-medium text-tv-text">{label}</span>}
    </div>
  );
}

function DecimalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
          {label}
        </span>
      )}
      <Input
        type="number"
        step="0.1"
        min={0.1}
        max={20}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums h-8 text-xs border-tv-border/60"
      />
    </label>
  );
}
