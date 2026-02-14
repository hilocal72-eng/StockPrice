
import React, { useEffect, useRef, useState, memo, useCallback, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, MouseEventParams, LineStyle, IPriceLine } from 'lightweight-charts';
import { PricePoint, TrendLine } from '../types.ts';

type Timeframe = '15m' | '1D';
type DrawingTool = 'horizontal' | 'trend' | null;

interface TerminalChartProps {
  ticker: string;
  data: PricePoint[];
  isModal: boolean;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  activeTimeframe?: Timeframe;
  activeTool?: DrawingTool;
  clearLinesSignal?: number;
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

const STORAGE_PREFIX_HL = 'stkr_drawings_';
const STORAGE_PREFIX_TL = 'stkr_trendlines_';

// Professional Blue Theme for Trendlines
const TRENDLINE_COLOR = '#3b82f6'; // Bright Blue
const TRENDLINE_HANDLE_COLOR = 'rgba(59, 130, 246, 0.6)';
const HL_LINE_COLOR = '#eab308'; // Yellow for H-Lines

const TerminalChart: React.FC<TerminalChartProps> = ({ 
  ticker,
  data, 
  isModal, 
  onTimeframeChange, 
  activeTimeframe,
  activeTool = null,
  clearLinesSignal = 0
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  const [tooltip, setTooltip] = useState<TooltipData>({ visible: false, x: 0, y: 0 });
  const [hLines, setHLines] = useState<number[]>([]);
  const [tLines, setTLines] = useState<TrendLine[]>([]);
  
  const hLineObjectsRef = useRef<Map<number, IPriceLine>>(new Map());
  const [pendingTrendLine, setPendingTrendLine] = useState<{ p1: { time: number; price: number }; p2: { x: number; y: number } } | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<{ lineId: string; point: 'p1' | 'p2' } | null>(null);
  
  // Refs for stable event listener access
  const activeToolRef = useRef<DrawingTool>(activeTool);
  const pendingTrendLineRef = useRef(pendingTrendLine);
  const hLinesRef = useRef(hLines);
  const tLinesRef = useRef(tLines);
  const isAdjustingRef = useRef(false);
  const lastCrosshairRef = useRef<{ x: number, y: number, time?: number } | null>(null);

  // Sync refs
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { pendingTrendLineRef.current = pendingTrendLine; }, [pendingTrendLine]);
  useEffect(() => { hLinesRef.current = hLines; }, [hLines]);
  useEffect(() => { tLinesRef.current = tLines; }, [tLines]);

  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const saveDrawings = useCallback((hl: number[], tl: TrendLine[]) => {
    if (!ticker || !isModal) return;
    localStorage.setItem(`${STORAGE_PREFIX_HL}${ticker}`, JSON.stringify(hl));
    localStorage.setItem(`${STORAGE_PREFIX_TL}${ticker}`, JSON.stringify(tl));
  }, [ticker, isModal]);

  const loadDrawings = useCallback(() => {
    if (!ticker || !isModal) return { hl: [], tl: [] };
    const savedHL = localStorage.getItem(`${STORAGE_PREFIX_HL}${ticker}`);
    const savedTL = localStorage.getItem(`${STORAGE_PREFIX_TL}${ticker}`);
    return {
      hl: savedHL ? JSON.parse(savedHL) : [],
      tl: savedTL ? JSON.parse(savedTL) : []
    };
  }, [ticker, isModal]);

  useEffect(() => {
    if (isModal) {
      const { hl, tl } = loadDrawings();
      setHLines(hl);
      setTLines(tl);
    }
  }, [ticker, isModal, loadDrawings]);

  useEffect(() => {
    if (clearLinesSignal > 0 && isModal) {
      setHLines([]);
      setTLines([]);
      saveDrawings([], []);
    }
  }, [clearLinesSignal, isModal, saveDrawings]);

  useEffect(() => {
    if (!seriesRef.current) return;
    hLineObjectsRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
    hLineObjectsRef.current.clear();
    if (!isModal) return;
    hLines.forEach(price => {
      const line = seriesRef.current!.createPriceLine({
        price: price, color: HL_LINE_COLOR, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '',
      });
      hLineObjectsRef.current.set(price, line);
    });
  }, [hLines, isModal]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingHandle) {
        setDraggingHandle(null);
        setTimeout(() => { isAdjustingRef.current = false; }, 50);
        saveDrawings(hLinesRef.current, tLinesRef.current);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [draggingHandle, saveDrawings]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: 'rgba(255, 255, 255, 0.7)' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.1)' }, horzLines: { color: 'rgba(255, 255, 255, 0.1)' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255, 255, 255, 0.2)' },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.2)' },
      crosshair: { mode: 1 },
      handleScroll: isModal,
      handleScale: isModal,
    });
    
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderDownColor: '#ef4444', borderUpColor: '#22c55e', wickDownColor: '#ef4444', wickUpColor: '#22c55e',
    });
    seriesRef.current = series;

    const formattedData = data.map(d => ({
      time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close,
    })).sort((a, b) => a.time - b.time);
    
    series.setData(formattedData);
    chart.timeScale().fitContent();
    chart.timeScale().subscribeVisibleTimeRangeChange(forceUpdate);

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener('resize', handleResize);
    
    const crosshairMoveHandler = (param: MouseEventParams) => {
      if (!param.point || !seriesRef.current) {
        setTooltip(prev => ({ ...prev, visible: false }));
        return;
      }

      lastCrosshairRef.current = {
        x: param.point.x,
        y: param.point.y,
        time: param.time as number
      };

      const seriesData = param.seriesData.get(seriesRef.current);
      if (seriesData) {
        const candleData = seriesData as { open: number; high: number; low: number; close: number; time: UTCTimestamp };
        const date = new Date(candleData.time * 1000);
        const formattedDate = activeTimeframe === '1D' 
          ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        setTooltip({ visible: true, x: param.point.x, y: param.point.y, open: candleData.open, high: candleData.high, low: candleData.low, close: candleData.close, date: formattedDate });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }

      if (pendingTrendLineRef.current) {
        setPendingTrendLine(prev => prev ? { ...prev, p2: { x: param.point!.x, y: param.point!.y } } : null);
      }

      if (draggingHandle) {
        const { lineId, point } = draggingHandle;
        const newPrice = seriesRef.current.coordinateToPrice(param.point.y);
        const newTime = (param.time as number) || chartRef.current?.timeScale().coordinateToTime(param.point.x);

        if (newPrice !== null && newTime !== undefined) {
          setTLines(prev => prev.map(l => l.id === lineId ? { ...l, [point]: { time: newTime as number, price: newPrice } } : l));
        }
      }
    };

    // Native mousedown listener for robust Click 1 / Click 2 logic
    // subscribeClick is too sensitive to mouse movement (considered a drag)
    const onNativeMouseDown = (e: MouseEvent) => {
      if (isAdjustingRef.current) return;
      if (!isModal || !seriesRef.current || !chartRef.current || !activeToolRef.current) return;

      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const price = seriesRef.current.coordinateToPrice(y);
      let mouseTime = chartRef.current.timeScale().coordinateToTime(x) as number;

      // Handle future points
      if (!mouseTime && data.length > 0) {
        mouseTime = data[data.length - 1].time;
      }

      if (price === null || !mouseTime) return;

      const tool = activeToolRef.current;

      if (tool === 'horizontal') {
        const currentHLines = hLinesRef.current;
        const hitIndex = currentHLines.findIndex(p => {
          const ly = seriesRef.current!.priceToCoordinate(p);
          return ly !== null && Math.abs(y - ly) < 10;
        });

        if (hitIndex !== -1) {
          const next = currentHLines.filter((_, i) => i !== hitIndex);
          setHLines(next);
          saveDrawings(next, tLinesRef.current);
          return;
        }
        const next = [...currentHLines, price];
        setHLines(next);
        saveDrawings(next, tLinesRef.current);
      }

      if (tool === 'trend') {
        const pending = pendingTrendLineRef.current;
        if (!pending) {
          // START DRAWING (Click 1)
          setPendingTrendLine({ p1: { time: mouseTime, price }, p2: { x, y } });
        } else {
          // FINISH DRAWING (Click 2)
          const newLine: TrendLine = {
            id: `tl-${Date.now()}`,
            p1: pending.p1,
            p2: { time: mouseTime, price }
          };
          const nextTLines = [...tLinesRef.current, newLine];
          setTLines(nextTLines);
          saveDrawings(hLinesRef.current, nextTLines);
          setPendingTrendLine(null);
        }
      }
    };

    chart.subscribeCrosshairMove(crosshairMoveHandler);
    chartContainerRef.current?.addEventListener('mousedown', onNativeMouseDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(forceUpdate);
        chartRef.current.unsubscribeCrosshairMove(crosshairMoveHandler);
        chartContainerRef.current?.removeEventListener('mousedown', onNativeMouseDown);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isModal, data, ticker, forceUpdate, activeTimeframe]);

  const svgLines = useMemo(() => {
    if (!seriesRef.current || !chartRef.current) return [];
    return tLines.map(line => {
      const x1 = chartRef.current!.timeScale().timeToCoordinate(line.p1.time as UTCTimestamp);
      const y1 = seriesRef.current!.priceToCoordinate(line.p1.price);
      const x2 = chartRef.current!.timeScale().timeToCoordinate(line.p2.time as UTCTimestamp);
      const y2 = seriesRef.current!.priceToCoordinate(line.p2.price);
      return { ...line, x1, y1, x2, y2 };
    }).filter(l => l.x1 !== null && l.y1 !== null && l.x2 !== null && l.y2 !== null);
  }, [tLines, tick]);

  const deleteTrendLine = (id: string) => {
    const next = tLines.filter(l => l.id !== id);
    setTLines(next);
    saveDrawings(hLines, next);
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute', zIndex: 20, top: `${tooltip.y + 15}px`, left: `${tooltip.x + 15}px`, pointerEvents: 'none'
  };

  return (
    <div className={`w-full h-full flex flex-col relative ${activeTool ? 'cursor-crosshair' : ''}`}>
      {tooltip.visible && !activeTool && (
        <div style={tooltipStyle} className="w-[150px] p-3 rounded-xl glossy-card !bg-black/80 !border-white/30">
          <div className="font-bold text-white/80 mb-2 text-center text-[11px]">{tooltip.date}</div>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between gap-4">
              <span className="text-white/60">Open:</span><span className="font-bold tabular-nums">{tooltip.open?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">High:</span><span className="font-bold text-emerald-400 tabular-nums">{tooltip.high?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Low:</span><span className="font-bold text-rose-500 tabular-nums">{tooltip.low?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Close:</span><span className="font-bold tabular-nums">{tooltip.close?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {isModal && (
        <svg 
          className="absolute inset-0 z-10 w-full h-full overflow-hidden pointer-events-none"
        >
          {svgLines.map(l => (
            <g 
              key={l.id} 
              // Very important: if we are in the middle of drawing a new line, existing lines must be inert
              className={`${pendingTrendLine ? 'pointer-events-none' : 'pointer-events-auto'} group`}
            >
              <line 
                x1={l.x1!} y1={l.y1!} x2={l.x2!} y2={l.y2!} 
                stroke={TRENDLINE_COLOR} strokeWidth="2" 
                className="cursor-pointer"
                onClick={(e) => { 
                  if(activeTool === 'trend') { 
                    e.stopPropagation(); 
                    deleteTrendLine(l.id); 
                  } 
                }}
              />
              {activeTool === 'trend' && (
                <>
                  <circle 
                    cx={l.x1!} cy={l.y1!} r="6" 
                    fill={TRENDLINE_HANDLE_COLOR} stroke="white" strokeWidth="1.5" 
                    className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      isAdjustingRef.current = true;
                      setDraggingHandle({ lineId: l.id, point: 'p1' }); 
                    }}
                  />
                  <circle 
                    cx={l.x2!} cy={l.y2!} r="6" 
                    fill={TRENDLINE_HANDLE_COLOR} stroke="white" strokeWidth="1.5" 
                    className="cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      isAdjustingRef.current = true;
                      setDraggingHandle({ lineId: l.id, point: 'p2' }); 
                    }}
                  />
                </>
              )}
            </g>
          ))}

          {/* Drawing Preview Line - Dotted and Blue */}
          {pendingTrendLine && (
            <line 
              x1={chartRef.current?.timeScale().timeToCoordinate(pendingTrendLine.p1.time as UTCTimestamp) || 0} 
              y1={seriesRef.current?.priceToCoordinate(pendingTrendLine.p1.price) || 0} 
              x2={pendingTrendLine.p2.x} 
              y2={pendingTrendLine.p2.y} 
              stroke={TRENDLINE_COLOR} strokeWidth="2" strokeDasharray="5,5" 
              className="pointer-events-none"
            />
          )}
        </svg>
      )}

      <div ref={chartContainerRef} className="w-full flex-1" />
    </div>
  );
};

export default memo(TerminalChart);
