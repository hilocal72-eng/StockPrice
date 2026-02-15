
import { GoogleGenAI, Type } from "@google/genai";
import { PricePoint, AIAnalysisResult, StockDetails, WatchlistStockAnalysis } from "../types.ts";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please check your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const getAIIntelligenceReport = async (
  ticker: string,
  currentPrice: number,
  history: PricePoint[]
): Promise<AIAnalysisResult | null> => {
  try {
    const ai = getAI();
    const historySnippet = history.slice(-50).map(p => 
      `T:${new Date(p.time * 1000).toISOString()} O:${p.open} H:${p.high} L:${p.low} C:${p.close} V:${p.volume}`
    ).join('\n');

    const prompt = `
      Act as a world-class senior financial analyst. Analyze the stock: ${ticker} (Current Price: ${currentPrice}).
      
      OHLC DATA (Last 50 entries):
      ${historySnippet}

      TASKS:
      1. Use Google Search to find recent news for ${ticker}. 
         - Provide exactly 3 concise, impactful bullet points in 'newsBullets'.
      2. Identify 3 key support levels and 3 key resistance levels based on price history.
      3. Scan for technical patterns. IMPORTANT: Include the date the pattern was observed in brackets, e.g., "Double Bottom (Feb 12)".
      4. Provide a definitive signal: "BUY", "SELL", or "NO OPPORTUNITY". 
         - signalReasoning: Exactly 3 concise bullet points explaining why.
      5. technicalSummary: Exactly 3 concise bullet points summarizing the technical outlook.
      6. If BUY or SELL: Provide entry price, Target 1, Target 2, and Stop Loss.

      IMPORTANT: 
      - Return ONLY a valid JSON object.
      - Do not include markdown blocks or extra text.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newsSummary: { type: Type.STRING },
            newsBullets: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Exactly 3 concise news bullet points."
            },
            supportLevels: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            resistanceLevels: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            patterns: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Patterns with dates in brackets, e.g. 'Pattern (Date)'"
            },
            technicalSummary: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 concise technical summary bullet points."
            },
            signal: { type: Type.STRING, description: "BUY, SELL, or NO OPPORTUNITY" },
            signalReasoning: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 concise reasoning bullet points."
            },
            tradeLevels: {
              type: Type.OBJECT,
              properties: {
                entry: { type: Type.NUMBER },
                target1: { type: Type.NUMBER },
                target2: { type: Type.NUMBER },
                stopLoss: { type: Type.NUMBER }
              }
            }
          },
          required: ["newsBullets", "supportLevels", "resistanceLevels", "patterns", "technicalSummary", "signal", "signalReasoning"]
        }
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = JSON.parse(text);
    return {
      ...result,
      newsSources: [] // Removed per user request
    };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};

export const getWatchlistPulseReport = async (stocks: StockDetails[]): Promise<WatchlistStockAnalysis[]> => {
  if (!stocks || stocks.length === 0) return [];

  try {
    const ai = getAI();
    // Providing 30 days of context but emphasizing the 10-day analysis in the prompt
    const dataContext = stocks.map(s => {
      const history = s.history.slice(-30).map(p => 
        `{T:${new Date(p.time * 1000).toISOString().split('T')[0]},C:${p.close},V:${p.volume}}`
      ).join('|');
      return `SYMBOL:${s.info.ticker} PRICE:${s.info.currentPrice} HISTORY:[${history}]`;
    }).join('\n');

    const prompt = `
      Perform a High-Precision Multi-Stock Pulse Scan. 
      Focus exclusively on identifying high-conviction "BUY" opportunities based on the most recent 10-day interval of price action and volume patterns.

      STOCKS DATA:
      ${dataContext}

      ANALYSIS CRITERIA (10-Day Focus):
      1. Identify Bullish Divergences or Breakouts occurring within the last 10 days.
      2. Check for volume-supported support bounces.
      3. ONLY include a stock in the response if it is a strong "BUY". If a stock is not a clear buy, exclude it from the final JSON array.
      
      RULES:
      - The 'signal' MUST always be "BUY". If you cannot justify a BUY, do not return that symbol.
      - Calculate 'entry' as the current price or a slight pullback level.
      - 'target1' must be a logical resistance level derived from the chart data.
      - 'stopLoss' should be strictly placed 3-5% below entry to protect capital.
      - Accuracy is paramount. Quality of signal over quantity.
      - Return ONLY a JSON array of objects.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              symbol: { type: Type.STRING },
              currentPrice: { type: Type.NUMBER },
              signal: { type: Type.STRING, description: "Must be BUY" },
              entry: { type: Type.NUMBER },
              target1: { type: Type.NUMBER },
              stopLoss: { type: Type.NUMBER }
            },
            required: ["symbol", "currentPrice", "signal", "entry", "target1", "stopLoss"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    const parsed = JSON.parse(text);
    // Extra safety filter to ensure only BUY signals are returned
    return parsed.filter((item: WatchlistStockAnalysis) => item.signal === 'BUY');
  } catch (error) {
    console.error("Watchlist Pulse Error:", error);
    return [];
  }
};
