import {
  createBinanceKlinesWS,
  fetchBinanceKlines,
  fetchBinanceSymbols,
  fetchBinanceTicker24h,
  fetchBinanceTickers24h,
} from "./binance";
import {
  createBybitKlinesWS,
  fetchBybitKlines,
  fetchBybitSymbols,
  fetchBybitTicker24h,
} from "./bybit";
import {
  createOKXKlinesWS,
  fetchOKXKlines,
  fetchOKXSymbols,
  fetchOKXTicker24h,
} from "./okx";
import {
  createCoinbaseTickerWS,
  fetchCoinbaseKlines,
  fetchCoinbaseSymbols,
  fetchCoinbaseTicker24h,
} from "./coinbase";
import type { Candle, ExchangeId, SymbolInfo, Ticker24h, Timeframe } from "./types";

export function parseSymbolKey(key: string): {
  exchange: ExchangeId;
  symbol: string;
  symbolKey: string;
} {
  if (!key) {
    return { exchange: "BINANCE", symbol: "BTCUSDT", symbolKey: "BINANCE:BTCUSDT" };
  }

  let rawSymbol = key.trim().toUpperCase();
  if (rawSymbol.includes(":")) {
    const parts = rawSymbol.split(":");
    rawSymbol = parts[1] || parts[0] || "";
  }

  // Fuerza Binance como único exchange según preferencia del usuario ("Y SOLO DE binance")
  const exchange: ExchangeId = "BINANCE";

  // Normaliza el símbolo: si viene base sin par (p. ej. LINK), añade USDT automáticamente -> LINKUSDT
  let symbol = rawSymbol;
  if (!symbol) {
    symbol = "BTCUSDT";
  } else if (
    !symbol.endsWith("USDT") &&
    !symbol.endsWith("BUSD") &&
    !symbol.endsWith("USDC") &&
    !symbol.endsWith("BTC") &&
    !symbol.endsWith("ETH") &&
    !symbol.endsWith("BNB")
  ) {
    symbol = `${symbol}USDT`;
  }

  return {
    exchange,
    symbol,
    symbolKey: `BINANCE:${symbol}`,
  };
}

export async function fetchKlines(
  symbolKey: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const { exchange, symbol } = parseSymbolKey(symbolKey);
  switch (exchange) {
    case "BYBIT":
      return fetchBybitKlines(symbol, interval, limit);
    case "OKX":
      return fetchOKXKlines(symbol, interval, limit);
    case "COINBASE":
      return fetchCoinbaseKlines(symbol, interval, limit);
    case "BINANCE":
    default:
      return fetchBinanceKlines(symbol, interval, limit);
  }
}

export async function fetchTicker24h(symbolKey: string): Promise<Ticker24h> {
  const { exchange, symbol } = parseSymbolKey(symbolKey);
  switch (exchange) {
    case "BYBIT":
      return fetchBybitTicker24h(symbol);
    case "OKX":
      return fetchOKXTicker24h(symbol);
    case "COINBASE":
      return fetchCoinbaseTicker24h(symbol);
    case "BINANCE":
    default:
      return fetchBinanceTicker24h(symbol);
  }
}

export async function fetchTickers24h(symbolKeys: string[]): Promise<Ticker24h[]> {
  const binanceKeys: string[] = [];
  const otherKeys: string[] = [];

  for (const k of symbolKeys) {
    const { exchange } = parseSymbolKey(k);
    if (exchange === "BINANCE") {
      binanceKeys.push(parseSymbolKey(k).symbol);
    } else {
      otherKeys.push(k);
    }
  }

  const results: Ticker24h[] = [];

  if (binanceKeys.length > 0) {
    try {
      const bTickers = await fetchBinanceTickers24h(binanceKeys);
      results.push(...bTickers);
    } catch {
      // ignore binance batch failure
    }
  }

  // Fetch non-Binance tickers in parallel
  const otherPromises = otherKeys.map((k) =>
    fetchTicker24h(k).catch(() => null),
  );
  const otherTickers = await Promise.all(otherPromises);

  for (const t of otherTickers) {
    if (t) results.push(t);
  }

  return results;
}

let cachedAllSymbols: SymbolInfo[] | null = null;

export async function fetchExchangeSymbols(
  exchangeFilter: ExchangeId | "ALL" = "ALL",
): Promise<SymbolInfo[]> {
  if (!cachedAllSymbols) {
    const [bSymbols, bySymbols, okxSymbols, cbSymbols] = await Promise.allSettled([
      fetchBinanceSymbols(),
      fetchBybitSymbols(),
      fetchOKXSymbols(),
      fetchCoinbaseSymbols(),
    ]);

    const all: SymbolInfo[] = [];
    if (bSymbols.status === "fulfilled") all.push(...bSymbols.value);
    if (bySymbols.status === "fulfilled") all.push(...bySymbols.value);
    if (okxSymbols.status === "fulfilled") all.push(...okxSymbols.value);
    if (cbSymbols.status === "fulfilled") all.push(...cbSymbols.value);

    cachedAllSymbols = all;
  }

  if (exchangeFilter === "ALL") {
    return cachedAllSymbols;
  }
  return cachedAllSymbols.filter((s) => s.exchange === exchangeFilter);
}

export function subscribeExchangeWS(
  symbolKey: string,
  interval: Timeframe,
  onCandle: (candle: Candle) => void,
): () => void {
  const { exchange, symbol } = parseSymbolKey(symbolKey);
  switch (exchange) {
    case "BYBIT":
      return createBybitKlinesWS(symbol, interval, onCandle);
    case "OKX":
      return createOKXKlinesWS(symbol, interval, onCandle);
    case "COINBASE":
      return createCoinbaseTickerWS(symbol, onCandle);
    case "BINANCE":
    default:
      return createBinanceKlinesWS(symbol, interval, onCandle);
  }
}
