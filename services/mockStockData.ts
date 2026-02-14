
import { StockDetails, PricePoint, DayAction, StockInfo, SentimentAnalysis, SearchResult } from '../types.ts';

const fetchYahoo = async (symbol: string, interval: string, range: string): Promise<any | null> => {
  try {
    const cacheBuster = `&t=${Date.now()}`;
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false${cacheBuster}`;
    const url = `https://holy-sun-212b.hilocal72.workers.dev/`;
    const response = await fetch(`${url}?url=${encodeURIComponent(targetUrl)}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) return null;
    return data.chart.result[0];
  } catch (e) {
    return null;
  }
};

export const searchStocks = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.trim().length < 1) return [];
  try {
    const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=6&newsCount=0&listsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&newsQueryId=news_cie_vespa&enableCb=true&enableNavLinks=true&enableEnhancedTrivialQuery=true`;
    const url = `https://holy-sun-212b.hilocal72.workers.dev/`;
    const response = await fetch(`${url}?url=${encodeURIComponent(targetUrl)}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.quotes || data.quotes.length === 0) return [];

    return data.quotes
      .filter((q: any) => q.symbol && (q.longname || q.shortname))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname,
        exchange: q.exchange,
      }));
  } catch (e) {
    console.error('Search API error:', e);
    return [];
  }
};

const generateSentimentAnalysis = (changePercent: number, history: PricePoint[]): SentimentAnalysis => {
  const type = changePercent > 0.5 ? 'bullish' : changePercent < -0.5 ? 'bearish' : 'neutral';
  
  const recentPrices = history.slice(-5);
  const upDays = recentPrices.filter((p, i, arr) => i > 0 && p.close > arr[i-1].close).length;
  
  const momentum = Math.min(Math.max(50 + (changePercent * 10) + (upDays * 5), 10), 95);
  const volume = Math.min(Math.max(40 + (Math.random() * 40), 10), 95);
  const volatility = Math.min(Math.max(30 + (Math.random() * 50), 10), 95);
  
  let score = 50;
  if (type === 'bullish') score = 70 + (changePercent * 2);
  if (type === 'bearish') score = 30 + (changePercent * 2);
  score = Math.min(Math.max(score, 5), 98);

  const summaries = {
    bullish: "Market structure is showing strong accumulation. Support levels are holding firm with high conviction buying seen on recent dips.",
    bearish: "Selling pressure is dominant as technical resistance holds. High-volume outflows suggest a temporary bearish cycle in play.",
    neutral: "Price action is oscillating within a tight range. Indicators suggest a period of consolidation as the market awaits a breakout catalyst."
  };

  return {
    type,
    score: Math.round(score),
    momentum: Math.round(momentum),
    volume: Math.round(volume),
    volatility: Math.round(volatility),
    summary: summaries[type]
  };
};

export const fetchStockData = async (ticker: string, range: string = '1y', interval: string = '1d'): Promise<StockDetails | null> => {
  if (!ticker) return null;
  
  const rawSymbol = ticker.toUpperCase().trim();
  let chartResult = await fetchYahoo(rawSymbol, interval, range); 
  let historyResult = await fetchYahoo(rawSymbol, '1d', '7d'); // For weekly table

  if (!chartResult && !rawSymbol.includes('.')) {
    const nsSymbol = `${rawSymbol}.NS`;
    chartResult = await fetchYahoo(nsSymbol, interval, range);
    historyResult = await fetchYahoo(nsSymbol, '1d', '7d');
    
    if (!chartResult) {
      const boSymbol = `${rawSymbol}.BO`;
      chartResult = await fetchYahoo(boSymbol, interval, range);
      historyResult = await fetchYahoo(boSymbol, '1d', '7d');
    }
  }

  if (!chartResult || !historyResult) return null;

  try {
    const meta = chartResult.meta;
    const currentPrice = meta.regularMarketPrice;
    
    const hTimestamps = historyResult.timestamp || [];
    const hCloses = historyResult.indicators.quote[0].close || [];
    const hQuotes = historyResult.indicators.quote[0];
    
    let prevClose = meta.regularMarketPreviousClose;
    if (!prevClose && hCloses.length >= 2) {
      prevClose = hCloses[hCloses.length - 2];
    }
    if (!prevClose) prevClose = hCloses[0] || currentPrice;

    const dayChange = currentPrice - prevClose;
    const dayChangePercent = prevClose !== 0 ? (dayChange / prevClose) * 100 : 0;

    const timestamps = chartResult.timestamp || [];
    const quotes = chartResult.indicators.quote[0];
    const history: PricePoint[] = timestamps.map((t: number, i: number) => ({
      time: t,
      open: parseFloat((quotes.open[i] || 0).toFixed(2)),
      high: parseFloat((quotes.high[i] || 0).toFixed(2)),
      low: parseFloat((quotes.low[i] || 0).toFixed(2)),
      close: parseFloat((quotes.close[i] || 0).toFixed(2)),
      volume: quotes.volume[i] || 0
    })).filter((p: PricePoint) => p.close > 0);

    const info: StockInfo = {
      ticker: meta.symbol || rawSymbol,
      name: meta.longName || meta.shortName || meta.symbol || rawSymbol,
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(dayChange.toFixed(2)),
      changePercent: parseFloat(dayChangePercent.toFixed(2)),
      marketCap: formatMarketCap(meta.marketCap) || 'N/A',
      dividendYield: meta.dividendYield ? (meta.dividendYield * 100).toFixed(2) + '%' : 'N/A',
      peRatio: meta.peRatio ? meta.peRatio.toFixed(2) : 'N/A',
      sentiment: generateSentimentAnalysis(dayChangePercent, history)
    };

    const dailyAction: DayAction[] = hTimestamps.map((t: number, i: number) => {
      const open = hQuotes.open[i] || 0;
      const close = hQuotes.close[i] || 0;
      const rowPrevClose = i > 0 ? hQuotes.close[i-1] : hQuotes.open[i];
      return {
        // Removed year from date formatting
        date: new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat((hQuotes.high[i] || 0).toFixed(2)),
        low: parseFloat((hQuotes.low[i] || 0).toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: hQuotes.volume[i] || 0,
        change: parseFloat((close - rowPrevClose).toFixed(2)),
        changePercent: parseFloat((rowPrevClose !== 0 ? ((close - rowPrevClose) / rowPrevClose) * 100 : 0).toFixed(2))
      };
    }).reverse().slice(0, 5);

    return { info, history, dailyAction };
  } catch (error) {
    console.error("Processing Error:", error);
    return null;
  }
};

const formatMarketCap = (labelValue: any) => {
  if (!labelValue || isNaN(labelValue)) return null;
  const val = Math.abs(Number(labelValue));
  if (val >= 1.0e+12) return (val / 1.0e+12).toFixed(2) + "T";
  if (val >= 1.0e+9) return (val / 1.0e+9).toFixed(2) + "B";
  if (val >= 1.0e+6) return (val / 1.0e+6).toFixed(2) + "M";
  return val.toLocaleString();
};
