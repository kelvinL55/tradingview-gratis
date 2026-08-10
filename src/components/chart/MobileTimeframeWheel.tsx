"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";
import type { Timeframe } from "@/lib/exchanges/types";

const TIMEFRAMES: { id: Timeframe; label: string; desc: string }[] = [
  { id: "1m", label: "1m", desc: "1 Minuto" },
  { id: "5m", label: "5m", desc: "5 Minutos" },
  { id: "15m", label: "15m", desc: "15 Minutos" },
  { id: "1h", label: "1H", desc: "1 Hora" },
  { id: "4h", label: "4H", desc: "4 Horas" },
  { id: "1d", label: "1D", desc: "1 Día" },
  { id: "1w", label: "1W", desc: "1 Semana" },
];

interface MobileTimeframeWheelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileTimeframeWheel({ open, onOpenChange }: MobileTimeframeWheelProps) {
  const timeframe = useChartStore((s) => s.timeframe);
  const setTimeframe = useChartStore((s) => s.setTimeframe);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active item to center when dialog opens
  useEffect(() => {
    if (open && containerRef.current) {
      const activeEl = containerRef.current.querySelector("[data-active='true']");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs gap-0 bg-[#0E131F] p-0 border border-tv-border rounded-xl">
        <DialogHeader className="border-b border-tv-border/80 px-4 py-3 text-center">
          <DialogTitle className="text-sm font-semibold text-tv-text flex items-center justify-center gap-1.5">
            <span>⏱️</span> Selección de Temporalidad
          </DialogTitle>
        </DialogHeader>

        {/* Wheel container with scroll snapping */}
        <div className="relative py-4 px-3">
          {/* Active selection highlight box */}
          <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-12 -translate-y-1/2 rounded-lg border border-tv-blue/60 bg-tv-blue/15 shadow-[0_0_15px_rgba(41,98,255,0.2)]" />

          <div
            ref={containerRef}
            className="flex h-56 flex-col overflow-y-auto overflow-x-hidden py-16 scroll-snap-y-mandatory touch-pan-y"
            style={{
              scrollSnapType: "y mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {TIMEFRAMES.map((t) => {
              const isSelected = t.id === timeframe;
              return (
                <button
                  key={t.id}
                  data-active={isSelected}
                  type="button"
                  onClick={() => {
                    setTimeframe(t.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex h-12 w-full shrink-0 snap-center items-center justify-between px-4 text-sm font-bold transition-all cursor-pointer rounded-md",
                    isSelected
                      ? "text-tv-blue scale-105"
                      : "text-tv-text-muted hover:text-tv-text hover:bg-tv-panel-hover/50"
                  )}
                >
                  <span className="text-base font-extrabold tracking-wide">{t.label}</span>
                  <span className="text-xs font-normal text-tv-text-dim">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
