
export interface PricePoint {
  time: number; // Unix timestamp (seconds)
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

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface TrendLine {
  id: string;
  p1: { time: number; price: number };
  p2: { time: number; price: number };
}

export interface Alert {
  id?: number;
  ticker: string;
  target_price: number;
  condition: 'above' | 'below';
  status: 'active' | 'triggered' | 'disabled';
  created_at?: string;
}

export interface AIAnalysisResult {
  newsSummary: string;
  newsBullets: string[];
  newsSources: { title: string; uri: string }[];
  supportLevels: number[];
  resistanceLevels: number[];
  patterns: string[];
  technicalSummary: string;
  signal: 'BUY' | 'SELL' | 'NO OPPORTUNITY';
  signalReasoning: string;
  tradeLevels?: {
    entry: number;
    target1: number;
    target2: number;
    stopLoss: number;
  };
}

export interface WatchlistStockAnalysis {
  symbol: string;
  currentPrice: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  target1: number;
  stopLoss: number;
}

export interface PortfolioItem {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
}
