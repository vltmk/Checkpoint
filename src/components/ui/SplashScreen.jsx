import React from 'react';
import { motion } from 'motion/react';
import { CheckpointLogo } from './Icons';

export function SplashScreen() {
  return (
    <motion.div
      key="checkpoint-splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center select-none overflow-hidden"
      dir="ltr"
    >
      <div className="flex flex-col items-center space-y-6" dir="ltr">
        {/* Crisp Unboxed Geometric Logo */}
        <div className="w-14 h-14 flex items-center justify-center">
          <CheckpointLogo className="w-full h-full text-zinc-200" />
        </div>

        {/* Brand Title and Subtitle */}
        <div className="flex flex-col items-center space-y-1.5 text-center">
          <span className="text-base font-black tracking-wider text-zinc-200 uppercase">
            CHECKPOINT
          </span>

          <p className="text-xs text-zinc-400 font-sans tracking-normal">
            High-density freelance & gaming ledger
          </p>
        </div>

        {/* Linear Time-Relative Progress Bar (0% to 100% in exactly 2.2s) - Forced LTR */}
        <div className="w-44 h-1 splash-progress-track bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800" dir="ltr">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            style={{ transformOrigin: 'left' }}
            transition={{
              duration: 2.2,
              ease: 'linear',
            }}
            className="w-full h-full splash-progress-filler bg-zinc-100 rounded-full"
          />
        </div>
      </div>

      {/* Dimmed Bottom-Centered Open Source Badge */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none">
        <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800/80 text-zinc-500">
          Free & Open Source with ❤️
        </span>
      </div>
    </motion.div>
  );
}

export default SplashScreen;
