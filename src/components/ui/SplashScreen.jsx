import React from 'react';
import { motion } from 'motion/react';
import nodraLogo from '../../../nodra-vault.svg';

export function SplashScreen() {
  return (
    <motion.div
      key="checkpoint-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-0 z-[999] bg-[#09090b] flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* Background Soft Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-zinc-800/20 blur-3xl pointer-events-none -z-10" />

      <div className="flex flex-col items-center space-y-5">
        {/* Pulsing Geometric Logo */}
        <motion.div
          animate={{
            scale: [0.96, 1.04, 0.96],
            opacity: [0.85, 1, 0.85],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.4,
            ease: 'easeInOut',
          }}
          className="relative flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 flex items-center justify-center p-3 shadow-2xl">
            <img
              src={nodraLogo}
              alt="Checkpoint"
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>

        {/* Brand Title & Version */}
        <div className="flex flex-col items-center space-y-1">
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

        {/* Shimmering Progress Bar */}
        <div className="w-36 h-1 bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800/60">
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: 'easeInOut',
            }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default SplashScreen;
