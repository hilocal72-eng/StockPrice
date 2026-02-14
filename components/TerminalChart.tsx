
import React, { useEffect, useRef, useState, memo } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams } from 'lightweight-charts';
import { PricePoint } from '../types.ts';

type Timeframe = '15m' | '1D';

interface TerminalChartProps {
  data: PricePoint[];
  isModal: boolean;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  activeTimeframe?: Timeframe;
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  date?: string;
}

const TerminalChart: React.FC<TerminalChartProps> = ({ data, isModal, onTimeframeChange, activeTimeframe }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.15)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.15)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      crosshair: {
        mode: 1,
      },
      handleScroll: isModal,
      handleScale: isModal,
    });
    
    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    const formattedData = data.map(d => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    })).sort((a, b) => a.time - b.time);
    
    seriesRef.current.setData(formattedData);
    chartRef.current.timeScale().fitContent();

    const handleResize = () => chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);
    
    const crosshairMoveHandler = (param: MouseEventParams) => {
      if (!param.point || param.time === undefined || !seriesRef.current) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return;
      }

      const seriesData = param.seriesData.get(seriesRef.current);

      if (seriesData) {
        const candleData = seriesData as { open: number; high: number; low: number; close: number; time: UTCTimestamp };
        const date = new Date(candleData.time * 1000);
        const formattedDate = activeTimeframe === '1D' 
          ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          date: formattedDate
        });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };

    chartRef.current.subscribeCrosshairMove(crosshairMoveHandler);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(crosshairMoveHandler);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !data.length) return;
    const formattedData = data.map(d => ({
        time: d.time as UTCTimestamp,
        open: d.open, high: d.high, low: d.low, close: d.close
    })).sort((a, b) => a.time - b.time);
    seriesRef.current.setData(formattedData);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  const timeFrameButtonClasses = (timeframe: Timeframe) => 
    `px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border-2 transition-all ${activeTimeframe === timeframe ? 'bg-white/15 border-white/50 text-white' : 'border-transparent text-white/50 hover:text-white'}`;

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 20,
    top: `${tooltip.y + 15}px`,
    left: `${tooltip.x + 15}px`,
    pointerEvents: 'none'
  };

  if (chartContainerRef.current) {
    const chartRect = chartContainerRef.current.getBoundingClientRect();
    const tooltipWidth = 150; 
    if (tooltip.x + 15 + tooltipWidth > chartRect.width) {
        tooltipStyle.left = `${tooltip.x - 15 - tooltipWidth}px`;
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      {isModal && (
        <div className="absolute top-0 left-0 right-0 z-10 p-2 flex items-center justify-end bg-transparent">
          <div className="flex items-center gap-1 glossy-card !bg-black/40 !rounded-lg p-1">
             {(['15m', '1D'] as Timeframe[]).map(tf => (
                <button key={tf} onClick={() => onTimeframeChange?.(tf)} className={timeFrameButtonClasses(tf)}>{tf}</button>
             ))}
          </div>
        </div>
      )}

      {tooltip.visible && (
        <div
          style={tooltipStyle}
          className="w-[150px] p-3 rounded-xl glossy-card !bg-black/80 !border-white/30"
        >
          <div className="font-bold text-white/80 mb-2 text-center text-[11px]">{tooltip.date}</div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between gap-4">
              <span className="text-white/60">Open:</span>
              <span className="font-bold tabular-nums">{tooltip.open?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">High:</span>
              <span className="font-bold text-emerald-400 tabular-nums">{tooltip.high?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Low:</span>
              <span className="font-bold text-rose-500 tabular-nums">{tooltip.low?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Close:</span>
              <span className="font-bold tabular-nums">{tooltip.close?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      <div ref={chartContainerRef} className="w-full flex-1" />
    </div>
  );
};

export default memo(TerminalChart);