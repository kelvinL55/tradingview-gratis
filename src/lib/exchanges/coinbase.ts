import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const REST_BASE = "https://api.exchange.coinbase.com";
const WS_BASE = "wss://ws-feed.exchange.coinbase.com";

function mapTimeframeCoinbase(tf: Timeframe): number {
  switch (tf) {
    case "1m": return 60;
    case "3m": return 60;
    case "5m": return 300;
    case "15m": return 900;
    case "30m": return 900;
    case "1h": return 3600;
    case "2h": return 3600;
    case "4h": return 3600;
    case "6h": return 21600;
    case "8h": return 21600;
    case "12h": return 21600;
    case "1d": return 86400;
    case "3d": return 86400;
    case "1w": return 86400;
    case "1M": return 86400;
    default: return 60;
  }
}

export async function fetchCoinbaseKlines(
  symbol: string, // e.g., "BTC-USD" or "BTCUSD"
  interval: Timeframe,
  limit = 300,
): Promise<Candle[]> {
  const prodId = symbol.includes("-") ? symbol : symbol.endsWith("USD") ? `${symbol.slice(0, -3)}-USD` : symbol;
  const gran = mapTimeframeCoinbase(interval);
  const url = `${REST_BASE}/products/${prodId}/candles?granularity=${gran}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Coinbase klines error: ${res.status}`);
  const data = (await res.json()) as number[][];
  
  // Coinbase format: [time, low, high, open, close, volume]
  // Returns newest-first, reverse to oldest-first
  return data.slice().reverse().slice(-limit).map((k) => ({
    time: k[0],
    open: k[3],
    high: k[2],
    low: k[1],
    close: k[4],
    volume: k[5],
    isFinal: true,
  }));
}

export async function fetchCoinbaseTicker24h(symbol: string): Promise<Ticker24h> {
  const prodId = symbol.includes("-") ? symbol : symbol.endsWith("USD") ? `${symbol.slice(0, -3)}-USD` : symbol;
  const url = `${REST_BASE}/products/${prodId}/stats`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Coinbase ticker error: ${res.status}`);
  const stats = await res.json();

  const lastPrice = parseFloat(stats.last || "0");
  const openPrice = parseFloat(stats.open || stats.last || "0");
  const priceChange = lastPrice - openPrice;
  const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0;

  return {
    symbol: prodId,
    symbolKey: `COINBASE:${prodId}`,
    exchange: "COINBASE",
    lastPrice,
    priceChange,
    priceChangePercent,
    highPrice: parseFloat(stats.high || "0"),
    lowPrice: parseFloat(stats.low || "0"),
    volume: parseFloat(stats.volume || "0"),
    quoteVolume: parseFloat(stats.volume_30day || "0"),
  };
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchCoinbaseSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;
  const url = `${REST_BASE}/products`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Coinbase products error: ${res.status}`);
  const list = await res.json();

  cachedSymbols = list
    .filter((s: { status: string; quote_currency: string }) => s.status === "online" && (s.quote_currency === "USD" || s.quote_currency === "USDT"))
    .map((s: { id: string; base_currency: string; quote_currency: string; status: string }) => ({
      symbol: s.id,
      symbolKey: `COINBASE:${s.id}`,
      baseAsset: s.base_currency,
      quoteAsset: s.quote_currency,
      exchange: "COINBASE" as const,
      status: s.status,
    }));

  return cachedSymbols!;
}

export function createCoinbaseTickerWS(
  symbol: string,
  onCandle: (candle: Candle) => void,
): () => void {
  const prodId = symbol.includes("-") ? symbol : symbol.endsWith("USD") ? `${symbol.slice(0, -3)}-USD` : symbol;
  const ws = new WebSocket(WS_BASE);

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [prodId],
        channels: ["ticker"],
      }),
    );
  };

  let lastPrice = 0;

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === "ticker" && msg.price) {
        const price = parseFloat(msg.price);
        const time = Math.floor(new Date(msg.time).getTime() / 1000);
        if (isNaN(time)) return;
        
        onCandle({
          time,
          open: lastPrice || price,
          high: Math.max(lastPrice || price, price),
          low: Math.min(lastPrice || price, price),
          close: price,
          volume: parseFloat(msg.last_size || "0"),
          isFinal: false,
        });
        lastPrice = price;
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
