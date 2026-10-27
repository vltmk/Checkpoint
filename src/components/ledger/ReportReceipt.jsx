import React, { useCallback, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { Camera, Check, Copy, Loader2 } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { CheckpointLogo, DiscordIcon } from '../ui/Icons';
import { copyTextNative, copyImageNative, downloadImageBlob } from '../../lib/desktop';
import { incrementLocalReceiptCount } from '../../lib/telemetry';
import { reportReceiptDiscord, reportReceiptText } from '../../lib/ledger/reportReceipt';
import { useLedgerFormat } from './format';

/**
 * A Reports period as a receipt: what came in, what went out and what you kept, plus the best months, clients or
 * games. Copy it as text, for Discord, or as a picture.
 */
export function ReportReceipt({ open, onClose, receipt }) {
  const f = useLedgerFormat();
  const cardRef = useRef(null);
  const [copied, setCopied] = useState('');
  const [capturing, setCapturing] = useState(false);

  const flash = useCallback((key) => { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1800); }, []);
  const copy = useCallback(async (kind) => {
    if (!receipt) return;
    await copyTextNative(kind === 'discord' ? reportReceiptDiscord(receipt) : reportReceiptText(receipt));
    incrementLocalReceiptCount();
    flash(kind);
  }, [receipt, flash]);

  const capture = useCallback(async () => {
    if (!cardRef.current || capturing) return;
    try {
      setCapturing(true);
      if (document.fonts?.ready) await document.fonts.ready;
      const dark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
      const bg = dark ? '#09090b' : '#ffffff';
      const MARGIN = 24;
      const card = cardRef.current;
      const blob = await toBlob(card, {
        pixelRatio: 2, backgroundColor: bg, cacheBust: true,
        width: card.offsetWidth + MARGIN * 2,
        height: card.offsetHeight + MARGIN * 2,
        style: { padding: `${MARGIN}px`, backgroundColor: bg, margin: '0', borderColor: 'transparent', borderRadius: '0' },
      });
      if (!blob) throw new Error('No image was produced');
      const ok = await copyImageNative({ blob });
      incrementLocalReceiptCount();
      if (ok) flash('image'); else downloadImageBlob(blob, 'checkpoint_report.png');
    } catch (err) {
      console.error('Report receipt picture failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, flash]);

  const done = useMemo(() => <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{f.t('lg.rr.dialog', 'Report receipt')}</DialogTitle>
      </DialogHeader>
      <DialogContent>
        {receipt && (
          <div ref={cardRef} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 text-xs" dir={f.isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{receipt.title}</div>
                <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">{receipt.period}</div>
              </div>
              <CheckpointLogo className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" />
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-3">
              {receipt.lines.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500 dark:text-zinc-400">{k}</dt>
                  <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-zinc-300 dark:border-zinc-700 pt-3">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{receipt.keepLabel}</span>
              <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{receipt.keep}</span>
            </div>

            {receipt.top.length > 0 && (
              <div className="mt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700 pt-3">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">{receipt.topTitle}</div>
                <ol className="space-y-1">
                  {receipt.top.map(([k, v], i) => (
                    <li key={k + i} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300"><span className="me-1.5 tabular-nums text-zinc-400">{f.formatNumber(i + 1)}.</span>{k}</span>
                      <span className="shrink-0 tabular-nums text-zinc-800 dark:text-zinc-200">{v}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 text-[10.5px] text-zinc-400 dark:text-zinc-500">
              <span>{receipt.generatedAt}</span>
              <span>Checkpoint</span>
            </div>
            {receipt.approximate && <p className="mt-2 text-[10.5px] text-zinc-400 dark:text-zinc-500">{receipt.approxNote}</p>}
          </div>
        )}
      </DialogContent>
      <DialogFooter className="justify-between">
        <Button variant="ghost" onClick={capture} disabled={capturing}>
          {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : copied === 'image' ? done : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
          {f.t('lg.rr.image', 'Copy picture')}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => copy('discord')}>
            {copied === 'discord' ? done : <DiscordIcon className="h-3.5 w-3.5" />}
            {f.t('lg.rr.discord', 'Copy for Discord')}
          </Button>
          <Button variant="primary" onClick={() => copy('text')}>
            {copied === 'text' ? done : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {f.t('lg.rr.text', 'Copy text')}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
