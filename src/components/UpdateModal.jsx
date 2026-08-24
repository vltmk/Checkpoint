import React, { useState } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from './ui/Dialog';
import { Button } from './ui/Button';
import {
  ArrowUpCircle,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { installUpdate, relaunchApp } from '../lib/updater';
import { openExternalUrl } from '../lib/desktop';

export function UpdateModal({
  isOpen,
  onClose,
  updateInfo,
  onToast,
}) {
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'downloading' | 'ready_to_restart' | 'error'
  const [progress, setProgress] = useState({ downloadedBytes: 0, totalBytes: 0, percent: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !updateInfo) return null;

  const currentVersion = updateInfo.currentVersion || '2.1.0';
  const newVersion = updateInfo.version || '2.2.0';

  const handleStartUpdate = async () => {
    if (!updateInfo.rawUpdate) {
      setInstallState('error');
      setErrorMessage('Update handle unavailable. Please restart and check again.');
      return;
    }

    try {
      setInstallState('downloading');
      setErrorMessage('');

      await installUpdate(updateInfo.rawUpdate, (p) => {
        setProgress(p);
      });

      setInstallState('ready_to_restart');
      onToast?.('Checkpoint update downloaded successfully. Ready to restart.');
    } catch (err) {
      console.error('[UpdateModal] Install failed:', err);
      setInstallState('error');
      setErrorMessage(err?.message || 'Failed to download and apply update.');
      onToast?.('Update download failed', { variant: 'destructive' });
    }
  };

  const handleRelaunch = async () => {
    await relaunchApp();
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
            <ArrowUpCircle className="w-3.5 h-3.5" />
          </div>
          <DialogTitle>Software Update Available</DialogTitle>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {/* Version Comparison Card */}
        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">
              Current Version
            </span>
            <span className="text-xs font-mono font-medium text-zinc-400">
              v{currentVersion}
            </span>
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          <div className="space-y-0.5 text-right">
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block font-semibold">
              New Version
            </span>
            <span className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>v{newVersion}</span>
            </span>
          </div>
        </div>

        {/* Release Notes Preview */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
            What's New in v{newVersion}
          </label>
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/90 text-xs text-zinc-300 max-h-40 overflow-y-auto font-sans leading-relaxed whitespace-pre-wrap select-text">
            {updateInfo.body || 'Performance enhancements, optimizations, and stability improvements.'}
          </div>
        </div>

        {/* Download Progress State */}
        {installState === 'downloading' && (
          <div className="space-y-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span>Downloading update...</span>
              </span>
              <span className="font-semibold text-white">{progress.percent}%</span>
            </div>

            {/* Monochromatic Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-100 transition-all duration-150"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span>{formatBytes(progress.downloadedBytes)}</span>
              <span>{progress.totalBytes > 0 ? formatBytes(progress.totalBytes) : 'Calculating...'}</span>
            </div>
          </div>
        )}

        {/* Ready to Restart State */}
        {installState === 'ready_to_restart' && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/60 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-200">
              <p className="font-semibold">Update ready to install</p>
              <p className="text-[11px] text-emerald-300/80">
                Restart Checkpoint now to apply version {newVersion}.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {installState === 'error' && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/60 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs text-rose-200">
              <p className="font-semibold">Update failed</p>
              <p className="text-[11px] text-rose-300/80">{errorMessage}</p>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
        {updateInfo.releaseUrl ? (
          <button
            type="button"
            onClick={() => openExternalUrl(updateInfo.releaseUrl)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>GitHub Release</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {installState === 'ready_to_restart' ? 'Later' : 'Close'}
          </Button>

          {installState === 'ready_to_restart' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRelaunch}
              className="gap-1.5 font-semibold"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Restart & Apply</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={installState === 'downloading'}
              onClick={handleStartUpdate}
              className="gap-1.5 font-semibold"
            >
              {installState === 'downloading' ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Update Now</span>
                </>
              )}
            </Button>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
}

export default UpdateModal;
