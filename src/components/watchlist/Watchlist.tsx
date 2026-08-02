"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { fetchTickers24h, parseSymbolKey } from "@/lib/exchanges/router";
import { useChartStore } from "@/lib/store/chart-store";
import { ExchangeBadge } from "@/components/ui/exchange-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  symbolKey: string;
  price: number;
  pct: number;
}

export function Watchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const activeSymbolKey = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});

  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;

    fetchTickers24h(watchlist)
      .then((tickers) => {
        if (cancelled) return;
        const map: Record<string, Row> = {};
        tickers.forEach((t) => {
          map[t.symbolKey] = {
            symbolKey: t.symbolKey,
            price: t.lastPrice,
            pct: t.priceChangePercent,
          };
        });
        setRows(map);
      })
      .catch(console.error);

    // Refresh tickers periodically every 5 seconds for multi-exchange live view
    const intervalId = setInterval(() => {
      fetchTickers24h(watchlist)
        .then((tickers) => {
          if (cancelled) return;
          setRows((prev) => {
            const nextMap = { ...prev };
            tickers.forEach((t) => {
              const prevRow = prev[t.symbolKey];
              if (prevRow) {
                if (t.lastPrice > prevRow.price) {
                  setFlash((f) => ({ ...f, [t.symbolKey]: "up" }));
                  setTimeout(() => setFlash((f) => ({ ...f, [t.symbolKey]: null })), 300);
                } else if (t.lastPrice < prevRow.price) {
                  setFlash((f) => ({ ...f, [t.symbolKey]: "down" }));
                  setTimeout(() => setFlash((f) => ({ ...f, [t.symbolKey]: null })), 300);
                }
              }
              nextMap[t.symbolKey] = {
                symbolKey: t.symbolKey,
                price: t.lastPrice,
                pct: t.priceChangePercent,
              };
            });
            return nextMap;
          });
        })
        .catch(() => {});
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [watchlist]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Watchlist
        </h2>
        <button
          onClick={() => openSymbolDialog(true)}
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Agregar símbolo"
          aria-label="Agregar al watchlist"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {watchlist.map((symbolKey) => {
            const parsed = parseSymbolKey(symbolKey);
            const row = rows[symbolKey] || rows[parsed.symbolKey] || rows[parsed.symbol];
            const isActive = symbolKey === activeSymbolKey;
            const f = flash[symbolKey];

            return (
              <div
                key={symbolKey}
                onClick={() => setSymbol(symbolKey)}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 text-xs transition-colors border-b border-tv-border/30",
                  "hover:bg-tv-panel-hover",
                  isActive && "bg-tv-panel-hover font-semibold",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-tv-text truncate">
                      {parsed.symbol}
                    </span>
                    <ExchangeBadge exchange={parsed.exchange} className="scale-90 origin-left" />
                  </div>
                </div>
                <span
                  className={cn(
                    "text-right tabular-nums transition-colors font-medium",
                    f === "up" && "text-tv-green",
                    f === "down" && "text-tv-red",
                    !f && "text-tv-text",
                  )}
                >
                  {row ? formatPrice(row.price) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      row
                        ? row.pct >= 0
                          ? "text-tv-green"
                          : "text-tv-red"
                        : "text-tv-text-muted",
                    )}
                  >
                    {row ? formatPct(row.pct) : "—"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(symbolKey);
                    }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible"
                    aria-label={`Quitar ${symbolKey} del watchlist`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {watchlist.length === 0 && (
            <div className="p-4 text-center text-xs text-tv-text-muted">
              Tu watchlist está vacío
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
