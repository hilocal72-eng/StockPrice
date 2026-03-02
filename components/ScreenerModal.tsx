import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Activity, ChevronDown, TrendingUp, Loader2, ArrowUpRight, ArrowDownRight, CandlestickChart } from 'lucide-react';
import { runScreener, INDICES, ScreenerResult, TradeType } from '../services/mockStockData.ts';

interface ScreenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock: (symbol: string) => void;
}

const ScreenerModal: React.FC<ScreenerModalProps> = ({ isOpen, onClose, onSelectStock }) => {
  const [selectedIndex, setSelectedIndex] = useState<keyof typeof INDICES>('NIFTY 50');
  const [tradeType, setTradeType] = useState<TradeType>('intraday');
  const [minPct, setMinPct] = useState<string>('0.5');
  const [maxPct, setMaxPct] = useState<string>('5.0');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScreenerResult[] | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResults(null);
    
    const min = parseFloat(minPct);
    const max = parseFloat(maxPct);
    
    if (isNaN(min) || isNaN(max)) {
      setIsScanning(false);
      return;
    }

    const data = await runScreener(selectedIndex, min, max, direction, tradeType);
    setResults(data);
    setIsScanning(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl glossy-card !bg-black/80 !border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500 border border-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                <CandlestickChart size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-widest leading-none">Stock Hunt</h2>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mt-1">Gap & Go Strategy</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Controls */}
          <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.01] flex flex-col gap-4">
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => setDirection('above')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border ${direction === 'above' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
              >
                <ArrowUpRight size={14} /> Above Open
              </button>
              <button 
                onClick={() => setDirection('below')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border ${direction === 'below' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
              >
                <ArrowDownRight size={14} /> Below Open
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="w-full sm:w-1/4 flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">Index</label>
                <div className="relative">
                  <select 
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value as keyof typeof INDICES)}
                    className="w-full appearance-none bg-white/5 border border-white/20 rounded-lg py-2.5 pl-3 pr-8 text-xs font-bold text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                  >
                    {Object.keys(INDICES).map(idx => (
                      <option key={idx} value={idx} className="bg-gray-900">{idx}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              <div className="w-full sm:w-1/4 flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">Trade Type</label>
                <div className="relative">
                  <select 
                    value={tradeType}
                    onChange={(e) => setTradeType(e.target.value as TradeType)}
                    className="w-full appearance-none bg-white/5 border border-white/20 rounded-lg py-2.5 pl-3 pr-8 text-xs font-bold text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                  >
                    <option value="intraday" className="bg-gray-900">Intraday</option>
                    <option value="investment" className="bg-gray-900">Investment</option>
                    <option value="hybrid" className="bg-gray-900">Hybrid</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>

              <div className="w-full sm:w-1/4 flex gap-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">Min %</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={minPct}
                      onChange={(e) => setMinPct(e.target.value)}
                      step="0.1"
                      className="w-full bg-white/5 border border-white/20 rounded-lg py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/30">%</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">Max %</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={maxPct}
                      onChange={(e) => setMaxPct(e.target.value)}
                      step="0.1"
                      className="w-full bg-white/5 border border-white/20 rounded-lg py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/30">%</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleScan}
                disabled={isScanning}
                className="w-full sm:w-1/4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScanning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Activity size={14} />
                    <span>Scan Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 min-h-[300px]">
            {isScanning ? (
              <div className="h-full flex flex-col items-center justify-center text-white/40 gap-4 py-12">
                <div className="relative">
                  <Loader2 className="animate-spin text-pink-500" size={32} strokeWidth={3} />
                  <div className="absolute inset-0 blur-md bg-pink-500/20 animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Analyzing Market Data...</span>
              </div>
            ) : results === null ? (
              <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3 py-12">
                <Search size={48} strokeWidth={1} className="opacity-50" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center max-w-[200px]">
                  Configure your parameters and click Scan to find opportunities.
                </span>
              </div>
            ) : results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3 py-12">
                <Activity size={48} strokeWidth={1} className="opacity-50" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">
                  No stocks found matching these criteria.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Top {results.length} Results</span>
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">
                    {tradeType === 'investment' ? 'Change from Close' : 'Change from Open'}
                  </span>
                </div>
                <div className="grid gap-2">
                  {results.map((stock, idx) => {
                    const displayChange = tradeType === 'investment' ? stock.changePercentFromClose : stock.changePercentFromOpen;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={stock.symbol}
                        onClick={() => {
                          onSelectStock(stock.symbol);
                          onClose();
                        }}
                        className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-pink-500/30 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-md bg-black/40 border border-white/10 flex items-center justify-center text-[9px] font-black text-white/40 group-hover:text-pink-500 group-hover:border-pink-500/30 transition-colors">
                            {idx + 1}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white uppercase tracking-tight group-hover:text-pink-400 transition-colors">{stock.symbol}</span>
                            <span className="text-[9px] font-bold text-white/40 truncate max-w-[120px] sm:max-w-[200px]">{stock.name}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-white tabular-nums">{stock.currentPrice.toFixed(2)}</span>
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">CMP</span>
                          </div>
                          <div className={`px-2 py-1 rounded-md border flex items-center gap-1 ${displayChange >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                            <TrendingUp size={10} className={displayChange < 0 ? 'rotate-180' : ''} />
                            <span className="text-[10px] font-black tabular-nums">{Math.abs(displayChange).toFixed(2)}%</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScreenerModal;
