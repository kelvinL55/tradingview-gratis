"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, X, ChevronDown, ListFilter, TrendingUp, TrendingDown, Layers } from "lucide-react";
import { fetchTickers24h, parseSymbolKey } from "@/lib/exchanges/router";
import { useChartStore } from "@/lib/store/chart-store";
import { ExchangeBadge } from "@/components/ui/exchange-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Row {
  symbolKey: string;
  price: number;
  pct: number;
}

type FilterCategory = "ALL" | "TOP_GAINERS" | "TOP_LOSERS" | "BINANCE" | "BYBIT" | "OKX";

export function Watchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const activeSymbolKey = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");

  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;

    fetchTickers24h(watchlist)
      .then((tickers) => {
        if (cancelled) return;
        const map: Record<string, Row> = {};
        tickers.forEach((t) => {
          const parsed = parseSymbolKey(t.symbolKey);
          const r: Row = {
            symbolKey: t.symbolKey,
            price: t.lastPrice,
            pct: t.priceChangePercent,
          };
          map[t.symbolKey] = r;
          map[parsed.symbolKey] = r;
          map[parsed.symbol] = r;
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
              const parsed = parseSymbolKey(t.symbolKey);
              const prevRow = prev[t.symbolKey] || prev[parsed.symbolKey] || prev[parsed.symbol];
              if (prevRow) {
                if (t.lastPrice > prevRow.price) {
                  setFlash((f) => ({ ...f, [t.symbolKey]: "up", [parsed.symbol]: "up" }));
                  setTimeout(() => setFlash((f) => ({ ...f, [t.symbolKey]: null, [parsed.symbol]: null })), 300);
                } else if (t.lastPrice < prevRow.price) {
                  setFlash((f) => ({ ...f, [t.symbolKey]: "down", [parsed.symbol]: "down" }));
                  setTimeout(() => setFlash((f) => ({ ...f, [t.symbolKey]: null, [parsed.symbol]: null })), 300);
                }
              }
              const r: Row = {
                symbolKey: t.symbolKey,
                price: t.lastPrice,
                pct: t.priceChangePercent,
              };
              nextMap[t.symbolKey] = r;
              nextMap[parsed.symbolKey] = r;
              nextMap[parsed.symbol] = r;
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

  // Filtered and sorted watchlist rows based on category dropdown selection
  const filteredWatchlist = useMemo(() => {
    let list = [...watchlist];

    if (filterCategory === "TOP_GAINERS") {
      list.sort((a, b) => (rows[b]?.pct ?? 0) - (rows[a]?.pct ?? 0));
    } else if (filterCategory === "TOP_LOSERS") {
      list.sort((a, b) => (rows[a]?.pct ?? 0) - (rows[b]?.pct ?? 0));
    } else if (filterCategory === "BINANCE") {
      list = list.filter((s) => parseSymbolKey(s).exchange === "BINANCE");
    } else if (filterCategory === "BYBIT") {
      list = list.filter((s) => parseSymbolKey(s).exchange === "BYBIT");
    } else if (filterCategory === "OKX") {
      list = list.filter((s) => parseSymbolKey(s).exchange === "OKX");
    }

    return list;
  }, [watchlist, filterCategory, rows]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-tv-panel">
      {/* Watchlist Header with Dropdown Selectors */}
      <div className="flex flex-col border-b border-tv-border bg-tv-panel px-3 py-2 gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          {/* Dropdown Menu for Watchlist Categories */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold uppercase tracking-wider text-tv-text hover:bg-tv-panel-hover transition-colors outline-none focus:ring-1 focus:ring-tv-blue">
              <Layers className="h-3.5 w-3.5 text-tv-blue" />
              <span>Lista de Monedas</span>
              <span className="ml-0.5 rounded bg-tv-blue/20 px-1.5 py-0.2 text-[10px] text-tv-blue font-mono font-normal">
                {watchlist.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted ml-0.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 bg-tv-panel border border-tv-border shadow-xl z-50">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                Lista Desplegable de Vistas
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-tv-border" />
              <DropdownMenuItem
                onClick={() => setFilterCategory("ALL")}
                className={cn("text-xs flex items-center justify-between cursor-pointer", filterCategory === "ALL" && "font-bold text-tv-blue")}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-tv-text-muted" />
                  <span>Todas las Monedas</span>
                </div>
                <span className="text-[10px] font-mono text-tv-text-dim">({watchlist.length})</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterCategory("TOP_GAINERS")}
                className={cn("text-xs flex items-center gap-2 cursor-pointer", filterCategory === "TOP_GAINERS" && "font-bold text-tv-green")}
              >
                <TrendingUp className="h-3.5 w-3.5 text-tv-green" />
                <span>Top Ganadores (24h)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterCategory("TOP_LOSERS")}
                className={cn("text-xs flex items-center gap-2 cursor-pointer", filterCategory === "TOP_LOSERS" && "font-bold text-tv-red")}
              >
                <TrendingDown className="h-3.5 w-3.5 text-tv-red" />
                <span>Top Perdedores (24h)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-tv-border" />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
                Por Exchange
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setFilterCategory("BINANCE")}
                className={cn("text-xs flex items-center gap-2 cursor-pointer", filterCategory === "BINANCE" && "font-bold text-tv-blue")}
              >
                <ExchangeBadge exchange="BINANCE" variant="short" />
                <span>Binance</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterCategory("BYBIT")}
                className={cn("text-xs flex items-center gap-2 cursor-pointer", filterCategory === "BYBIT" && "font-bold text-tv-blue")}
              >
                <ExchangeBadge exchange="BYBIT" variant="short" />
                <span>Bybit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterCategory("OKX")}
                className={cn("text-xs flex items-center gap-2 cursor-pointer", filterCategory === "OKX" && "font-bold text-tv-blue")}
              >
                <ExchangeBadge exchange="OKX" variant="short" />
                <span>OKX</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => openSymbolDialog(true)}
            className="flex items-center gap-1 rounded bg-tv-blue/10 px-2 py-1 text-xs font-medium text-tv-blue hover:bg-tv-blue/20 transition-colors"
            title="Agregar símbolo a la lista"
            aria-label="Agregar al watchlist"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>

        {/* Lista Desplegable (<select>) para Cambio Directo Rápido de Moneda */}
        <div className="relative w-full">
          <select
            value={activeSymbolKey}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full appearance-none rounded border border-tv-border bg-tv-bg px-2.5 py-1.5 pr-7 text-xs font-semibold text-tv-text cursor-pointer hover:border-tv-blue/50 focus:border-tv-blue focus:outline-none transition-colors"
            aria-label="Seleccionar moneda desplegable"
          >
            {watchlist.map((sKey) => {
              const p = parseSymbolKey(sKey);
              const r = rows[sKey];
              const priceStr = r ? formatPrice(r.price) : "";
              const pctStr = r ? formatPct(r.pct) : "";
              return (
                <option key={sKey} value={sKey} className="bg-tv-panel text-tv-text py-1">
                  {p.symbol} ({p.exchange}) — {priceStr} {pctStr}
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tv-text-muted" />
        </div>
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-[1.1fr_1fr_auto_auto] gap-1.5 border-b border-tv-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-tv-text-dim bg-tv-bg/50 shrink-0">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h %</span>
        <span className="text-right pr-0.5">Exch</span>
      </div>

      {/* Scrollable Watchlist Rows - Strictly Bounded */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col divide-y divide-tv-border/20">
          {filteredWatchlist.map((symbolKey) => {
            const parsed = parseSymbolKey(symbolKey);
            const row = rows[symbolKey] || rows[parsed.symbolKey] || rows[parsed.symbol];
            const isActive = symbolKey === activeSymbolKey;
            const f = flash[symbolKey];

            return (
              <div
                key={symbolKey}
                onClick={() => setSymbol(symbolKey)}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1.1fr_1fr_auto_auto] items-center gap-1.5 px-2.5 py-2 text-xs transition-all border-l-2 border-transparent",
                  "hover:bg-tv-panel-hover/80",
                  isActive && "bg-tv-panel-hover border-l-2 border-tv-blue font-bold",
                )}
              >
                {/* 1. Nombre Completo del Activo (sin truncamiento ...) */}
                <div className="flex items-center min-w-0">
                  <span
                    className={cn(
                      "text-xs font-bold whitespace-nowrap tracking-tight",
                      isActive ? "text-tv-blue" : "text-tv-text"
                    )}
                    title={parsed.symbol}
                  >
                    {parsed.symbol}
                  </span>
                </div>

                {/* 2. Precio Completo */}
                <span
                  className={cn(
                    "text-right tabular-nums transition-colors font-bold text-xs whitespace-nowrap",
                    f === "up" && "text-tv-green animate-pulse",
                    f === "down" && "text-tv-red animate-pulse",
                    !f && "text-tv-text",
                  )}
                >
                  {row ? formatPrice(row.price) : "—"}
                </span>

                {/* 3. Porcentaje 24h */}
                <span
                  className={cn(
                    "tabular-nums text-[10.5px] font-semibold px-1 py-0.5 rounded text-right whitespace-nowrap",
                    row
                      ? row.pct >= 0
                        ? "text-tv-green bg-tv-green/10"
                        : "text-tv-red bg-tv-red/10"
                      : "text-tv-text-muted",
                  )}
                >
                  {row ? formatPct(row.pct) : "—"}
                </span>

                {/* 4. Marca/Exchange (BN) al extremo derecho en tamaño compacto */}
                <div className="flex items-center justify-end w-6 shrink-0">
                  <ExchangeBadge
                    exchange={parsed.exchange}
                    variant="short"
                    className="text-[8px] px-1 py-0.2 scale-90 group-hover:hidden transition-all"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(symbolKey);
                    }}
                    className="hidden group-hover:flex items-center justify-center rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red transition-colors"
                    aria-label={`Quitar ${symbolKey} del watchlist`}
                    title="Eliminar de watchlist"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredWatchlist.length === 0 && (
            <div className="p-6 text-center text-xs text-tv-text-muted flex flex-col items-center gap-2">
              <ListFilter className="h-5 w-5 text-tv-text-dim" />
              <span>No hay monedas para mostrar en esta categoría</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
