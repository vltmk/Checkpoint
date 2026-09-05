import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';
import { isTauri, saveImageNative } from '../lib/desktop';

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

  const handleDownload = async (e) => {
    if (isTauri()) {
      e.preventDefault();
      const filename = `${(caption || 'proof').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      await saveImageNative({
        defaultPath: filename,
        dataUrl: imgSrc,
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && imgSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90"
          />

          {/* Lightbox Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="relative z-10 max-w-4xl w-full max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950">
              <div className="text-xs font-semibold text-zinc-200 truncate max-w-md">
                {caption}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={imgSrc}
                  download={`${(caption || 'proof').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`}
                  onClick={handleDownload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-800 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image Preview Canvas */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/80">
              <img
                src={imgSrc}
                alt={caption}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-md border border-zinc-800 shadow-lg"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Lightbox;
