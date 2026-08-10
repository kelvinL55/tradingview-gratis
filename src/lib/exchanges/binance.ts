import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const REST_BASE = "https://api.binance.com/api/v3";
const WS_BASE = "wss://stream.binance.com:9443/stream";

function cleanSymbol(sym: string): string {
  let s = (sym || "").trim().toUpperCase();
  if (s.includes(":")) s = s.split(":")[1];
  if (
    !s.endsWith("USDT") &&
    !s.endsWith("BUSD") &&
    !s.endsWith("USDC") &&
    !s.endsWith("BTC") &&
    !s.endsWith("ETH") &&
    !s.endsWith("BNB")
  ) {
    s = `${s}USDT`;
  }
  return s;
}

export async function fetchBinanceKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const sym = cleanSymbol(symbol);
  const url = `${REST_BASE}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const data = (await res.json()) as unknown[][];
  return data.map((k) => ({
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    isFinal: true,
  }));
}

export async function fetchBinanceTicker24h(symbol: string): Promise<Ticker24h> {
  const sym = cleanSymbol(symbol);
  const url = `${REST_BASE}/ticker/24hr?symbol=${sym}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  const t = await res.json();
  return {
    symbol: t.symbol,
    symbolKey: `BINANCE:${t.symbol}`,
    exchange: "BINANCE",
    lastPrice: parseFloat(t.lastPrice),
    priceChange: parseFloat(t.priceChange),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
  };
}

export async function fetchBinanceTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const cleanSymbols = symbols.map((s) => s.toUpperCase());
  const arr = JSON.stringify(cleanSymbols);
  const url = `${REST_BASE}/ticker/24hr?symbols=${encodeURIComponent(arr)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((t: Record<string, string>) => ({
          symbol: t.symbol,
          symbolKey: `BINANCE:${t.symbol}`,
          exchange: "BINANCE",
          lastPrice: parseFloat(t.lastPrice),
          priceChange: parseFloat(t.priceChange),
          priceChangePercent: parseFloat(t.priceChangePercent),
          highPrice: parseFloat(t.highPrice),
          lowPrice: parseFloat(t.lowPrice),
          volume: parseFloat(t.volume),
          quoteVolume: parseFloat(t.quoteVolume),
        }));
      }
    }
  } catch {
    // Fallback a peticiones individuales si falla el lote
  }

  // Fallback seguro: obtener cada símbolo individualmente sin detener los demás
  const results = await Promise.allSettled(
    cleanSymbols.map((sym) => fetchBinanceTicker24h(sym))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Ticker24h> => r.status === "fulfilled")
    .map((r) => r.value);
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchBinanceSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;
  const res = await fetch(`${REST_BASE}/exchangeInfo`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Binance exchangeInfo error: ${res.status}`);
  const data = await res.json();
  cachedSymbols = data.symbols
    .filter(
      (s: { status: string; quoteAsset: string }) =>
        s.status === "TRADING" && s.quoteAsset === "USDT",
    )
    .map((s: { symbol: string; baseAsset: string; quoteAsset: string; status: string }) => ({
      symbol: s.symbol,
      symbolKey: `BINANCE:${s.symbol}`,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      exchange: "BINANCE" as const,
      status: s.status,
    }));
  return cachedSymbols!;
}

// WebSocket implementation for Binance
export function createBinanceKlinesWS(
  symbol: string,
  interval: Timeframe,
  onCandle: (candle: Candle) => void,
): () => void {
  const sym = cleanSymbol(symbol);
  const stream = `${sym.toLowerCase()}@kline_${interval}`;
  const ws = new WebSocket(`${WS_BASE}?streams=${stream}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const k = msg?.data?.k;
      if (!k) return;
      onCandle({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        isFinal: k.x,
      });
    } catch {
      // ignore
    }
  };

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
