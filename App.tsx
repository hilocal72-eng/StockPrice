
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Activity, Loader2, X, Heart, ArrowUpRight, ArrowDownRight, Search, LayoutDashboard, Flame, Snowflake, Meh, ShieldCheck, Zap, Info, Globe, Cpu, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStockData } from './services/mockStockData.ts';
import { StockDetails, SentimentAnalysis, DayAction } from './types.ts';
import TerminalChart from './components/TerminalChart.tsx';

type View = 'dashboard' | 'favorites';

const AnimatedMarketBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#010203]">
      <div className="absolute inset-0 bg-grid animate-grid opacity-20" />
      <div className="absolute inset-0">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: 0 
            }}
            animate={{ 
              y: [null, "-5%", "105%"],
              opacity: [0, 0.2, 0]
            }}
            transition={{ 
              duration: 20 + Math.random() * 30, 
              repeat: Infinity, 
              ease: "linear",
              delay: Math.random() * 5
            }}
            className="absolute"
          >
            <div className={`w-[1px] h-10 bg-gradient-to-b from-transparent ${i % 2 === 0 ? 'via-pink-500/30' : 'via-blue-500/30'} to-transparent`} />
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-0 scanlines opacity-[0.05]" />
    </div>
  );
};

const SentimentDetailModal: React.FC<{ ticker: string; analysis: SentimentAnalysis; onClose: () => void }> = ({ ticker, analysis, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/90 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.9, y: 20 }} 
        className="relative w-full max-w-[320px] glossy-card !border-white/60 rounded-xl overflow-hidden shadow-2xl"
      >
        <div className="px-4 py-2 border-b border-white/30 flex items-center justify-between bg-white/[0.05]">
          <div className="flex items-center gap-2">
            <Cpu size={12} className="text-pink-500" />
            <h3 className="text-[9px] font-black text-white uppercase tracking-wider">{ticker} Analysis</h3>
          </div>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="text-4xl font-black text-white tracking-tighter">{analysis.score}<span className="text-xs text-white/40 ml-0.5">/100</span></div>
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] mt-1 ${analysis.type === 'bullish' ? 'text-emerald-400' : analysis.type === 'bearish' ? 'text-rose-500' : 'text-blue-400'}`}>
              Trend: {analysis.type === 'bullish' ? 'Bullish' : analysis.type === 'bearish' ? 'Bearish' : 'Steady'}
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Speed', val: analysis.momentum, color: 'bg-emerald-500' },
              { label: 'Volume', val: analysis.volume, color: 'bg-pink-500' },
              { label: 'Risk', val: analysis.volatility, color: 'bg-blue-500' }
            ].map((stat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[7px] font-black uppercase tracking-widest text-white/60">
                  <span>{stat.label}</span>
                  <span className="text-white">{stat.val}%</span>
                </div>
                <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden border border-white/20">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${stat.val}%` }} 
                    transition={{ delay: 0.1 * idx, duration: 0.8 }}
                    className={`h-full rounded-full ${stat.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-black/40 p-3 rounded-lg border border-white/10">
            <p className="text-[10px] text-white/80 leading-relaxed font-medium italic text-center">
              "{analysis.summary}"
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SentimentIndicator: React.FC<{ analysis: SentimentAnalysis; size?: 'sm' | 'md'; onClick?: () => void }> = ({ analysis, size = 'md', onClick }) => {
  const configs = {
    bullish: { icon: Flame, text: 'Bullish', color: 'text-emerald-400 border-emerald-500/80 bg-emerald-500/20 hover:bg-emerald-500/40' },
    bearish: { icon: Snowflake, text: 'Bearish', color: 'text-rose-500 border-rose-500/80 bg-rose-500/20 hover:bg-rose-500/40' },
    neutral: { icon: Meh, text: 'Steady', color: 'text-blue-400 border-blue-500/80 bg-blue-500/20 hover:bg-blue-500/40' }
  };
  const config = configs[analysis.type];
  const Icon = config.icon;

  return (
    <motion.button 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 transition-all cursor-pointer backdrop-blur-md shadow-lg ${config.color} ${size === 'sm' ? 'scale-90' : ''}`}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={3} />
      <span className={`${size === 'sm' ? 'text-[8px]' : 'text-[10px]'} font-extrabold uppercase tracking-widest`}>
        {config.text}
      </span>
    </motion.button>
  );
};

const PriceActionTable: React.FC<{ data: DayAction[] }> = ({ data }) => {
  return (
    <div className="glossy-card !border-white/40 rounded-xl overflow-hidden flex-1">
      <div className="px-3 py-2 border-b border-white/30 flex items-center justify-between bg-white/[0.06]">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-pink-500" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-wider">Weekly History</h3>
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[400px]">
          <thead>
            <tr className="bg-white/[0.04] border-b border-white/20">
              <th className="px-3 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest">Date</th>
              <th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Open</th>
              <th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">High</th>
              <th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Low</th>
              <th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Close</th>
              <th className="px-3 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {data.slice(0, 5).map((day, i) => (
              <tr key={i} className="hover:bg-white/[0.08] transition-colors">
                <td className="px-3 py-2 text-[10px] font-bold text-white/90">{day.date}</td>
                <td className="px-2 py-2 text-[10px] font-medium text-white/60 tabular-nums text-right">{day.open.toFixed(2)}</td>
                <td className="px-2 py-2 text-[10px] font-medium text-emerald-400/80 tabular-nums text-right">{day.high.toFixed(2)}</td>
                <td className="px-2 py-2 text-[10px] font-medium text-rose-500/80 tabular-nums text-right">{day.low.toFixed(2)}</td>
                <td className="px-2 py-2 text-[10px] font-black text-white tabular-nums text-right">{day.close.toFixed(2)}</td>
                <td className={`px-3 py-2 text-[10px] font-black text-right tabular-nums ${day.change >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {day.change >= 0 ? '+' : ''}{day.changePercent.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockData, setStockData] = useState<StockDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [favoriteStocksDetails, setFavoriteStocksDetails] = useState<StockDetails[]>([]);
  const [selectedSentiment, setSelectedSentiment] = useState<{ticker: string, analysis: SentimentAnalysis} | null>(null);

  const handleSearch = useCallback(async (ticker: string) => {
    if (!ticker || ticker.trim() === '') return;
    const cleanTicker = ticker.trim().toUpperCase();
    setLoading(true);
    setError(null);
    setActiveView('dashboard');
    try {
      const data = await fetchStockData(cleanTicker);
      if (data) {
        setStockData(data);
      } else {
        setError(`Not found: ${cleanTicker}`);
      }
    } catch (err) {
      setError('Connection Timeout');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedFavs = localStorage.getItem('stkr_favs_v2');
    if (storedFavs) setFavorites(JSON.parse(storedFavs));
    handleSearch('AAPL');
  }, [handleSearch]);

  const toggleFavorite = (ticker: string) => {
    const newFavs = favorites.includes(ticker) ? favorites.filter(f => f !== ticker) : [...favorites, ticker];
    setFavorites(newFavs);
    localStorage.setItem('stkr_favs_v2', JSON.stringify(newFavs));
  };

  useEffect(() => {
    if (activeView === 'favorites' && favorites.length > 0) {
      const load = async () => {
        setLoading(true);
        const details = await Promise.all(favorites.map(f => fetchStockData(f)));
        setFavoriteStocksDetails(details.filter((d): d is StockDetails => d !== null));
        setLoading(false);
      };
      load();
    }
  }, [activeView, favorites]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#010203] relative overflow-hidden">
      <AnimatedMarketBackground />

      <AnimatePresence>
        {selectedSentiment && (
          <SentimentDetailModal 
            ticker={selectedSentiment.ticker} 
            analysis={selectedSentiment.analysis} 
            onClose={() => setSelectedSentiment(null)} 
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[70px] glossy-card !bg-black/50 !rounded-none !border-y-0 !border-l-0 border-r !border-white/50 z-30 shrink-0">
        <div className="p-4 flex justify-center">
          <div className="bg-pink-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xl border border-white/40">
            <TrendingUp size={20} strokeWidth={4} />
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-4 mt-6">
          <button 
            onClick={() => setActiveView('dashboard')} 
            className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'dashboard' ? 'bg-white/15 text-white border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}
          >
            <LayoutDashboard size={20} />
          </button>
          <button 
            onClick={() => setActiveView('favorites')} 
            className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'favorites' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}
          >
            <Heart size={20} />
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar pb-[80px] md:pb-6 p-4 md:p-6 relative z-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex md:hidden items-center gap-3 w-full mb-2">
              <div className="bg-pink-600 w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg border border-white/30">
                <TrendingUp size={16} strokeWidth={4} />
              </div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase">Stocker</h1>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchTerm); }} className="w-full max-w-sm relative group">
              <input
                type="text"
                placeholder="Search symbol (e.g. AAPL, RELIANCE)..."
                className="w-full bg-white/[0.08] border border-white/40 rounded-xl py-3 pl-5 pr-12 text-[12px] font-bold text-white placeholder-white/30 focus:outline-none focus:border-pink-500/80 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-pink-600 text-white p-2.5 rounded-lg transition-all">
                <Search size={16} strokeWidth={3} />
              </button>
            </form>
            
            <div className="hidden sm:flex items-center gap-5 text-white/30 text-[8px] font-black uppercase tracking-wider">
               <div className="flex items-center gap-2">
                 <ShieldCheck size={12} className="text-emerald-500/60" />
                 <span>Verified</span>
               </div>
               <div className="flex items-center gap-2">
                 <Activity size={12} className="text-pink-500/60" />
                 <span>Live Data</span>
               </div>
            </div>
          </header>

          {error && (
            <div className="px-4 py-3 border-2 border-rose-500/60 bg-rose-500/15 text-rose-400 text-[11px] font-black rounded-xl flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <Info size={14} />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-rose-500/20 rounded-lg"><X size={16} /></button>
            </div>
          )}

          {loading ? (
            <div className="py-32 flex flex-col items-center gap-6">
              <div className="relative">
                <Loader2 className="animate-spin text-pink-500" size={48} strokeWidth={4} />
                <div className="absolute inset-0 blur-xl bg-pink-500/20 animate-pulse" />
              </div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">Synchronizing Market Data</span>
            </div>
          ) : stockData && activeView === 'dashboard' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <section className="glossy-card !border-white/50 p-5 md:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 blur-[100px] pointer-events-none" />
                <div className="space-y-3 relative z-10 w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-start gap-4">
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                      {stockData.info.ticker.split('.')[0]}
                    </h2>
                    <button 
                      onClick={() => toggleFavorite(stockData.info.ticker)} 
                      className={`p-3 rounded-xl border-2 transition-all ${favorites.includes(stockData.info.ticker) ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'border-white/40 text-white/40 hover:text-white'}`}
                    >
                      <Heart size={18} fill={favorites.includes(stockData.info.ticker) ? "currentColor" : "none"} strokeWidth={3} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-[2px] bg-pink-600 rounded-full" />
                     <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] italic truncate max-w-[200px] md:max-w-none">{stockData.info.name}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-4 relative z-10 w-full md:w-auto">
                   <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                      <span className="text-4xl md:text-5xl font-black text-white tabular-nums tracking-tighter leading-none">
                        {stockData.info.currentPrice.toFixed(2)}
                      </span>
                      <SentimentIndicator 
                        analysis={stockData.info.sentiment} 
                        onClick={() => setSelectedSentiment({ ticker: stockData.info.ticker.split('.')[0], analysis: stockData.info.sentiment })}
                      />
                   </div>
                   <div className={`text-[12px] font-black tabular-nums px-4 py-1.5 rounded-xl border-2 self-start md:self-auto ${stockData.info.change >= 0 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15' : 'text-rose-500 border-rose-500/40 bg-rose-500/15'}`}>
                      {stockData.info.change >= 0 ? <ArrowUpRight size={14} className="inline mr-1" /> : <ArrowDownRight size={14} className="inline mr-1" />}
                      {Math.abs(stockData.info.change).toFixed(2)} ({stockData.info.changePercent.toFixed(2)}%)
                   </div>
                </div>
              </section>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <TerminalChart data={stockData.history} />
                </div>
                <div className="flex flex-col gap-6 lg:col-span-1">
                  <PriceActionTable data={stockData.dailyAction} />
                </div>
              </div>
            </div>
          ) : activeView === 'favorites' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
               {favoriteStocksDetails.map((fav) => (
                  <div 
                    key={fav.info.ticker} 
                    className="glossy-card !border-white/40 p-5 rounded-2xl space-y-5 hover:border-pink-500/60 transition-all cursor-pointer group shadow-xl active:scale-[0.98]" 
                    onClick={() => handleSearch(fav.info.ticker)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-black text-white group-hover:text-pink-500 transition-colors uppercase tracking-tight">{fav.info.ticker.split('.')[0]}</h3>
                        <p className="text-[8px] text-white/50 font-black mt-1 uppercase tracking-widest truncate max-w-[120px]">{fav.info.name.split(' ')[0]}</p>
                      </div>
                      <div className={`text-[10px] font-black px-2 py-1 rounded-lg border ${fav.info.change >= 0 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-rose-500 border-rose-500/40 bg-rose-500/10'}`}>
                        {fav.info.changePercent.toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4">
                       <span className="text-2xl font-black text-white tabular-nums">{fav.info.currentPrice.toFixed(2)}</span>
                       <SentimentIndicator 
                        analysis={fav.info.sentiment} 
                        size="sm" 
                        onClick={() => setSelectedSentiment({ ticker: fav.info.ticker.split('.')[0], analysis: fav.info.sentiment })}
                       />
                    </div>
                  </div>
               ))}
               {favorites.length === 0 && (
                 <div className="col-span-full py-24 text-center glossy-card !border-white/30 rounded-3xl flex flex-col items-center gap-6">
                    <Heart size={48} className="text-white/10" strokeWidth={1} />
                    <div className="space-y-2">
                      <span className="block text-[12px] font-black text-white/50 uppercase tracking-[0.2em]">Your watchlist is empty</span>
                      <p className="text-[10px] text-white/30 max-w-[200px]">Start searching for stocks to add them to your favorites list.</p>
                    </div>
                    <button 
                      onClick={() => setActiveView('dashboard')} 
                      className="px-8 py-3 bg-pink-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/30 shadow-lg hover:bg-pink-500 transition-colors"
                    >
                      Go to Dashboard
                    </button>
                 </div>
               )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-[50] h-[64px] glossy-card !bg-black/80 !rounded-2xl border !border-white/40 flex items-center justify-around shadow-2xl px-2">
        <button 
          onClick={() => setActiveView('dashboard')} 
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeView === 'dashboard' ? 'text-pink-500' : 'text-white/40'}`}
        >
          <LayoutDashboard size={20} strokeWidth={activeView === 'dashboard' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Dash</span>
        </button>
        <div className="w-[1px] h-6 bg-white/10" />
        <button 
          onClick={() => setActiveView('favorites')} 
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeView === 'favorites' ? 'text-pink-500' : 'text-white/40'}`}
        >
          <Heart size={20} strokeWidth={activeView === 'favorites' ? 3 : 2} fill={activeView === 'favorites' ? 'currentColor' : 'none'} />
          <span className="text-[8px] font-black uppercase tracking-widest">Watchlist</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
