import React from 'react';
import { motion } from 'motion/react';
import nodraLogo from '../../../nodra-vault.svg';

export function SplashScreen() {
  return (
    <motion.div
      key="checkpoint-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[999] bg-[#09090b] flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* High-End Multi-Layer Ambient Radial Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-b from-zinc-700/10 via-zinc-800/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute w-72 h-72 rounded-full bg-zinc-800/20 blur-2xl pointer-events-none -z-10 animate-pulse" />

      <div className="flex flex-col items-center space-y-6">
        {/* Pulsing Geometric Logo Container */}
        <motion.div
          animate={{
            scale: [0.97, 1.03, 0.97],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.2,
            ease: 'easeInOut',
          }}
          className="relative flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/95 border border-zinc-800/90 flex items-center justify-center p-3.5 shadow-2xl backdrop-blur-sm">
            <img
              src={nodraLogo}
              alt="Checkpoint"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.08)]"
            />
          </div>
        </motion.div>

        {/* Brand Title & Version */}
        <div className="flex flex-col items-center space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-zinc-100">
              Checkpoint
            </span>
            <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              v2.1.0
            </span>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 tracking-tight">
            High-Density Freelance Ledger
          </p>
        </div>

        {/* High-Precision Shimmering Progress Beam */}
        <div className="w-40 h-1 bg-zinc-900/80 rounded-full overflow-hidden relative border border-zinc-800/70">
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.3,
              ease: 'easeInOut',
            }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default SplashScreen;
