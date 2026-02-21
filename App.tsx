
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrendingUp, Activity, Loader2, X, Heart, ArrowUpRight, ArrowDownRight, Search, LayoutDashboard, Flame, Snowflake, Meh, ShieldCheck, Zap, Info, Globe, Cpu, Clock, Calendar, Expand, Minus, Timer, CalendarDays, SeparatorHorizontal, Trash2, Milestone, BellRing, ChevronRight, TrendingDown, CheckCircle2, ShieldAlert, Sparkles, Wand2, RefreshCw, AlertTriangle, BellOff, Smartphone, Briefcase, Plus, Coins, BarChart4, Settings, Check, ZapOff, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStockData, searchStocks } from './services/mockStockData.ts';
import { StockDetails, SentimentAnalysis, DayAction, SearchResult, PricePoint, Alert, PortfolioItem } from './types.ts';
import TerminalChart from './components/TerminalChart.tsx';
import AIIntelligenceModal from './components/AIIntelligenceModal.tsx';
import WatchlistPulseModal from './components/WatchlistPulseModal.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import AdminPanelModal from './components/AdminPanelModal.tsx';
import { getAnonymousId, createAlert, fetchUserAlerts, deleteAlert } from './services/alertService.ts';
import { isPushSupported, getNotificationPermission, requestNotificationPermission, subscribeUser, unsubscribeUser, getPushSubscription } from './services/pushNotificationService.ts';

type View = 'dashboard' | 'favorites' | 'alerts' | 'trade';
type Timeframe = '15m' | '1D';
type DrawingTool = 'horizontal' | 'trend' | null;
type SentimentFilter = 'all' | 'bullish' | 'bearish';

const TIMEFRAMES: Record<Timeframe, { range: string; interval: string }> = {
  '15m': { range: '5d', interval: '15m' },
  '1D': { range: '1y', interval: '1d' }
};

const RECOMMENDED_MODELS = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash', desc: 'Fast & Stable (Recommended)', badge: 'FLASH', icon: Zap },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Elite reasoning core', badge: '3.1-PRO', icon: Sparkles },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Ultra-low latency', badge: '3-FAST', icon: Zap },
  { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', desc: 'Stable reasoning layer', badge: '2.5-PRO', icon: ShieldCheck },
  { id: 'gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', desc: 'Balanced synthesis', badge: '2.5-FAST', icon: Activity },
  { id: 'gemini-2.5-flash-lite-latest', name: 'Flash Lite', desc: 'Minimal footprint', badge: 'LITE', icon: Cpu },
];

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
      <div className="absolute inset-0 bg-grid animate-grid opacity(10)" />
      <div className="absolute inset-0 scanlines opacity-[0.03]" />
    </div>
  );
};

const ModelSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [model, setModel] = useState(localStorage.getItem('stkr_override_model') || '');

  const handleSave = () => {
    if (model.trim()) {
      localStorage.setItem('stkr_override_model', model.trim());
    } else {
      localStorage.removeItem('stkr_override_model');
    }
    onClose();
    window.location.reload(); 
  };

  const handleReset = () => {
    localStorage.removeItem('stkr_override_model');
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm glossy-card !border-white/40 rounded-2xl overflow-hidden p-4">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg text-white"><Settings size={14} strokeWidth={2.5} /></div>
            <div>
              <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Engine Config</h2>
              <p className="text-[7px] font-bold text-white/60 uppercase tracking-widest">Model Override Matrix</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[8px] font-black uppercase text-white/80 tracking-widest block px-1">Logic Layers</label>
            <div className="grid grid-cols-1 gap-1.5 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
              {RECOMMENDED_MODELS.map((m) => {
                const isActive = model === m.id;
                const Icon = m.icon;
                return (
                  <button 
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left group ${isActive ? 'bg-pink-600/20 border-pink-500/60 shadow-lg' : 'bg-white/[0.04] border-white/10 hover:border-white/30'}`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-pink-600 text-white' : 'bg-white/10 text-white/50'}`}>
                      <Icon size={13} strokeWidth={isActive ? 3 : 2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-white/90'}`}>{m.name}</span>
                        <span className={`text-[6px] font-black px-1 rounded uppercase shrink-0 ${isActive ? 'bg-pink-500 text-white' : 'bg-white/20 text-white/70'}`}>{m.badge}</span>
                      </div>
                      <p className={`text-[7px] font-bold truncate mt-0.5 ${isActive ? 'text-pink-300' : 'text-white/50'}`}>{m.desc}</p>
                    </div>
                    {isActive && <Check size={14} className="text-pink-500 shrink-0" strokeWidth={4} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[8px] font-black uppercase text-white/80 tracking-widest block">Custom ID</label>
              {model && !RECOMMENDED_MODELS.find(rm => rm.id === model) && <span className="text-[6px] font-black text-pink-400 uppercase tracking-tighter">Manual Link Active</span>}
            </div>
            <input 
              type="text" 
              placeholder="Enter model string..." 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/30 rounded-lg px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-pink-500/80 transition-all placeholder:text-white/30" 
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button onClick={handleSave} className="flex-1 bg-white text-black py-3 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:bg-white/90 border border-transparent">
              Apply Engine
            </button>
            <button onClick={handleReset} className="px-5 bg-white/10 text-white/80 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 hover:text-white hover:bg-white/20">
              Reset
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AddTradeModal: React.FC<{ onClose: () => void; onAdd: (item: Omit<PortfolioItem, 'id' | 'currentPrice'>) => void }> = ({ onClose, onAdd }) => {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (ticker.length > 0) {
      const delayDebounceFn = setTimeout(async () => {
        setIsSearching(true);
        const res = await searchStocks(ticker);
        const sorted = [...res].sort((a, b) => {
          const aNS = a.symbol.toUpperCase().endsWith('.NS');
          const bNS = b.symbol.toUpperCase().endsWith('.NS');
          if (aNS && !bNS) return -1;
          if (!aNS && bNS) return 1;
          return 0;
        });
        setSearchResults(sorted);
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [ticker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker && quantity && avgPrice) {
      onAdd({
        symbol: ticker.toUpperCase(),
        quantity: parseFloat(quantity),
        avgPrice: parseFloat(avgPrice)
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm glossy-card !border-white/40 rounded-3xl overflow-hidden p-5">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pink-600 rounded-lg text-white"><Plus size={14} strokeWidth={3} /></div>
            <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Add Position</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label className="text-[7px] font-black uppercase text-white/70 tracking-widest mb-1 block">Ticker</label>
            <input 
              type="text" 
              placeholder="e.g. RELIANCE.NS" 
              value={ticker} 
              onChange={(e) => setTicker(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/20 rounded-lg px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-pink-500/80 transition-all uppercase" 
              required
            />
            {searchResults.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-black/95 border border-white/20 rounded-lg max-h-32 overflow-y-auto custom-scrollbar shadow-2xl">
                {searchResults.map(s => (
                  <li 
                    key={s.symbol} 
                    onClick={() => { setTicker(s.symbol); setSearchResults([]); }}
                    className="p-2 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0"
                  >
                    <div className="flex justify-between items-center text-[9px] font-black text-white">
                      <span>{s.symbol}</span>
                      {s.symbol.toUpperCase().endsWith('.NS') && <span className="text-[6px] bg-pink-500/20 text-pink-500 px-1 rounded uppercase tracking-tighter">NSE</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[7px] font-black uppercase text-white/70 tracking-widest block">Qty</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/20 rounded-lg px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-pink-500/80 transition-all tabular-nums" 
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[7px] font-black uppercase text-white/70 tracking-widest block">Avg Price</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={avgPrice} 
                onChange={(e) => setAvgPrice(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/20 rounded-lg px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-pink-500/80 transition-all tabular-nums" 
                required
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-pink-600 hover:bg-pink-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] shadow-lg shadow-pink-600/10 transition-all active:scale-95 border border-white/10 mt-2">
            Confirm Entry
          </button>
        </form>
      </motion.div>
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
              className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wider transition-colors ${condition === 'above' ? 'text-black' : 'text-white/90 hover:text-white'}`}
            >
              Above
            </button>
            <button 
              onClick={() => setCondition('below')} 
              className={`relative z-10 flex-1 py-2 text-[9px] font-black uppercase tracking-wider transition-colors ${condition === 'below' ? 'text-black' : 'text-white/90 hover:text-white'}`}
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
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('stkr_current_user'));
  const [showSplash, setShowSplash] = useState(true);

  // Sync profile to server
  const syncProfile = useCallback(async (username: string, favs: string[], port: PortfolioItem[]) => {
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, favorites: favs, portfolio: port })
      });
    } catch (err) {
      console.error("Failed to sync profile:", err);
    }
  }, []);

  // User-specific storage keys
  const getStorageKey = useCallback((base: string) => {
    return currentUser ? `stkr_${currentUser}_${base}` : `stkr_anon_${base}`;
  }, [currentUser]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (username: string) => {
    setCurrentUser(username);
    localStorage.setItem('stkr_current_user', username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('stkr_current_user');
    setFavorites([]);
    setPortfolio([]);
    setFavoriteStocksDetails([]);
    setStockData(null);
  };
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('1D');
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [clearLinesSignal, setClearLinesSignal] = useState(0);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);

  const [userAlerts, setUserAlerts] = useState<Alert[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

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

  const toggleFavorite = useCallback((ticker: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(ticker);
      const next = isFav ? prev.filter(f => f !== ticker) : [...prev, ticker];
      localStorage.setItem(getStorageKey('favs_v2'), JSON.stringify(next));
      if (currentUser) syncProfile(currentUser, next, portfolio);
      return next;
    });
  }, [getStorageKey, currentUser, syncProfile, portfolio]);

  const isIosAndNotStandalone = useMemo(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true;
    return isIos && !isStandalone;
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const alerts = await fetchUserAlerts();
      setUserAlerts(alerts);
    } catch (e) {
      console.warn("Sync failed:", e);
    }
  }, []);

  const handleAddPortfolioItem = (item: Omit<PortfolioItem, 'id' | 'currentPrice'>) => {
    const newItem: PortfolioItem = {
      ...item,
      id: Date.now().toString(),
    };
    const newPortfolio = [...portfolio, newItem];
    setPortfolio(newPortfolio);
    localStorage.setItem(getStorageKey('portfolio_v1'), JSON.stringify(newPortfolio));
    if (currentUser) syncProfile(currentUser, favorites, newPortfolio);
    refreshPortfolioPrices(newPortfolio);
  };

  const handleRemovePortfolioItem = (id: string) => {
    const newPortfolio = portfolio.filter(p => p.id !== id);
    setPortfolio(newPortfolio);
    localStorage.setItem(getStorageKey('portfolio_v1'), JSON.stringify(newPortfolio));
    if (currentUser) syncProfile(currentUser, favorites, newPortfolio);
  };

  const refreshPortfolioPrices = useCallback(async (currentPortfolio: PortfolioItem[]) => {
    if (currentPortfolio.length === 0) return;
    setIsPortfolioLoading(true);
    try {
      const updated = await Promise.all(currentPortfolio.map(async (p) => {
        const data = await fetchStockData(p.symbol, '1d', '1d');
        return { ...p, currentPrice: data?.info.currentPrice };
      }));
      setPortfolio(updated);
    } catch (e) {
      console.error("Portfolio refresh failed:", e);
    } finally {
      setIsPortfolioLoading(false);
    }
  }, []);

  const portfolioStats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    portfolio.forEach(item => {
      totalInvested += item.quantity * item.avgPrice;
      totalCurrentValue += item.quantity * (item.currentPrice || item.avgPrice);
    });
    return {
      totalInvested,
      totalPL: totalCurrentValue - totalInvested,
      totalPLPercent: totalInvested !== 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0
    };
  }, [portfolio]);

  useEffect(() => {
    const hasActive = userAlerts.some(a => a.status === 'active');
    if (!hasActive && activeView !== 'alerts') return;
    const interval = setInterval(refreshAlerts, 20000);
    return () => clearInterval(interval);
  }, [userAlerts, activeView, refreshAlerts]);

  const handleEnsureSubscription = async () => {
    if (!isPushSupported()) {
      setError("Push Manager is not supported on this device/browser.");
      return false;
    }

    if (isIosAndNotStandalone) {
      setError("iOS Alert Setup: Please 'Add to Home Screen' using the Share button to enable push notifications.");
      return false;
    }
    
    setIsPushLoading(true);
    setError(null);
    try {
      const permission = getNotificationPermission();
      if (permission === 'default') {
        const result = await requestNotificationPermission();
        setPushStatus(result);
        if (result !== 'granted') return false;
      } else if (permission === 'denied') {
        setError("Notifications blocked. Please reset site permissions in your browser settings.");
        return false;
      }
      const success = await subscribeUser();
      setIsPushSubscribed(success);
      return success;
    } catch (e) {
      setError("Handshake Error: Failed to secure push token.");
      return false;
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSaveAlert = async (price: number, condition: 'above' | 'below'): Promise<boolean> => {
    if (!stockData) return false;
    setError(null);
    try {
      // Try to subscribe, but don't block alert creation forever
      let subSuccess = false;
      try {
        const subPromise = handleEnsureSubscription();
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
        subSuccess = await Promise.race([subPromise, timeoutPromise]);
      } catch (e) {
        console.warn("Subscription check failed:", e);
      }

      if (!subSuccess && !isPushSubscribed) {
        console.warn("Saving alert without an active push subscription.");
      }
      
      const success = await createAlert({
        ticker: stockData.info.ticker,
        target_price: price,
        condition: condition
      });
      if (success) {
        await refreshAlerts();
        setIsAlertModalOpen(false);
        return true;
      } else {
        setError("Unable to save alert. Check connection.");
        return false;
      }
    } catch (err) {
      setError("An unexpected error occurred.");
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
    if (!currentUser) return;

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/user/profile?username=${currentUser}`);
        if (response.ok) {
          const data = await response.json();
          setFavorites(data.favorites);
          setPortfolio(data.portfolio);
          refreshPortfolioPrices(data.portfolio);
          
          // Also update local storage for offline/fallback
          localStorage.setItem(getStorageKey('favs_v2'), JSON.stringify(data.favorites));
          localStorage.setItem(getStorageKey('portfolio_v1'), JSON.stringify(data.portfolio));
        } else {
          // Fallback to local storage if server fails
          const storedFavs = localStorage.getItem(getStorageKey('favs_v2'));
          if (storedFavs) setFavorites(JSON.parse(storedFavs));
          else setFavorites([]);
          
          const storedPortfolio = localStorage.getItem(getStorageKey('portfolio_v1'));
          if (storedPortfolio) {
            const parsed = JSON.parse(storedPortfolio);
            setPortfolio(parsed);
            refreshPortfolioPrices(parsed);
          } else {
            setPortfolio([]);
          }
        }
      } catch (err) {
        console.error("Profile load failed:", err);
      }
    };

    loadProfile();
    getAnonymousId();
    refreshAlerts();
    
    if (isPushSupported()) {
      const perm = getNotificationPermission();
      setPushStatus(perm);
      getPushSubscription().then(sub => {
        setIsPushSubscribed(!!sub);
        if (perm === 'granted' && !sub && !isIosAndNotStandalone) {
          subscribeUser().then(success => setIsPushSubscribed(success));
        }
      });
    }

    handleSelectAndSearch('AAPL');
  }, [handleSelectAndSearch, isIosAndNotStandalone, refreshAlerts, currentUser, getStorageKey]);

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
    if (activeView === 'trade') {
      refreshPortfolioPrices(portfolio);
    }
  }, [activeView, favorites]);

  const activeAlertForCurrent = useMemo(() => {
    if (!stockData || !Array.isArray(userAlerts)) return null;
    return userAlerts.find(a => a.ticker === stockData.info.ticker && a.status === 'active');
  }, [userAlerts, stockData]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#010203] relative overflow-hidden text-[10px]">
      <AnimatedMarketBackground />
      
      <AnimatePresence>
        {showSplash && <SplashScreen />}
        {!showSplash && !currentUser && <LoginScreen onLogin={handleLogin} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSentiment && <SentimentDetailModal ticker={selectedSentiment.ticker} analysis={selectedSentiment.analysis} onClose={() => setSelectedSentiment(null)} />}
        {isAlertModalOpen && stockData && <AlertModal ticker={stockData.info.ticker} currentPrice={stockData.info.currentPrice} onClose={() => setIsAlertModalOpen(false)} onSave={handleSaveAlert} />}
        {isAddTradeModalOpen && <AddTradeModal onClose={() => setIsAddTradeModalOpen(false)} onAdd={handleAddPortfolioItem} />}
        {isModelSettingsOpen && <ModelSettingsModal onClose={() => setIsModelSettingsOpen(false)} />}
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
        {isAdminModalOpen && currentUser === 'admin' && (
          <AdminPanelModal 
            adminUsername={currentUser} 
            onClose={() => setIsAdminModalOpen(false)} 
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
        <div className="p-4 flex justify-center">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModelSettingsOpen(true)}
            className="bg-pink-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xl border border-white/40 cursor-pointer"
          >
            <TrendingUp size={20} strokeWidth={4} />
          </motion.button>
        </div>
        <nav className="flex-1 px-2 space-y-4 mt-6">
          <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'dashboard' ? 'bg-white/15 text-white border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><LayoutDashboard size={20} /></button>
          <button onClick={() => setActiveView('trade')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'trade' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><Briefcase size={20} /></button>
          <button onClick={() => setActiveView('favorites')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'favorites' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><Heart size={20} /></button>
          <button onClick={() => setActiveView('alerts')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'alerts' ? 'bg-white/15 text-yellow-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`}><BellRing size={20} /></button>
          {currentUser === 'admin' && (
            <button onClick={() => setIsAdminModalOpen(true)} className="w-full flex items-center justify-center p-3.5 rounded-2xl transition-all text-pink-500 hover:bg-pink-500/10 border border-transparent hover:border-pink-500/20 shadow-md"><Shield size={20} strokeWidth={2.5} /></button>
          )}
        </nav>
        <div className="p-4 mb-2 flex flex-col items-center gap-4">
        </div>
      </aside>

      <main className="flex-1 h-full overflow-y-auto custom-scrollbar pb-32 md:pb-6 p-3 md:p-6 relative z-10 bg-black/10">
        <div className="max-w-6xl mx-auto space-y-2.5">
          <header className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative p-[1.5px] rounded-xl overflow-hidden w-full mb-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(236,72,153,0.1)_90deg,rgba(236,72,153,0.8)_180deg,rgba(236,72,153,0.1)_270deg,transparent_360deg)] opacity-60"
                />
                <div className="relative flex items-center justify-between gap-4 px-4 py-2 bg-black/80 backdrop-blur-2xl rounded-[calc(0.75rem-1px)] border border-white/10">
                  <div className="flex items-center gap-4">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsModelSettingsOpen(true)}
                      className="p-2 rounded-lg bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] border border-white/20 cursor-pointer"
                    >
                       <TrendingUp size={16} strokeWidth={4} />
                    </motion.button>
                    <div className="flex flex-col">
                       <h1 className="text-sm font-black text-white uppercase tracking-[0.3em] leading-tight">Stocker</h1>
                       <span className="text-[8px] font-bold text-white/40 uppercase tracking-[0.4em]">{currentUser}'s Terminal</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="p-2 text-rose-500/60 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-lg border border-rose-500/20"
                    title="Logout Session"
                  >
                    <ZapOff size={16} />
                  </button>
                </div>
            </div>
            {activeView === 'dashboard' && (
              <div className="w-full max-sm relative group" onFocus={() => setIsSearchFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsSearchFocused(false); }}>
                <form className="relative" onSubmit={(e) => { e.preventDefault(); handleSelectAndSearch(searchResults.length > 0 ? searchResults[0].symbol : searchTerm); }}>
                  <input type="text" placeholder="Search symbol..." className="w-full bg-white/[0.08] border border-white/40 rounded-xl py-3 pl-5 pr-12 text-[12px] font-bold text-white placeholder-white/30 focus:outline-none focus:border-pink-500/80 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <button type="submit" className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/80 hover:text-pink-500 transition-colors duration-200"><motion.div animate={{ y: [0, -2, 0], scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}><TrendingUp size={16} strokeWidth={3} /></motion.div></button>
                </form>
                <AnimatePresence>{isSearchFocused && searchResults.length > 0 && (<motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full mt-2 w-full glossy-card !border-white/40 rounded-xl overflow-hidden z-50 p-1">{searchResults.map((result) => (<li key={result.symbol} onMouseDown={() => handleSelectAndSearch(result.symbol)} className="p-3 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"><div className="flex items-center justify-between"><span className="text-[11px] font-black text-white uppercase">{result.symbol}</span><span className="text-[9px] font-bold text-white/50 px-2 py-0.5 bg-white/5 rounded">{result.exchange}</span></div><p className="text-[10px] text-white/70 mt-1 truncate">{result.name}</p></li>))}</motion.ul>)}</AnimatePresence>
              </div>
            )}
          </header>

          {error && (<div className="px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px] font-black rounded-lg flex justify-between items-center animate-in slide-in-from-top-2 duration-300"><div className="flex items-center gap-2"><Info size={12} /><span>{error}</span></div><button onClick={() => setError(null)} className="p-1 hover:bg-rose-500/20 rounded-md"><X size={14} /></button></div>)}

          {loading ? (
            <div className="py-24 flex flex-col items-center gap-4"><div className="relative"><Loader2 className="animate-spin text-pink-500" size={32} strokeWidth={4} /><div className="absolute inset-0 blur-lg bg-pink-500/20 animate-pulse" /></div><span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] animate-pulse">Syncing Market Engine</span></div>
          ) : stockData && activeView === 'dashboard' ? (
            <div className="space-y-4 animate-in fade-in duration-500">
              <section className="glossy-card !border-white/40 p-4 md:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-pink-600/5 blur-[80px] pointer-events-none" />
                <div className="space-y-2 relative z-10 w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-start gap-2.5">
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">{stockData.info.ticker.split('.')[0]}</h2>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleFavorite(stockData.info.ticker)} className={`p-2 rounded-lg border-2 transition-all ${favorites.includes(stockData.info.ticker) ? 'bg-pink-600 border-pink-400 text-white shadow-lg' : 'border-white/20 text-white/50 hover:text-white'}`}><Heart size={10} fill={favorites.includes(stockData.info.ticker) ? "currentColor" : "none"} strokeWidth={3} /></button>
                      <button onClick={() => setIsAlertModalOpen(true)} className={`p-2 rounded-lg border-2 transition-all ${activeAlertForCurrent ? 'bg-yellow-500 border-yellow-300 text-black shadow-lg' : 'border-white/20 text-white/50 hover:text-white'}`}>{activeAlertForCurrent ? <BellRing size={10} strokeWidth={3} className="animate-pulse" /> : <BellRing size={10} strokeWidth={3} />}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><div className="w-6 h-[1.5px] bg-pink-600 rounded-full" /><p className="text-[9px] text-white/70 font-black uppercase tracking-[0.15em] italic truncate max-w-[150px] md:max-w-none">{stockData.info.name}</p></div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-3 relative z-10 w-full md:w-auto">
                   <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                      <span className="text-3xl md:text-4xl font-black text-white tabular-nums tracking-tighter leading-none">{stockData.info.currentPrice.toFixed(2)}</span>
                      <div className="flex flex-col items-center gap-1.5">
                        <SentimentIndicator analysis={stockData.info.sentiment} size="sm" onClick={() => setSelectedSentiment({ ticker: stockData.info.ticker.split('.')[0], analysis: stockData.info.sentiment })} />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsAIModalOpen(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500 text-white border border-white/30 shadow-md shadow-pink-500/10"
                        >
                          <Sparkles size={10} fill="white" className="animate-pulse" />
                          <span className="text-[7px] font-black uppercase tracking-widest">Analyst</span>
                        </motion.button>
                      </div>
                   </div>
                   <div className={`text-[10px] font-black tabular-nums px-3 py-1 rounded-lg border-2 self-start md:self-auto ${stockData.info.change >= 0 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-500 border-rose-500/30 bg-rose-500/10'}`}>{stockData.info.change >= 0 ? '+' : ''}{Math.abs(stockData.info.change).toFixed(2)} ({stockData.info.changePercent.toFixed(2)}%)</div>
                </div>
              </section>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                <div className="lg:col-span-3 h-[380px] w-full glossy-card !border-white/40 p-0.5 rounded-xl relative group shadow-xl bg-black/20 overflow-hidden">{dailyHistory && <TerminalChart ticker={stockData.info.ticker} data={dailyHistory.slice(-20)} isModal={false} />}<button onClick={() => setIsChartModalOpen(true)} className="absolute top-3 right-3 z-10 p-2.5 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md text-white/60 hover:text-white hover:bg-pink-600 transition-all opacity-0 group-hover:opacity-100"><Expand size={14} /></button></div>
                <div className="lg:col-span-1"><PriceActionTable data={stockData.dailyAction} /></div>
              </div>
            </div>
          ) : activeView === 'trade' ? (
            <div className="space-y-4 animate-in fade-in duration-500">
               <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-pink-600/20 text-pink-500 rounded-lg border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)]"><Briefcase size={16} strokeWidth={3} /></div>
                    <div className="flex flex-col">
                      <h2 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">PORTFOLIO</h2>
                      <span className="text-[7px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">Real-time valuation</span>
                    </div>
                  </div>
                  <button onClick={() => setIsAddTradeModalOpen(true)} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[8px] font-black uppercase tracking-[0.15em] shadow-lg border border-white/20 transition-all flex items-center gap-1.5 active:scale-95">
                    <Plus size={12} strokeWidth={3} />
                    ADD POISTION
                  </button>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="glossy-card !border-white/30 p-3.5 rounded-xl flex flex-col gap-0.5 shadow-lg relative overflow-hidden group border-white/10">
                    <span className="text-[7px] font-black text-white/60 uppercase tracking-widest">Invested Value</span>
                    <div className="text-[16px] font-black text-white tabular-nums tracking-tighter">
                      {portfolioStats.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={`glossy-card !border-white/30 p-3.5 rounded-xl flex flex-col gap-0.5 shadow-lg relative overflow-hidden group ${portfolioStats.totalPL >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[7px] font-black text-white/60 uppercase tracking-widest">Total P/L</span>
                      <span className={`text-[7px] font-black px-1 rounded-sm border ${portfolioStats.totalPL >= 0 ? 'text-emerald-400 border-emerald-400/40' : 'text-rose-400 border-rose-400/40'}`}>
                        {portfolioStats.totalPL >= 0 ? '+' : ''}{portfolioStats.totalPLPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className={`text-[16px] font-black tabular-nums tracking-tighter ${portfolioStats.totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {portfolioStats.totalPL >= 0 ? '+' : '-'}{Math.abs(portfolioStats.totalPL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
               </div>

               <div className="glossy-card !border-white/30 rounded-xl overflow-hidden shadow-xl bg-black/40">
                  <div className="px-3 py-2 border-b border-white/10 bg-white/[0.04] flex items-center justify-between">
                    <h3 className="text-[8px] font-black text-white/70 uppercase tracking-widest">HOLDINGS</h3>
                    {isPortfolioLoading && <Loader2 size={10} className="animate-spin text-pink-500" />}
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[420px]">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/20">
                          <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest border-r border-white/10">STOCK</th>
                          <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Quantity</th>
                          <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Avg Cost</th>
                          <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Mkt Price</th>
                          <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">P/L</th>
                          <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-center">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {portfolio.map(item => {
                          const pl = item.currentPrice ? (item.currentPrice - item.avgPrice) * item.quantity : 0;
                          const plPerc = (pl / (item.avgPrice * item.quantity)) * 100;
                          return (
                            <tr key={item.id} className="hover:bg-white/[0.04] transition-colors group">
                              <td className="px-3 py-3 border-r border-white/10" onClick={() => handleSelectAndSearch(item.symbol)}>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black text-white uppercase group-hover:text-pink-500 transition-colors tracking-tight">{item.symbol}</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-right font-bold text-white/90 tabular-nums text-[10px] border-r border-white/10">{item.quantity}</td>
                              <td className="px-2 py-3 text-right font-medium text-white/50 tabular-nums text-[10px] border-r border-white/10">{item.avgPrice.toFixed(2)}</td>
                              <td className="px-2 py-3 text-right font-black text-white tabular-nums text-[10px] border-r border-white/10">{item.currentPrice?.toFixed(2) || '---'}</td>
                              <td className="px-2 py-3 text-right border-r border-white/10">
                                <div className={`flex flex-col items-end ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  <span className="text-[10px] font-black tabular-nums">{pl >= 0 ? '+' : ''}{pl.toFixed(2)}</span>
                                  <span className="text-[6px] font-bold opacity-70 uppercase tracking-tighter">{plPerc.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button onClick={() => handleRemovePortfolioItem(item.id)} className="p-1.5 rounded-md text-white/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20">
                                  <Trash2 size={12} strokeWidth={2.5} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {portfolio.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-16 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Activity size={24} className="text-white/20" />
                                <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">No active positions tracked</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          ) : activeView === 'favorites' ? (
            <div className="space-y-3.5 animate-in fade-in duration-500">
               <div className="relative p-[1px] rounded-xl overflow-hidden w-full mb-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(236,72,153,0.1)_90deg,rgba(236,72,153,0.6)_180deg,rgba(236,72,153,0.1)_270deg,transparent_360deg)] opacity-40"
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2 bg-black/80 backdrop-blur-xl rounded-[calc(0.75rem-1px)] border border-white/5">
                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500 shadow-sm border border-pink-500/20">
                       <Heart size={12} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-tight">Watchlist</h2>
                       <span className="text-[6px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Market Monitors</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                       <motion.button
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         onClick={() => setIsPulseModalOpen(true)}
                         disabled={favorites.length === 0}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-500 text-white border border-white/20 shadow-md ${favorites.length === 0 ? 'opacity-40' : ''}`}
                       >
                         <Wand2 size={10} fill="white" className="animate-pulse" />
                         <span className="text-[7px] font-black uppercase tracking-widest">Pulse Scan</span>
                       </motion.button>
                    </div>
                  </div>
               </div>

               <div className="flex items-center p-0.5 bg-white/[0.02] border border-white/20 rounded-xl max-w-2xl">
                  <div className="relative flex-1 group min-w-0"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-pink-500" size={10} /><input type="text" placeholder="Filter favorites..." className="w-full bg-transparent py-2 pl-8 pr-3 text-[9px] font-black uppercase tracking-wider text-white placeholder-white/20 focus:outline-none" value={favSearchTerm} onChange={(e) => setFavSearchTerm(e.target.value)} /></div>
                  <div className="w-[1px] h-3 bg-white/10 mx-1" />
                  <div className="flex items-center gap-0.5 shrink-0">{(['all', 'bullish', 'bearish'] as const).map((mode) => (<button key={mode} onClick={() => setFavFilter(mode)} className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${favFilter === mode ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white/60'}`}>{mode === 'bullish' && <Flame size={8} />}{mode === 'bearish' && <Snowflake size={8} />}<span>{mode}</span></button>))}</div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {filteredFavorites.map((fav) => (<div key={fav.info.ticker} className="relative p-3 rounded-xl overflow-hidden transition-all cursor-pointer group shadow-lg active:scale-[0.98] border border-white/20 bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent backdrop-blur-md" onClick={() => handleSelectAndSearch(fav.info.ticker)}><div className="relative z-10 flex flex-col gap-0.5"><div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-black text-white group-hover:text-pink-500 transition-colors uppercase tracking-tight truncate">{fav.info.ticker.split('.')[0]}</h3><SentimentIndicator analysis={fav.info.sentiment} size="sm" onClick={() => setSelectedSentiment({ ticker: fav.info.ticker.split('.')[0], analysis: fav.info.sentiment })} /></div><div className="relative flex items-center justify-between gap-1.5 border-t border-white/5 pt-2 mt-1.5"><span className="text-[13px] font-black text-white tabular-nums tracking-tighter">{fav.info.currentPrice.toFixed(2)}</span><div className={`text-[8px] font-black px-1 rounded border ${fav.info.change >= 0 ? 'text-emerald-400 border-emerald-400/20 bg-emerald-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'}`}>{fav.info.changePercent.toFixed(1)}%</div></div></div></div>))}
               </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
               <div className="relative p-[1px] rounded-xl overflow-hidden w-full mb-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.1)_90deg,rgba(234,179,8,0.6)_180deg,rgba(234,179,8,0.1)_270deg,transparent_360deg)] opacity-40"
                  />
                  <div className="relative flex items-center gap-3 px-3 py-2 bg-black/80 backdrop-blur-xl rounded-[calc(0.75rem-1px)] border border-white/5">
                    <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-sm">
                       <BellRing size={12} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-tight">Price Alerts</h2>
                       <span className="text-[6px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Active Thresholds</span>
                    </div>
                  </div>
               </div>

               {isIosAndNotStandalone && (
                 <div className="p-3 bg-pink-600/10 border border-pink-500/30 rounded-xl flex items-start gap-3 shadow-md">
                   <Smartphone size={14} className="text-pink-500 shrink-0 mt-0.5" />
                   <p className="text-[8px] text-white/80 leading-relaxed font-bold uppercase tracking-wider">
                     Enable Notifications: Tap <span className="text-white underline">Share</span> then <span className="text-white underline">"Add to Home Screen"</span>.
                   </p>
                 </div>
               )}

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {Array.isArray(userAlerts) && userAlerts.map(alert => (
                    <motion.div 
                      key={alert.id || `alert-${alert.ticker}-${alert.target_price}`} 
                      className={`relative overflow-hidden p-[1px] rounded-xl transition-all bg-gradient-to-br ${alert.status === 'triggered' ? 'from-yellow-400/60 via-yellow-600/20 to-transparent' : 'from-white/20 via-white/5 to-transparent'}`}
                    >
                      <div className={`relative h-full w-full rounded-[0.65rem] p-3 bg-black/80 backdrop-blur-xl flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${alert.status === 'triggered' ? 'bg-yellow-500/10 border-yellow-400/30 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                              {alert.status === 'triggered' ? <Zap size={12} fill="currentColor" /> : <Clock size={12} />}
                            </div>
                            <div className="flex flex-col">
                              <h3 className="text-[10px] font-black text-white tracking-tight uppercase">{alert.ticker}</h3>
                              <span className={`text-[6px] font-black uppercase tracking-widest ${alert.status === 'triggered' ? 'text-yellow-400' : 'text-emerald-400/80'}`}>{alert.status === 'triggered' ? 'Target Met' : 'Active'}</span>
                            </div>
                          </div>
                          <button onClick={() => alert.id && handleDeleteAlert(alert.id)} className="p-1 text-white/30 hover:text-rose-500 hover:bg-rose-500/5 transition-all"><Trash2 size={12} /></button>
                        </div>
                        <div className="bg-white/[0.02] border border-white/10 rounded-lg p-2 flex items-center justify-between">
                          <span className="text-[7px] font-black text-white/80 uppercase tracking-widest">{alert.condition === 'above' ? 'Above' : 'Below'}</span>
                          <span className="text-[14px] font-black text-white tabular-nums tracking-tighter">{alert.target_price.toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
               </div>
            </div>
          )}
          <div className="h-12 md:hidden"></div>
        </div>
      </main>
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-[50] h-[58px] glossy-card !bg-black/70 !rounded-2xl border !border-white/30 flex items-center justify-around shadow-2xl px-2">
        <button onClick={() => setActiveView('dashboard')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'dashboard' ? 'text-pink-500' : 'text-white/40'}`}><LayoutDashboard size={18} strokeWidth={activeView === 'dashboard' ? 3 : 2} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Desk</span></button>
        <button onClick={() => setActiveView('trade')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'trade' ? 'text-pink-500' : 'text-white/40'}`}><Briefcase size={18} strokeWidth={activeView === 'trade' ? 3 : 2} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Trade</span></button>
        <button onClick={() => setActiveView('favorites')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'favorites' ? 'text-pink-500' : 'text-white/40'}`}><Heart size={18} strokeWidth={activeView === 'favorites' ? 3 : 2} fill={activeView === 'favorites' ? 'currentColor' : 'none'} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Watch</span></button>
        <button onClick={() => setActiveView('alerts')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'alerts' ? 'text-yellow-500' : 'text-white/40'}`}><BellRing size={18} strokeWidth={activeView === 'alerts' ? 3 : 2} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Alerts</span></button>
        {currentUser === 'admin' && (
          <button onClick={() => setIsAdminModalOpen(true)} className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-pink-500"><Shield size={18} strokeWidth={3} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Admin</span></button>
        )}
      </nav>
    </div>
  );
};

export default App;
