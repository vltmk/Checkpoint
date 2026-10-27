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
  ShieldAlert,
} from 'lucide-react';
import {
  installUpdate,
  relaunchApp,
  isWindowsSecurityBlockedError,
  getStandaloneInstallerUrl,
} from '../lib/updater';
import { openExternalUrl } from '../lib/desktop';
import { getReleaseNotesForVersion } from '../lib/releaseNotes';
import { isRTL } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

export function UpdateModal({
  isOpen,
  onClose,
  updateInfo,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [installState, setInstallState] = useState('idle'); // 'idle' | 'downloading' | 'ready_to_restart' | 'error'
  const [progress, setProgress] = useState({ downloadedBytes: 0, totalBytes: 0, percent: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  const getTagBadge = (tag) => {
    switch (tag) {
      case 'new':
        return {
          label: t('notifications.tagNew', 'NEW'),
          style: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
        };
      case 'improved':
        return {
          label: t('notifications.tagImproved', 'IMPROVED'),
          style: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/80',
        };
      case 'fix':
        return {
          label: t('notifications.tagFix', 'FIX'),
          style: 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700/80',
        };
      default:
        return null;
    }
  };

  const currentVersion = updateInfo?.currentVersion || updateInfo?.rawUpdate?.currentVersion || '';
  const newVersion = updateInfo?.version || updateInfo?.rawUpdate?.version || '';
  const isSecurityBlock = isWindowsSecurityBlockedError(errorMessage);

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
    } catch (err) {
      console.error('[UpdateModal] Install failed:', err);
      setInstallState('error');
      setErrorMessage(err?.message || 'Failed to download and apply update.');
    }
  };

  const handleRelaunch = async () => {
    await relaunchApp();
  };

  const handleDownloadInstaller = () => {
    const directUrl = getStandaloneInstallerUrl(newVersion);
    const fallbackUrl = updateInfo?.releaseUrl || 'https://github.com/vltmk/Checkpoint/releases/latest';
    openExternalUrl(directUrl || fallbackUrl);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={Boolean(isOpen && updateInfo)} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/80 dark:text-emerald-400 flex items-center justify-center">
            <ArrowUpCircle className="w-3.5 h-3.5" />
          </div>
          <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('update.title')}</DialogTitle>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {/* Version Comparison Card */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className={cn('text-[10px] text-zinc-500 uppercase tracking-wider block', isRtl && 'font-farsi')}>
              {t('update.currentVersion')}
            </span>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              v{currentVersion}
            </span>
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

          <div className="space-y-0.5 text-right">
            <span className={cn('text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block font-medium', isRtl && 'font-farsi')}>
              {t('update.newVersion')}
            </span>
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center justify-end gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
              <span>v{newVersion}</span>
            </span>
          </div>
        </div>

        {/* Release Notes Preview */}
        {(() => {
          const notes = getReleaseNotesForVersion(newVersion, language, updateInfo?.body);
          const hasItems = Array.isArray(notes.items) && notes.items.length > 0;
          const isBodyRTL = isRTL(notes.summary || updateInfo?.body);

          return (
            <div className="space-y-1.5">
              <label className={cn('text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block', isRtl && 'font-farsi')}>
                {t('update.releaseNotes')}
              </label>
              <div
                dir={isBodyRTL ? 'rtl' : 'ltr'}
                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 text-xs text-zinc-700 dark:text-zinc-300 max-h-48 overflow-y-auto space-y-2 select-text"
              >
                {notes.summary && (
                  <p className={cn('text-zinc-700 dark:text-zinc-300 text-[11px] leading-relaxed', isBodyRTL && 'text-right')}>
                    {notes.summary}
                  </p>
                )}

                {hasItems ? (
                  <ul className="space-y-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
                    {notes.items.map((it, idx) => {
                      const tagInfo = it.tag ? getTagBadge(it.tag) : null;
                      const text = it.text || String(it);
                      const itemRtl = isRTL(text);

                      return (
                        <li
                          key={idx}
                          dir={itemRtl ? 'rtl' : 'ltr'}
                          className="flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed"
                        >
                          {tagInfo ? (
                            <span
                              dir="ltr"
                              className={cn(
                                'text-[9px] font-medium uppercase px-1.5 py-0.5 rounded border shrink-0 mt-0.5 tracking-wider',
                                tagInfo.style
                              )}
                            >
                              {tagInfo.label}
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 mt-1.5 shrink-0" />
                          )}

                          <span className={cn('break-words min-w-0 flex-1', itemRtl && 'text-right')}>
                            {text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div
                    className={cn(
                      'whitespace-pre-wrap leading-relaxed',
                      isBodyRTL && 'text-right'
                    )}
                  >
                    {updateInfo?.body || 'Performance enhancements, optimizations, and stability improvements.'}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Download Progress State */}
        {installState === 'downloading' && (
          <div className="space-y-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className={cn('text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                <RotateCw className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-spin" />
                <span>{t('update.downloading')}</span>
              </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatNumber(progress.percent)}%</span>
            </div>

            {/* Monochromatic Progress Bar */}
            <div dir="ltr" className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-800 dark:bg-zinc-200 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>{formatBytes(progress.downloadedBytes)}</span>
              <span>{progress.totalBytes > 0 ? formatBytes(progress.totalBytes) : 'Calculating...'}</span>
            </div>
          </div>
        )}

        {/* Ready to Restart State */}
        {installState === 'ready_to_restart' && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className={cn('text-xs text-emerald-900 dark:text-emerald-200', isRtl && 'font-farsi')}>
              <p className="font-medium">{t('update.readyRestart')}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80">
                {language === 'fa' ? `برنامه را مجدداً راه‌اندازی کنید تا نسخه ${newVersion} اعمال شود.` : `Restart Checkpoint now to apply version ${newVersion}.`}
              </p>
            </div>
          </div>
        )}

        {/* Error State: Security / Smart App Control Block */}
        {installState === 'error' && isSecurityBlock && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-amber-300/80 dark:border-amber-700/60 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className={cn('space-y-1 min-w-0 flex-1 text-xs', isRtl && 'font-farsi')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                    {t('update.securityBlockedTitle', 'Blocked by Windows Security')}
                  </p>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-amber-300/80 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 shrink-0">
                    Smart App Control
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(
                    'update.securityBlockedDesc',
                    'Windows Smart App Control or system policy blocked the silent background update. You can update safely by downloading and running the standalone installer.'
                  )}
                </p>
                {errorMessage && (
                  <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 truncate pt-0.5" title={errorMessage}>
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <span className={cn('text-[10px] text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                {t('update.settingsPreserved', 'All your data and settings will be preserved.')}
              </span>
              <button
                type="button"
                onClick={handleDownloadInstaller}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors',
                  isRtl && 'font-farsi'
                )}
              >
                <Download className="w-3 h-3" />
                <span>{t('update.downloadInstaller', 'Download Installer (.exe)')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error State: Standard / Network Failure */}
        {installState === 'error' && !isSecurityBlock && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className={cn('text-xs text-rose-900 dark:text-rose-200', isRtl && 'font-farsi')}>
              <p className="font-medium">{language === 'fa' ? 'خطا در به‌روزرسانی' : 'Update failed'}</p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300/80">{errorMessage}</p>
            </div>
          </div>
        )}
      </DialogContent>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
        {updateInfo?.releaseUrl ? (
          <button
            type="button"
            onClick={() => openExternalUrl(updateInfo.releaseUrl)}
            className={cn('flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors', isRtl && 'font-farsi')}
          >
            <span>GitHub Release</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className={cn(isRtl && 'font-farsi')}>
            {installState === 'ready_to_restart' ? (language === 'fa' ? 'بعداً' : 'Later') : t('common.close')}
          </Button>

          {installState === 'ready_to_restart' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRelaunch}
              className={cn('gap-1.5 font-medium', isRtl && 'font-farsi')}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t('update.readyRestart')}</span>
            </Button>
          ) : installState === 'error' && isSecurityBlock ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartUpdate}
                className={cn('gap-1.5 font-medium', isRtl && 'font-farsi')}
              >
                <RotateCw className="w-3 h-3" />
                <span>{t('update.retry', 'Retry')}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadInstaller}
                className={cn('gap-1.5 font-medium', isRtl && 'font-farsi')}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('update.downloadInstaller', 'Download Installer (.exe)')}</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={installState === 'downloading'}
              onClick={handleStartUpdate}
              className={cn('gap-1.5 font-medium', isRtl && 'font-farsi')}
            >
              {installState === 'downloading' ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('update.downloading')}</span>
                </>
              ) : installState === 'error' ? (
                <>
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{t('update.retry', 'Retry')}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('update.installNow')}</span>
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
