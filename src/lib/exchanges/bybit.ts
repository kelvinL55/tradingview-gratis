import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const REST_BASE = "https://api.bybit.com/v5/market";
const WS_BASE = "wss://stream.bybit.com/v5/public/spot";

function mapTimeframeBybit(tf: Timeframe): string {
  switch (tf) {
    case "1m": return "1";
    case "3m": return "3";
    case "5m": return "5";
    case "15m": return "15";
    case "30m": return "30";
    case "1h": return "60";
    case "2h": return "120";
    case "4h": return "240";
    case "6h": return "360";
    case "12h": return "720";
    case "1d": return "D";
    case "1w": return "W";
    case "1M": return "M";
    default: return "1";
  }
}

export async function fetchBybitKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const bybitTf = mapTimeframeBybit(interval);
  const url = `${REST_BASE}/kline?category=spot&symbol=${symbol.toUpperCase()}&interval=${bybitTf}&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bybit klines error: ${res.status}`);
  const data = await res.json();
  const list = (data?.result?.list as string[][]) || [];
  
  // Bybit returns list newest-first, reverse to oldest-first
  return list.slice().reverse().map((k) => ({
    time: Math.floor(parseInt(k[0], 10) / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    isFinal: true,
  }));
}

export async function fetchBybitTicker24h(symbol: string): Promise<Ticker24h> {
  const url = `${REST_BASE}/tickers?category=spot&symbol=${symbol.toUpperCase()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bybit ticker error: ${res.status}`);
  const data = await res.json();
  const t = data?.result?.list?.[0];
  if (!t) throw new Error(`Bybit ticker not found for ${symbol}`);
  
  const lastPrice = parseFloat(t.lastPrice || "0");
  const prevPrice24h = parseFloat(t.prevPrice24h || t.lastPrice || "0");
  const priceChange = lastPrice - prevPrice24h;
  const priceChangePercent = prevPrice24h > 0 ? (priceChange / prevPrice24h) * 100 : parseFloat(t.price24hPcnt || "0") * 100;

  return {
    symbol: t.symbol,
    symbolKey: `BYBIT:${t.symbol}`,
    exchange: "BYBIT",
    lastPrice,
    priceChange,
    priceChangePercent,
    highPrice: parseFloat(t.highPrice24h || "0"),
    lowPrice: parseFloat(t.lowPrice24h || "0"),
    volume: parseFloat(t.volume24h || "0"),
    quoteVolume: parseFloat(t.turnover24h || "0"),
  };
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchBybitSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;
  const url = `${REST_BASE}/instruments-info?category=spot`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Bybit instruments error: ${res.status}`);
  const data = await res.json();
  const list = data?.result?.list || [];
  
  cachedSymbols = list
    .filter((s: { status: string; quoteCoin: string }) => s.status === "Trading" && s.quoteCoin === "USDT")
    .map((s: { symbol: string; baseCoin: string; quoteCoin: string; status: string }) => ({
      symbol: s.symbol,
      symbolKey: `BYBIT:${s.symbol}`,
      baseAsset: s.baseCoin,
      quoteAsset: s.quoteCoin,
      exchange: "BYBIT" as const,
      status: s.status,
    }));

  return cachedSymbols!;
}

export function createBybitKlinesWS(
  symbol: string,
  interval: Timeframe,
  onCandle: (candle: Candle) => void,
): () => void {
  const bybitTf = mapTimeframeBybit(interval);
  const topic = `kline.${bybitTf}.${symbol.toUpperCase()}`;
  const ws = new WebSocket(WS_BASE);

  ws.onopen = () => {
    ws.send(JSON.stringify({ op: "subscribe", args: [topic] }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.topic === topic && Array.isArray(msg?.data)) {
        const k = msg.data[0];
        if (!k) return;
        onCandle({
          time: Math.floor(parseInt(k.start, 10) / 1000),
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume),
          isFinal: k.confirm ?? true,
        });
      }
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
