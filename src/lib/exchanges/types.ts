export type ExchangeId = "BINANCE" | "BYBIT" | "OKX" | "COINBASE";

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

export interface Candle {
  time: number; // UTC timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal?: boolean;
}

export interface SymbolInfo {
  symbol: string; // Native symbol name, e.g., BTCUSDT or BTC-USDT
  symbolKey: string; // Full composite key, e.g., BINANCE:BTCUSDT, BYBIT:BTCUSDT, OKX:BTC-USDT
  baseAsset: string; // e.g., BTC
  quoteAsset: string; // e.g., USDT or USD
  exchange: ExchangeId; // BINANCE, BYBIT, OKX, COINBASE
  status?: string;
}

export interface Ticker24h {
  symbol: string;
  symbolKey: string;
  exchange: ExchangeId;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}
