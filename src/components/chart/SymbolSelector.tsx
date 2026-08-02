"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchExchangeSymbols, parseSymbolKey } from "@/lib/exchanges/router";
import { useChartStore } from "@/lib/store/chart-store";
import { ExchangeBadge } from "@/components/ui/exchange-badge";
import { cn } from "@/lib/utils";
import type { ExchangeId, SymbolInfo } from "@/lib/exchanges/types";

const EXCHANGES: { id: ExchangeId | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "BINANCE", label: "Binance" },
  { id: "BYBIT", label: "Bybit" },
  { id: "OKX", label: "OKX" },
  { id: "COINBASE", label: "Coinbase" },
];

export function SymbolSelector() {
  const activeSymbolKey = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const addToWatchlist = useChartStore((s) => s.addToWatchlist);
  const open = useChartStore((s) => s.symbolDialogOpen);
  const setOpen = useChartStore((s) => s.setSymbolDialogOpen);

  const [query, setQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<ExchangeId | "ALL">("ALL");
  const [allSymbols, setAllSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const activeParsed = useMemo(() => parseSymbolKey(activeSymbolKey), [activeSymbolKey]);

  useEffect(() => {
    if (open && allSymbols.length === 0) {
      setLoading(true);
      fetchExchangeSymbols("ALL")
        .then(setAllSymbols)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, allSymbols.length]);

  const filtered = useMemo(() => {
    let list = allSymbols;
    if (selectedExchange !== "ALL") {
      list = list.filter((s) => s.exchange === selectedExchange);
    }
    const q = query.trim().toUpperCase();
    if (!q) return list.slice(0, 100);

    return list
      .filter(
        (s) =>
          s.symbol.toUpperCase().includes(q) ||
          s.baseAsset.toUpperCase().includes(q) ||
          s.quoteAsset.toUpperCase().includes(q) ||
          s.symbolKey.toUpperCase().includes(q),
      )
      .slice(0, 100);
  }, [query, selectedExchange, allSymbols]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex items-center gap-2 rounded px-2.5 py-1.5 text-sm font-semibold hover:bg-tv-panel-hover">
        <Search className="h-3.5 w-3.5 text-tv-text-muted group-hover:text-tv-text" />
        <span className="tabular-nums text-tv-text">{activeParsed.symbol}</span>
        <ExchangeBadge exchange={activeParsed.exchange} />
        <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 bg-tv-panel p-0 border border-tv-border">
        <DialogHeader className="border-b border-tv-border px-4 py-3">
          <DialogTitle className="text-sm font-medium text-tv-text flex items-center justify-between">
            <span>Buscar Símbolo Cripto</span>
            <span className="text-xs font-normal text-tv-text-dim">Multi-Exchange Live</span>
          </DialogTitle>
        </DialogHeader>

        <div className="border-b border-tv-border p-3 space-y-2">
          <Input
            autoFocus
            placeholder="Buscar BTC, ETH, SOL, XRP en Binance, Bybit, OKX, Coinbase…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-tv-bg text-sm"
          />

          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
            {EXCHANGES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedExchange(ex.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedExchange === ex.id
                    ? "bg-tv-blue text-white"
                    : "bg-tv-bg text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
                )}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[380px]">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-xs text-tv-text-muted gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-tv-blue" />
              <span>Cargando mercados de múltiples exchanges…</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-xs text-tv-text-muted">
                  Sin resultados para &quot;{query}&quot;
                </div>
              )}
              {filtered.map((s) => {
                const isSelected = s.symbolKey === activeSymbolKey;
                return (
                  <button
                    key={s.symbolKey}
                    onClick={() => {
                      setSymbol(s.symbolKey);
                      addToWatchlist(s.symbolKey);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex items-center justify-between border-b border-tv-border/50 px-4 py-2.5 text-left text-xs hover:bg-tv-panel-hover transition-colors",
                      isSelected && "bg-tv-panel-hover font-semibold",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-tv-text">{s.baseAsset}</span>
                        <span className="text-tv-text-muted">/ {s.quoteAsset}</span>
                      </div>
                      <ExchangeBadge exchange={s.exchange} />
                    </div>
                    <span className="text-tv-text-muted font-mono">{s.symbol}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
