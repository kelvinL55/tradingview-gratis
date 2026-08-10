"use client";

import { useEffect, useState } from "react";
import { Code2, RotateCcw } from "lucide-react";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { ProfileSelector } from "@/components/chart/ProfileSelector";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/Logo";
import { useChartStore } from "@/lib/store/chart-store";

import { MobileHeader } from "@/components/layout/MobileHeader";

interface HeaderProps {
  onToggleDrawingTools?: () => void;
  drawingToolsOpen?: boolean;
}

export function Header({ onToggleDrawingTools, drawingToolsOpen }: HeaderProps = {}) {
  const triggerResetChart = useChartStore((s) => s.triggerResetChart);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("https://api.github.com/repos/kelvinL55/tradingview-gratis/commits?per_page=1")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const rawDate = Array.isArray(data)
          ? data[0]?.commit?.committer?.date || data[0]?.commit?.author?.date
          : data?.commit?.committer?.date;

        if (rawDate) {
          const d = new Date(rawDate);
          const formatted = d.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          setLastUpdated(formatted);
        }
      })
      .catch(() => {
        // Fallback en caso de sin conexión o límite de API
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <MobileHeader onToggleDrawingTools={onToggleDrawingTools} drawingToolsOpen={drawingToolsOpen} />
      <header className="hidden md:flex h-12 items-center justify-between border-b border-tv-border bg-tv-panel px-3">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 pr-2 select-none">
          <Logo className="h-7 w-7" />
          <span className="text-sm font-bold tracking-tight text-tv-text flex items-center gap-1">
            <span className="text-tv-blue text-base">⚡</span> Trading_KL
          </span>
        </div>
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <SymbolSelector />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TimeframeSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <IndicatorMenu />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <ProfileSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <button
          onClick={triggerResetChart}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover outline-none transition-colors"
          title="Restablecer zoom y vista inicial del gráfico"
        >
          <RotateCcw className="h-3.5 w-3.5 text-tv-text-muted" />
          <span>Restablecer</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="https://github.com/kelvinL55/tradingview-gratis"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text transition-colors"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Source</span>
        </a>

        {lastUpdated && (
          <div className="flex items-center gap-1 pl-2 border-l border-tv-border/60 text-xs text-tv-text-muted">
            <span className="text-tv-text-dim">Última actualización:</span>
            <span className="font-medium text-tv-text">{lastUpdated}</span>
          </div>
        )}
      </div>
    </header>
    </>
  );
}

