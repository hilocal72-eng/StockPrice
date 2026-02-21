import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Shield, Users, Database, Trash2, Search, RefreshCw } from 'lucide-react';

interface AdminUser {
  id: number;
  username: string;
  favorites: string[];
  portfolio: any[];
}

interface AdminPanelModalProps {
  adminUsername: string;
  onClose: () => void;
}

const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ adminUsername, onClose }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?requester=${adminUsername}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError("Failed to fetch users. Access denied.");
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/90 backdrop-blur-2xl" 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }} 
        className="relative w-full max-w-4xl h-[80vh] glossy-card !border-white/40 rounded-[2rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-pink-600 rounded-2xl text-white shadow-lg shadow-pink-600/20">
              <Shield size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Admin Matrix</h2>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em]">Database Management Terminal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchUsers}
              className="p-2 text-white/40 hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-white/[0.01] border-b border-white/5 flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-pink-500" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Total Users:</span>
            <span className="text-[12px] font-black text-white">{users.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Database size={14} className="text-cyan-500" />
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">DB Status:</span>
            <span className="text-[10px] font-black text-emerald-500 uppercase">Online</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Search users by identity..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-white placeholder-white/10 focus:outline-none focus:border-pink-500/50 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-500 gap-2">
              <Shield size={48} className="opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">{error}</p>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw size={32} className="text-pink-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map(user => (
                <div key={user.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 font-black text-xs">
                        {user.id}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">{user.username}</h3>
                        <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Analyst Identity</p>
                      </div>
                    </div>
                    {user.username === 'admin' && (
                      <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-500 text-[8px] font-black uppercase tracking-tighter border border-pink-500/30">
                        Superuser
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1">Watchlist</p>
                      <p className="text-xs font-black text-white">{user.favorites.length} <span className="text-[8px] text-white/40">items</span></p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1">Portfolio</p>
                      <p className="text-xs font-black text-white">{user.portfolio.length} <span className="text-[8px] text-white/40">trades</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white/[0.02] border-t border-white/10 text-center">
          <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.5em]">End of Database Stream</p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminPanelModal;
