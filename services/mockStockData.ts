
import { StockDetails, PricePoint, DayAction, StockInfo, SentimentAnalysis, SearchResult } from '../types.ts';

// Simple in-memory cache to speed up repeated requests
const dataCache: Record<string, { data: StockDetails; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

const fetchYahoo = async (symbol: string, interval: string, range: string): Promise<any | null> => {
  try {
    const response = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`);
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
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const data = await response.json();
    
    let results: SearchResult[] = [];
    if (data.quotes && data.quotes.length > 0) {
      results = data.quotes
        .filter((q: any) => q.symbol && (q.longname || q.shortname))
        .map((q: any) => {
          const isNSE = q.symbol.endsWith('.NS');
          const isBSE = q.symbol.endsWith('.BO');
          
          return {
            // Strip .NS and .BO for Zerodha style symbols
            symbol: q.symbol.split('.')[0],
            name: q.longname || q.shortname,
            // Map exchange to NSE/BSE for Indian stocks, otherwise use Yahoo's exchange
            exchange: isNSE ? 'NSE' : isBSE ? 'BSE' : q.exchange,
          };
        })
        // Prioritize Indian exchanges (NSE/BSE) for Zerodha integration
        .sort((a: SearchResult, b: SearchResult) => {
          const aIsIndian = a.exchange === 'NSE' || a.exchange === 'BSE';
          const bIsIndian = b.exchange === 'NSE' || b.exchange === 'BSE';
          if (aIsIndian && !bIsIndian) return -1;
          if (!aIsIndian && bIsIndian) return 1;
          return 0;
        });
    }

    // Mock NFO segment data for Zerodha
    const upperQuery = query.toUpperCase();
    const queryWords = upperQuery.split(/\s+/).filter(w => w.length > 0);
    
    const mockNFO = [
      // Monthly Expiries
      { symbol: 'NIFTY24FEB22000CE', name: 'NIFTY 24 FEB 22000 CE', exchange: 'NFO' },
      { symbol: 'NIFTY24FEB22000PE', name: 'NIFTY 24 FEB 22000 PE', exchange: 'NFO' },
      { symbol: 'NIFTY24MAR22500CE', name: 'NIFTY 24 MAR 22500 CE', exchange: 'NFO' },
      { symbol: 'NIFTY24MAR22500PE', name: 'NIFTY 24 MAR 22500 PE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY24FEB46000CE', name: 'BANKNIFTY 24 FEB 46000 CE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY24FEB46000PE', name: 'BANKNIFTY 24 FEB 46000 PE', exchange: 'NFO' },
      
      // Weekly Expiries (Commonly used in Zerodha)
      { symbol: 'NIFTY2420822000CE', name: 'NIFTY 24 08 FEB 22000 CE', exchange: 'NFO' },
      { symbol: 'NIFTY2420822000PE', name: 'NIFTY 24 08 FEB 22000 PE', exchange: 'NFO' },
      { symbol: 'NIFTY2421522100CE', name: 'NIFTY 24 15 FEB 22100 CE', exchange: 'NFO' },
      { symbol: 'NIFTY2421522100PE', name: 'NIFTY 24 15 FEB 22100 PE', exchange: 'NFO' },
      { symbol: 'NIFTY2422222200CE', name: 'NIFTY 24 22 FEB 22200 CE', exchange: 'NFO' },
      { symbol: 'NIFTY2422222200PE', name: 'NIFTY 24 22 FEB 22200 PE', exchange: 'NFO' },
      { symbol: 'NIFTY2422922300CE', name: 'NIFTY 24 29 FEB 22300 CE', exchange: 'NFO' },
      { symbol: 'NIFTY2422922300PE', name: 'NIFTY 24 29 FEB 22300 PE', exchange: 'NFO' },
      
      // Higher Strikes for Nifty (e.g. 25200)
      { symbol: 'NIFTY24FEB25200CE', name: 'NIFTY 24 FEB 25200 CE', exchange: 'NFO' },
      { symbol: 'NIFTY24FEB25200PE', name: 'NIFTY 24 FEB 25200 PE', exchange: 'NFO' },
      { symbol: 'NIFTY24MAR25200CE', name: 'NIFTY 24 MAR 25200 CE', exchange: 'NFO' },
      { symbol: 'NIFTY24MAR25200PE', name: 'NIFTY 24 MAR 25200 PE', exchange: 'NFO' },

      { symbol: 'BANKNIFTY2420745500CE', name: 'BANKNIFTY 24 07 FEB 45500 CE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2420745500PE', name: 'BANKNIFTY 24 07 FEB 45500 PE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2421445800CE', name: 'BANKNIFTY 24 14 FEB 45800 CE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2421445800PE', name: 'BANKNIFTY 24 14 FEB 45800 PE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2422146000CE', name: 'BANKNIFTY 24 21 FEB 46000 CE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2422146000PE', name: 'BANKNIFTY 24 21 FEB 46000 PE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2422846500CE', name: 'BANKNIFTY 24 28 FEB 46500 CE', exchange: 'NFO' },
      { symbol: 'BANKNIFTY2422846500PE', name: 'BANKNIFTY 24 28 FEB 46500 PE', exchange: 'NFO' },

      // Futures
      { symbol: 'NIFTY24FEBFUT', name: 'NIFTY 24 FEB FUT', exchange: 'NFO' },
      { symbol: 'BANKNIFTY24FEBFUT', name: 'BANKNIFTY 24 FEB FUT', exchange: 'NFO' },
      { symbol: 'RELIANCE24FEBFUT', name: 'RELIANCE 24 FEB FUT', exchange: 'NFO' },
      { symbol: 'HDFCBANK24FEBFUT', name: 'HDFCBANK 24 FEB FUT', exchange: 'NFO' },
      { symbol: 'INFY24FEBFUT', name: 'INFY 24 FEB FUT', exchange: 'NFO' },
    ];
    
    const filteredNFO = mockNFO.filter(nfo => {
      // Flexible search: all query words must be present in either symbol or name
      // Also handle cases like "nifty25200" by checking if the word is a substring
      return queryWords.every(word => {
        const wordUpper = word.toUpperCase();
        const inSymbol = nfo.symbol.includes(wordUpper);
        const inName = nfo.name.toUpperCase().includes(wordUpper);
        
        if (inSymbol || inName) return true;
        
        // If word is something like "NIFTY25200", try to match parts
        if (wordUpper.startsWith('NIFTY') && wordUpper.length > 5) {
          const strike = wordUpper.substring(5);
          return nfo.symbol.startsWith('NIFTY') && nfo.symbol.includes(strike);
        }
        if (wordUpper.startsWith('BANKNIFTY') && wordUpper.length > 9) {
          const strike = wordUpper.substring(9);
          return nfo.symbol.startsWith('BANKNIFTY') && nfo.symbol.includes(strike);
        }
        
        return false;
      });
    });
    
    // Always return NFO results if they match, or just prepend them
    results = [...filteredNFO, ...results];

    return results;
  } catch (e) {
    console.error('Search API error:', e);
    return [];
  }
};

export const INDICES = {
  'NIFTY 50': ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS', 'SBIN.NS', 'INFY.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS', 'BAJFINANCE.NS', 'HCLTECH.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'TATAMOTORS.NS', 'TATASTEEL.NS', 'KOTAKBANK.NS', 'TITAN.NS', 'ADANIENT.NS', 'ASIANPAINT.NS', 'BAJAJFINSV.NS', 'WIPRO.NS', 'ULTRACEMCO.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS', 'M&M.NS', 'LTIM.NS', 'COALINDIA.NS', 'ADANIPORTS.NS', 'HINDALCO.NS', 'BRITANNIA.NS', 'TECHM.NS', 'EICHERMOT.NS', 'DIVISLAB.NS', 'GRASIM.NS', 'CIPLA.NS', 'JSWSTEEL.NS', 'HEROMOTOCO.NS', 'APOLLOHOSP.NS', 'DRREDDY.NS', 'SBILIFE.NS', 'HDFCLIFE.NS', 'BAJAJ-AUTO.NS', 'UPL.NS', 'INDUSINDBK.NS', 'NESTLEIND.NS', 'BPCL.NS'],
  'NIFTY BANK': ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'INDUSINDBK.NS', 'BANKBARODA.NS', 'AUBANK.NS', 'FEDERALBNK.NS', 'IDFCFIRSTB.NS', 'PNB.NS', 'BANDHANBNK.NS'],
  'NIFTY IT': ['TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'TECHM.NS', 'LTIM.NS', 'COFORGE.NS', 'PERSISTENT.NS', 'MPHASIS.NS', 'LTTS.NS'],
};

export interface ScreenerResult {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercentFromOpen: number;
  changePercentFromClose: number;
  volume: number;
}

export type TradeType = 'intraday' | 'investment' | 'hybrid';

export const runScreener = async (
  indexName: keyof typeof INDICES, 
  minPct: number, 
  maxPct: number, 
  direction: 'above' | 'below' = 'above',
  tradeType: TradeType = 'intraday'
): Promise<ScreenerResult[]> => {
  try {
    const symbols = INDICES[indexName];
    if (!symbols) return [];

    const response = await fetch(`/api/screener?symbols=${symbols.join(',')}`);
    
    if (!response.ok) throw new Error('Failed to fetch quotes');
    const data = await response.json();
    
    if (!data.quotes) return [];

    const results: ScreenerResult[] = [];

    // yahoo-finance2 returns an array of quotes
    const quotesArray = Array.isArray(data.quotes) ? data.quotes : [data.quotes];

    quotesArray.forEach((quote: any) => {
      const currentPrice = quote.regularMarketPrice;
      const openPrice = quote.regularMarketOpen || quote.regularMarketPreviousClose;
      const prevClose = quote.regularMarketPreviousClose || openPrice;
      
      if (currentPrice && openPrice) {
        const changeFromOpen = ((currentPrice - openPrice) / openPrice) * 100;
        const changeFromClose = ((currentPrice - prevClose) / prevClose) * 100;
        
        let isMatch = false;
        
        if (tradeType === 'intraday') {
          if (direction === 'above') {
            isMatch = changeFromOpen >= minPct && changeFromOpen <= maxPct;
          } else {
            isMatch = changeFromOpen <= -minPct && changeFromOpen >= -maxPct;
          }
        } else if (tradeType === 'investment') {
          if (direction === 'above') {
            isMatch = changeFromClose >= minPct && changeFromClose <= maxPct;
          } else {
            isMatch = changeFromClose <= -minPct && changeFromClose >= -maxPct;
          }
        } else if (tradeType === 'hybrid') {
          // Hybrid logic: Primary (Open) + Secondary (Close)
          if (direction === 'above') {
            const primaryMatch = changeFromOpen >= minPct && changeFromOpen <= maxPct;
            const secondaryMatch = changeFromClose > 0;
            isMatch = primaryMatch && secondaryMatch;
          } else {
            const primaryMatch = changeFromOpen <= -minPct && changeFromOpen >= -maxPct;
            const secondaryMatch = changeFromClose < 0;
            isMatch = primaryMatch && secondaryMatch;
          }
        }
        
        if (isMatch) {
          results.push({
            symbol: quote.symbol.replace('.NS', ''),
            name: quote.shortName || quote.longName || quote.symbol,
            currentPrice: currentPrice,
            changePercentFromOpen: changeFromOpen,
            changePercentFromClose: changeFromClose,
            volume: quote.regularMarketVolume || 0
          });
        }
      }
    });

    // Sort by the primary metric based on trade type
    const sortFn = (a: ScreenerResult, b: ScreenerResult) => {
      const valA = tradeType === 'investment' ? a.changePercentFromClose : a.changePercentFromOpen;
      const valB = tradeType === 'investment' ? b.changePercentFromClose : b.changePercentFromOpen;
      
      if (direction === 'above') {
        return valB - valA;
      } else {
        return valA - valB;
      }
    };

    return results.sort(sortFn).slice(0, 10);
  } catch (e) {
    console.error('Screener error:', e);
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
  const cacheKey = `${rawSymbol}_${range}_${interval}`;

  // Check cache first
  const cached = dataCache[cacheKey];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  
  // PARALLEL FETCH: Load chart and history at the same time for performance
  let [chartResult, historyResult] = await Promise.all([
    fetchYahoo(rawSymbol, interval, range),
    fetchYahoo(rawSymbol, '1d', '7d')
  ]);

  // Fallback for Indian markets if common symbol is used without suffix
  if (!chartResult && !rawSymbol.includes('.')) {
    const nsSymbol = `${rawSymbol}.NS`;
    const [nsChart, nsHistory] = await Promise.all([
      fetchYahoo(nsSymbol, interval, range),
      fetchYahoo(nsSymbol, '1d', '7d')
    ]);
    
    if (nsChart) {
      chartResult = nsChart;
      historyResult = nsHistory;
    } else {
      const boSymbol = `${rawSymbol}.BO`;
      const [boChart, boHistory] = await Promise.all([
        fetchYahoo(boSymbol, interval, range),
        fetchYahoo(boSymbol, '1d', '7d')
      ]);
      if (boChart) {
        chartResult = boChart;
        historyResult = boHistory;
      }
    }
  }

  if (!chartResult || !historyResult) {
    console.warn("API returned no data for:", ticker);
    return null;
  }

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

    const result = { info, history, dailyAction };
    
    // Store in cache
    dataCache[cacheKey] = { data: result, timestamp: Date.now() };
    
    return result;
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
