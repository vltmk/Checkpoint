import React from 'react';

export function MobileShell({ children }) {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center sm:py-6 sm:px-4 overflow-x-hidden selection:bg-white/20">
      {/* Outer ambient glow mesh for desktop screen immersion */}
      <div className="ambient-mesh fixed inset-0 pointer-events-none" />

      {/* Centered Mobile Viewport Container */}
      <div className="w-full max-w-[440px] min-h-screen sm:min-h-[860px] sm:max-h-[92vh] bg-[#09090b] sm:rounded-[36px] border border-white/[0.08] sm:shadow-[0_25px_80px_rgba(0,0,0,0.95),inset_0_1px_0_0_rgba(255,255,255,0.18)] relative flex flex-col overflow-y-auto overflow-x-hidden transition-all duration-300">
        {/* Inner ambient glow orbs specifically focused inside the mobile frame */}
        <div className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-emerald-500/[0.07] blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-blue-500/[0.08] blur-3xl pointer-events-none" />
        <div className="absolute bottom-32 -left-20 w-64 h-64 rounded-full bg-amber-500/[0.06] blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}

export default MobileShell;
