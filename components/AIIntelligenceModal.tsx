
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Globe, TrendingUp, ShieldAlert, Target, Link as LinkIcon, BarChart3, Fingerprint, Loader2, Newspaper, ChevronRight, LayoutDashboard, Info, Circle } from 'lucide-react';
import { AIAnalysisResult, StockInfo, PricePoint } from '../types.ts';
import { getAIIntelligenceReport } from '../services/aiService.ts';

interface AIIntelligenceModalProps {
  ticker: string;
  currentPrice: number;
  history: PricePoint[];
  onClose: () => void;
}

type TabType = 'overview' | 'news' | 'technical';

const AIIntelligenceModal: React.FC<AIIntelligenceModalProps> = ({ ticker, currentPrice, history, onClose }) => {
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    const fetchReport = async () => {
      const data = await getAIIntelligenceReport(ticker, currentPrice, history);
      setReport(data);
      setLoading(false);
    };

    fetchReport();
  }, [ticker, currentPrice, history]);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Signal', icon: LayoutDashboard },
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'technical', label: 'Analysis', icon: BarChart3 },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/95 backdrop-blur-3xl" 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] glossy-card !border-white/50 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(236,72,153,0.3)] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 flex items-center justify-between bg-white/[0.04] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 to-cyan-500 shadow-xl border border-white/30 shrink-0">
              <Sparkles size={18} className="text-white" fill="white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white uppercase tracking-widest truncate">AI Report</h2>
              <span className="text-[8px] font-bold text-pink-400 uppercase tracking-[0.4em] block">{ticker}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors border border-white/20">
            <X size={18} className="text-white/70 hover:text-white" />
          </button>
        </div>

        {/* Tab Navigation */}
        {!loading && report && (
          <div className="flex border-b border-white/30 bg-black/20 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activeTab === tab.id ? 'text-pink-500' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden xs:inline">{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-black/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-12 gap-8">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 rounded-full border-t-4 border-r-4 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.4)]"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={24} className="text-cyan-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-3 px-4">
                <motion.p 
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-[14px] font-black text-white uppercase tracking-[0.4em] leading-relaxed"
                >
                  Generating....
                </motion.p>
              </div>
            </div>
          ) : report ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Signal Banner */}
                    <div className={`p-1.5 rounded-3xl bg-gradient-to-r ${
                      report.signal === 'BUY' ? 'from-emerald-500 to-cyan-500' : 
                      report.signal === 'SELL' ? 'from-rose-500 to-orange-500' : 
                      'from-yellow-500 to-amber-500'
                    }`}>
                      <div className="bg-[#0a0c10] rounded-[1.3rem] p-5 flex flex-col gap-6">
                        <div className="text-center">
                          <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em] mb-1 block">AI Verdict</span>
                          <h1 className={`text-5xl font-black italic tracking-tighter leading-none ${
                            report.signal === 'BUY' ? 'text-emerald-400' : 
                            report.signal === 'SELL' ? 'text-rose-400' : 
                            'text-yellow-400'
                          }`}>{report.signal}</h1>
                          <div className="mt-1 text-yellow-400 text-[10px] font-black tracking-widest uppercase opacity-90">
                            Market: {currentPrice.toFixed(2)}
                          </div>
                        </div>

                        {report.tradeLevels && report.signal !== 'NO OPPORTUNITY' && (
                          <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-5">
                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest block">Entry</span>
                              <span className="text-lg font-black text-white tabular-nums">{report.tradeLevels.entry.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1 text-right">
                              <span className="text-[8px] font-black text-rose-400/60 uppercase tracking-widest block">StopLoss</span>
                              <span className="text-lg font-black text-rose-400 tabular-nums">{report.tradeLevels.stopLoss.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest block">Target1</span>
                              <span className="text-lg font-black text-emerald-400 tabular-nums">{report.tradeLevels.target1.toFixed(2)}</span>
                            </div>
                            <div className="space-y-1 text-right">
                              <span className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest block">Target2</span>
                              <span className="text-lg font-black text-emerald-400 tabular-nums">{report.tradeLevels.target2.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-white/[0.03] border border-white/30 rounded-2xl">
                      <div className="flex items-center gap-2 mb-4">
                        <Info size={14} className="text-pink-500" />
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Rationale</h3>
                      </div>
                      <div className="space-y-3">
                        {Array.isArray(report.signalReasoning) ? (
                          report.signalReasoning.map((item: string, i: number) => (
                            <div key={i} className="flex gap-3">
                              <ChevronRight size={14} className="text-pink-500 shrink-0 mt-0.5" />
                              <p className="text-[12px] text-white/90 leading-relaxed font-medium">
                                {item}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-white/80 font-medium">{report.signalReasoning}</p>
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-white/[0.03] border border-white/30 rounded-2xl">
                       <div className="flex items-center gap-2 mb-4">
                          <Fingerprint size={14} className="text-cyan-400" />
                          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Technical Brief</h3>
                       </div>
                       <div className="space-y-3">
                        {Array.isArray(report.technicalSummary) ? (
                          report.technicalSummary.map((item: string, i: number) => (
                            <div key={i} className="flex gap-3">
                              <ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                              <p className="text-[12px] text-white/90 leading-relaxed font-medium">
                                {item}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-[12px] text-white/80 font-medium">{report.technicalSummary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'news' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/30 pb-4">
                      <Newspaper size={18} className="text-pink-500" />
                      <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Grounding Intelligence</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {(report.newsBullets && report.newsBullets.length > 0) ? (
                        report.newsBullets.map((bullet: string, idx: number) => (
                          <motion.div 
                            initial={{ x: -10, opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            transition={{ delay: 0.1 * idx }}
                            key={idx} 
                            className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/20"
                          >
                            <div className="shrink-0 mt-1">
                              <ChevronRight size={14} className="text-pink-500" strokeWidth={4} />
                            </div>
                            <p className="text-[12px] text-white font-medium leading-relaxed">
                              {bullet}
                            </p>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-[12px] text-white/70 italic px-2">{report.newsSummary}</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'technical' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/30 pb-4">
                      <Target size={18} className="text-cyan-400" />
                      <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Key Structural Levels</h3>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-white/40 bg-black/40">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/[0.08]">
                            <th className="px-4 py-3 text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/30">Type</th>
                            <th className="px-4 py-3 text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/30 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                          {report.resistanceLevels.slice(0, 3).reverse().map((lvl: number, i: number) => (
                            <tr key={`r-${i}`} className="hover:bg-rose-500/5 transition-colors">
                              <td className="px-4 py-3 text-[10px] font-bold text-rose-400 uppercase tracking-tight flex items-center gap-2">
                                <ShieldAlert size={10} /> R{3 - i}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-white tabular-nums text-right">{lvl.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-white/[0.03]">
                            <td className="px-4 py-2 text-[8px] font-black text-yellow-400/80 uppercase text-center border-y border-white/30" colSpan={2}>
                              Price Ref: {currentPrice.toFixed(2)}
                            </td>
                          </tr>
                          {report.supportLevels.slice(0, 3).map((lvl: number, i: number) => (
                            <tr key={`s-${i}`} className="hover:bg-emerald-500/5 transition-colors">
                              <td className="px-4 py-3 text-[10px] font-bold text-emerald-400 uppercase tracking-tight flex items-center gap-2">
                                <TrendingUp size={10} /> S{i + 1}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-white tabular-nums text-right">{lvl.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <BarChart3 size={14} className="text-yellow-400" />
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Detected Patterns</h4>
                      </div>
                      <div className="flex flex-wrap gap-2 px-1">
                         {report.patterns.map((p: string, i: number) => (
                           <span key={i} className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[9px] font-black text-yellow-500 uppercase tracking-widest shadow-sm">{p}</span>
                         ))}
                         {report.patterns.length === 0 && <span className="text-[10px] text-white/30 italic">No patterns confirmed.</span>}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-full flex items-center justify-center py-20 px-6 text-center">
              <div className="space-y-4 max-w-xs">
                <ShieldAlert size={40} className="text-rose-500/40 mx-auto" />
                <p className="text-[11px] text-rose-400 font-black uppercase tracking-widest leading-relaxed">Neural Analysis Disconnected or Unavailable</p>
                <button onClick={onClose} className="px-8 py-2.5 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/20">Return to Desk</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AIIntelligenceModal;
