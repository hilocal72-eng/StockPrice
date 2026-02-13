
import React, { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  isModal?: boolean;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol, isModal }) => {
  const containerId = useRef(`tv-chart-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    const initWidget = () => {
      if (typeof window.TradingView === 'undefined') return;

      // --- Precise Symbol Mapping for TradingView ---
      let ticker = symbol.toUpperCase().trim();
      let tvSymbol = '';

      // Map Yahoo suffixes to TradingView Prefixes
      if (ticker.endsWith('.NS')) {
        tvSymbol = `NSE:${ticker.replace('.NS', '')}`;
      } else if (ticker.endsWith('.BO')) {
        tvSymbol = `BSE:${ticker.replace('.BO', '')}`;
      } 
      // Popular manual mappings
      else if (['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'WIT', 'TATAMOTORS'].includes(ticker)) {
        tvSymbol = `NSE:${ticker}`;
      } else if (['AAPL', 'TSLA', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META'].includes(ticker)) {
        tvSymbol = `NASDAQ:${ticker}`;
      } else {
        tvSymbol = ticker;
      }

      try {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": tvSymbol,
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "toolbar_bg": "#131722",
          "enable_publishing": false,
          "allow_symbol_change": true,
          "container_id": containerId.current,
          "width": "100%",
          "height": "100%",
          "hide_side_toolbar": false,
          "details": false,
          "hotlist": false,
          "calendar": false,
          "show_popup_button": false,
          "withdateranges": true,
          "hide_volume": false,
        });
      } catch (e) {
        console.error("TV Widget Init Error:", e);
      }
    };

    // Small timeout to ensure the div is mounted and tv.js is ready
    const timer = setTimeout(initWidget, 200);
    return () => clearTimeout(timer);
  }, [symbol]);

  return (
    <div className="w-full h-full bg-[#131722] rounded-[2.5rem] overflow-hidden">
      <div 
        id={containerId.current}
        className={`w-full ${isModal ? 'h-full' : 'h-[550px] md:h-[700px]'} border border-white/40 shadow-2xl`}
      />
    </div>
  );
};

export default TradingViewChart;
