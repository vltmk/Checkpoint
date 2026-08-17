import React from 'react';
import { motion } from 'motion/react';
import { Home, ScrollText, BarChart3, Plus } from 'lucide-react';

export function MobileNavBar({
  activeTab = 'home',
  onTabChange,
  onOpenWorkModal,
}) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'ledger', label: 'Ledger', icon: ScrollText },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div className="fixed sm:absolute bottom-4 inset-x-0 mx-auto w-[calc(100%-2rem)] max-w-[408px] z-30 pointer-events-auto">
      <div className="glass-dock rounded-[28px] px-3 py-2 flex items-center justify-between shadow-[0_16px_36px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.22)] border border-white/15">
        {/* Left Tab: Home */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all relative ${
            activeTab === 'home'
              ? 'text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {activeTab === 'home' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/10"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Home className={`w-5 h-5 relative z-10 transition-transform ${activeTab === 'home' ? 'scale-110 text-white' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight relative z-10">Home</span>
        </button>

        {/* Center-Left Tab: Ledger */}
        <button
          type="button"
          onClick={() => onTabChange('ledger')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all relative ${
            activeTab === 'ledger'
              ? 'text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {activeTab === 'ledger' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/10"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <ScrollText className={`w-5 h-5 relative z-10 transition-transform ${activeTab === 'ledger' ? 'scale-110 text-white' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight relative z-10">Ledger</span>
        </button>

        {/* Center Floating Elevated CTA: + Log Work */}
        <div className="flex-none px-2 -my-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onOpenWorkModal}
            title="Log Work (N)"
            className="relative group flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-b from-white to-zinc-200 text-black shadow-[0_8px_24px_rgba(255,255,255,0.3),inset_0_1px_0_0_rgba(255,255,255,1)] border border-white"
          >
            {/* Ambient radiant pulse behind button */}
            <div className="absolute inset-0 rounded-full bg-white/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
            <Plus className="w-6 h-6 text-black relative z-10 stroke-[2.5]" />
          </motion.button>
        </div>

        {/* Right Tab: Stats */}
        <button
          type="button"
          onClick={() => onTabChange('stats')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all relative ${
            activeTab === 'stats'
              ? 'text-white font-bold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {activeTab === 'stats' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-white/[0.08] rounded-2xl border border-white/10"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <BarChart3 className={`w-5 h-5 relative z-10 transition-transform ${activeTab === 'stats' ? 'scale-110 text-white' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight relative z-10">Stats</span>
        </button>
      </div>
    </div>
  );
}

export default MobileNavBar;
