import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toBlob } from 'html-to-image';
import { Camera, Check, Pencil, CircleCheck, CirclePlay, CircleX, Clock, Copy, Loader2, MessageSquare, Store, StickyNote, Users } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { CheckpointLogo, DiscordIcon } from '../ui/Icons';
import { formatMoney } from '../../lib/currencies';
import { copyTextNative, copyImageNative, downloadImageBlob } from '../../lib/desktop';
import { incrementLocalReceiptCount } from '../../lib/telemetry';
import { useLanguage, formatShamsiDate, formatClock, resolveHour12 } from '../../lib/i18n';
import { toPersianDigits } from '../../lib/persianCalendar';
import { fromMinor } from '../../lib/ledger/money';
import {
  RECEIPT_WORDS, heroLabel, heroMinor, receiptDiscord, receiptPlainText, receiptSubtitle, receiptTitle, statusText, statusTone,
} from '../../lib/ledger/receipt';
import { cn } from '../../lib/utils';
import { Initial } from './parts';

const TONE = {
  paid: { chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', Icon: CircleCheck },
  unpaid: { chip: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30', Icon: Clock },
  progress: { chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30', Icon: CirclePlay },
  dead: { chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30', Icon: CircleX },
};

/** Formatting for the receipt's own language (a Farsi receipt can be sent from an English app). */
function makeFmt(lang, hour12 = lang !== 'fa') {
  const fa = lang === 'fa';
  return {
    money: (minor, currency) => {
      const text = formatMoney(fromMinor(minor, currency), currency, false, fa);
      return fa ? text : text.replace('تومان', 'Toman');
    },
    date: (iso) => {
      const d = new Date(iso);
      if (!iso || Number.isNaN(d.getTime())) return '';
      return fa ? formatShamsiDate(d, { month: 'long', day: 'numeric', year: 'numeric' }) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },
    time: (iso) => formatClock(iso, lang, hour12),
    num: (n) => (fa ? toPersianDigits(n) : String(n)),
  };
}

function StatusChip({ tone, children }) {
  const { chip, Icon } = TONE[tone] || TONE.progress;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', chip)}>
      <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />{children}
    </span>
  );
}

function CopyFeedback({ done, Icon, className }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.span key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.12 }} className="flex items-center"><Check className={cn(className, 'text-emerald-500')} /></motion.span>
      ) : (
        <motion.span key="idle" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.12 }} className="flex items-center"><Icon className={className} /></motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * A receipt for one order, built from the ledger. Advertisers get the client's receipt and the boosters' payout slip;
 * boosters get a proof-of-work receipt. The same facts are on the card, in the copied text, and in the Discord block.
 */
export function LedgerReceipt({ open, onClose, receipt, profileId, onOpenLightbox, onEdit }) {
  const { language, isRtl, timeFormat } = useLanguage();
  const isAdvertiser = profileId === 'advertiser';
  const cardRef = useRef(null);
  const [lang, setLang] = useState(language);
  const [mode, setMode] = useState(isAdvertiser ? 'client' : 'work');
  const [capturing, setCapturing] = useState(false);
  const [copied, setCopied] = useState('');
  const vm = receipt;

  useEffect(() => { if (open) { setLang(language); setMode(isAdvertiser ? 'client' : 'work'); } }, [open, language, isAdvertiser, vm?.id]);

  // the receipt can be in another language than the app, so "auto" follows the receipt's language
  const fmt = useMemo(() => makeFmt(lang, resolveHour12(timeFormat, lang)), [lang, timeFormat]);
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  const isFa = lang === 'fa';

  const flash = useCallback((key) => { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1800); }, []);
  const copyText = useCallback(async (kind, opts) => {
    if (!vm) return;
    await copyTextNative(kind === 'discord' ? receiptDiscord(vm, mode, lang, fmt, opts) : receiptPlainText(vm, mode, lang, fmt, opts));
    incrementLocalReceiptCount();
    flash(opts?.onlyShare ? `slip:${opts.onlyShare.id}` : kind);
  }, [vm, mode, lang, fmt, flash]);

  const capture = useCallback(async () => {
    if (!cardRef.current || capturing || !vm) return;
    try {
      setCapturing(true);
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 60));
      const dark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
      const bg = dark ? '#09090b' : '#ffffff';
      // The picture has a 24px margin of background colour around the card. The card is border-box, so padding added
      // to it would be taken out of its own fixed size and clip the content (overflow-hidden): grow the canvas by the
      // same amount instead.
      const MARGIN = 24;
      const card = cardRef.current;
      const blob = await toBlob(card, {
        pixelRatio: 2, backgroundColor: bg, cacheBust: true,
        width: card.offsetWidth + MARGIN * 2,
        height: card.offsetHeight + MARGIN * 2,
        // the on-screen card's border and rounded corners are chrome, not part of the picture: keep the border's width
        // (so nothing reflows) but make it invisible, and square the corners
        style: { padding: `${MARGIN}px`, backgroundColor: bg, margin: '0', borderColor: 'transparent', borderRadius: '0' },
        filter: (node) => !(node.classList && node.classList.contains('hide-in-screenshot')),
      });
      if (!blob) throw new Error('No image was produced');
      const ok = await copyImageNative({ blob });
      incrementLocalReceiptCount();
      if (ok) flash('image'); else downloadImageBlob(blob, `checkpoint_receipt_${vm.code.toLowerCase()}.png`);
    } catch (err) {
      console.error('Receipt screenshot failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, vm, flash]);

  // C or S copies the picture, as before
  useEffect(() => {
    if (!open || !vm) return undefined;
    const onKey = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      if (/^[cs]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); capture(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, vm, capture]);

  if (!vm) return null;

  const tone = statusTone(vm);
  const hero = heroMinor(vm, mode);
  const showShares = (mode === 'slip' || (mode === 'work' && vm.shares.length > 0));
  const tomanEquivalent = vm.rates ? vm.tomanMinor(vm.dead ? vm.grossMinor : hero) : null;
  const ratesText = (() => {
    if (!vm.rates) return '';
    const parts = [];
    if (vm.currency === 'GOLD' && vm.rates.goldRateTOMAN) parts.push(`${fmt.money(vm.rates.goldRateTOMAN, 'TOMAN')} / ${vm.rates.perOneGold ? w.gold1 : w.gold1k}`);
    if ((vm.currency === 'USD' || vm.currency === 'EUR') && vm.rates.usdRateTOMAN) parts.push(`$1 = ${fmt.money(vm.rates.usdRateTOMAN, 'TOMAN')}`);
    if (vm.currency === 'EUR' && vm.rates.eurRateUSD) parts.push(`€1 = $${fmt.num(vm.rates.eurRateUSD)}`);
    return parts.join(' · ');
  })();
  const titleText = isAdvertiser ? receiptTitle(mode, language) : receiptTitle('work', language);

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="max-w-lg">
      <DialogHeader onClose={onClose}>
        <div className="flex w-full items-center justify-between pe-6">
          <DialogTitle className={cn(isRtl && 'font-farsi')}>{titleText}</DialogTitle>
          <div role="group" aria-label="Receipt language" className="flex items-center rounded-md border border-zinc-200 bg-zinc-100 p-0.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
            {[['fa', 'فارسی'], ['en', 'EN']].map(([code, label]) => (
              <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code} className={cn('rounded px-2 py-0.5 font-medium transition-colors', lang === code ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100')}>{label}</button>
            ))}
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4 p-6">
        {isAdvertiser && (
          <div role="tablist" aria-label="Receipt type" className="hide-in-screenshot mx-auto flex w-fit items-center rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
            {[['client', Store, w.clientTitle], ['slip', Users, w.slipTitle]].map(([key, Icon, label]) => (
              <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors', mode === key ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100')}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        )}

        <div ref={cardRef} dir={isFa ? 'rtl' : 'ltr'} className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 select-text dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100', isFa && 'font-farsi')}>
          {/* who is speaking, and when */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-2.5">
              <CheckpointLogo className="h-7 w-7 shrink-0 text-zinc-900 dark:text-zinc-100" />
              <div>
                <div className="text-sm font-black tracking-wider">CHECKPOINT</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{receiptSubtitle(isAdvertiser ? mode : 'work', lang)}</div>
              </div>
            </div>
            <div className="text-end">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400" dir="ltr">{w.receiptNo} {vm.code}</div>
              <div className="text-[11px] text-zinc-700 dark:text-zinc-300">{fmt.date(vm.dateTime)}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{fmt.time(vm.dateTime)}</div>
            </div>
          </div>

          {/* the number this document is about */}
          <div className="px-5 pb-4 pt-5">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{heroLabel(vm, mode, lang)}</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className={cn('text-[28px] font-semibold leading-none tracking-tight tabular-nums', vm.dead && 'text-zinc-400 line-through dark:text-zinc-500')}>{fmt.money(vm.dead ? vm.grossMinor : hero, vm.currency)}</div>
              {mode !== 'slip' && <StatusChip tone={tone}>{statusText(vm, lang, fmt)}</StatusChip>}
            </div>
            {tomanEquivalent !== null && <div className="mt-1 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">≈ {fmt.money(tomanEquivalent, 'TOMAN')}</div>}
          </div>

          {/* what it was */}
          <div className="border-t border-dashed border-zinc-300 px-5 py-4 dark:border-zinc-700">
            <div className="text-base font-medium leading-snug">{vm.title || w.untitled}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-700 dark:text-zinc-400">
              {vm.game && <span className="inline-flex items-center gap-1.5"><GameIcon game={vm.game} className="h-4 w-4" /><span>{vm.game}</span></span>}
              {vm.payer && <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" /><span>{vm.payer}</span></span>}
              {vm.orderRef && <span className="inline-flex items-center gap-1" dir="ltr"><span className="text-zinc-400">{w.orderNo}</span>#{vm.orderRef}</span>}
            </div>
          </div>

          {/* who was paid what */}
          {showShares && (
            <div className="border-t border-dashed border-zinc-300 px-5 py-4 dark:border-zinc-700">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>{mode === 'slip' ? w.boosters : w.team}</span>
                {mode === 'work' && <span className="tabular-nums">{w.pot} {fmt.money(vm.grossMinor - vm.feeMinor, vm.currency)}</span>}
              </div>
              <ul className="space-y-1.5">
                {vm.shares.map((s) => {
                  const sTone = statusTone(vm, { share: s });
                  return (
                    <li key={s.id} className="flex items-center gap-2.5">
                      <Initial name={s.name} className="h-6 w-6 text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{s.name}</span>
                        {s.note && <span className="block truncate text-[11px] text-zinc-500">{s.note}</span>}
                      </div>
                      {mode === 'slip' && <StatusChip tone={sTone}>{statusText(vm, lang, fmt, { share: s })}</StatusChip>}
                      <span className="text-[13px] font-medium tabular-nums">{fmt.money(s.amountMinor, vm.currency)}</span>
                      {mode === 'slip' && (
                        <button type="button" onClick={() => copyText('discord', { onlyShare: s })} title={w.copySlip.replace('{name}', s.name)} aria-label={w.copySlip.replace('{name}', s.name)} className="hide-in-screenshot inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                          <CopyFeedback done={copied === `slip:${s.id}`} Icon={DiscordIcon} className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* small print: fee, rates, notes */}
          {((mode === 'work' && vm.feeMinor > 0) || (ratesText && mode !== 'client') || vm.note) && (
            <dl className="space-y-1.5 border-t border-dashed border-zinc-300 px-5 py-4 text-[12px] dark:border-zinc-700">
              {mode === 'work' && vm.feeMinor > 0 && (
                <div className="flex items-baseline justify-between gap-4"><dt className="text-zinc-500 dark:text-zinc-400">{w.fee}</dt><dd className="tabular-nums">{fmt.num(vm.feePct)}% · {fmt.money(vm.feeMinor, vm.currency)}</dd></div>
              )}
              {ratesText && mode !== 'client' && (
                <div className="flex items-baseline justify-between gap-4"><dt className="text-zinc-500 dark:text-zinc-400">{w.rates}</dt><dd className="tabular-nums" dir="ltr">{ratesText}</dd></div>
              )}
              {vm.note && (
                <div className="flex gap-2 pt-0.5"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" /><p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{vm.note}</p></div>
              )}
            </dl>
          )}

          {vm.proofs.length > 0 && (
            <div className="border-t border-dashed border-zinc-300 px-5 py-4 dark:border-zinc-700">
              <div className="mb-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{w.proofs} ({fmt.num(vm.proofs.length)})</div>
              <div className="flex flex-wrap gap-2">
                {vm.proofs.map((p) => (
                  <button key={p.id} type="button" onClick={() => onOpenLightbox?.(p.data, vm.title)} className="overflow-hidden rounded-lg border border-zinc-200 transition-opacity hover:opacity-80 dark:border-zinc-700">
                    <img src={p.data} alt={p.name || 'Proof'} className="h-16 w-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-2.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />{mode === 'client' ? w.footClient : mode === 'slip' ? w.footSlip : w.footWork}</span>
            <span dir="ltr">{vm.code} · {fmt.time(vm.dateTime)}</span>
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={capture} disabled={capturing} title="Copy the receipt as a picture (C or S)" aria-label="Copy the receipt as a picture" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyFeedback done={copied === 'image'} Icon={Camera} className="h-4 w-4" />}
          </Button>
            <Button variant="secondary" size="sm" onClick={() => copyText('discord')}><CopyFeedback done={copied === 'discord'} Icon={MessageSquare} className="h-3.5 w-3.5" /><span>Discord</span></Button>
            <Button variant="primary" size="sm" onClick={() => copyText('text')}><CopyFeedback done={copied === 'text'} Icon={Copy} className="h-3.5 w-3.5" /><span>{isFa ? 'کپی متن' : 'Copy text'}</span></Button>
          </div>
          {onEdit && vm?.id && (
            <Button variant="outline" size="sm" onClick={() => onEdit(vm.id)}><Pencil className="h-3.5 w-3.5" /><span>{isFa ? 'ویرایش' : 'Edit'}</span></Button>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
}

export default LedgerReceipt;
