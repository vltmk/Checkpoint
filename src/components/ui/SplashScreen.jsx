import React from 'react';
import { motion } from 'motion/react';
import nodraLogo from '../../../nodra-vault.svg';

export function SplashScreen() {
  return (
    <motion.div
      key="checkpoint-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center select-none overflow-hidden"
    >
      <div className="flex flex-col items-center space-y-6">
        {/* Crisp Unboxed Geometric Logo */}
        <div className="w-14 h-14 flex items-center justify-center">
          <img
            src={nodraLogo}
            alt="Checkpoint"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Brand Title, Subtitle, and Emerald Accent Free Forever Badge */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <span className="text-base font-bold tracking-tight text-zinc-100">
            Checkpoint
          </span>

          <p className="text-xs text-zinc-400 font-sans tracking-normal">
            Nodra's freelancing ledger
          </p>

          <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded bg-emerald-950/20 border border-emerald-800/60 text-emerald-400 mt-0.5">
            Open Source with ❤️
          </span>
        </div>

        {/* Linear Time-Relative Progress Bar (0% to 100% in exactly 2.2s) */}
        <div className="w-44 h-1 bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 2.2,
              ease: 'linear',
            }}
            className="h-full bg-zinc-100 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default SplashScreen;
