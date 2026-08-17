import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

export function Lightbox({ isOpen, onClose, imgSrc, caption = 'Screenshot Proof' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && imgSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* Lightbox Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative z-10 max-w-5xl w-full max-h-[92vh] flex flex-col bg-[#0a0a0c] border border-white/[0.12] rounded-2xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="text-xs font-semibold text-white truncate max-w-md">
                {caption}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={imgSrc}
                  download={`${(caption || 'proof').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white border border-white/10 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Preview Canvas */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60">
              <img
                src={imgSrc}
                alt={caption}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg border border-white/10 shadow-2xl"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
