
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, ArrowUpRight, ArrowDownRight, Minus, AlertCircle } from 'lucide-react';
import { StockDetails, WatchlistStockAnalysis } from '../types.ts';
import { getWatchlistPulseReport } from '../services/aiService.ts';

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
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-3xl glossy-card !border-white/60 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(236,72,153,0.2)] flex flex-col max-h-[85vh]"
      >
        <div className="px-6 py-5 border-b border-white/60 flex items-center justify-between bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-600 to-cyan-500 shadow-xl border border-white/40">
              <Sparkles size={20} className="text-white" fill="white" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[12px] font-black text-white uppercase tracking-[0.2em]">Watchlist Pulse</h2>
              <span className="text-[8px] font-bold text-pink-400 uppercase tracking-widest">AI Multi-Asset Analysis</span>
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
                <Loader2 className="animate-spin text-pink-500" size={48} strokeWidth={3} />
                <div className="absolute inset-0 blur-2xl bg-pink-500/20 animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] animate-pulse">Scanning Portfolios...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/60 bg-black/40">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-white/[0.08] border-b border-white/60">
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest">Symbol</th>
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Market Price</th>
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-center">Signal</th>
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Entry</th>
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Target 1</th>
                    <th className="px-4 py-4 text-[9px] font-black text-white/50 uppercase tracking-widest text-right">Stop Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {results.map((item, idx) => (
                    <motion.tr 
                      key={item.symbol}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-white/[0.06] transition-colors"
                    >
                      <td className="px-4 py-4">
                        <span className="text-[13px] font-black text-white uppercase tracking-tight">{item.symbol.split('.')[0]}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-[13px] font-black text-white tabular-nums">{item.currentPrice.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border-2 ${
                          item.signal === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400' :
                          item.signal === 'SELL' ? 'bg-rose-500/20 border-rose-500/60 text-rose-400' :
                          'bg-blue-500/20 border-blue-500/60 text-blue-400'
                        }`}>
                          {item.signal}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-[13px] font-black text-white/80 tabular-nums">{item.entry.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-[13px] font-black text-emerald-400 tabular-nums">{item.target1.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-[13px] font-black text-rose-400 tabular-nums">{item.stopLoss.toFixed(2)}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <AlertCircle size={40} className="text-white/20 mx-auto" strokeWidth={1} />
              <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Unable to generate pulse report</p>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/60 flex justify-between items-center shrink-0">
          <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">Based on recent market cycles and neural patterns.</p>
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/40 text-[9px] font-black text-white uppercase tracking-widest transition-all"
          >
            Acknowledge
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default WatchlistPulseModal;
