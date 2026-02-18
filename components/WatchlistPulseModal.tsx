import React, { useEffect, useState } from 'react';
// Casting motion components to any to resolve IntrinsicAttributes error in this specific environment's React/Framer-Motion types
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Search, Target } from 'lucide-react';
import { StockDetails, WatchlistStockAnalysis } from '../types.ts';
import { getWatchlistPulseReport } from '../services/aiService.ts';

const MotionDiv = motion.div as any;
const MotionTr = motion.tr as any;

interface WatchlistPulseModalProps {
  stocks: StockDetails[];
  onClose: () => void;
}

const WatchlistPulseModal: React.FC<WatchlistPulseModalProps> = ({ stocks, onClose }) => {
  const [results, setResults] = useState<WatchlistStockAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyze = async () => {
      setLoading(true);
      const data = await getWatchlistPulseReport(stocks);
      setResults(data);
      setLoading(false);
    };
    analyze();
  }, [stocks]);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <MotionDiv 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
      />
      
      <MotionDiv 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-3xl glossy-card !border-white/60 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(236,72,153,0.2)] flex flex-col max-h-[85vh]"
      >
        <div className="px-6 py-5 border-b border-white/60 flex items-center justify-between bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 shadow-xl border border-white/40">
              <Target size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[12px] font-black text-white uppercase tracking-[0.2em]">Alpha Scan</h2>
              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">High-Conviction Buy Opportunities</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-all border border-white/40">
            <X size={20} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <Loader2 className="animate-spin text-emerald-500" size={48} strokeWidth={3} />
                <div className="absolute inset-0 blur-2xl bg-emerald-500/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] animate-pulse">Analyzing 10-Day Intervals</p>
                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Validating technical breakouts...</p>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                <Sparkles size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-emerald-300 font-medium leading-relaxed uppercase tracking-wider">
                  The following stocks have passed our high-accuracy 10-day technical filters for long entries.
                </p>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-white/60 bg-black/40">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/[0.08] border-b border-white/60">
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest">Symbol</th>
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Market</th>
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-center">Conviction</th>
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Entry</th>
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Target</th>
                      <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Protection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {results.map((item, idx) => (
                      <MotionTr 
                        key={item.symbol}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-emerald-500/[0.04] transition-colors"
                      >
                        <td className="px-4 py-4">
                          <span className="text-[13px] font-black text-white uppercase tracking-tight">{item.symbol.split('.')[0]}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-[13px] font-black text-white tabular-nums">{item.currentPrice.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border-2 bg-emerald-500/20 border-emerald-500/60 text-emerald-400">
                            STRONG BUY
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-[13px] font-black text-white/80 tabular-nums">{item.entry.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-[13px] font-black text-emerald-400 tabular-nums">{item.target1.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[13px] font-black text-rose-400 tabular-nums">{item.stopLoss.toFixed(2)}</span>
                            <span className="text-[7px] text-rose-500/60 font-black uppercase">Stop Loss</span>
                          </div>
                        </td>
                      </MotionTr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <Search size={40} className="text-white/10 mx-auto" strokeWidth={1} />
              <div className="space-y-1">
                <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">No BUY Signals Found</p>
                <p className="text-[9px] text-white/20 uppercase tracking-widest">10-day technical criteria not met for monitored symbols.</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/60 flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">Interval Analysis: 10 Days</p>
            <p className="text-[7px] font-bold text-emerald-500/40 uppercase tracking-[0.2em]">Neural Precision Mode: Active</p>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/40 text-[9px] font-black text-white uppercase tracking-widest transition-all"
          >
            Acknowledge
          </button>
        </div>
      </MotionDiv>
    </div>
  );
};

export default WatchlistPulseModal;