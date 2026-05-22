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
      <DialogContent className="max-w-sm bg-tv-panel">
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
    adxLength: config.adxLength ?? 14,
    dmiLength: config.dmiLength ?? 14,
    adxKeyLevel: config.adxKeyLevel ?? 23,
    adxColor: config.adxColor ?? "#ef5350",
    plusDIColor: config.plusDIColor ?? "#2196f3",
    minusDIColor: config.minusDIColor ?? "#787b86",
    adxKeyLevelColor: config.adxKeyLevelColor ?? "#ffffff",
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
      adxLength: config.adxLength ?? 14,
      dmiLength: config.dmiLength ?? 14,
      adxKeyLevel: config.adxKeyLevel ?? 23,
      adxColor: config.adxColor ?? "#ef5350",
      plusDIColor: config.plusDIColor ?? "#2196f3",
      minusDIColor: config.minusDIColor ?? "#787b86",
      adxKeyLevelColor: config.adxKeyLevelColor ?? "#ffffff",
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
      });
    else if (target === "volume") onSave({});
  }

  return (
    <div className="flex flex-col gap-3">
      {/* TradingView-like Tabs for RSI / ADX to divide Inputs vs Style */}
      {(target === "rsi" || target === "adx") && (
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

      {activeTab === "style" && target === "adx" && (
        <div className="flex flex-col gap-4 py-2 border-b border-tv-border/20">
          <ColorPicker
            value={draft.adxColor}
            onChange={(color) => setDraft((d) => ({ ...d, adxColor: color }))}
            label="Línea ADX"
          />
          <ColorPicker
            value={draft.plusDIColor}
            onChange={(color) => setDraft((d) => ({ ...d, plusDIColor: color }))}
            label="Línea +DI"
          />
          <ColorPicker
            value={draft.minusDIColor}
            onChange={(color) => setDraft((d) => ({ ...d, minusDIColor: color }))}
            label="Línea -DI"
          />
          <ColorPicker
            value={draft.adxKeyLevelColor}
            onChange={(color) => setDraft((d) => ({ ...d, adxKeyLevelColor: color }))}
            label="Línea Nivel Clave"
          />
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={2}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
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
      <span className="text-xs font-medium text-tv-text">{label}</span>
    </div>
  );
}
