
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
    const dataContext = stocks.map(s => {
      const history = s.history.slice(-30).map(p => `C:${p.close}`).join(',');
      return `SYMBOL:${s.info.ticker} PRICE:${s.info.currentPrice} HISTORY(30d):[${history}]`;
    }).join('\n');

    const prompt = `
      Perform a rapid multi-stock pulse check. 
      For each stock, provide a signal (BUY/SELL/HOLD), entry price, target 1, and stop-loss based on current price and recent 30-day history.
      
      STOCKS DATA:
      ${dataContext}

      RULES:
      - Be aggressive but realistic with levels.
      - Stop loss should be sensible (usually 3-7% from entry).
      - Target 1 should be a realistic resistance level.
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
              signal: { type: Type.STRING, description: "BUY, SELL, or HOLD" },
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
    return JSON.parse(text);
  } catch (error) {
    console.error("Watchlist Pulse Error:", error);
    return [];
  }
};
