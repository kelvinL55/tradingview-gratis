import React from "react";
import { cn } from "@/lib/utils";
import type { ExchangeId } from "@/lib/exchanges/types";

interface Props {
  exchange: ExchangeId;
  className?: string;
  variant?: "full" | "short" | "auto";
}

const SHORT_NAMES: Record<ExchangeId, string> = {
  BINANCE: "BN",
  BYBIT: "BYB",
  OKX: "OKX",
  COINBASE: "CB",
};

export function ExchangeBadge({ exchange, className, variant = "full" }: Props) {
  const styles: Record<ExchangeId, string> = {
    BINANCE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    BYBIT: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    OKX: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    COINBASE: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };

  const shortName = SHORT_NAMES[exchange] || exchange;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 select-none",
        styles[exchange] || styles.BINANCE,
        className,
      )}
      title={exchange}
    >
      {variant === "short" ? (
        shortName
      ) : variant === "auto" ? (
        <>
          <span className="hidden xl:inline">{exchange}</span>
          <span className="inline xl:hidden">{shortName}</span>
        </>
      ) : (
        exchange
      )}
    </span>
  );
}
