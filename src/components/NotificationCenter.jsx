import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  ExternalLink,
  Download,
  Copy,
  Share2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
  Megaphone,
} from 'lucide-react';
import { Button } from './ui/Button';
import { DiscordIcon } from './ui/Icons';
import { openExternalUrl, copyTextNative } from '../lib/desktop';
import { isNotificationRTL, isRTL } from '../lib/utils';
import { useLanguage, formatShamsiDateTime } from '../lib/i18n';
import { cn } from '../lib/utils';

export function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenUpdateModal,
}) {
  const shouldReduceMotion = useReducedMotion();
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unread' | 'releases' | 'announcements'
  const [copiedActionKey, setCopiedActionKey] = useState(null);

  const unreadList = notifications.filter((item) => !item.read);
  const releaseList = notifications.filter((item) => item.source === 'updater' || item.source === 'system');
  const announcementList = notifications.filter((item) => item.source === 'announcement');

  const displayedNotifications = (() => {
    switch (filterMode) {
      case 'unread':
        return unreadList;
      case 'releases':
        return releaseList;
      case 'announcements':
        return announcementList;
      case 'all':
      default:
        return notifications;
    }
  })();

  const getNotificationIcon = (item) => {
    if (item.source === 'updater') {
      return <ArrowUpCircle className="w-4 h-4 text-emerald-400" />;
    }
    if (item.source === 'system') {
      return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
    switch (item.type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'info':
      default:
        return <Megaphone className="w-4 h-4 text-zinc-400" />;
    }
  };

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

  const getBadgeStyle = (item) => {
    if (item.source === 'updater') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';
    }
    if (item.source === 'system') {
      return 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/60';
    }
    switch (item.type) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60';
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';
      case 'info':
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (language === 'fa') {
        return formatShamsiDateTime(d, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Slide-over Drawer Frame */}
        <motion.div
          key="notification-drawer"
          initial={shouldReduceMotion ? { opacity: 0 } : { x: isRtl ? '-100%' : '100%' }}
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { x: isRtl ? '-100%' : '100%' }}
          transition={
            shouldReduceMotion
              ? { duration: 0.15 }
              : { type: 'spring', damping: 30, stiffness: 350 }
          }
          className={cn(
            'relative w-full max-w-md bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800/90 h-full flex flex-col shadow-2xl z-10 text-zinc-900 dark:text-zinc-100',
            isRtl && 'border-l-0 border-r'
          )}
          data-no-drag
        >
          {/* Header */}
          <div dir="ltr" className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/90 backdrop-blur shrink-0 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className={cn('text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider', isRtl && 'font-farsi')}>
                    {t('notifications.title')}
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {formatNumber(notifications.length)} {notifications.length === 1 ? 'record' : 'records'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onMarkAllAsRead?.()}
                    title="Mark all as read"
                    className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors', isRtl && 'font-farsi')}
                  >
                    <CheckCheck className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    <span>{t('notifications.readAll')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ml-1"
                  aria-label="Close Notification Center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[10px] overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={cn(`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`, isRtl && 'font-farsi')}
              >
                {t('notifications.all')} ({formatNumber(notifications.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unread')}
                className={cn(`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors ${
                  filterMode === 'unread'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-300 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`, isRtl && 'font-farsi')}
              >
                {t('notifications.unread')} ({formatNumber(unreadList.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('releases')}
                className={cn(`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors ${
                  filterMode === 'releases'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-300 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`, isRtl && 'font-farsi')}
              >
                {t('notifications.releases')} ({formatNumber(releaseList.length)})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('announcements')}
                className={cn(`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors ${
                  filterMode === 'announcements'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`, isRtl && 'font-farsi')}
              >
                {t('notifications.announcements')} ({formatNumber(announcementList.length)})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 gpu-scroll">
            {displayedNotifications.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                <Bell className="w-6 h-6 text-zinc-400 dark:text-zinc-700 stroke-[1.5]" />
                <p className={cn('text-xs font-medium text-zinc-600 dark:text-zinc-400', isRtl && 'font-farsi')}>
                  {filterMode === 'unread' ? t('notifications.noUnread') : t('notifications.empty')}
                </p>
                <p className={cn('text-[11px] text-zinc-500 dark:text-zinc-600 max-w-xs', isRtl && 'font-farsi')}>
                  {filterMode === 'unread'
                    ? t('notifications.noUnreadDesc')
                    : t('notifications.emptyDesc')}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const isRTLItem = isNotificationRTL(item);

                return (
                  <div
                    key={item.id}
                    dir={isRTLItem ? 'rtl' : 'ltr'}
                    onClick={() => onMarkAsRead?.(item.id)}
                    className={`group relative p-3 rounded-xl border transition-all text-xs space-y-2 cursor-default ${
                      !item.read
                        ? 'bg-zinc-50/90 dark:bg-zinc-900/90 border-zinc-300 dark:border-zinc-700/80 shadow-xs'
                        : 'bg-white dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700/60'
                    }`}
                  >
                    {/* Top line: Icon, Type Badge, Published Date */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
                          {getNotificationIcon(item)}
                        </div>
                        <span
                          dir="ltr"
                          className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border ${getBadgeStyle(
                            item
                          )}`}
                        >
                          {item.source === 'updater' ? 'Release' : item.type}
                        </span>
                        {!item.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                        )}
                      </div>

                      <span dir="ltr" className="text-[10px] text-zinc-500 font-mono shrink-0">
                        {formatTime(item.publishedAt)}
                      </span>
                    </div>

                    {/* Notification Title & Body */}
                    <div className="space-y-1">
                      <div
                        className={`font-semibold text-zinc-900 dark:text-zinc-100 break-words ${
                          isRTLItem
                            ? 'text-right font-farsi tracking-normal text-xs leading-[1.65]'
                            : 'leading-snug'
                        }`}
                      >
                        {item.title}
                      </div>
                      {item.message && (
                        <p
                          className={`text-zinc-600 dark:text-zinc-400 break-words whitespace-pre-line ${
                            isRTLItem
                              ? 'text-right font-farsi tracking-normal text-[11px] leading-[1.75]'
                              : 'text-[11px] leading-relaxed'
                          }`}
                        >
                          {item.message}
                        </p>
                      )}

                      {/* Structured Change Items (Categorized Badges & Bullets) */}
                      {Array.isArray(item.items) && item.items.length > 0 && (
                        <ul className="space-y-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/60 mt-2">
                          {item.items.map((it, idx) => {
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
                                      'text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 mt-0.5 tracking-wider',
                                      tagInfo.style,
                                      language === 'fa' && 'font-farsi text-[8.5px]'
                                    )}
                                  >
                                    {tagInfo.label}
                                  </span>
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 mt-1.5 shrink-0" />
                                )}

                                {it.version && (
                                  <span
                                    dir="ltr"
                                    className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                                  >
                                    v{it.version}
                                  </span>
                                )}

                                <span
                                  className={cn(
                                    'break-words min-w-0 flex-1',
                                    itemRtl && 'text-right font-farsi'
                                  )}
                                >
                                  {text}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {/* Actions (if configured) */}
                    {(item.actions?.length > 0 || item.action) && (
                      <div className="pt-1 flex items-center flex-wrap gap-2">
                        {item.source === 'updater' ? (
                          <>
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenUpdateModal?.();
                                onClose();
                              }}
                              className="gap-1.5 text-[11px] h-6 px-2.5 font-semibold"
                            >
                              <Download className="w-3 h-3" />
                              <span>{t('update.installNow')}</span>
                            </Button>
                            {item.action?.url && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExternalUrl(item.action.url);
                                }}
                                className="gap-1 text-[11px] h-6 px-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{t('update.releaseNotes')}</span>
                              </Button>
                            )}
                          </>
                        ) : (
                          (item.actions && item.actions.length > 0 ? item.actions : [item.action]).map((act, actIdx) => {
                            if (!act) return null;
                            const actionKey = `${item.id}-action-${actIdx}`;
                            const isCopied = copiedActionKey === actionKey;
                            const isActionRTLItem = act.label ? isRTL(act.label) : isRTLItem;

                            const handleAction = async (e) => {
                              e.stopPropagation();
                              if (act.type === 'copy_link' || act.type === 'copy_text') {
                                await copyTextNative(act.url || act.text || '');
                                setCopiedActionKey(actionKey);
                                setTimeout(() => setCopiedActionKey((prev) => (prev === actionKey ? null : prev)), 2000);
                                return;
                              }
                              if (act.url) {
                                openExternalUrl(act.url);
                              }
                            };

                            return (
                              <Button
                                key={actIdx}
                                variant={act.variant || (act.type === 'download' ? 'primary' : 'secondary')}
                                size="xs"
                                onClick={handleAction}
                                className={cn(
                                  'gap-1.5 text-[11px] h-6 px-2.5',
                                  act.variant === 'primary' ? 'font-semibold' : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white',
                                  isActionRTLItem && 'font-farsi tracking-normal'
                                )}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                                    <span>{language === 'fa' ? 'کپی شد!' : 'Copied!'}</span>
                                  </>
                                ) : act.type === 'copy_link' || act.type === 'copy_text' ? (
                                  <>
                                    <Share2 className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                    <span>{act.label || (language === 'fa' ? 'کپی لینک' : 'Copy Link')}</span>
                                  </>
                                ) : act.type === 'download' || act.url?.endsWith('.exe') ? (
                                  <>
                                    <Download className="w-3 h-3 shrink-0" />
                                    <span>{act.label || (language === 'fa' ? 'دانلود فایل' : 'Download')}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>{act.label || t('common.open')}</span>
                                    <ExternalLink className="w-3 h-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
                                  </>
                                )}
                              </Button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: Official Discord Community */}
          <div dir="ltr" className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-zinc-500 dark:text-zinc-400">
                <DiscordIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  Official Discord Server
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  discord.gg/TYPRXeKPp
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => openExternalUrl('https://discord.gg/TYPRXeKPp')}
              className="gap-1 text-xs h-7 px-2.5 shrink-0 text-zinc-700 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
            >
              <span>Join</span>
              <ExternalLink className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            </Button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}

export default NotificationCenter;
