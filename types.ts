
export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DayAction {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface SentimentAnalysis {
  type: Sentiment;
  score: number;
  momentum: number;
  volume: number;
  volatility: number;
  summary: string;
}

export interface StockInfo {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  marketCap: string;
  dividendYield: string;
  peRatio: string;
  sentiment: SentimentAnalysis;
}

export interface StockDetails {
  info: StockInfo;
  history: PricePoint[];
  dailyAction: DayAction[];
}
