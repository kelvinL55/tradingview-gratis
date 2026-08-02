"use client";

import { useEffect, useState } from "react";
import { useChartStore } from "@/lib/store/chart-store";
import { fetchTicker24h, parseSymbolKey } from "@/lib/exchanges/router";
import type { Ticker24h } from "@/lib/exchanges/types";
import { ExchangeBadge } from "@/components/ui/exchange-badge";
import { formatPrice, formatPct, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BottomPanel() {
  const symbolKey = useChartStore((s) => s.symbol);
  const timezone = useChartStore((s) => s.timezone);
  const setTimezone = useChartStore((s) => s.setTimezone);

  const [t, setT] = useState<Ticker24h | null>(null);
  const [localLabel, setLocalLabel] = useState("UTC");

  const parsed = parseSymbolKey(symbolKey);

  useEffect(() => {
    let cancelled = false;
    setT(null);
    const load = () => {
      fetchTicker24h(symbolKey)
        .then((x) => {
          if (!cancelled) setT(x);
        })
        .catch(console.error);
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbolKey]);

  useEffect(() => {
    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = -offsetMinutes / 60;
    const offsetSign = offsetHours >= 0 ? "+" : "";
    setLocalLabel(`UTC${offsetSign}${offsetHours}`);
  }, []);

  const upClass = (n: number) => (n >= 0 ? "text-tv-green" : "text-tv-red");

  return (
    <div className="flex h-9 items-center gap-0 border-t border-tv-border bg-tv-panel px-3 text-xs">
      <div className="flex items-center gap-1.5 border-r border-tv-border px-3">
        <span className="text-tv-text-dim">Símbolo</span>
        <span className="font-medium text-tv-text">{parsed.symbol}</span>
        <ExchangeBadge exchange={parsed.exchange} className="scale-90" />
      </div>
      <Stat
        label="24h Cambio"
        value={t ? formatPct(t.priceChangePercent) : "—"}
        valueClass={t ? upClass(t.priceChangePercent) : ""}
      />
      <div className="hidden md:flex items-center gap-0">
        <Stat
          label="24h Alto"
          value={t ? formatPrice(t.highPrice) : "—"}
          valueClass="text-tv-green"
        />
        <Stat
          label="24h Bajo"
          value={t ? formatPrice(t.lowPrice) : "—"}
          valueClass="text-tv-red"
        />
        <Stat
          label="24h Vol (base)"
          value={t ? formatVolume(t.volume) : "—"}
        />
        <Stat
          label="24h Vol (quote)"
          value={t ? formatVolume(t.quoteVolume) : "—"}
        />
      </div>
      <div className="ml-auto flex items-center gap-3 text-[10px] text-tv-text-dim">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-tv-green" />
          <span>{parsed.exchange} · Live</span>
        </div>
        <span className="text-tv-border">|</span>
        <button
          onClick={() => setTimezone(timezone === "UTC" ? "Local" : "UTC")}
          title={`Huso Horario: ${timezone === "UTC" ? "UTC (GMT+0)" : `Local (${localLabel})`}. Haz clic para cambiar.`}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-all duration-150 active:scale-95 cursor-pointer",
            timezone === "UTC"
              ? "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              : "bg-tv-blue/10 text-tv-blue hover:bg-tv-blue/20",
          )}
        >
          {timezone === "UTC" ? "UTC" : localLabel}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 border-r border-tv-border px-3">
      <span className="text-tv-text-dim">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClass ?? "text-tv-text")}>
        {value}
      </span>
    </div>
  );
}
