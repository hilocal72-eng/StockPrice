
import { GoogleGenAI, Type } from "@google/genai";
import { PricePoint, AIAnalysisResult, StockDetails, WatchlistStockAnalysis } from "../types.ts";
import { getTechnicalIndicators } from "./technicalAnalysis.ts";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please check your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to fetch the model name from localStorage override or use default.
 */
const getModelName = (defaultModel: string): string => {
  return localStorage.getItem('stkr_override_model') || defaultModel;
};

/**
 * Generates a detailed intelligence report using Gemini 3 Pro with Google Search grounding.
 * HYBRID MODEL: Local Math Layer + AI Reasoning Layer.
 */
export const getAIIntelligenceReport = async (
  ticker: string,
  currentPrice: number,
  history: PricePoint[]
): Promise<AIAnalysisResult | null> => {
  try {
    const ai = getAI();
    
    // --- HYBRID STEP: LOCAL MATH LAYER ---
    const techData = getTechnicalIndicators(history);
    
    const prompt = `
      Analyze the stock: ${ticker} (Current Price: ${currentPrice}).
      
      VERIFIED TECHNICAL DATA (Math Layer):
      - RSI (14): ${techData.rsi}
      - SMA (50): ${techData.sma50}
      - SMA (200): ${techData.sma200}
      - EMA (20): ${techData.ema20}
      - Calculated Support Levels: ${techData.supportLevels.join(', ')}
      - Calculated Resistance Levels: ${techData.resistanceLevels.join(', ')}

      TASKS:
      1. Use Google Search to find recent news for ${ticker}. 
         - Provide exactly 3 concise, impactful bullet points in 'newsBullets'.
      2. Analyze the provided Math Layer data (RSI, MAs) to form a trade hypothesis.
      3. Identify any additional 3 support/resistance levels if necessary, or confirm the calculated ones.
      4. Scan for technical patterns. Include date in brackets, e.g., "Cup & Handle (Feb 15)".
      5. Provide a definitive signal: "BUY", "SELL", or "NO OPPORTUNITY". 
         - signalReasoning: Exactly 3 concise bullet points. Use the RSI and SMA data in your reasoning.
      6. technicalSummary: Exactly 3 concise bullet points summarizing the outlook based on both Math and News.
      7. If BUY or SELL: Provide Entry, Target 1, Target 2, and Stop Loss. 
         - Stop Loss should be strictly below support for BUY, or above resistance for SELL.

      IMPORTANT: 
      - Return ONLY a valid JSON object.
      - Do not include markdown blocks or extra text.
    `;

    let response;
    try {
      response = await ai.models.generateContent({
        model: getModelName("gemini-3-flash-preview"),
        contents: prompt,
        config: {
          systemInstruction: "You are a world-class senior financial analyst. Return ONLY valid JSON as requested.",
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
                description: "Patterns with dates in brackets."
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
    } catch (toolError: any) {
      console.warn("AI Analysis with Google Search failed, retrying without tools...", toolError.message || toolError);
      // Retry without tools
      response = await ai.models.generateContent({
        model: getModelName("gemini-3-flash-preview"),
        contents: prompt + "\n\nNote: Google Search is unavailable, use your internal knowledge for recent context if possible.",
        config: {
          systemInstruction: "You are a world-class senior financial analyst. Return ONLY valid JSON as requested.",
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
                description: "Patterns with dates in brackets."
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
    }

    const text = response.text;
    if (!text) return null;

    try {
      const result = JSON.parse(text);
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const newsSources = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "Reference Source",
          uri: chunk.web.uri
        }));

      return {
        ...result,
        newsSources,
        technicalData: techData // Include the math layer data in the result for the UI
      };
    } catch (parseError) {
      console.error("Failed to parse AI response. Raw text:", text, parseError);
      return null;
    }
  } catch (error: any) {
    console.error("AI Analysis Error:", error.message || error);
    return null;
  }
};

/**
 * Scans the user's watchlist for high-conviction buy signals based on recent history.
 */
export const getWatchlistPulseReport = async (stocks: StockDetails[]): Promise<WatchlistStockAnalysis[]> => {
  if (!stocks || stocks.length === 0) return [];

  try {
    const ai = getAI();
    const dataContext = stocks.map(s => {
      const tech = getTechnicalIndicators(s.history);
      return `SYMBOL:${s.info.ticker} PRICE:${s.info.currentPrice} RSI:${tech.rsi} SMA50:${tech.sma50} SMA200:${tech.sma200}`;
    }).join('\n');

    const prompt = `
      Perform a High-Precision Multi-Stock Pulse Scan. 
      Focus on identifying high-conviction "BUY" opportunities using the provided pre-calculated Technical Indicators.

      STOCKS DATA (Math Layer Provided):
      ${dataContext}

      ANALYSIS CRITERIA:
      1. Identify stocks where Price > SMA200 (Long term trend is UP).
      2. Identify stocks where RSI is oversold (<40) or trending up from support.
      3. ONLY include a stock if it is a strong "BUY".
      
      RULES:
      - The 'signal' MUST always be "BUY".
      - Return ONLY a JSON array of objects.
    `;

    const response = await ai.models.generateContent({
      model: getModelName("gemini-3-flash-preview"),
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
    
    try {
      const parsed = JSON.parse(text);
      return parsed.filter((item: WatchlistStockAnalysis) => item.signal === 'BUY');
    } catch (e) {
      return [];
    }
  } catch (error) {
    console.error("Watchlist Pulse Error:", error);
    return [];
  }
};
