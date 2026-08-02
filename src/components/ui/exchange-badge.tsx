import React from "react";
import { cn } from "@/lib/utils";
import type { ExchangeId } from "@/lib/exchanges/types";

interface Props {
  exchange: ExchangeId;
  className?: string;
}

export function ExchangeBadge({ exchange, className }: Props) {
  const styles: Record<ExchangeId, string> = {
    BINANCE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    BYBIT: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    OKX: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    COINBASE: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[exchange] || styles.BINANCE,
        className,
      )}
    >
      {exchange}
    </span>
  );
}
