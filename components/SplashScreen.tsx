import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Activity } from 'lucide-react';

const SplashScreen: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[2000] bg-[#010203] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-600/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 blur-3xl bg-pink-600/30 animate-pulse" />
          <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-pink-600 to-cyan-500 flex items-center justify-center text-white shadow-2xl border border-white/20">
            <TrendingUp size={48} strokeWidth={3} />
          </div>
        </motion.div>

        <div className="text-center">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              color: ["#ffffff", "#ec4899", "#06b6d4", "#ffffff"] 
            }}
            transition={{ 
              y: { delay: 0.5, duration: 0.8 },
              opacity: { delay: 0.5, duration: 0.8 },
              color: { delay: 1.3, duration: 4, repeat: Infinity, ease: "linear" }
            }}
            className="text-4xl font-black uppercase tracking-[0.4em]"
          >
            Stocker
          </motion.h1>
        </div>
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-pink-500 animate-pulse" />
          <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-pink-500 to-transparent"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
