
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrendingUp, Activity, Loader2, X, Heart, ArrowUpRight, ArrowDownRight, Search, LayoutDashboard, Flame, Snowflake, Meh, ShieldCheck, Zap, Info, Globe, Cpu, Clock, Calendar, Expand, Minus, Timer, CalendarDays, SeparatorHorizontal, Trash2, Milestone, BellRing, ChevronRight, TrendingDown, CheckCircle2, ShieldAlert, Sparkles, Wand2, RefreshCw, AlertTriangle, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStockData, searchStocks } from './services/mockStockData.ts';
import { StockDetails, SentimentAnalysis, DayAction, SearchResult, PricePoint, Alert } from './types.ts';
import TerminalChart from './components/TerminalChart.tsx';
import AIIntelligenceModal from './components/AIIntelligenceModal.tsx';
import WatchlistPulseModal from './components/WatchlistPulseModal.tsx';
import { getAnonymousId, createAlert, fetchUserAlerts, deleteAlert } from './services/alertService.ts';
import { isPushSupported, getNotificationPermission, requestNotificationPermission, subscribeUser, unsubscribeUser, getPushSubscription } from './services/pushNotificationService.ts';

type View = 'dashboard' | 'favorites' | 'alerts';
type Timeframe = '15m' | '1D';
type DrawingTool = 'horizontal' | 'trend' | null;
type SentimentFilter = 'all' | 'bullish' | 'bearish';

const TIMEFRAMES: Record<Timeframe, { range: string; interval: string }> = {
  '15m': { range: '5d', interval: '15m' },
  '1D': { range: '1y', interval: '1d' }
};

const AnimatedMarketBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=60&w=1200")',
          filter: 'brightness(0.3) saturate(1.2)'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-pink-900/10 opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0)_0%,rgba(1,2,3,1)_90%)]" />
      <div className="absolute inset-0 bg-grid animate-grid opacity-10" />
      <div className="absolute inset-0 scanlines opacity-[0.03]" />
    </div>
  );
};

const AlertModal: React.FC<{ ticker: string; currentPrice: number; onClose: () => void; onSave: (price: number, condition: 'above' | 'below') => Promise<boolean> }> = ({ ticker, currentPrice, onClose, onSave }) => {
  const [targetPrice, setTargetPrice] = useState(currentPrice.toFixed(2));
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [isSaving, setIsSaving] = useState(false);

  const handleAction = async () => {
    setIsSaving(true);
    const success = await onSave(parseFloat(targetPrice), condition);
    if (!success) {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ y: "100%", opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: "100%", opacity: 0 }} 
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className={`relative w-full max-w-[320px] glossy-card rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl p-6 border-t-[0.5px] border-x-[0.5px] border-white/20 transition-colors duration-500 ${condition === 'above' ? 'shadow-emerald-500/10' : 'shadow-rose-500/10'}`}
      >
        <div className="md:hidden w-10 h-1 bg-white/10 rounded-full mx-auto -mt-2 mb-4" />

        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-xl border transition-colors duration-500 ${condition === 'above' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'}`}>
            <BellRing size={16} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">{ticker} Alert</h3>
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Target Notification</span>
          </div>
        </div>

        <div className="space-y-5">
          <div className="relative p-1 bg-white/[0.04] border border-white/10 rounded-xl flex">
            <motion.div 
              layoutId="toggle-bg"
              className={`absolute inset-y-1 rounded-lg shadow-lg transition-colors duration-500 ${condition === 'above' ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
              style={{ width: 'calc(50% - 4px)', left: condition === 'above' ? '4px' : 'calc(50%)' }}
            />
            <button 
              onClick={() => setCondition('above')} 
              className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wider transition-colors ${condition === 'above' ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              Above
            </button>
            <button 
              onClick={() => setCondition('below')} 
              className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wider transition-colors ${condition === 'below' ? 'text-black' : 'text-white/60 hover:text-white'}`}
            >
              Below
            </button>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <label className="text-[8px] font-black uppercase text-white/70 tracking-widest">Trigger Price</label>
              <span className="text-[8px] font-bold text-white/50 uppercase tabular-nums">Market: {currentPrice.toFixed(2)}</span>
            </div>
            <div className="relative group">
              <input 
                type="number" 
                step="0.01"
                value={targetPrice} 
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-white/[0.03] border-2 border-white/20 rounded-xl px-4 py-3 text-xl font-black text-white focus:outline-none focus:border-white/50 transition-all tabular-nums text-center"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSaving}
              onClick={handleAction} 
              className={`relative w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-white border transition-all shadow-xl flex items-center justify-center min-h-[44px] ${condition === 'above' ? 'bg-emerald-600 border-emerald-400' : 'bg-rose-600 border-rose-400'} ${isSaving ? 'opacity-90 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={16} strokeWidth={3} />
              ) : (
                'Activate Monitor'
              )}
            </motion.button>
            <button 
              onClick={onClose} 
              className="w-full py-2 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white/70 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SentimentDetailModal: React.FC<{ ticker: string; analysis: SentimentAnalysis; onClose: () => void }> = ({ ticker, analysis, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-[320px] glossy-card !border-white/60 rounded-xl overflow-hidden shadow-2xl">
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
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] mt-1 ${analysis.type === 'bullish' ? 'text-emerald-400' : analysis.type === 'bearish' ? 'text-rose-500' : 'text-blue-400'}`}>Trend: {analysis.type === 'bullish' ? 'Bullish' : analysis.type === 'bearish' ? 'Bearish' : 'Steady'}</div>
          </div>
          <div className="space-y-3">
            {[{ label: 'Speed', val: analysis.momentum, color: 'bg-emerald-500' }, { label: 'Volume', val: analysis.volume, color: 'bg-pink-500' }, { label: 'Risk', val: analysis.volatility, color: 'bg-blue-500' }].map((stat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[7px] font-black uppercase tracking-widest text-white/60"><span>{stat.label}</span><span className="text-white">{stat.val}%</span></div>
                <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden border border-white/20"><motion.div initial={{ width: 0 }} animate={{ width: `${stat.val}%` }} transition={{ delay: 0.1 * idx, duration: 0.8 }} className={`h-full rounded-full ${stat.color}`}/></div>
              </div>
            ))}
          </div>
          <div className="bg-black/40 p-3 rounded-lg border border-white/10"><p className="text-[10px] text-white/80 leading-relaxed font-medium italic text-center">"{analysis.summary}"</p></div>
        </div>
      </motion.div>
    </div>
  );
};

const SentimentIndicator: React.FC<{ analysis: SentimentAnalysis; size?: 'sm' | 'md'; onClick?: () => void }> = ({ analysis, size = 'md', onClick }) => {
  const configs = { bullish: { icon: Flame, text: 'Bullish', color: 'text-emerald-400 border-emerald-500/80 bg-emerald-500/20 hover:bg-emerald-500/40' }, bearish: { icon: Snowflake, text: 'Bearish', color: 'text-rose-500 border-rose-500/80 bg-rose-500/20 hover:bg-rose-500/40' }, neutral: { icon: Meh, text: 'Steady', color: 'text-blue-400 border-blue-500/80 bg-blue-500/20 hover:bg-blue-500/40' } };
  const config = configs[analysis.type];
  const Icon = config.icon;
  return (<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); onClick?.(); }} className={`inline-flex items-center gap-1.5 rounded-full border transition-all cursor-pointer backdrop-blur-md shadow-lg ${config.color} ${size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1.5 border-2'}`}><Icon size={size === 'sm' ? 8 : 12} strokeWidth={3} /><span className={`${size === 'sm' ? 'text-[8px]' : 'text-[10px]'} font-extrabold uppercase tracking-widest`}>{config.text}</span></motion.button>);
};

const PriceActionTable: React.FC<{ data: DayAction[] }> = ({ data }) => {
  return (
    <div className="glossy-card !border-white/40 rounded-xl overflow-hidden flex-1 min-w-[300px]">
      <div className="px-3 py-2 border-b border-white/30 flex items-center justify-between bg-white/[0.06]"><div className="flex items-center gap-2"><Calendar size={12} className="text-pink-500" /><h3 className="text-[10px] font-black text-white uppercase tracking-wider">Weekly History</h3></div></div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[300px]">
          <thead><tr className="bg-white/[0.04] border-b border-white/20"><th className="px-3 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest">Date</th><th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Open</th><th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">High</th><th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Low</th><th className="px-2 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Close</th><th className="px-3 py-2 text-[8px] font-black text-white/50 uppercase tracking-widest text-right">Change</th></tr></thead>
          <tbody className="divide-y divide-white/10">{data.slice(0, 5).map((day, i) => (<tr key={i} className="hover:bg-white/[0.08] transition-colors"><td className="px-3 py-2 text-[10px] font-bold text-white/90">{day.date}</td><td className="px-2 py-2 text-[10px] font-medium text-white/60 tabular-nums text-right">{day.open.toFixed(2)}</td><td className="px-2 py-2 text-[10px] font-medium text-emerald-400/80 tabular-nums text-right">{day.high.toFixed(2)}</td><td className="px-2 py-2 text-[10px] font-medium text-rose-500/80 tabular-nums text-right">{day.low.toFixed(2)}</td><td className="px-2 py-2 text-[10px] font-black text-white tabular-nums text-right">{day.close.toFixed(2)}</td><td className={`px-3 py-2 text-[10px] font-black text-right tabular-nums ${day.change >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{day.change >= 0 ? '+' : ''}{day.changePercent.toFixed(2)}%</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockData, setStockData] = useState<StockDetails | null>(null);
  const [dailyHistory, setDailyHistory] = useState<PricePoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [favoriteStocksDetails, setFavoriteStocksDetails] = useState<StockDetails[]>([]);
  const [selectedSentiment, setSelectedSentiment] = useState<{ticker: string, analysis: SentimentAnalysis} | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debounceTimeout = useRef<number | null>(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isPulseModalOpen, setIsPulseModalOpen] = useState(false);
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('1D');
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [clearLinesSignal, setClearLinesSignal] = useState(0);

  // Alerts logic
  const [userAlerts, setUserAlerts] = useState<Alert[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Push notification state
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  // Favorites screen filter states
  const [favSearchTerm, setFavSearchTerm] = useState('');
  const [favFilter, setFavFilter] = useState<SentimentFilter>('all');

  const filteredFavorites = useMemo(() => {
    return favoriteStocksDetails.filter(stock => {
      const matchesSearch = stock.info.ticker.toLowerCase().includes(favSearchTerm.toLowerCase()) || stock.info.name.toLowerCase().includes(favSearchTerm.toLowerCase());
      const matchesSentiment = favFilter === 'all' || stock.info.sentiment.type === favFilter;
      return matchesSearch && matchesSentiment;
    });
  }, [favoriteStocksDetails, favSearchTerm, favFilter]);

  const handleFetchData = useCallback(async (ticker: string, timeframe: Timeframe) => {
    if (!ticker || ticker.trim() === '') return;
    const cleanTicker = ticker.trim().toUpperCase();
    setLoading(true);
    setError(null);
    try {
      const { range, interval } = TIMEFRAMES[timeframe];
      const data = await fetchStockData(cleanTicker, range, interval);
      if (data) {
        setStockData(data);
        if (timeframe === '1D') setDailyHistory(data.history);
      } else {
        setError(`Not found: ${cleanTicker}`);
        setStockData(null);
        setDailyHistory(null);
      }
    } catch (err) {
      setError('Connection Timeout');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectAndSearch = useCallback((ticker: string) => {
    setSearchTerm('');
    setSearchResults([]);
    setIsSearchFocused(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setActiveView('dashboard');
    const newTimeframe = '1D';
    setCurrentTimeframe(newTimeframe);
    handleFetchData(ticker, newTimeframe);
  }, [handleFetchData]);

  const handleTimeframeChange = useCallback((newTimeframe: Timeframe) => {
    if (stockData?.info.ticker) {
      setCurrentTimeframe(newTimeframe);
      handleFetchData(stockData.info.ticker, newTimeframe);
    }
  }, [stockData, handleFetchData]);

  // Robust Subscription Logic
  const handleEnsureSubscription = async () => {
    if (!isPushSupported()) {
      setError("Push Manager is not supported on this device/browser.");
      return false;
    }
    
    setIsPushLoading(true);
    try {
      const permission = getNotificationPermission();
      
      if (permission === 'default') {
        const result = await requestNotificationPermission();
        setPushStatus(result);
        if (result !== 'granted') return false;
      } else if (permission === 'denied') {
        setError("Notifications blocked. Please reset site permissions in browser settings.");
        return false;
      }
      
      const success = await subscribeUser();
      setIsPushSubscribed(success);
      if (!success) {
        setError("Failed to register for push alerts. Check your connection.");
      }
      return success;
    } catch (e) {
      console.error("Subscription flow error:", e);
      setError("An error occurred while enabling notifications.");
      return false;
    } finally {
      setIsPushLoading(false);
    }
  };

  // Alert Actions
  const handleSaveAlert = async (price: number, condition: 'above' | 'below'): Promise<boolean> => {
    if (!stockData) return false;
    
    setError(null);
    try {
      // Proactively ensure subscription is active BEFORE saving alert
      const subSuccess = await handleEnsureSubscription();
      if (!subSuccess) {
        // We warn the user, but we can still try to save the alert if they want
        // though it won't trigger a push notification.
        console.warn("Saving alert without an active push subscription.");
      }

      const success = await createAlert({
        ticker: stockData.info.ticker,
        target_price: price,
        condition: condition
      });

      if (success) {
        const freshAlerts = await fetchUserAlerts();
        setUserAlerts(freshAlerts);
        setIsAlertModalOpen(false);
        return true;
      } else {
        setError("Unable to save alert. Check connection or Worker status.");
        return false;
      }
    } catch (err) {
      console.error("Alert save crash:", err);
      setError("An unexpected error occurred while saving alert.");
      return false;
    }
  };

  const handleDeleteAlert = async (id: number) => {
    const success = await deleteAlert(id);
    if (success) {
      setUserAlerts(prev => prev.filter(a => a.id !== id));
    }
  };

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    if (searchTerm.trim() && isSearchFocused) {
      debounceTimeout.current = window.setTimeout(async () => {
        const results = await searchStocks(searchTerm);
        setSearchResults(results);
      }, 300);
    } else {
      setSearchResults([]);
    }
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [searchTerm, isSearchFocused]);

  useEffect(() => {
    const storedFavs = localStorage.getItem('stkr_favs_v2');
    if (storedFavs) setFavorites(JSON.parse(storedFavs));
    getAnonymousId();
    fetchUserAlerts().then(alerts => setUserAlerts(alerts));
    
    if (isPushSupported()) {
      const perm = getNotificationPermission();
      setPushStatus(perm);
      getPushSubscription().then(sub => {
        setIsPushSubscribed(!!sub);
        // If granted but no subscription record in browser, try to fix it automatically
        if (perm === 'granted' && !sub) {
          console.log("Permission granted but no local subscription. Attempting auto-fix...");
          subscribeUser().then(success => setIsPushSubscribed(success));
        }
      });
    }

    handleSelectAndSearch('AAPL');
  }, [handleSelectAndSearch]);

  const toggleFavorite = (ticker: string) => {
    const newFavs = favorites.includes(ticker) ? favorites.filter(f => f !== ticker) : [...favorites, ticker];
    setFavorites(newFavs);
    localStorage.setItem('stkr_favs_v2', JSON.stringify(newFavs));
  };

  useEffect(() => {
    if (activeView === 'favorites') {
      if (favorites.length > 0) {
        setLoading(true);
        Promise.all(favorites.map(f => fetchStockData(f))).then(details => {
          setFavoriteStocksDetails(details.filter((d): d is StockDetails => d !== null));
          setLoading(false);
        });
      } else {
        setFavoriteStocksDetails([]);
      }
    }
  }, [activeView, favorites]);

  const activeAlertForCurrent = useMemo(() => {
    if (!stockData || !Array.isArray(userAlerts)) return null;
    return userAlerts.find(a => a.ticker === stockData.info.ticker && a.status === 'active');
  }, [userAlerts, stockData]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#010203] relative overflow-hidden">
      <AnimatedMarketBackground />
      
      <AnimatePresence>
        {selectedSentiment && <SentimentDetailModal ticker={selectedSentiment.ticker} analysis={selectedSentiment.analysis} onClose={() => setSelectedSentiment(null)} />}
        {isAlertModalOpen && stockData && <AlertModal ticker={stockData.info.ticker} currentPrice={stockData.info.currentPrice} onClose={() => setIsAlertModalOpen(false)} onSave={handleSaveAlert} />}
        {isAIModalOpen && stockData && (
          <AIIntelligenceModal 
            ticker={stockData.info.ticker} 
            currentPrice={stockData.info.currentPrice} 
            history={stockData.history} 
            onClose={() => setIsAIModalOpen(false)} 
          />
        )}
        {isPulseModalOpen && favoriteStocksDetails.length > 0 && (
          <WatchlistPulseModal
            stocks={favoriteStocksDetails}
            onClose={() => setIsPulseModalOpen(false)}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isChartModalOpen && stockData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col">
            <div className="px-6 py-3 flex justify-between items-start text-white border-b border-white/30 bg-black/70">
                <div className="flex flex-col gap-2">
                    <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/50">{stockData.info.ticker}</h2>
                    <div className="flex items-center gap-2">
                        {(['15m', '1D'] as Timeframe[]).map(tf => (<button key={tf} onClick={() => handleTimeframeChange(tf)} className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md border-2 transition-all flex items-center gap-1.5 ${currentTimeframe === tf ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'bg-white/15 border-white/40 text-white/70 hover:text-white hover:bg-white/25'}`}>{tf === '15m' ? <Timer size={10} /> : <CalendarDays size={10} />}{tf}</button>))}
                        <div className="w-[1px] h-4 bg-white/20 mx-1" />
                        <button onClick={() => setActiveTool(activeTool === 'horizontal' ? null : 'horizontal')} className={`p-1.5 rounded-md border-2 transition-all flex items-center gap-1.5 ${activeTool === 'horizontal' ? 'bg-yellow-500 border-yellow-300 text-black shadow-lg' : 'bg-white/15 border-white/40 text-white/70 hover:text-white hover:bg-white/25'}`}><SeparatorHorizontal size={12} strokeWidth={3} /></button>
                        <button onClick={() => setActiveTool(activeTool === 'trend' ? null : 'trend')} className={`p-1.5 rounded-md border-2 transition-all flex items-center gap-1.5 ${activeTool === 'trend' ? 'bg-yellow-500 border-yellow-300 text-black shadow-lg' : 'bg-white/15 border-white/40 text-white/70 hover:text-white hover:bg-white/25'}`}><Milestone size={12} strokeWidth={3} className="-rotate-45" /></button>
                        <button onClick={() => setClearLinesSignal(s => s + 1)} className="p-1.5 rounded-md border-2 bg-white/15 border-white/40 text-white/70 hover:text-rose-400 hover:border-rose-400/80 hover:bg-white/25 transition-all"><Trash2 size={12} strokeWidth={2.5} /></button>
                    </div>
                </div>
                <button onClick={() => { setIsChartModalOpen(false); setActiveTool(null); }} className="p-2 bg-white/15 rounded-xl hover:bg-rose-600 transition-all text-white/60 hover:text-white border border-white/40"><X size={16} strokeWidth={3} /></button>
            </div>
            <div className="flex-1 p-4"><TerminalChart key={stockData.info.ticker} ticker={stockData.info.ticker} data={stockData.history} isModal={true} onTimeframeChange={handleTimeframeChange} activeTimeframe={currentTimeframe} activeTool={activeTool} clearLinesSignal={clearLinesSignal} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex flex-col w-[70px] glossy-card !bg-black/30 !rounded-none !border-y-0 !border-l-0 border-r !border-white/50 z-30 shrink-0">
        <div className="p-4 flex justify-center"><div className="bg-pink-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xl border border-white/40"><TrendingUp size={20} strokeWidth={4} /></div></div>
        <nav className="flex-1 px-2 space-y-4 mt-6">
          <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'dashboard' ? 'bg-white/15 text-white border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><LayoutDashboard size={20} /></button>
          <button onClick={() => setActiveView('favorites')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'favorites' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><Heart size={20} /></button>
          <button onClick={() => setActiveView('alerts')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'alerts' ? 'bg-white/15 text-yellow-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><BellRing size={20} /></button>
        </nav>
      </aside>

      <main className="flex-1 h-full overflow-y-auto custom-scrollbar pb-32 md:pb-6 p-4 md:p-6 relative z-10 bg-black/10">
        <div className="max-w-6xl mx-auto space-y-3">
          <header className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {activeView === 'dashboard' && (
              <div className="relative p-[1.5px] rounded-xl overflow-hidden w-full mb-1">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(236,72,153,0.1)_90deg,rgba(236,72,153,0.8)_180deg,rgba(236,72,153,0.1)_270deg,transparent_360deg)] opacity-60"
                  />
                  <div className="relative flex items-center gap-3 px-4 py-2 bg-black/80 backdrop-blur-2xl rounded-[calc(0.75rem-1px)] border border-white/10">
                    <div className="p-2 rounded-lg bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] border border-white/20">
                       <TrendingUp size={16} strokeWidth={4} />
                    </div>
                    <div className="flex flex-col">
                       <h1 className="text-sm font-black text-white uppercase tracking-[0.3em] leading-tight">Stocker</h1>
                       <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.4em]">Professional Analytics</span>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-white/30 text-[8px] font-black uppercase tracking-wider">
                       <div className="hidden sm:flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-500/60" /><span></span></div>
                       <div className="flex items-center gap-2"><Activity size={12} className="text-pink-500/60" /><span></span></div>
                    </div>
                  </div>
              </div>
            )}
            {activeView === 'dashboard' && (
              <div className="w-full max-sm relative group" onFocus={() => setIsSearchFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsSearchFocused(false); }}>
                <form className="relative" onSubmit={(e) => { e.preventDefault(); handleSelectAndSearch(searchResults.length > 0 ? searchResults[0].symbol : searchTerm); }}>
                  <input type="text" placeholder="Search by name or symbol..." className="w-full bg-white/[0.08] border border-white/40 rounded-xl py-3 pl-5 pr-12 text-[12px] font-bold text-white placeholder-white/30 focus:outline-none focus:border-pink-500/80 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-4 text-yellow/80 hover:text-pink-500 transition-colors duration-200"><motion.div animate={{ y: [0, -2, 0], scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}><TrendingUp size={16} strokeWidth={3} /></motion.div></button>
                </form>
                <AnimatePresence>{isSearchFocused && searchResults.length > 0 && (<motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full mt-2 w-full glossy-card !border-white/40 rounded-xl overflow-hidden z-50 p-1">{searchResults.map((result) => (<li key={result.symbol} onMouseDown={() => handleSelectAndSearch(result.symbol)} className="p-3 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"><div className="flex items-center justify-between"><span className="text-[11px] font-black text-white uppercase">{result.symbol}</span><span className="text-[9px] font-bold text-white/40 px-2 py-0.5 bg-white/5 rounded">{result.exchange}</span></div><p className="text-[10px] text-white/60 mt-1 truncate">{result.name}</p></li>))}</motion.ul>)}</AnimatePresence>
              </div>
            )}
          </header>

          {error && (<div className="px-4 py-3 border-2 border-rose-500/60 bg-rose-500/15 text-rose-400 text-[11px] font-black rounded-xl flex justify-between items-center animate-in slide-in-from-top-2 duration-300"><div className="flex items-center gap-2"><Info size={14} /><span>{error}</span></div><button onClick={() => setError(null)} className="p-1 hover:bg-rose-500/20 rounded-lg"><X size={16} /></button></div>)}

          {loading ? (
            <div className="py-32 flex flex-col items-center gap-6"><div className="relative"><Loader2 className="animate-spin text-pink-500" size={48} strokeWidth={4} /><div className="absolute inset-0 blur-xl bg-pink-500/20 animate-pulse" /></div><span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">Synchronizing Market Data</span></div>
          ) : stockData && activeView === 'dashboard' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <section className="glossy-card !border-white/50 p-5 md:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 blur-[100px] pointer-events-none" />
                <div className="space-y-3 relative z-10 w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-start gap-3">
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">{stockData.info.ticker.split('.')[0]}</h2>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleFavorite(stockData.info.ticker)} className={`p-2.5 rounded-xl border-2 transition-all ${favorites.includes(stockData.info.ticker) ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'border-white/40 text-white/40 hover:text-white'}`}><Heart size={10} fill={favorites.includes(stockData.info.ticker) ? "currentColor" : "none"} strokeWidth={3} /></button>
                      <button onClick={() => setIsAlertModalOpen(true)} className={`p-2.5 rounded-xl border-2 transition-all ${activeAlertForCurrent ? 'bg-yellow-500 border-yellow-300 text-black shadow-lg' : 'border-white/40 text-white/40 hover:text-white'}`}>{activeAlertForCurrent ? <BellRing size={10} strokeWidth={3} className="animate-pulse" /> : <BellRing size={10} strokeWidth={3} />}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3"><div className="w-10 h-[2px] bg-pink-600 rounded-full" /><p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] italic truncate max-w-[200px] md:max-w-none">{stockData.info.name}</p></div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-4 relative z-10 w-full md:w-auto">
                   <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                      <span className="text-4xl md:text-5xl font-black text-white tabular-nums tracking-tighter leading-none">{stockData.info.currentPrice.toFixed(2)}</span>
                      <div className="flex flex-col items-center gap-2">
                        <SentimentIndicator analysis={stockData.info.sentiment} onClick={() => setSelectedSentiment({ ticker: stockData.info.ticker.split('.')[0], analysis: stockData.info.sentiment })} />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setIsAIModalOpen(true)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-500 text-white border border-white/40 shadow-lg shadow-pink-500/20"
                        >
                          <Sparkles size={12} fill="white" className="animate-pulse" />
                          <span className="text-[8px] font-black uppercase tracking-widest">AI Analyst</span>
                        </motion.button>
                      </div>
                   </div>
                   <div className={`text-[12px] font-black tabular-nums px-4 py-1.5 rounded-xl border-2 self-start md:self-auto ${stockData.info.change >= 0 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15' : 'text-rose-500 border-rose-500/40 bg-rose-500/15'}`}>{stockData.info.change >= 0 ? <ArrowUpRight size={14} className="inline mr-1" /> : <ArrowDownRight size={14} className="inline mr-1" />}{Math.abs(stockData.info.change).toFixed(2)} ({stockData.info.changePercent.toFixed(2)}%)</div>
                </div>
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                <div className="lg:col-span-3 h-[450px] w-full glossy-card !border-white/50 p-1 rounded-2xl relative group shadow-2xl bg-black/30 overflow-hidden">{dailyHistory && <TerminalChart ticker={stockData.info.ticker} data={dailyHistory.slice(-20)} isModal={false} />}<button onClick={() => setIsChartModalOpen(true)} className="absolute top-4 right-4 z-10 p-3 bg-black/50 rounded-full border border-white/20 backdrop-blur-lg text-white/70 hover:text-white hover:bg-pink-600 transition-all opacity-0 group-hover:opacity-100"><Expand size={16} /></button></div>
                <div className="lg:col-span-1"><PriceActionTable data={stockData.dailyAction} /></div>
              </div>
            </div>
          ) : activeView === 'favorites' ? (
            <div className="space-y-4 animate-in fade-in duration-500">
               <div className="relative p-[1.5px] rounded-xl overflow-hidden w-full mb-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(236,72,153,0.1)_90deg,rgba(236,72,153,0.6)_180deg,rgba(236,72,153,0.1)_270deg,transparent_360deg)] opacity-40"
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2 bg-black/80 backdrop-blur-xl rounded-[calc(0.75rem-1px)] border border-white/5">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-transparent border border-pink-500/40 text-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.15)]">
                       <Heart size={14} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[10px] font-black text-white uppercase tracking-[0.25em] leading-tight">Watchlist</h2>
                       <span className="text-[7px] font-bold text-white/30 uppercase tracking-widest">Monitored Assets</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                       <motion.button
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         onClick={() => setIsPulseModalOpen(true)}
                         disabled={favorites.length === 0}
                         className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-500 text-white border border-white/40 shadow-lg shadow-pink-500/20 ${favorites.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                       >
                         <Wand2 size={12} fill="white" className="animate-pulse" />
                         <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">AI Pulse Check</span>
                         <span className="text-[9px] font-black uppercase tracking-widest sm:hidden">Pulse</span>
                       </motion.button>
                       <div className="hidden sm:flex items-center gap-1.5 opacity-30">
                          <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                          <span className="text-[7px] font-black text-white uppercase tracking-widest">{favorites.length} Symbols</span>
                       </div>
                    </div>
                  </div>
               </div>

               <div className="flex items-center p-0.5 bg-white/[0.03] border border-white/30 rounded-xl max-w-2xl">
                  <div className="relative flex-1 group min-w-0 opacity-80"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-pink-500 transition-colors" size={12} /><input type="text" placeholder="Filter favorites..." className="w-full bg-transparent py-2.5 pl-10 pr-4 text-[11px] font-black uppercase tracking-wider text-white placeholder-white/20 focus:outline-none transition-all" value={favSearchTerm} onChange={(e) => setFavSearchTerm(e.target.value)} /></div>
                  <div className="w-[1px] h-4 bg-white/20 mx-1" />
                  <div className="flex items-center gap-0.5 shrink-0 opacity-80">{(['all', 'bullish', 'bearish'] as const).map((mode) => (<button key={mode} onClick={() => setFavFilter(mode)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${favFilter === mode ? 'bg-white/20 text-white shadow-lg border border-white/40' : 'text-white/40 hover:text-white/60'}`}>{mode === 'bullish' && <Flame size={10} className={favFilter === 'bullish' ? 'text-emerald-400' : ''} />}{mode === 'bearish' && <Snowflake size={10} className={favFilter === 'bearish' ? 'text-rose-500' : ''} />}<span className="hidden sm:inline">{mode}</span>{mode === 'all' && <span className="sm:hidden">All</span>}</button>))}</div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {filteredFavorites.map((fav) => (<div key={fav.info.ticker} className="relative p-4 rounded-xl overflow-hidden transition-all cursor-pointer group shadow-xl active:scale-[0.98] border border-white/30 bg-gradient-to-br from-white/[0.12] via-white/[0.04] to-transparent backdrop-blur-md" onClick={() => handleSelectAndSearch(fav.info.ticker)}><div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" /><div className="relative z-10 flex flex-col gap-0.5 opacity-95"><div className="flex items-center justify-between gap-2 min-w-0"><h3 className="text-[15px] font-black text-white group-hover:text-pink-500 transition-colors uppercase tracking-tight truncate shrink">{fav.info.ticker.split('.')[0]}</h3><div className="shrink-0"><SentimentIndicator analysis={fav.info.sentiment} size="sm" onClick={() => setSelectedSentiment({ ticker: fav.info.ticker.split('.')[0], analysis: fav.info.sentiment })} /></div></div><div className="min-w-0"><p className="text-[9px] text-white/40 font-black uppercase tracking-widest truncate">{fav.info.name}</p></div><div className="relative flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 mt-2"><span className="text-base font-black text-white tabular-nums tracking-tighter shrink-0">{fav.info.currentPrice.toFixed(2)}</span><div className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${fav.info.change >= 0 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-rose-500 border-rose-500/40 bg-rose-500/10'}`}>{fav.info.changePercent.toFixed(1)}%</div></div></div></div>))}
                  {favorites.length === 0 && (<div className="col-span-full py-16 text-center glossy-card !border-white/30 rounded-2xl flex flex-col items-center gap-4"><Heart size={40} className="text-white/10" strokeWidth={1} /><div className="space-y-1"><span className="block text-[12px] font-black text-white/50 uppercase tracking-[0.2em]">Watchlist Empty</span><p className="text-[10px] text-white/30 max-w-[200px]">Add stocks from the dashboard to track them here.</p></div><button onClick={() => setActiveView('dashboard')} className="px-8 py-3 bg-pink-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/30 shadow-lg hover:bg-pink-500 transition-colors">Find Stocks</button></div>)}
               </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
               <div className="relative p-[1.5px] rounded-xl overflow-hidden w-full mb-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.1)_90deg,rgba(234,179,8,0.6)_180deg,rgba(234,179,8,0.1)_270deg,transparent_360deg)] opacity-40"
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2 bg-black/80 backdrop-blur-xl rounded-[calc(0.75rem-1px)] border border-white/5">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-transparent border border-yellow-500/40 text-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
                       <BellRing size={14} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[10px] font-black text-white uppercase tracking-[0.25em] leading-tight">Price Alerts</h2>
                       <span className="text-[7px] font-bold text-white/30 uppercase tracking-widest">Active Monitor</span>
                    </div>
                    <div className="ml-auto hidden sm:flex items-center gap-1.5 opacity-30">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[7px] font-black text-white uppercase tracking-widest">System Online</span>
                    </div>
                  </div>
               </div>

               {/* Push Notification Diagnostics Card */}
               <div className="glossy-card !border-white/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className={`p-2.5 rounded-xl border-2 transition-all ${
                      pushStatus === 'granted' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
                      pushStatus === 'denied' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' :
                      'bg-yellow-500/10 border-yellow-500/40 text-yellow-500'
                    }`}>
                      {pushStatus === 'granted' ? <ShieldCheck size={18} /> : 
                       pushStatus === 'denied' ? <BellOff size={18} /> : 
                       <AlertTriangle size={18} />}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest leading-none mb-1">Push System Status</h4>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${
                        pushStatus === 'granted' ? 'text-emerald-400/80' :
                        pushStatus === 'denied' ? 'text-rose-400/80' :
                        'text-yellow-400/80'
                      }`}>
                        {pushStatus === 'granted' ? (isPushSubscribed ? 'Alerts Optimized' : 'Permission Granted (Unsynced)') :
                         pushStatus === 'denied' ? 'Alerts Blocked by OS' :
                         'Action Required'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {pushStatus === 'default' && (
                      <button 
                        onClick={handleEnsureSubscription}
                        disabled={isPushLoading}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/30 transition-all flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/10"
                      >
                        {isPushLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}
                        Enable Notifications
                      </button>
                    )}
                    {pushStatus === 'granted' && (
                      <button 
                        onClick={handleEnsureSubscription}
                        disabled={isPushLoading}
                        className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/30 transition-all flex items-center justify-center gap-2 shadow-xl ${
                          isPushSubscribed ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/10'
                        }`}
                      >
                        {isPushLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        {isPushSubscribed ? 'Sync Settings' : 'Repair Subscription'}
                      </button>
                    )}
                    {pushStatus === 'denied' && (
                      <div className="flex-1 sm:flex-none px-4 py-2 bg-rose-500/10 border border-rose-500/40 rounded-xl">
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Reset Browser Permissions</span>
                      </div>
                    )}
                  </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
                  {Array.isArray(userAlerts) && userAlerts.map(alert => (
                    <motion.div 
                      key={alert.id || `alert-${alert.ticker}-${alert.target_price}`} 
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`relative overflow-hidden p-[1.5px] rounded-2xl transition-all duration-300 group shadow-lg hover:shadow-pink-500/10 bg-gradient-to-br ${
                        alert.status === 'triggered' 
                        ? 'from-yellow-400 via-yellow-600/40 to-transparent shadow-[0_0_20px_rgba(234,179,8,0.2)]' 
                        : 'from-white/50 via-white/10 to-white/5 hover:from-white/70 hover:via-white/20'
                      }`}
                    >
                      <div className={`relative h-full w-full rounded-[0.9rem] p-4 backdrop-blur-2xl flex flex-col gap-3 ${
                        alert.status === 'triggered' 
                        ? 'bg-black/80' 
                        : 'bg-black/60'
                      }`}>
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
                              alert.status === 'triggered' 
                              ? 'bg-yellow-500/10 border-yellow-400/30 text-yellow-500' 
                              : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                              {alert.status === 'triggered' ? <Zap size={16} strokeWidth={3} fill="currentColor" /> : <Clock size={16} strokeWidth={3} />}
                            </div>
                            <div className="flex flex-col">
                              <h3 className="text-sm font-black text-white tracking-tight uppercase">{alert.ticker}</h3>
                              <span className={`text-[7px] font-black uppercase tracking-widest ${
                                alert.status === 'triggered' ? 'text-yellow-400' : 'text-emerald-400'
                              }`}>
                                {alert.status === 'triggered' ? 'Triggered' : 'Active'}
                              </span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => alert.id && handleDeleteAlert(alert.id)} 
                            className="p-1.5 bg-white/5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-white/5 active:scale-95"
                          >
                            <Trash2 size={12} strokeWidth={2.5} />
                          </button>
                        </div>

                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 flex items-end justify-between relative z-10">
                          <div className="flex flex-col">
                             <div className="flex items-center gap-1 text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">
                               {alert.condition === 'above' ? 'Target Above' : 'Target Below'}
                             </div>
                             <div className="text-2xl font-black text-white tabular-nums tracking-tighter leading-none">
                               {alert.target_price.toFixed(2)}
                             </div>
                          </div>
                          
                          <div className="text-right">
                             <div className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-0.5 justify-end mb-1 ${alert.condition === 'above' ? 'text-emerald-400/70' : 'text-rose-500/70'}`}>
                                {alert.condition === 'above' ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
                                Threshold
                             </div>
                             <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">
                               Notify on breach
                             </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {(!Array.isArray(userAlerts) || userAlerts.length === 0) && (
                    <div className="col-span-full py-16 text-center rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center gap-3">
                      <BellRing size={24} className="text-white/5" strokeWidth={1} />
                      <div className="space-y-0.5">
                        <span className="block text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">No alerts config</span>
                        <p className="text-[7px] text-white/10 uppercase tracking-widest">Select a symbol to start monitoring.</p>
                      </div>
                    </div>
                  )}
               </div>
            </div>
          )}
          <div className="h-12 md:hidden"></div>
        </div>
      </main>
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-[50] h-[64px] glossy-card !bg-black/60 !rounded-2xl border !border-white/30 flex items-center justify-around shadow-2xl px-2">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeView === 'dashboard' ? 'text-pink-500' : 'text-white/40'}`}><LayoutDashboard size={20} strokeWidth={activeView === 'dashboard' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Desk</span></button>
        <button onClick={() => setActiveView('favorites')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeView === 'favorites' ? 'text-pink-500' : 'text-white/40'}`}><Heart size={20} strokeWidth={activeView === 'favorites' ? 3 : 2} fill={activeView === 'favorites' ? 'currentColor' : 'none'} /><span className="text-[8px] font-black uppercase tracking-widest">Watch</span></button>
        <button onClick={() => setActiveView('alerts')} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${activeView === 'alerts' ? 'text-yellow-500' : 'text-white/40'}`}><BellRing size={20} strokeWidth={activeView === 'alerts' ? 3 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">Alerts</span></button>
      </nav>
    </div>
  );
};

export default App;
