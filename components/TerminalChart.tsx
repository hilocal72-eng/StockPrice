
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { PricePoint } from '../types.ts';

interface TerminalChartProps {
  data: PricePoint[];
}

const CandleShape = (props: any) => {
  const { x, y, width, height, open, close, high, low, color } = props;
  const centerX = x + width / 2;
  const bodyMin = Math.min(open, close);
  const bodyMax = Math.max(open, close);
  const bodyRange = bodyMax - bodyMin;
  const totalRange = high - low;
  if (totalRange <= 0) return null;
  const pixelPerUnit = height / (bodyRange || 0.001);
  const highY = y - (high - bodyMax) * pixelPerUnit;
  const lowY = y + height + (bodyMin - low) * pixelPerUnit;
  
  return (
    <g>
      <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth={1.5} strokeOpacity={0.8} />
      <rect x={x} y={y} width={width} height={Math.max(1, height)} fill={color} fillOpacity={0.9} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const candle = payload[0].payload;
    const isUp = candle.close >= candle.open;
    const colorClass = isUp ? 'text-emerald-400' : 'text-rose-500';

    return (
      <div className="bg-[#050608]/98 border-2 border-white/50 p-4 rounded-xl shadow-2xl backdrop-blur-3xl min-w-[140px] z-[100]">
        <p className="text-[10px] font-black text-white/60 uppercase mb-3 border-b border-white/20 pb-2 tracking-widest text-center">{label}</p>
        <div className="space-y-2">
          {[
            { label: 'Open', val: candle.open, color: 'text-white/80' },
            { label: 'High', val: candle.high, color: 'text-emerald-400' },
            { label: 'Low', val: candle.low, color: 'text-rose-500' },
            { label: 'Close', val: candle.close, color: colorClass, bold: true }
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center gap-6">
              <span className="text-[8px] font-black text-white/40 uppercase">{item.label}</span>
              <span className={`text-[12px] font-bold tabular-nums ${item.color || 'text-white/95'} ${item.bold ? 'font-black' : ''}`}>
                {item.val.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const TerminalChart: React.FC<TerminalChartProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const chartData = data.map(d => ({
    ...d,
    body: [Math.min(d.open, d.close), Math.max(d.open, d.close) + (d.open === d.close ? 0.01 : 0)],
    color: d.close >= d.open ? '#22c55e' : '#ef4444', 
  }));

  const allValues = data.flatMap(d => [d.low, d.high]);
  const minP = Math.min(...allValues);
  const maxP = Math.max(...allValues);
  const range = maxP - minP;
  const padding = range * 0.15;

  return (
    <div className="w-full h-[320px] md:h-[420px] glossy-card !border-white/50 p-4 md:p-6 rounded-2xl relative group shadow-2xl bg-black/30">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur-lg">
         <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_12px_#ec4899] animate-pulse" />
         <span className="text-[8px] font-black text-white tracking-[0.2em] uppercase">Market Depth</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 50, right: 0, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff40" vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#ffffffa0', fontSize: 10, fontWeight: 800 }}
            interval={Math.ceil(data.length / (window.innerWidth < 768 ? 6 : 10))}
          />
          <YAxis 
            domain={[minP - padding, maxP + padding]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#ffffffa0', fontSize: 10, fontWeight: 800 }}
            orientation="right"
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
            isAnimationActive={false}
            trigger="click"
          />
          <Bar dataKey="body" shape={<CandleShape />} barSize={window.innerWidth < 768 ? 8 : 12} animationDuration={1000}>
            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TerminalChart;
