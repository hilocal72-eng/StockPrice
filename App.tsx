
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import OneSignal from 'react-onesignal';
import { TrendingUp, Activity, Loader2, X, Heart, ArrowUpRight, ArrowDownRight, Search, LayoutDashboard, Flame, Snowflake, Meh, ShieldCheck, Zap, Info, Globe, Cpu, Clock, Calendar, Expand, Minus, Timer, CalendarDays, SeparatorHorizontal, Trash2, Milestone, BellRing, ChevronRight, TrendingDown, CheckCircle2, ShieldAlert, Sparkles, Wand2, RefreshCw, AlertTriangle, BellOff, Smartphone, Briefcase, Plus, Coins, BarChart4, Settings, Check, ZapOff, Shield, AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStockData, searchStocks } from './services/mockStockData.ts';
import { StockDetails, SentimentAnalysis, DayAction, SearchResult, PricePoint, Alert, PortfolioItem, TradingMode, ZerodhaHolding, ZerodhaPosition, ZerodhaProfile } from './types.ts';
import TerminalChart from './components/TerminalChart.tsx';
import AIIntelligenceModal from './components/AIIntelligenceModal.tsx';
import WatchlistPulseModal from './components/WatchlistPulseModal.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import AdminPanelModal from './components/AdminPanelModal.tsx';
import { getAnonymousId, createAlert, fetchUserAlerts, deleteAlert } from './services/alertService.ts';

type View = 'dashboard' | 'favorites' | 'trade' | 'z';
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

let toastCount = 0;
export const toast = {
  success: (msg: string) => window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: ++toastCount, type: 'success', message: msg } })),
  error: (msg: string) => window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: ++toastCount, type: 'error', message: msg } })),
  info: (msg: string) => window.dispatchEvent(new CustomEvent('stkr-toast', { detail: { id: ++toastCount, type: 'info', message: msg } })),
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState<any[]>([]);
  useEffect(() => {
    const handleToast = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('stkr-toast', handleToast);
    return () => window.removeEventListener('stkr-toast', handleToast);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-xl ${t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : t.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 'bg-blue-500/20 border-blue-500/50 text-blue-400'}`}>
            {t.type === 'success' ? <CheckCircle2 size={16} /> : t.type === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            <span className="text-[10px] font-black uppercase tracking-widest">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
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

const BrokerSettingsModal: React.FC<{ 
  onClose: () => void; 
  status: { connected: boolean; broker?: string; last_sync?: string }; 
  onConnect: () => void; 
  onDisconnect: () => void;
  onSync: () => void;
  isSyncing?: boolean;
}> = ({ onClose, status, onConnect, onDisconnect, onSync, isSyncing }) => {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm glossy-card !border-white/40 rounded-2xl overflow-hidden p-4">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg text-white"><Briefcase size={14} strokeWidth={2.5} /></div>
            <div>
              <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Zerodha</h2>
              <p className="text-[7px] font-bold text-white/60 uppercase tracking-widest">Live Execution Layer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="space-y-5">
          {status.connected && status.broker === 'zerodha' ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                  <Zap size={20} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-white uppercase tracking-wider">Zerodha Kite</h3>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Connected</p>
                </div>
              </div>
              <button onClick={onDisconnect} className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all" title="Disconnect">
                <ZapOff size={16} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30">
                    <Zap size={16} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-wider">Zerodha Kite</h3>
                    <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Direct API Integration</p>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-widest bg-white/5 border-white/10 text-white/30">
                  Offline
                </div>
              </div>
              <button onClick={onConnect} className="w-full py-2.5 rounded-lg bg-white text-black text-[9px] font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl">
                Connect Zerodha
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
            <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[8px] font-medium text-blue-400/70 leading-relaxed">
              Live trading requires a valid Kite Connect API subscription. Your credentials are encrypted and never stored in plain text.
            </p>
          </div>

          <button onClick={onClose} className="w-full py-3 rounded-lg bg-white/5 text-white/60 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10">
            Close Matrix
          </button>
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

const ZerodhaTradeModal: React.FC<{ onClose: () => void; currentUser: string; onSuccess: () => void; availableFunds: number | null }> = ({ onClose, currentUser, onSuccess, availableFunds }) => {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transactionType, setTransactionType] = useState('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [product, setProduct] = useState('CNC');
  const [price, setPrice] = useState('');
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const debounceTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (ticker.trim() && isSearchFocused) {
      debounceTimeout.current = window.setTimeout(async () => {
        const results = await searchStocks(ticker);
        setSearchResults(results);
      }, 300);
    } else {
      setSearchResults([]);
    }
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [ticker, isSearchFocused]);

  useEffect(() => {
    const fetchPrice = async () => {
      if (ticker && ticker.length >= 2) {
        setIsLoadingPrice(true);
        try {
          const data = await fetchStockData(ticker);
          if (data) {
            setCurrentMarketPrice(data.info.currentPrice);
            // Auto-fill price if it's a limit order and price is empty
            if (orderType === 'LIMIT' && !price) {
              setPrice(data.info.currentPrice.toString());
            }
          } else {
            setCurrentMarketPrice(null);
          }
        } catch (e) {
          setCurrentMarketPrice(null);
        } finally {
          setIsLoadingPrice(false);
        }
      } else {
        setCurrentMarketPrice(null);
      }
    };

    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [ticker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/broker/zerodha/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          ticker: ticker.toUpperCase(),
          quantity: parseInt(quantity, 10),
          transaction_type: transactionType,
          order_type: orderType,
          product: product,
          price: orderType === 'LIMIT' ? parseFloat(price) : 0
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success('Order placed successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(`Order failed: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-teal-950/80 backdrop-blur-xl border border-teal-500/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(20,184,166,0.2)]">
        <div className={`absolute top-0 left-0 w-full h-1 ${transactionType === 'BUY' ? 'bg-teal-400' : 'bg-rose-400'} transition-colors duration-300`} />
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[80px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-600/10 blur-[60px] pointer-events-none rounded-full" />

        <div className="p-6 relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl flex items-center justify-center transition-colors duration-300 ${transactionType === 'BUY' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-inner' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-inner'}`}>
                <Zap size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-teal-50 tracking-tight">Live Order</h2>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-medium text-teal-200/60 uppercase tracking-widest">Zerodha Integration</p>
                  <span className="w-1 h-1 rounded-full bg-teal-500/40" />
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
                    {availableFunds !== null ? `Funds: ₹${availableFunds.toLocaleString('en-IN')}` : 'Loading Funds...'}
                  </p>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-teal-800/50 text-teal-200/50 hover:text-teal-100 transition-colors border border-transparent hover:border-teal-500/30"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex p-1 bg-teal-900/40 rounded-xl border border-teal-500/20 shadow-inner">
              <button type="button" onClick={() => setTransactionType('BUY')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${transactionType === 'BUY' ? 'bg-gradient-to-b from-teal-400 to-teal-600 text-white shadow-[0_4px_15px_rgba(20,184,166,0.4)] border border-teal-300/50' : 'text-teal-200/50 hover:text-teal-100'}`}>BUY</button>
              <button type="button" onClick={() => setTransactionType('SELL')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${transactionType === 'SELL' ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_4px_15px_rgba(244,63,94,0.4)] border border-rose-300/50' : 'text-teal-200/50 hover:text-teal-100'}`}>SELL</button>
            </div>

            <div className="relative z-50">
              <div className="flex justify-between items-end mb-1.5">
                <label className="text-[10px] font-bold uppercase text-teal-200/70 tracking-widest block">Trading Symbol</label>
                {currentMarketPrice !== null && (
                  <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                    <span className="text-[8px] font-bold text-teal-200/40 uppercase tracking-widest">LTP:</span>
                    <span className="text-[10px] font-black text-teal-400 tabular-nums">₹{currentMarketPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {isLoadingPrice && (
                  <Loader2 size={10} className="animate-spin text-teal-500/50 mb-0.5" />
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-200/50" size={14} />
                <input 
                  type="text" 
                  placeholder="Search stock (e.g. RELIANCE)" 
                  value={ticker} 
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="w-full bg-teal-900/30 backdrop-blur-md border border-teal-500/30 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-teal-50 focus:outline-none focus:border-teal-400 focus:bg-teal-800/50 transition-all uppercase placeholder-teal-200/30 shadow-inner" 
                  required
                  autoComplete="off"
                />
              </div>
              
              <AnimatePresence>
                {isSearchFocused && searchResults.length > 0 && (
                  <motion.ul 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -5 }} 
                    className="absolute top-full left-0 right-0 mt-2 bg-teal-950 border border-teal-500/30 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] max-h-48 overflow-y-auto custom-scrollbar backdrop-blur-xl"
                  >
                    {searchResults.map((result) => (
                      <li 
                        key={result.symbol} 
                        onMouseDown={() => {
                          setTicker(result.symbol);
                          setSearchResults([]);
                          setIsSearchFocused(false);
                        }} 
                        className="px-4 py-3 hover:bg-teal-800/50 cursor-pointer transition-colors border-b border-teal-500/10 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-50 uppercase">{result.symbol}</span>
                          <span className="text-[9px] font-bold text-teal-200/60 px-2 py-0.5 bg-teal-900/50 rounded uppercase tracking-wider border border-teal-500/20">{result.exchange}</span>
                        </div>
                        <p className="text-[10px] text-teal-200/50 mt-0.5 truncate">{result.name}</p>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-teal-200/70 tracking-widest block">Product</label>
                <div className="relative">
                  <select value={product} onChange={(e) => setProduct(e.target.value)} className="w-full appearance-none bg-teal-900/30 backdrop-blur-md border border-teal-500/30 rounded-xl px-4 py-3 text-sm font-bold text-teal-50 focus:outline-none focus:border-teal-400 focus:bg-teal-800/50 transition-all shadow-inner [&>option]:bg-teal-950">
                    <option value="CNC">CNC (Long term)</option>
                    <option value="MIS">MIS (Intraday)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-teal-200/50">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-teal-200/70 tracking-widest block">Order Type</label>
                <div className="relative">
                  <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full appearance-none bg-teal-900/30 backdrop-blur-md border border-teal-500/30 rounded-xl px-4 py-3 text-sm font-bold text-teal-50 focus:outline-none focus:border-teal-400 focus:bg-teal-800/50 transition-all shadow-inner [&>option]:bg-teal-950">
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-teal-200/50">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-teal-200/70 tracking-widest block">Quantity</label>
                <input 
                  type="number" 
                  min="1"
                  placeholder="1" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-teal-900/30 backdrop-blur-md border border-teal-500/30 rounded-xl px-4 py-3 text-sm font-bold text-teal-50 focus:outline-none focus:border-teal-400 focus:bg-teal-800/50 transition-all tabular-nums placeholder-teal-200/30 shadow-inner" 
                  required
                />
              </div>
              <div className={`space-y-1.5 transition-opacity duration-300 ${orderType === 'LIMIT' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <label className="text-[10px] font-bold uppercase text-teal-200/70 tracking-widest block">Price</label>
                <input 
                  type="number" 
                  step="0.05" 
                  placeholder="0.00" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-teal-900/30 backdrop-blur-md border border-teal-500/30 rounded-xl px-4 py-3 text-sm font-bold text-teal-50 focus:outline-none focus:border-teal-400 focus:bg-teal-800/50 transition-all tabular-nums placeholder-teal-200/30 shadow-inner" 
                  required={orderType === 'LIMIT'}
                  disabled={orderType !== 'LIMIT'}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-all active:scale-[0.98] mt-4 disabled:opacity-50 flex items-center justify-center gap-2 ${
                transactionType === 'BUY' 
                  ? 'bg-gradient-to-b from-teal-400 to-teal-600 hover:from-teal-300 hover:to-teal-500 text-white shadow-[0_4px_20px_rgba(20,184,166,0.5)] border border-teal-300/50' 
                  : 'bg-gradient-to-b from-rose-400 to-rose-600 hover:from-rose-300 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(244,63,94,0.5)] border border-rose-300/50'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Place {transactionType} Order</span>
              )}
            </button>
          </form>
        </div>
      </motion.div>
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
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [tradingMode, setTradingMode] = useState<TradingMode>((localStorage.getItem('stkr_trading_mode') as TradingMode) || 'paper');
  const [brokerStatus, setBrokerStatus] = useState<{ connected: boolean; broker?: string; last_sync?: string }>({ connected: false });
  const [zerodhaHoldings, setZerodhaHoldings] = useState<ZerodhaHolding[]>([]);
  const [zerodhaPositions, setZerodhaPositions] = useState<ZerodhaPosition[]>([]);
  const [zerodhaOrders, setZerodhaOrders] = useState<any[]>([]);
  const [zerodhaMargins, setZerodhaMargins] = useState<any | null>(null);
  const [isBrokerLoading, setIsBrokerLoading] = useState(false);
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

  useEffect(() => {
    const initOneSignal = async () => {
      try {
        const appId = (import.meta as any).env.VITE_ONESIGNAL_APP_ID || "10b11bf1-fcf6-44a9-abc8-2ec961abdf40";
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js'
        });
        
        if (currentUser) {
          await OneSignal.login(currentUser);
        }
      } catch (e) {
        console.error("OneSignal init failed:", e);
      }
    };
    initOneSignal();
  }, [currentUser]);

  const handleLogin = (username: string) => {
    setCurrentUser(username);
    localStorage.setItem('stkr_current_user', username);
    OneSignal.login(username).catch(console.error);
  };

  const handleLogout = () => {
    OneSignal.logout().catch(console.error);
    setCurrentUser(null);
    localStorage.removeItem('stkr_current_user');
    setFavorites([]);
    setPortfolio([]);
    setFavoriteStocksDetails([]);
    setStockData(null);
    setBrokerStatus({ connected: false });
    setTradingMode('paper');
    localStorage.setItem('stkr_trading_mode', 'paper');
  };

  const fetchBrokerStatus = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/broker/status?username=${encodeURIComponent(currentUser)}`);
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data = await res.json();
      setBrokerStatus(data);
    } catch (e) {
      console.error("STKR_LOG: Failed to fetch broker status:", e);
    }
  }, [currentUser]);

  const fetchZerodhaData = useCallback(async () => {
    if (!currentUser) return;
    console.log("STKR_LOG: fetchZerodhaData v1.0.1 called");
    // If we're not in 'live' mode and not in 'z' view, don't fetch
    if (tradingMode !== 'live' && activeView !== 'z') {
      console.log("STKR_LOG: Skipping Zerodha fetch - not in live mode/Z view");
      return;
    }
    
    console.log("STKR_LOG: Fetching Zerodha data...");
    setIsBrokerLoading(true);
    try {
      const urls = [
        `/api/broker/zerodha/holdings?username=${encodeURIComponent(currentUser)}`,
        `/api/broker/zerodha/positions?username=${encodeURIComponent(currentUser)}`,
        `/api/broker/zerodha/orders?username=${encodeURIComponent(currentUser)}`,
        `/api/broker/zerodha/margins?username=${encodeURIComponent(currentUser)}`
      ];
      
      const responses = await Promise.all(urls.map(url => fetch(url)));
      
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          const errorText = await responses[i].text();
          console.error(`STKR_LOG: Fetch failed for ${urls[i]}: ${responses[i].status} ${responses[i].statusText}`, errorText);
          throw new Error(`Zerodha API call failed: ${urls[i]}`);
        }
      }

      const [holdingsData, positionsData, ordersData, marginsData] = await Promise.all(responses.map(res => res.json()));
      
      if (holdingsData.status === 'success') setZerodhaHoldings(holdingsData.data);
      if (positionsData.status === 'success') setZerodhaPositions(positionsData.data.net);
      if (marginsData.status === 'success') setZerodhaMargins(marginsData.data);
      if (ordersData.status === 'success') {
        // Sort orders by time descending
        const sortedOrders = ordersData.data.sort((a: any, b: any) => new Date(b.order_timestamp).getTime() - new Date(a.order_timestamp).getTime());
        setZerodhaOrders(sortedOrders);
      }
      console.log("STKR_LOG: Zerodha data fetched successfully");
    } catch (e: any) {
      console.error("STKR_LOG: Failed to fetch Zerodha data:", e);
      toast.error(`Sync failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsBrokerLoading(false);
    }
  }, [currentUser, tradingMode, activeView]);

  // Global check for Zerodha callback in URL (for environments where popups open in same tab)
  useEffect(() => {
    if (!currentUser) return;

    const urlParams = new URLSearchParams(window.location.search);
    const requestToken = urlParams.get('request_token');
    const status = urlParams.get('status');

    if (status === 'success' && requestToken) {
      const processToken = async () => {
        setIsBrokerLoading(true);
        try {
          const exchangeRes = await fetch('/api/broker/zerodha/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, requestToken })
          });
          
          const result = await exchangeRes.json();
          if (result.status === 'success') {
            fetchBrokerStatus();
            fetchZerodhaData();
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            toast.success("Zerodha Connected Successfully!");
          } else {
            console.error("Zerodha exchange failed:", result.error);
            toast.error(`Connection failed: ${result.error}`);
          }
        } catch (err) {
          console.error("Exchange error:", err);
          toast.error("Connection failed: Network or server error.");
        } finally {
          setIsBrokerLoading(false);
        }
      };

      processToken();
    }
  }, [currentUser, fetchBrokerStatus, fetchZerodhaData]);

  const handleConnectZerodha = async () => {
    try {
      const res = await fetch('/api/broker/zerodha/auth-url');
      const { url } = await res.json();
      
      const authWindow = window.open(url, 'zerodha_auth', 'width=600,height=700');
      
      let isExchanging = false;

      const processToken = async (requestToken: string) => {
        if (isExchanging) return;
        isExchanging = true;
        
        try {
          const exchangeRes = await fetch('/api/broker/zerodha/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, requestToken })
          });
          
          const result = await exchangeRes.json();
          if (result.status === 'success') {
            fetchBrokerStatus();
            fetchZerodhaData();
            authWindow?.close();
            toast.success("Zerodha Connected Successfully!");
          } else {
            console.error("Zerodha exchange failed:", result.error);
            toast.error(`Connection failed: ${result.error}`);
          }
        } catch (err) {
          console.error("Exchange error:", err);
          toast.error("Connection failed: Network or server error.");
        } finally {
          window.removeEventListener('message', handleMessage);
          window.removeEventListener('storage', handleStorage);
          isExchanging = false;
        }
      };

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ZERODHA_REQUEST_TOKEN') {
          processToken(event.data.requestToken);
        }
      };

      const handleStorage = (event: StorageEvent) => {
        if (event.key === 'zerodha_request_token' && event.newValue) {
          processToken(event.newValue);
          localStorage.removeItem('zerodha_request_token');
        }
      };

      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);
    } catch (e) {
      console.error("Failed to start Zerodha auth:", e);
      toast.error("Failed to initiate connection. Please check your API keys.");
    }
  };

  const handleDisconnectBroker = async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/broker/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser })
      });
      setBrokerStatus({ connected: false });
      setTradingMode('paper');
      localStorage.setItem('stkr_trading_mode', 'paper');
    } catch (e) {
      console.error("Failed to disconnect broker:", e);
    }
  };

  const toggleTradingMode = () => {
    const newMode = tradingMode === 'paper' ? 'live' : 'paper';
    if (newMode === 'live' && !brokerStatus.connected) {
      setIsBrokerModalOpen(true);
      return;
    }
    setTradingMode(newMode);
    localStorage.setItem('stkr_trading_mode', newMode);
  };

  useEffect(() => {
    fetchBrokerStatus();
  }, [fetchBrokerStatus]);

  useEffect(() => {
    if (activeView === 'trade') {
      setTradingMode('paper');
      localStorage.setItem('stkr_trading_mode', 'paper');
    } else if (activeView === 'z') {
      setTradingMode('live');
      localStorage.setItem('stkr_trading_mode', 'live');
      // Fetch status and data immediately when switching to Z view
      fetchBrokerStatus();
      fetchZerodhaData();
    }
  }, [activeView, fetchZerodhaData, fetchBrokerStatus]);

  // Periodic refresh for live data
  useEffect(() => {
    if (tradingMode === 'live' && activeView === 'z') {
      const interval = setInterval(() => {
        const now = new Date();
        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();
        
        let istHours = utcHours + 5;
        let istMinutes = utcMinutes + 30;
        if (istMinutes >= 60) {
          istHours += 1;
          istMinutes -= 60;
        }
        if (istHours >= 24) {
          istHours -= 24;
        }

        if (istHours >= 9 && istHours < 16) {
          fetchZerodhaData();
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [tradingMode, activeView, fetchZerodhaData]);

  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('1D');
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [clearLinesSignal, setClearLinesSignal] = useState(0);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [isZerodhaTradeModalOpen, setIsZerodhaTradeModalOpen] = useState(false);
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
    if (tradingMode === 'live') {
      let totalInvested = 0;
      let totalCurrentValue = 0;
      zerodhaHoldings.forEach(item => {
        totalInvested += item.quantity * item.average_price;
        totalCurrentValue += item.quantity * item.last_price;
      });
      return {
        totalInvested,
        totalPL: totalCurrentValue - totalInvested,
        totalPLPercent: totalInvested !== 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0
      };
    }

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
  }, [portfolio, tradingMode, zerodhaHoldings]);

  useEffect(() => {
    const hasActive = userAlerts.some(a => a.status === 'active');
    if (!hasActive && activeView !== 'trade') return;
    const interval = setInterval(refreshAlerts, 20000);
    return () => clearInterval(interval);
  }, [userAlerts, activeView, refreshAlerts]);

  const handleEnsureSubscription = async () => {
    try {
      if (!OneSignal.Notifications.permission) {
        await OneSignal.Notifications.requestPermission();
      }
      return OneSignal.Notifications.permission;
    } catch (e) {
      setError("Notification permission request failed.");
      return false;
    }
  };

  const handleSaveAlert = async (price: number, condition: 'above' | 'below'): Promise<boolean> => {
    if (!stockData) return false;
    setError(null);
    try {
      // Ensure OneSignal is ready
      await handleEnsureSubscription();
      
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
      <ToastContainer />
      
      <AnimatePresence>
        {showSplash && <SplashScreen />}
        {!showSplash && !currentUser && <LoginScreen onLogin={handleLogin} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSentiment && <SentimentDetailModal ticker={selectedSentiment.ticker} analysis={selectedSentiment.analysis} onClose={() => setSelectedSentiment(null)} />}
        {isAlertModalOpen && stockData && <AlertModal ticker={stockData.info.ticker} currentPrice={stockData.info.currentPrice} onClose={() => setIsAlertModalOpen(false)} onSave={handleSaveAlert} />}
        {isAddTradeModalOpen && <AddTradeModal onClose={() => setIsAddTradeModalOpen(false)} onAdd={handleAddPortfolioItem} />}
        {isZerodhaTradeModalOpen && currentUser && (
          <ZerodhaTradeModal 
            onClose={() => setIsZerodhaTradeModalOpen(false)} 
            currentUser={currentUser} 
            onSuccess={fetchZerodhaData} 
            availableFunds={zerodhaMargins?.equity?.available?.cash || null}
          />
        )}
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
        {isBrokerModalOpen && (
          <BrokerSettingsModal 
            onClose={() => setIsBrokerModalOpen(false)} 
            status={brokerStatus}
            onConnect={handleConnectZerodha}
            onDisconnect={handleDisconnectBroker}
            onSync={fetchBrokerStatus}
            isSyncing={isBrokerLoading}
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
          <button onClick={() => setActiveView('trade')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'trade' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`} title="Paper Trading"><Briefcase size={20} /></button>
          <button onClick={() => setActiveView('favorites')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'favorites' ? 'bg-white/15 text-pink-500 border border-white/50 shadow-md' : 'text-white/40 hover:text-white/80'}`} title="Watchlist"><Heart size={20} /></button>
          <button onClick={() => setActiveView('z')} className={`w-full flex items-center justify-center p-3.5 rounded-2xl transition-all ${activeView === 'z' ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/30 shadow-md' : 'text-white/40 hover:text-white/80'}`} title="Zerodha"><Zap size={20} /></button>
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
                <div className="relative flex items-center justify-between gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-black/80 backdrop-blur-2xl rounded-[calc(0.75rem-1px)] border border-white/10 overflow-x-auto custom-scrollbar">
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsModelSettingsOpen(true)}
                      className="p-1.5 sm:p-2 rounded-lg bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)] border border-white/20 cursor-pointer shrink-0"
                    >
                       <TrendingUp size={14} className="sm:w-4 sm:h-4" strokeWidth={4} />
                    </motion.button>
                    <div className="flex flex-col hidden xs:flex">
                       <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-[0.3em] leading-tight">Stocker</h1>
                       <span className="text-[6px] sm:text-[8px] font-bold text-white/40 uppercase tracking-[0.4em] hidden sm:block">{currentUser}'s Terminal</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                    <button 
                      onClick={() => setIsBrokerModalOpen(true)}
                      className={`p-1.5 sm:p-2 rounded-lg border transition-all shrink-0 flex items-center justify-center ${brokerStatus.connected ? 'bg-[#ccff00]/20 border-[#ccff00]/40 text-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.2)]' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'}`}
                      title="Zerodha"
                    >
                      <span className="font-black text-xs sm:text-sm leading-none w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center">Z</span>
                    </button>
                    <button 
                      onClick={handleLogout} 
                      className="p-1.5 sm:p-2 text-rose-500/60 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-lg border border-rose-500/20 shrink-0"
                      title="Logout Session"
                    >
                      <ZapOff size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
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
                    <div className="p-2 rounded-lg border shadow-lg transition-all bg-pink-600/20 text-pink-500 border-pink-500/30">
                      <Briefcase size={16} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-[11px] font-black uppercase tracking-widest leading-none text-white">
                        PAPER PORTFOLIO
                      </h2>
                      <span className="text-[7px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">
                        Real-time valuation
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setIsAddTradeModalOpen(true)} className="px-3 sm:px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[7px] sm:text-[8px] font-black uppercase tracking-[0.15em] shadow-lg border border-white/20 transition-all flex items-center gap-1 sm:gap-1.5 active:scale-95 shrink-0">
                    <Plus size={12} className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} />
                    <span className="hidden xs:inline">ADD POSITION</span>
                    <span className="xs:hidden">ADD</span>
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
                    <h3 className="text-[8px] font-black text-white/70 uppercase tracking-widest">
                      HOLDINGS
                    </h3>
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

               {/* Alerts Section moved to Paper tab */}
               <div className="space-y-4 pt-4">
                  <div className="relative p-[1px] rounded-xl overflow-hidden w-full">
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
            </div>
          ) : activeView === 'z' ? (
            <div className="space-y-4 animate-in fade-in duration-500">
               {!brokerStatus.connected ? (
                 <div className="py-24 flex flex-col items-center gap-6 text-center">
                   <div className="p-6 rounded-full bg-white/5 border border-white/10 shadow-2xl">
                     <ZapOff size={48} className="text-white/20" />
                   </div>
                   <div className="space-y-2">
                     <h2 className="text-xl font-black text-white uppercase tracking-widest">Zerodha Not Connected</h2>
                     <p className="text-[10px] text-white/50 uppercase tracking-widest max-w-xs mx-auto">Please connect your Zerodha account to access live trading terminal.</p>
                   </div>
                   <button 
                     onClick={() => setIsBrokerModalOpen(true)}
                     className="px-8 py-3 bg-[#ccff00] text-black font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 transition-all active:scale-95"
                   >
                     Connect Kite
                   </button>
                 </div>
               ) : (
                 <>
                   <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg border shadow-lg transition-all bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/30">
                          <Zap size={16} strokeWidth={3} />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="text-[11px] font-black uppercase tracking-widest leading-none text-[#ccff00]">
                            ZERODHA TERMINAL
                          </h2>
                          <span className="text-[7px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">
                            Live Kite Integration
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <button onClick={() => setIsZerodhaTradeModalOpen(true)} className="px-2.5 sm:px-4 py-2 bg-[#ccff00] hover:bg-[#b3e600] text-black rounded-lg text-[7px] sm:text-[8px] font-black uppercase tracking-[0.15em] shadow-[0_0_10px_rgba(204,255,0,0.3)] border border-[#ccff00]/50 transition-all flex items-center gap-1 sm:gap-1.5 active:scale-95">
                          <Plus size={10} className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
                          TRADE
                        </button>
                        <button onClick={fetchZerodhaData} disabled={isBrokerLoading} className="px-2.5 sm:px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[7px] sm:text-[8px] font-black uppercase tracking-[0.15em] border border-white/20 transition-all flex items-center gap-1 sm:gap-1.5 active:scale-95 disabled:opacity-50">
                          <RefreshCw size={10} className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isBrokerLoading ? 'animate-spin' : ''}`} />
                          <span className="hidden xs:inline">SYNC KITE</span>
                          <span className="xs:hidden">SYNC</span>
                        </button>
                      </div>
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
                        <h3 className="text-[8px] font-black text-white/70 uppercase tracking-widest">
                          ZERODHA HOLDINGS
                        </h3>
                        {isBrokerLoading && <Loader2 size={10} className="animate-spin text-pink-500" />}
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
                            {zerodhaHoldings.map((item, i) => {
                              const pl = item.pnl;
                              const plPerc = (pl / (item.average_price * item.quantity)) * 100;
                              return (
                                <tr key={i} className="hover:bg-white/[0.04] transition-colors group">
                                  <td className="px-3 py-3 border-r border-white/10" onClick={() => handleSelectAndSearch(item.tradingsymbol)}>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-white uppercase group-hover:text-pink-500 transition-colors tracking-tight">{item.tradingsymbol}</span>
                                      <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">{item.exchange}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-3 text-right font-bold text-white/90 tabular-nums text-[10px] border-r border-white/10">{item.quantity}</td>
                                  <td className="px-2 py-3 text-right font-medium text-white/50 tabular-nums text-[10px] border-r border-white/10">{item.average_price.toFixed(2)}</td>
                                  <td className="px-2 py-3 text-right font-black text-white tabular-nums text-[10px] border-r border-white/10">{item.last_price.toFixed(2)}</td>
                                  <td className="px-2 py-3 text-right border-r border-white/10">
                                    <div className={`flex flex-col items-end ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      <span className="text-[10px] font-black tabular-nums">{pl >= 0 ? '+' : ''}{pl.toFixed(2)}</span>
                                      <span className="text-[6px] font-bold opacity-70 uppercase tracking-tighter">{plPerc.toFixed(1)}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <button onClick={() => handleSelectAndSearch(item.tradingsymbol)} className="p-1.5 rounded-md text-white/30 hover:text-pink-500 hover:bg-pink-500/10 transition-all border border-transparent hover:border-pink-500/20">
                                      <ArrowUpRight size={12} strokeWidth={2.5} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {zerodhaHoldings.length === 0 && (
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

                   {zerodhaPositions.length > 0 && (
                     <div className="glossy-card !border-white/30 rounded-xl overflow-hidden shadow-xl bg-black/40">
                        <div className="px-3 py-2 border-b border-white/10 bg-white/[0.04] flex items-center justify-between">
                          <h3 className="text-[8px] font-black text-white/70 uppercase tracking-widest">ZERODHA POSITIONS</h3>
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
                                <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-center">Product</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {zerodhaPositions.map((item, i) => {
                                const pl = item.pnl;
                                return (
                                  <tr key={i} className="hover:bg-white/[0.04] transition-colors group">
                                    <td className="px-3 py-3 border-r border-white/10" onClick={() => handleSelectAndSearch(item.tradingsymbol)}>
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-white uppercase group-hover:text-pink-500 transition-colors tracking-tight">{item.tradingsymbol}</span>
                                        <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">{item.exchange}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 text-right font-bold text-white/90 tabular-nums text-[10px] border-r border-white/10">{item.quantity}</td>
                                    <td className="px-2 py-3 text-right font-medium text-white/50 tabular-nums text-[10px] border-r border-white/10">{item.average_price.toFixed(2)}</td>
                                    <td className="px-2 py-3 text-right font-black text-white tabular-nums text-[10px] border-r border-white/10">{item.last_price.toFixed(2)}</td>
                                    <td className="px-2 py-3 text-right border-r border-white/10">
                                      <div className={`flex flex-col items-end ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <span className="text-[10px] font-black tabular-nums">{pl >= 0 ? '+' : ''}{pl.toFixed(2)}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10">{item.product}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                     </div>
                   )}

                   {zerodhaOrders.length > 0 && (
                     <div className="glossy-card !border-white/30 rounded-xl overflow-hidden shadow-xl bg-black/40 mt-3.5">
                        <div className="px-3 py-2 border-b border-white/10 bg-white/[0.04] flex items-center justify-between">
                          <h3 className="text-[8px] font-black text-white/70 uppercase tracking-widest">ZERODHA ORDERS</h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-white/[0.02] border-b border-white/20">
                                <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest border-r border-white/10">Time</th>
                                <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest border-r border-white/10">STOCK</th>
                                <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Type</th>
                                <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Qty</th>
                                <th className="px-2 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-right border-r border-white/10">Price</th>
                                <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-center border-r border-white/10">Status</th>
                                <th className="px-3 py-2.5 text-[7px] font-black text-white/60 uppercase tracking-widest text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {zerodhaOrders.map((order, i) => {
                                const isBuy = order.transaction_type === 'BUY';
                                let statusColor = 'text-white/50 border-white/10 bg-white/5';
                                if (order.status === 'COMPLETE') statusColor = 'text-emerald-400 border-emerald-400/20 bg-emerald-500/10';
                                if (order.status === 'REJECTED' || order.status === 'CANCELLED') statusColor = 'text-rose-400 border-rose-400/20 bg-rose-500/10';
                                if (order.status === 'OPEN' || order.status === 'TRIGGER PENDING') statusColor = 'text-amber-400 border-amber-400/20 bg-amber-500/10';

                                const canCancel = order.status === 'OPEN' || order.status === 'TRIGGER PENDING';

                                return (
                                  <tr key={i} className="hover:bg-white/[0.04] transition-colors group">
                                    <td className="px-3 py-3 border-r border-white/10 text-[9px] text-white/60 whitespace-nowrap">
                                      {new Date(order.order_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="px-3 py-3 border-r border-white/10" onClick={() => handleSelectAndSearch(order.tradingsymbol)}>
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-white uppercase group-hover:text-pink-500 transition-colors tracking-tight">{order.tradingsymbol}</span>
                                        <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">{order.exchange}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-3 text-right border-r border-white/10">
                                      <span className={`text-[9px] font-black uppercase tracking-wider ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {order.transaction_type}
                                      </span>
                                    </td>
                                    <td className="px-2 py-3 text-right font-bold text-white/90 tabular-nums text-[10px] border-r border-white/10">
                                      {order.filled_quantity}/{order.quantity}
                                    </td>
                                    <td className="px-2 py-3 text-right font-medium text-white/50 tabular-nums text-[10px] border-r border-white/10">
                                      {order.average_price > 0 ? order.average_price.toFixed(2) : order.price.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-center border-r border-white/10">
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${statusColor}`}>
                                        {order.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      {canCancel ? (
                                        <button 
                                          onClick={async () => {
                                            try {
                                              const res = await fetch(`/api/broker/zerodha/order/${order.order_id}`, { method: 'DELETE' });
                                              const data = await res.json();
                                              if (data.status === 'success') {
                                                toast.success('Order cancelled');
                                                fetchZerodhaData();
                                              } else {
                                                toast.error(data.message || 'Failed to cancel');
                                              }
                                            } catch (e) {
                                              toast.error('Error cancelling order');
                                            }
                                          }}
                                          className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      ) : (
                                        <span className="text-[8px] text-white/20 uppercase tracking-widest">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                     </div>
                   )}
                 </>
               )}
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
        <button onClick={() => setActiveView('trade')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'trade' ? 'text-pink-500' : 'text-white/40'}`}><Briefcase size={18} strokeWidth={activeView === 'trade' ? 3 : 2} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Paper</span></button>
        <button onClick={() => setActiveView('favorites')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'favorites' ? 'text-pink-500' : 'text-white/40'}`}><Heart size={18} strokeWidth={activeView === 'favorites' ? 3 : 2} fill={activeView === 'favorites' ? 'currentColor' : 'none'} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Watch</span></button>
        <button onClick={() => setActiveView('z')} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${activeView === 'z' ? 'text-[#ccff00]' : 'text-white/40'}`}><Zap size={18} strokeWidth={activeView === 'z' ? 3 : 2} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Z</span></button>
        {currentUser === 'admin' && (
          <button onClick={() => setIsAdminModalOpen(true)} className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-pink-500"><Shield size={18} strokeWidth={3} /><span className="text-[7px] font-black uppercase tracking-[0.15em]">Admin</span></button>
        )}
      </nav>
    </div>
  );
};

export default App;
