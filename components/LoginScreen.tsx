import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'create'>('login');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      setError("Minimum 3 characters required");
      setTimeout(() => setError(null), 2000);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = activeTab === 'create' ? '/api/auth/register' : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase() })
      });

      const data = await response.json().catch(() => ({ error: "Invalid server response" }));

      if (response.ok) {
        onLogin(data.username);
      } else {
        setError(data.error || `Error ${response.status}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError("Network error or server unreachable");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#010203]/40 backdrop-blur-3xl"
    >
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-600/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 blur-[120px] animate-pulse delay-700" />

      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="relative w-full max-w-md glossy-card !border-white/40 rounded-[2.5rem] overflow-hidden p-8 md:p-10 shadow-[0_0_100px_rgba(236,72,153,0.15)]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <motion.div 
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600 to-cyan-500 flex items-center justify-center text-white shadow-2xl border border-white/40 mb-6"
          >
            <ShieldCheck size={32} strokeWidth={2.5} />
          </motion.div>

          <h1 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-8 leading-tight">
            STOCKER <span className="text-pink-500">Login</span>
          </h1>

          {/* Tabs */}
          <div className="flex w-full bg-white/[0.05] p-1 rounded-xl mb-6 border border-white/10">
            <button 
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'login' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'create' ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Create
            </button>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={18} className="text-white/30 group-focus-within:text-pink-500 transition-colors" />
              </div>
              <input 
                type="text" 
                placeholder={activeTab === 'create' ? "Choose Username..." : "Enter Username..."}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className={`w-full bg-white/[0.05] border ${error ? 'border-rose-500/50' : 'border-white/20'} rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-white/20 focus:outline-none focus:border-pink-500/80 focus:bg-white/[0.08] transition-all shadow-inner`}
              />
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="absolute -bottom-6 left-2 text-[8px] font-black text-rose-500 uppercase tracking-widest"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full relative group overflow-hidden rounded-2xl p-[1.5px] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <div className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#EC4899_50%,#E2E8F0_100%)]" />
              <div className="relative flex items-center justify-center gap-3 bg-black/90 hover:bg-black/80 py-4 rounded-[calc(1rem-1.5px)] transition-colors">
                <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                  {isLoading ? "Processing..." : activeTab === 'create' ? "Register Account" : "Initialize Session"}
                </span>
                {!isLoading && <ArrowRight size={16} className="text-pink-500 group-hover:translate-x-1 transition-transform" />}
              </div>
            </button>
          </form>

        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-pink-500/50 to-transparent" />
      </motion.div>

    </motion.div>
  );
};

export default LoginScreen;
