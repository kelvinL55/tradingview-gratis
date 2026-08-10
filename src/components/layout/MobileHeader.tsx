"use client";

import { useState, useEffect } from "react";
import { MoreVertical, RotateCcw, Layers, Sliders, ChevronDown, PenTool, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useChartStore } from "@/lib/store/chart-store";
import { parseSymbolKey, fetchTicker24h } from "@/lib/exchanges/router";
import { formatPrice, formatPct } from "@/lib/format";
import { MobileTimeframeWheel } from "@/components/chart/MobileTimeframeWheel";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { ProfileSelector } from "@/components/chart/ProfileSelector";

interface MobileHeaderProps {
  onToggleDrawingTools?: () => void;
  drawingToolsOpen?: boolean;
}

export function MobileHeader({ onToggleDrawingTools, drawingToolsOpen }: MobileHeaderProps) {
  const symbol = useChartStore((s) => s.symbol);
  const timeframe = useChartStore((s) => s.timeframe);
  const setSymbolDialogOpen = useChartStore((s) => s.setSymbolDialogOpen);
  const triggerResetChart = useChartStore((s) => s.triggerResetChart);

  const [ticker, setTicker] = useState<{ price: number; pct: number } | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const parsed = parseSymbolKey(symbol);

  // Fetch 24h price & pct periodically for mobile header badge
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchTicker24h(symbol)
        .then((t) => {
          if (!cancelled && t) {
            setTicker({ price: t.lastPrice, pct: t.priceChangePercent });
          }
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return (
    <>
      <header className="flex h-12 w-full items-center justify-between border-b border-tv-border bg-tv-panel px-2.5 md:hidden select-none z-30">
        {/* Left Section: Logo & Symbol Trigger */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Logo className="h-6 w-6 shrink-0" />
          <button
            type="button"
            onClick={() => setSymbolDialogOpen(true)}
            className="flex items-center gap-1 rounded bg-tv-bg px-2 py-1 text-xs font-bold text-tv-text hover:bg-tv-panel-hover cursor-pointer border border-tv-border/40"
          >
            <span className="truncate max-w-[90px]">{parsed.symbol}</span>
            <ChevronDown className="h-3 w-3 text-tv-text-muted shrink-0" />
          </button>
        </div>

        {/* Center Section: Live Price & 24h % */}
        {ticker && (
          <div className="flex items-center gap-1.5 px-1 font-mono text-xs">
            <span className="font-bold text-tv-text tabular-nums">{formatPrice(ticker.price)}</span>
            <span
              className={`text-[10px] font-semibold tabular-nums px-1 rounded ${
                ticker.pct >= 0 ? "text-tv-green bg-tv-green/10" : "text-tv-red bg-tv-red/10"
              }`}
            >
              {formatPct(ticker.pct)}
            </span>
          </div>
        )}

        {/* Right Section: Timeframe Wheel Trigger & More Options */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Timeframe Wheel Trigger */}
          <button
            type="button"
            onClick={() => setWheelOpen(true)}
            className="flex items-center gap-1 rounded bg-tv-blue/15 border border-tv-blue/40 px-2 py-1 text-xs font-extrabold text-tv-blue hover:bg-tv-blue/25 cursor-pointer"
          >
            <span>{timeframe.toUpperCase()}</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Options Bottom Sheet Button (⋮) */}
          <button
            type="button"
            aria-label="Más opciones"
            onClick={() => setOptionsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-tv-panel-hover text-tv-text-muted hover:text-tv-text cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Vertical Timeframe Wheel Dialog */}
      <MobileTimeframeWheel open={wheelOpen} onOpenChange={setWheelOpen} />

      {/* Options Bottom Sheet Modal */}
      {optionsOpen && (
        <>
          <div
            onClick={() => setOptionsOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs md:hidden"
          />
          <div className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl border-t border-tv-border bg-tv-panel p-4 shadow-2xl md:hidden animate-in slide-in-from-bottom duration-200">
            {/* Handle bar */}
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-tv-border" />

            <div className="flex items-center justify-between border-b border-tv-border/60 pb-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-tv-text flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-tv-blue" /> Opciones del Gráfico
              </span>
              <button
                onClick={() => setOptionsOpen(false)}
                className="rounded p-1 text-tv-text-muted hover:text-tv-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 py-1">
              {/* Indicadores */}
              <div
                onClick={() => setOptionsOpen(false)}
                className="flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold text-tv-text hover:bg-tv-panel-hover cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-tv-blue/20 text-tv-blue">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <span>Indicadores Técnicos</span>
                </div>
                <IndicatorMenu />
              </div>

              {/* Perfiles */}
              <div
                onClick={() => setOptionsOpen(false)}
                className="flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold text-tv-text hover:bg-tv-panel-hover cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-purple-500/20 text-purple-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <span>Perfiles Guardados</span>
                </div>
                <ProfileSelector />
              </div>

              {/* Herramientas de Dibujo */}
              {onToggleDrawingTools && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleDrawingTools();
                    setOptionsOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold text-tv-text hover:bg-tv-panel-hover cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/20 text-emerald-400">
                      <PenTool className="h-4 w-4" />
                    </div>
                    <span>{drawingToolsOpen ? "Ocultar Herramientas" : "Herramientas de Dibujo"}</span>
                  </div>
                </button>
              )}

              {/* Restablecer Gráfico */}
              <button
                type="button"
                onClick={() => {
                  triggerResetChart();
                  setOptionsOpen(false);
                }}
                className="flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold text-tv-text hover:bg-tv-panel-hover cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/20 text-amber-400">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <span>Restablecer Gráfico y Eje Y</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
