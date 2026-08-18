import React from 'react';
import { Layers, Sparkles } from 'lucide-react';

export function ExchangeView() {
  return (
    <div className="pb-20 md:pb-6">
      <div className="min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/10">
        {/* Icon Frame */}
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-center text-zinc-400 shadow-xl mb-4">
          <Layers className="w-5 h-5 text-zinc-300" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-[10px] font-mono text-zinc-400 mb-3">
          <Sparkles className="w-3 h-3 text-zinc-400" />
          <span>Under Development</span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-semibold text-zinc-100 tracking-tight">
          Coming Soon
        </h3>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mt-1.5">
          This section is currently reserved for future modules and expansions. Stay tuned for updates.
        </p>
      </div>
    </div>
  );
}

export default ExchangeView;
