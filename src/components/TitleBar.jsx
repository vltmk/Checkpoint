import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import nodraLogo from '../../nodra-vault.svg';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  closeWindow,
  isTauri,
} from '../lib/desktop';

export function TitleBar() {
  const isDesktop = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    let unlisten = null;
    const setupListener = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const max = await win.isMaximized();
        setIsMaximized(max);

        unlisten = await win.onResized(async () => {
          const isMax = await win.isMaximized();
          setIsMaximized(isMax);
        });
      } catch (e) {}
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [isDesktop]);

  const handleMinimize = (e) => {
    e.stopPropagation();
    minimizeWindow();
  };

  const handleToggleMaximize = async (e) => {
    e.stopPropagation();
    await toggleMaximizeWindow();
    const max = await isWindowMaximized();
    setIsMaximized(max);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    closeWindow();
  };

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      className="h-9 w-full bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between select-none px-3 shrink-0 z-50 text-zinc-300"
    >
      {/* Left: App Identity */}
      <div className="flex items-center gap-2 pointer-events-none">
        <img
          src={nodraLogo}
          alt="Nodra Vault"
          className="w-4 h-4 object-contain"
        />
        <span className="text-xs font-medium text-zinc-200 tracking-tight">
          Nodra Vault
        </span>
        <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800/80">
          v2.0.0
        </span>
      </div>

      {/* Middle: Drag Handle Region */}
      <div data-tauri-drag-region className="flex-1 h-full cursor-default" />

      {/* Right: Window Controls */}
      {isDesktop ? (
        <div className="flex items-center gap-1 no-drag">
          <button
            type="button"
            onClick={handleMinimize}
            className="h-6 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none"
            title="Minimize"
            aria-label="Minimize Window"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="h-6 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-6 w-8 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-red-600/90 transition-colors focus:outline-none"
            title="Close"
            aria-label="Close Window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-zinc-600 font-mono">
          Standalone Vault
        </div>
      )}
    </header>
  );
}

export default TitleBar;
