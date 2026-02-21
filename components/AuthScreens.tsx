
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Sparkles, User, ArrowRight, Loader2, ShieldCheck, Zap } from 'lucide-react';

const MotionDiv = motion.div as any;

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#010203] flex items-center justify-center overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MotionDiv
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-full h-full bg-pink-600/20 blur-[120px] rounded-full"
        />
        <MotionDiv
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-cyan-500/20 blur-[120px] rounded-full"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <MotionDiv
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-600 to-cyan-500 flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.5)] border border-white/30">
            <TrendingUp size={48} className="text-white" strokeWidth={3} />
          </div>
          <MotionDiv
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-4 bg-pink-500/20 blur-2xl rounded-full -z-10"
          />
        </MotionDiv>

        <MotionDiv
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
            STOCKER
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-8 bg-pink-600" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">
              Neural Market Engine
            </span>
            <div className="h-[1px] w-8 bg-pink-600" />
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-12 flex flex-col items-center gap-3"
        >
          <Loader2 className="animate-spin text-pink-500/50" size={20} />
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
            Initializing Core Matrix
          </span>
        </MotionDiv>
      </div>
    </div>
  );
};

interface LoginScreenProps {
  onLogin: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsSubmitting(true);
      // Simulate a small delay for "glossy" feel
      setTimeout(() => {
        onLogin(username.trim());
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-[900] bg-[#010203] flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,rgba(236,72,153,0.15)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_70%,rgba(6,182,212,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-grid opacity-[0.05]" />
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md glossy-card !border-white/40 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)]"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-600 via-cyan-500 to-pink-600 animate-gradient-x" />
        
        <div className="p-8 md:p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center mb-6 shadow-inner">
              <User size={32} className="text-pink-500" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase mb-2">
              Welcome Back
            </h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">
              Enter your identity to access the terminal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-white/60 tracking-[0.2em] ml-1">
                Username
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Alpha_Trader"
                  className="w-full bg-white/[0.03] border-2 border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-pink-500/50 transition-all placeholder:text-white/10"
                  required
                />
                <div className="absolute inset-0 rounded-2xl bg-pink-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !username.trim()}
              className="w-full relative group overflow-hidden rounded-2xl p-[2px] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-cyan-500 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative bg-[#0a0c10] rounded-[calc(1rem-1px)] py-4 flex items-center justify-center gap-3">
                {isSubmitting ? (
                  <Loader2 className="animate-spin text-white" size={18} />
                ) : (
                  <>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                      Initialize Session
                    </span>
                    <ArrowRight size={16} className="text-pink-500 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { icon: ShieldCheck, label: 'Secure' },
              { icon: Zap, label: 'Fast' },
              { icon: Sparkles, label: 'AI Ready' }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <item.icon size={14} className="text-white/20" />
                <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </MotionDiv>

      <div className="absolute bottom-8 text-center">
        <p className="text-[8px] font-bold text-white/10 uppercase tracking-[0.5em]">
          Stocker v4.0.2 // Neural Interface
        </p>
      </div>
    </div>
  );
};
