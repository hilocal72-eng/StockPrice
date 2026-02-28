
import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import IndicatorsAll from 'highcharts/indicators/indicators-all';
import DragPanes from 'highcharts/modules/drag-panes';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import PriceIndicator from 'highcharts/modules/price-indicator';
import FullScreen from 'highcharts/modules/full-screen';
import StockTools from 'highcharts/modules/stock-tools';
import { PricePoint } from '../types.ts';
import { 
  Activity, 
  Minus, 
  ArrowRight, 
  TrendingUp, 
  MoveHorizontal, 
  MoveVertical, 
  Square, 
  Circle, 
  Type, 
  Ruler, 
  Maximize, 
  AlignJustify, 
  GitBranch, 
  Equal, 
  EyeOff, 
  Save 
} from 'lucide-react';

// Import Highcharts CSS
import 'highcharts/css/annotations/popup.css';

// Initialize Highcharts modules
IndicatorsAll(Highcharts);
DragPanes(Highcharts);
AnnotationsAdvanced(Highcharts);
PriceIndicator(Highcharts);
FullScreen(Highcharts);
StockTools(Highcharts);

interface TerminalChartProps {
  ticker: string;
  data: PricePoint[];
  isModal: boolean;
  onTimeframeChange?: (timeframe: '15m' | '1D') => void;
  activeTimeframe?: '15m' | '1D';
  activeTool?: 'horizontal' | 'trend' | null;
  clearLinesSignal?: number;
  saveChartSignal?: number;
}

const TerminalChart: React.FC<TerminalChartProps> = ({ 
  ticker,
  data, 
  isModal,
  onTimeframeChange,
  activeTimeframe,
  clearLinesSignal,
  saveChartSignal
}) => {
  const chartRef = React.useRef<HighchartsReact.RefObject>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const ohlcRef = React.useRef<HTMLDivElement>(null);
  const dashboardOhlcRef = React.useRef<HTMLDivElement>(null);
  const lastClearSignal = React.useRef(clearLinesSignal);
  const lastSaveSignal = React.useRef(saveChartSignal);

  // Handle Clear Drawings
  React.useEffect(() => {
    if (clearLinesSignal && clearLinesSignal !== lastClearSignal.current && chartRef.current?.chart) {
      lastClearSignal.current = clearLinesSignal;
      const chart = chartRef.current.chart;
      // Remove all annotations
      const annotations = chart.annotations || [];
      while (annotations.length > 0) {
        chart.removeAnnotation(annotations[0]);
      }
      // Remove all series that are not the main OHLC series
      const seriesToRemove = chart.series.filter(s => s.options.id !== 'ohlc' && s.options.id !== 'highcharts-navigator-series');
      seriesToRemove.forEach(s => s.remove(false));
      chart.redraw();
      
      // Clear local storage for this ticker
      localStorage.removeItem(`chart-drawings-${ticker}`);
      window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: Date.now(), type: 'info', message: 'Drawings cleared' } }));
    }
  }, [clearLinesSignal, ticker]);

  // Handle Save Chart
  React.useEffect(() => {
    if (saveChartSignal && saveChartSignal !== lastSaveSignal.current && chartRef.current?.chart) {
      lastSaveSignal.current = saveChartSignal;
      const chart = chartRef.current.chart;
      const annotations = (chart.annotations || []).map(a => a.userOptions);
      const indicators = chart.series
        .filter(s => s.options.id !== 'ohlc' && s.options.id !== 'highcharts-navigator-series')
        .map(s => s.userOptions);
      
      localStorage.setItem(`chart-drawings-${ticker}`, JSON.stringify({ annotations, indicators }));
      window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: Date.now(), type: 'success', message: 'Drawings saved successfully' } }));
    }
  }, [saveChartSignal, ticker]);

  // Load saved drawings on mount
  React.useEffect(() => {
    if (isModal && chartRef.current?.chart) {
      const chart = chartRef.current.chart;
      const saved = localStorage.getItem(`chart-drawings-${ticker}`);
      if (saved) {
        try {
          const { annotations, indicators } = JSON.parse(saved);
          if (annotations) {
            annotations.forEach((a: any) => {
              try { chart.addAnnotation(a, false); } catch (e) {}
            });
          }
          if (indicators) {
            indicators.forEach((i: any) => {
              try { chart.addSeries(i, false); } catch (e) {}
            });
          }
          chart.redraw();
        } catch (e) {
          console.error('Failed to load chart drawings', e);
        }
      }
    }
  }, [ticker, data.length, isModal]); // Re-run if data length changes significantly to ensure series attach correctly

  // Force reflow on mount and resize
  React.useEffect(() => {
    if (!containerRef.current || !chartRef.current?.chart) return;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        chartRef.current?.chart.reflow();
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isModal]);

  // Auto-zoom to latest candles when data changes
  React.useEffect(() => {
    if (chartRef.current?.chart && data.length > 0) {
      const chart = chartRef.current.chart;
      const lastPoint = data[data.length - 1];
      const lastTime = lastPoint.time * 1000;
      
      // Calculate interval from last two points, or default
      let interval = 24 * 60 * 60 * 1000; // Default 1 day
      if (data.length > 1) {
        const p1 = data[data.length - 1].time;
        const p2 = data[data.length - 2].time;
        interval = (p1 - p2) * 1000;
      }
      
      // Add buffer of 1 candle to the right for spacing
      const buffer = interval * 1;
      const maxTime = lastTime + buffer;
      
      // Show last 50 candles approx for modal, 30 for dashboard
      const visibleCandles = isModal ? 50 : 30;
      const startIndex = Math.max(0, data.length - visibleCandles);
      const startTime = data[startIndex].time * 1000;

      // Use setExtremes to zoom with buffer
      chart.xAxis[0].setExtremes(startTime, maxTime);
    }
  }, [data, activeTimeframe, isModal]);

  // Initialize dashboard OHLC with latest data
  React.useEffect(() => {
    if (!isModal && dashboardOhlcRef.current && data.length > 0) {
      const point = data[data.length - 1];
      const open = point.open.toFixed(2);
      const high = point.high.toFixed(2);
      const low = point.low.toFixed(2);
      const close = point.close.toFixed(2);
      const colorClass = point.close >= point.open ? 'text-emerald-500' : 'text-rose-500';
      const date = new Date(point.time * 1000).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });

      dashboardOhlcRef.current.innerHTML = `
        <div class="flex items-center gap-4 text-[10px] font-mono font-medium tracking-tight">
          <span class="text-white/60 font-bold">${date}</span>
          <div class="flex gap-3">
            <span class="text-white/40">O <span class="${colorClass}">${open}</span></span>
            <span class="text-white/40">H <span class="${colorClass}">${high}</span></span>
            <span class="text-white/40">L <span class="${colorClass}">${low}</span></span>
            <span class="text-white/40">C <span class="${colorClass}">${close}</span></span>
          </div>
        </div>
      `;
    }
  }, [data, isModal]);
  
  const ohlcData = useMemo(() => {
    // Ensure data is sorted by time
    const sortedData = [...data].sort((a, b) => a.time - b.time);
    return sortedData.map(point => [
      point.time * 1000, // Convert to milliseconds
      point.open,
      point.high,
      point.low,
      point.close
    ]);
  }, [data]);

  const options: Highcharts.Options = useMemo(() => ({
    chart: {
      backgroundColor: isModal ? '#ffffff' : 'transparent',
      style: {
        fontFamily: 'Inter, sans-serif'
      },
      height: isModal ? null : 380, // Let CSS control height in modal mode
      margin: isModal ? [10, 60, 20, 10] : undefined, // Top: 10, Right: 60, Bottom: 20, Left: 10
      spacing: isModal ? [0, 0, 0, 0] : [10, 10, 15, 10],
      panning: {
        enabled: isModal,
        type: 'x'
      },
      zoomType: isModal ? 'x' : undefined,
      zooming: {
        mouseWheel: {
          enabled: isModal
        }
      },
      panKey: 'shift'
    },
    rangeSelector: {
      enabled: false // Disable built-in range selector
    },
    navigator: {
      enabled: false // Disable navigator
    },
    scrollbar: {
      enabled: false
    },
    credits: {
      enabled: false
    },
    navigation: {
      bindingsClassName: 'highcharts-bindings-wrapper'
    },
    stockTools: {
      gui: {
        enabled: false // Disable built-in GUI, using custom HTML toolbar
      }
    },
    xAxis: {
      gridLineColor: isModal ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
      lineColor: isModal ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
      tickColor: isModal ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
      labels: {
        style: {
          color: isModal ? '#374151' : 'rgba(255, 255, 255, 0.6)'
        },
        y: 15 // Standard offset
      },
      ordinal: false,
      crosshair: {
        width: 1,
        color: isModal ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
        dashStyle: 'Dash'
      }
    },
    yAxis: [{
      labels: {
        align: 'left',
        x: 10, // Align left in the right margin (starts after plot area)
        style: {
          color: isModal ? '#374151' : 'rgba(255, 255, 255, 0.6)'
        }
      },
      title: {
        text: null
      },
      height: '100%',
      top: '0%', // Ensure it takes full height
      lineWidth: 0,
      gridLineColor: isModal ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
      opposite: true,
      resize: {
        enabled: false // Disable resize to remove the line separator
      },
      crosshair: {
        width: 1,
        color: isModal ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
        dashStyle: 'Dash'
      }
    }],
    tooltip: {
      split: false,
      shared: true,
      useHTML: true,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadow: false,
      padding: 0,
      headerFormat: '',
      pointFormat: '',
      footerFormat: '',
      positioner: function () {
        return { x: 0, y: 0 }; // Hidden
      },
      formatter: function () {
        const points = (this as any).points;
        const point = points ? points[0].point : (this as any).point;
        
        if (point) {
          const open = point.open.toFixed(2);
          const high = point.high.toFixed(2);
          const low = point.low.toFixed(2);
          const close = point.close.toFixed(2);
          const colorClass = point.close >= point.open ? 'text-emerald-500' : 'text-rose-500';
          
          const date = new Date(point.x).toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });

          const html = `
            <div class="flex items-center gap-4 text-[10px] font-mono font-medium tracking-tight">
              <span class="${isModal ? 'text-gray-500' : 'text-white/60'} font-bold">${date}</span>
              <div class="flex gap-3">
                <span class="${isModal ? 'text-gray-400' : 'text-white/40'}">O <span class="${colorClass}">${open}</span></span>
                <span class="${isModal ? 'text-gray-400' : 'text-white/40'}">H <span class="${colorClass}">${high}</span></span>
                <span class="${isModal ? 'text-gray-400' : 'text-white/40'}">L <span class="${colorClass}">${low}</span></span>
                <span class="${isModal ? 'text-gray-400' : 'text-white/40'}">C <span class="${colorClass}">${close}</span></span>
              </div>
            </div>
          `;

          if (isModal && ohlcRef.current) {
            ohlcRef.current.innerHTML = html;
          } else if (!isModal && dashboardOhlcRef.current) {
            dashboardOhlcRef.current.innerHTML = html;
          }
        }
        return false; // Don't show actual tooltip
      }
    },
    plotOptions: {
      candlestick: {
        color: '#ef4444', // Red for down
        upColor: '#22c55e', // Green for up
        lineColor: '#ef4444',
        upLineColor: '#22c55e'
      }
    },
    series: [{
      type: 'candlestick',
      name: ticker,
      data: ohlcData,
      id: 'ohlc',
      dataGrouping: {
        enabled: false
      }
    }]
  }), [ohlcData, isModal, ticker]);

  return (
    <div ref={containerRef} className={`w-full h-full relative flex flex-col ${!isModal ? 'highcharts-dark' : 'chart-modal-open'}`}>
      <div className="flex-1 relative w-full min-h-0">
        {!isModal && (
          <div 
            ref={dashboardOhlcRef} 
            className="absolute top-3 left-3 z-10 pointer-events-none"
          >
             {/* Initial empty state or placeholder if needed */}
          </div>
        )}
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          constructorType={'stockChart'}
          options={options}
          containerProps={{ style: { height: '100%', width: '100%', position: 'absolute', inset: 0 } }}
        />
      </div>
      {isModal && (
        <div 
          ref={ohlcRef} 
          className="h-8 shrink-0 border-t border-gray-100 bg-white flex items-center px-4"
        >
          <div className="text-[11px] text-gray-400 font-mono">Hover over chart to view details</div>
        </div>
      )}
    </div>
  );
};

export default TerminalChart;
