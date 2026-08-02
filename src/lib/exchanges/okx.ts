import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const REST_BASE = "https://www.okx.com/api/v5";
const WS_BASE = "wss://ws.okx.com:8443/ws/v5/public";

function mapTimeframeOKX(tf: Timeframe): string {
  switch (tf) {
    case "1m": return "1m";
    case "3m": return "3m";
    case "5m": return "5m";
    case "15m": return "15m";
    case "30m": return "30m";
    case "1h": return "1H";
    case "2h": return "2H";
    case "4h": return "4H";
    case "6h": return "6H";
    case "12h": return "12H";
    case "1d": return "1D";
    case "1w": return "1W";
    case "1M": return "1M";
    default: return "1m";
  }
}

export async function fetchOKXKlines(
  symbol: string, // e.g., "BTC-USDT" or "BTCUSDT"
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const instId = symbol.includes("-") ? symbol : symbol.replace("USDT", "-USDT");
  const bar = mapTimeframeOKX(interval);
  const url = `${REST_BASE}/market/candles?instId=${instId}&bar=${bar}&limit=${Math.min(limit, 300)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OKX klines error: ${res.status}`);
  const data = await res.json();
  const list = (data?.data as string[][]) || [];

  // OKX returns newest-first, reverse to oldest-first
  return list.slice().reverse().map((k) => ({
    time: Math.floor(parseInt(k[0], 10) / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    isFinal: k[8] === "1",
  }));
}

export async function fetchOKXTicker24h(symbol: string): Promise<Ticker24h> {
  const instId = symbol.includes("-") ? symbol : symbol.replace("USDT", "-USDT");
  const url = `${REST_BASE}/market/ticker?instId=${instId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OKX ticker error: ${res.status}`);
  const data = await res.json();
  const t = data?.data?.[0];
  if (!t) throw new Error(`OKX ticker not found for ${symbol}`);

  const lastPrice = parseFloat(t.last || "0");
  const sod24h = parseFloat(t.sod24h || t.open24h || t.last || "0");
  const priceChange = lastPrice - sod24h;
  const priceChangePercent = sod24h > 0 ? (priceChange / sod24h) * 100 : 0;

  return {
    symbol: t.instId,
    symbolKey: `OKX:${t.instId}`,
    exchange: "OKX",
    lastPrice,
    priceChange,
    priceChangePercent,
    highPrice: parseFloat(t.high24h || "0"),
    lowPrice: parseFloat(t.low24h || "0"),
    volume: parseFloat(t.vol24h || "0"),
    quoteVolume: parseFloat(t.volCcy24h || "0"),
  };
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchOKXSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;
  const url = `${REST_BASE}/public/instruments?instType=SPOT`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`OKX instruments error: ${res.status}`);
  const data = await res.json();
  const list = data?.data || [];

  cachedSymbols = list
    .filter((s: { state: string; quoteCcy: string }) => s.state === "live" && s.quoteCcy === "USDT")
    .map((s: { instId: string; baseCcy: string; quoteCcy: string; state: string }) => ({
      symbol: s.instId,
      symbolKey: `OKX:${s.instId}`,
      baseAsset: s.baseCcy,
      quoteAsset: s.quoteCcy,
      exchange: "OKX" as const,
      status: s.state,
    }));

  return cachedSymbols!;
}

export function createOKXKlinesWS(
  symbol: string,
  interval: Timeframe,
  onCandle: (candle: Candle) => void,
): () => void {
  const instId = symbol.includes("-") ? symbol : symbol.replace("USDT", "-USDT");
  const bar = mapTimeframeOKX(interval);
  const channel = `candle${bar}`;
  const ws = new WebSocket(WS_BASE);

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        op: "subscribe",
        args: [{ channel, instId }],
      }),
    );
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.data && Array.isArray(msg.data)) {
        const k = msg.data[0];
        if (!k) return;
        onCandle({
          time: Math.floor(parseInt(k[0], 10) / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          isFinal: k[8] === "1",
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
