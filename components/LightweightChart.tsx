
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp, LineStyle, MouseEventHandler } from 'lightweight-charts';
import { PricePoint } from '../types.ts';

interface LightweightChartProps {
  ticker: string;
  data: PricePoint[];
  activeTimeframe?: '15m' | '1D';
  activeTool?: string | null;
  clearLinesSignal?: number;
  saveChartSignal?: number;
  interactive?: boolean;
}

const LightweightChart: React.FC<LightweightChartProps> = ({
  ticker,
  data,
  activeTimeframe,
  activeTool,
  clearLinesSignal,
  saveChartSignal,
  interactive = true
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const drawingObjectsRef = useRef<any[]>([]); // Holds the actual chart objects (PriceLines, Series)
  const [ohlc, setOhlc] = useState<any>(null);
  const pendingSegmentRef = useRef<{ time: UTCTimestamp, price: number } | null>(null);
  
  // State to hold drawing DATA persistently across re-renders (timeframe changes)
  const [drawings, setDrawings] = useState<any[]>([]);

  // Load drawings when ticker changes or on mount
  useEffect(() => {
    const savedKey = `lw-drawings-${ticker}`;
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        setDrawings(JSON.parse(saved));
      } catch (e) {
        setDrawings([]);
      }
    } else {
      setDrawings([]);
    }
  }, [ticker]);

  const formattedData = useMemo(() => {
    return data.map(p => ({
      time: p.time as UTCTimestamp,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    })).sort((a, b) => a.time - b.time);
  }, [data]);

  // 1. Initialize Chart (Once per ticker/interactive mode)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: interactive ? '#ffffff' : 'transparent' },
        textColor: interactive ? '#333333' : 'rgba(255, 255, 255, 0.7)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: interactive ? '#f3f4f6' : 'rgba(255, 255, 255, 0.05)', style: LineStyle.Solid },
        horzLines: { color: interactive ? '#f3f4f6' : 'rgba(255, 255, 255, 0.05)', style: LineStyle.Solid },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: interactive ? '#9ca3af' : 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111827',
        },
        horzLine: {
          color: interactive ? '#9ca3af' : 'rgba(255, 255, 255, 0.2)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#111827',
        },
      },
      rightPriceScale: {
        borderColor: interactive ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)',
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: interactive ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 6,
      },
      handleScroll: { mouseWheel: interactive, pressedMouseMove: interactive },
      handleScale: { axisPressedMouseMove: interactive, mouseWheel: interactive, pinch: interactive },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker, interactive]);

  // 2. Update Data
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    
    seriesRef.current.setData(formattedData);

    // Initial range
    if (formattedData.length > 0) {
      let count = activeTimeframe === '1D' ? 60 : 30;
      if (!interactive) count = 30;
      const startIndex = Math.max(0, formattedData.length - count);
      chartRef.current.timeScale().setVisibleRange({
        from: formattedData[startIndex].time,
        to: formattedData[formattedData.length - 1].time,
      });
    }

    // Tooltip / OHLC display
    const candlestickSeries = seriesRef.current;
    const chart = chartRef.current;
    
    const handleCrosshairMove = (param: any) => {
      if (param.time && param.seriesData.has(candlestickSeries)) {
        const data = param.seriesData.get(candlestickSeries) as any;
        setOhlc(data);
      } else if (formattedData.length > 0) {
        setOhlc(formattedData[formattedData.length - 1]);
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [formattedData, activeTimeframe, interactive]);

  // 3. Sync Drawings (Render drawings from state to chart)
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    // Clear existing drawing objects
    drawingObjectsRef.current.forEach(obj => {
      if (obj.type === 'hline') series.removePriceLine(obj.line);
      if (obj.type === 'segment') chart.removeSeries(obj.series);
    });
    drawingObjectsRef.current = [];

    // Add drawings from state
    drawings.forEach(d => {
      if (d.type === 'hline') {
        const line = series.createPriceLine({
          price: d.price,
          color: '#db2777',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
        });
        drawingObjectsRef.current.push({ type: 'hline', line });
      } else if (d.type === 'segment') {
        const lineSeries = chart.addLineSeries({
          color: '#db2777',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        lineSeries.setData(d.data);
        drawingObjectsRef.current.push({ type: 'segment', series: lineSeries });
      }
    });
  }, [drawings]); // Re-run whenever drawings state changes (including after chart recreation)

  // Handle Drawing Creation
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !activeTool) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    const handleChartClick = (param: any) => {
      if (!param.point || !param.time) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price === null) return;

      if (activeTool === 'horizontal-line') {
        setDrawings(prev => [...prev, { type: 'hline', price }]);
      } else if (activeTool === 'segment' || activeTool === 'line') {
        if (!pendingSegmentRef.current) {
          pendingSegmentRef.current = { time: param.time as UTCTimestamp, price };
        } else {
          const lineData = [
            { time: pendingSegmentRef.current.time, value: pendingSegmentRef.current.price },
            { time: param.time as UTCTimestamp, value: price },
          ];
          setDrawings(prev => [...prev, { type: 'segment', data: lineData }]);
          pendingSegmentRef.current = null;
        }
      }
    };

    chart.subscribeClick(handleChartClick);
    return () => chart.unsubscribeClick(handleChartClick);
  }, [activeTool]);

  // Handle Clear Drawings
  useEffect(() => {
    if (clearLinesSignal) {
      setDrawings([]);
      localStorage.removeItem(`lw-drawings-${ticker}`);
      window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: Date.now(), type: 'info', message: 'Drawings cleared' } }));
    }
  }, [clearLinesSignal, ticker]);

  // Handle Save Drawings
  useEffect(() => {
    if (saveChartSignal) {
      localStorage.setItem(`lw-drawings-${ticker}`, JSON.stringify(drawings));
      window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: Date.now(), type: 'success', message: 'Drawings saved' } }));
    }
  }, [saveChartSignal, ticker, drawings]);

  return (
    <div className="w-full h-full relative chart-container">
      {ohlc && (
        <div className={`absolute top-2 left-2 z-10 flex gap-3 text-[10px] font-mono ${interactive ? 'text-black' : 'bg-black/40 text-white/60 border border-white/10 backdrop-blur-sm px-2 py-1 rounded'} pointer-events-none`}>
          <span>O: <span className={ohlc.close >= ohlc.open ? 'text-green-500' : 'text-red-500'}>{ohlc.open.toFixed(2)}</span></span>
          <span>H: <span className={ohlc.close >= ohlc.open ? 'text-green-500' : 'text-red-500'}>{ohlc.high.toFixed(2)}</span></span>
          <span>L: <span className={ohlc.close >= ohlc.open ? 'text-green-500' : 'text-red-500'}>{ohlc.low.toFixed(2)}</span></span>
          <span>C: <span className={ohlc.close >= ohlc.open ? 'text-green-500' : 'text-red-500'}>{ohlc.close.toFixed(2)}</span></span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};

export default LightweightChart;

