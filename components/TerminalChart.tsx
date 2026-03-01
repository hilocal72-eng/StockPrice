
import React from 'react';
import LightweightChart from './LightweightChart.tsx';
import { PricePoint } from '../types.ts';
import { Maximize } from 'lucide-react';

interface TerminalChartProps {
  ticker: string;
  data: PricePoint[];
  isModal: boolean;
  onTimeframeChange?: (timeframe: '15m' | '1D') => void;
  activeTimeframe?: '15m' | '1D';
  activeTool?: string | null;
  clearLinesSignal?: number;
  saveChartSignal?: number;
}

const TerminalChart: React.FC<TerminalChartProps & { onExpand?: () => void }> = ({ 
  ticker,
  data, 
  isModal,
  onTimeframeChange,
  activeTimeframe,
  activeTool,
  clearLinesSignal,
  saveChartSignal,
  onExpand
}) => {
  const ohlcRef = React.useRef<HTMLDivElement>(null);

  if (isModal) {
    return (
      <div className="w-full h-full relative bg-white overflow-hidden flex flex-col">
        <div className="flex-1 relative w-full min-h-0">
          <LightweightChart 
            ticker={ticker}
            data={data}
            activeTimeframe={activeTimeframe}
            activeTool={activeTool}
            clearLinesSignal={clearLinesSignal}
            saveChartSignal={saveChartSignal}
            interactive={true}
          />
        </div>
        <div 
          ref={ohlcRef} 
          className="h-8 shrink-0 border-t border-gray-100 bg-white flex items-center px-4"
        >
          <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{ticker}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black/20 overflow-hidden group">
      <LightweightChart 
        ticker={ticker}
        data={data}
        activeTimeframe="1D"
        interactive={false}
      />

      {onExpand && (
        <button 
          onClick={onExpand}
          className="absolute bottom-2 left-2 z-20 p-1.5 bg-black rounded shadow-md text-white hover:bg-gray-900 transition-all border border-white/10 flex items-center justify-center"
          title="Expand Chart"
        >
          <Maximize size={12} color="white" />
        </button>
      )}
    </div>
  );
};

export default TerminalChart;
