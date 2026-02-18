
import { PricePoint, TechnicalIndicators } from '../types.ts';

/**
 * Calculates Simple Moving Average
 */
export const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const sum = data.slice(-period).reduce((acc, val) => acc + val, 0);
  return sum / period;
};

/**
 * Calculates Exponential Moving Average
 */
export const calculateEMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
};

/**
 * Calculates Relative Strength Index (RSI)
 */
export const calculateRSI = (data: number[], period: number = 14): number => {
  if (data.length <= period) return 50;
  
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    let currentGain = change >= 0 ? change : 0;
    let currentLoss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

/**
 * Detects Support and Resistance levels using local minima/maxima
 */
export const detectLevels = (prices: PricePoint[]): { support: number[], resistance: number[] } => {
  const closes = prices.map(p => p.close);
  const support: number[] = [];
  const resistance: number[] = [];
  
  // Simple pivot detection logic
  for (let i = 2; i < closes.length - 2; i++) {
    // Local Minimum (Support)
    if (closes[i] < closes[i-1] && closes[i] < closes[i-2] && closes[i] < closes[i+1] && closes[i] < closes[i+2]) {
      support.push(Number(closes[i].toFixed(2)));
    }
    // Local Maximum (Resistance)
    if (closes[i] > closes[i-1] && closes[i] > closes[i-2] && closes[i] > closes[i+1] && closes[i] > closes[i+2]) {
      resistance.push(Number(closes[i].toFixed(2)));
    }
  }

  // Sort and filter for unique-ish levels
  const filterLevels = (levels: number[]) => {
    return Array.from(new Set(levels))
      .sort((a, b) => a - b)
      .filter((val, index, self) => index === 0 || Math.abs(val - self[index-1]) > (val * 0.02))
      .slice(-3);
  };

  return {
    support: filterLevels(support),
    resistance: filterLevels(resistance)
  };
};

/**
 * Main function to get all technical indicators for the Hybrid Model
 */
export const getTechnicalIndicators = (history: PricePoint[]): TechnicalIndicators => {
  const closes = history.map(p => p.close);
  const levels = detectLevels(history);
  
  return {
    rsi: Number(calculateRSI(closes).toFixed(2)),
    sma50: Number(calculateSMA(closes, 50).toFixed(2)),
    sma200: Number(calculateSMA(closes, 200).toFixed(2)),
    ema20: Number(calculateEMA(closes, 20).toFixed(2)),
    supportLevels: levels.support,
    resistanceLevels: levels.resistance
  };
};
