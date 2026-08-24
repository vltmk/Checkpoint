import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  ExternalLink,
  Download,
  Info,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
  Megaphone,
  Layers,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/Button';
import { openExternalUrl } from '../lib/desktop';

export function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
  onOpenUpdateModal,
}) {
  if (!isOpen) return null;

  const activeNotifications = notifications.filter((item) => !item.dismissed);

  const getNotificationIcon = (item) => {
    if (item.source === 'updater') {
      return <ArrowUpCircle className="w-4 h-4 text-emerald-400" />;
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

  const getBadgeStyle = (item) => {
    if (item.source === 'updater') {
      return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60';
    }
    switch (item.type) {
      case 'critical':
        return 'bg-rose-950/50 text-rose-300 border-rose-800/60';
      case 'warning':
        return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
      case 'success':
        return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60';
      case 'info':
      default:
        return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
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
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="relative w-full max-w-md bg-zinc-950 border-l border-zinc-800/90 h-full flex flex-col shadow-2xl z-10 text-zinc-100"
          data-no-drag
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                <Bell className="w-3.5 h-3.5 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Notifications & Feed
                </h2>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {notifications.length} {notifications.length === 1 ? 'record' : 'records'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notifications.some((n) => !n.read) && (
                <button
                  type="button"
                  onClick={() => onMarkAllAsRead?.()}
                  title="Mark all as read"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
                >
                  <CheckCheck className="w-3 h-3 text-zinc-400" />
                  <span>Read all</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearAll?.()}
                  title="Clear history"
                  className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors ml-1"
                aria-label="Close Notification Center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 gpu-scroll">
            {activeNotifications.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                <Bell className="w-6 h-6 text-zinc-700 stroke-[1.5]" />
                <p className="text-xs font-medium text-zinc-400">No notifications</p>
                <p className="text-[11px] text-zinc-600 max-w-xs">
                  No active announcements or updates at this time.
                </p>
              </div>
            ) : (
              activeNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onMarkAsRead?.(item.id)}
                  className={`group relative p-3 rounded-xl border transition-all text-xs space-y-2 cursor-default ${
                    !item.read
                      ? 'bg-zinc-900/90 border-zinc-700/80 shadow-md'
                      : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700/60'
                  }`}
                >
                  {/* Top line: Icon, Type Badge, Published Date, Dismiss */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                        {getNotificationIcon(item)}
                      </div>
                      <span
                        className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded border ${getBadgeStyle(
                          item
                        )}`}
                      >
                        {item.source === 'updater' ? 'Release' : item.type}
                      </span>
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatTime(item.publishedAt)}
                      </span>
                      {item.dismissible !== false && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss?.(item.id);
                          }}
                          title="Dismiss"
                          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notification Title & Body */}
                  <div className="space-y-1">
                    <div className="font-semibold text-zinc-100 leading-snug break-words">
                      {item.title}
                    </div>
                    {item.message && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed break-words whitespace-pre-line">
                        {item.message}
                      </p>
                    )}
                  </div>

                  {/* Actions (if configured) */}
                  {item.action && (
                    <div className="pt-1 flex items-center gap-2">
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
                            <span>Update Checkpoint</span>
                          </Button>
                          {item.action.url && (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                openExternalUrl(item.action.url);
                              }}
                              className="gap-1 text-[11px] h-6 px-2 text-zinc-400"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Release Notes</span>
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.action.url) {
                              openExternalUrl(item.action.url);
                            }
                          }}
                          className="gap-1.5 text-[11px] h-6 px-2.5 text-zinc-200"
                        >
                          <span>{item.action.label || 'Open Link'}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 border-t border-zinc-900 bg-zinc-950/80 text-[10px] text-zinc-500 text-center font-mono">
            Checkpoint • Local-First Ledger Engine
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default NotificationCenter;
