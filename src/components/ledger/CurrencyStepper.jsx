import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TomanIcon } from '../ui/Icons';
import { cn } from '../../lib/utils';
import { EASE_OUT } from '../../lib/motion';
import { useLedgerFormat } from './format';

export const CURRENCY_CHOICES = ['TOMAN', 'USD', 'EUR'];

const GLYPH = {
  TOMAN: <TomanIcon className="h-5 w-5" aria-hidden="true" />,
  USD: <span aria-hidden="true" className="w-4 text-center font-semibold">$</span>,
  EUR: <span aria-hidden="true" className="w-4 text-center font-semibold">€</span>,
};

/**
 * "Show amounts in" as one small stepper instead of a row of four buttons: the current currency in the middle,
 * arrows to step through the others. The name rolls in the direction you step, the wheel and the arrow keys
 * step too, and a row of dots shows where you are. Hovering shows today's rate against Toman.
 */
export function CurrencyStepper({ value, onChange, rates }) {
  const f = useLedgerFormat();
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const dirRef = useRef(1);
  const index = Math.max(0, CURRENCY_CHOICES.indexOf(value));

  const step = (d) => {
    dirRef.current = d;
    onChange(CURRENCY_CHOICES[(index + d + CURRENCY_CHOICES.length) % CURRENCY_CHOICES.length]);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  // the wheel steps through currencies while the pointer is on the stepper (React's wheel listener is passive)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let last = 0;
    const onWheel = (e) => {
      // a sideways swipe or a feather-light scroll is not for this control: leave it to the page
      if (Math.abs(e.deltaY) < 4 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      if (now - last < 140) return; // one notch, one step; a trackpad flick is not four
      last = now;
      stepRef.current(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toman = f.t('lg.cur.TOMAN', 'Toman');
  const rateHint = (c) => {
    if (c === 'USD' && rates?.usdRateTOMAN > 0) return `1 $ ≈ ${f.formatNumber(rates.usdRateTOMAN)} ${toman}`;
    if (c === 'EUR' && rates?.eurRateUSD > 0 && rates?.usdRateTOMAN > 0) return `1 € ≈ ${f.formatNumber(Math.round(rates.eurRateUSD * rates.usdRateTOMAN))} ${toman}`;
    return undefined;
  };
  const label = f.t('lg.cur.show', 'Show amounts in');
  const name = f.t(`lg.cur.${CURRENCY_CHOICES[index]}`, CURRENCY_CHOICES[index]);
  const hint = rateHint(CURRENCY_CHOICES[index]);
  const arrow = 'inline-flex h-8 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500';
  // the roll follows the step: forward rolls up, back rolls down
  const y = (d) => (reduce ? 0 : `${d * 70}%`);

  return (
    <div className="mb-3 flex items-center justify-end gap-2">
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        title={hint}
        onKeyDown={(e) => {
          const fwd = ['ArrowDown', 'ArrowRight'].includes(e.key);
          const back = ['ArrowUp', 'ArrowLeft'].includes(e.key);
          if (!fwd && !back) return;
          e.preventDefault();
          // in Farsi the arrows point the other way on screen, so left/right follow the reading direction
          const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
          const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
          step((fwd ? 1 : -1) * (horizontal && rtl ? -1 : 1));
        }}
        className="inline-flex h-10 items-center rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 px-0.5"
      >
        <button type="button" onClick={() => step(-1)} aria-label={f.t('lg.cur.prev', 'Previous currency')} className={arrow}>
          <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`${label}: ${name}`}
          className="relative flex h-8 w-[6.5rem] flex-col items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
        >
          <AnimatePresence initial={false} mode="popLayout" custom={dirRef.current}>
            <motion.span
              key={value}
              custom={dirRef.current}
              variants={{
                enter: (d) => ({ y: y(d), opacity: 0 }),
                center: { y: 0, opacity: 1 },
                exit: (d) => ({ y: y(-d), opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: EASE_OUT }}
              aria-live="polite"
              className="-mt-1 flex items-center gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100"
            >
              {GLYPH[CURRENCY_CHOICES[index]]}
              {name}
            </motion.span>
          </AnimatePresence>
          <span aria-hidden="true" className="absolute bottom-1 flex gap-[3px]">
            {CURRENCY_CHOICES.map((c, i) => (
              <span key={c} className={cn('h-[3px] rounded-full transition-[width,background-color] duration-200', i === index ? 'w-2.5 bg-zinc-500 dark:bg-zinc-400' : 'w-[3px] bg-zinc-300 dark:bg-zinc-700')} />
            ))}
          </span>
        </button>
        <button type="button" onClick={() => step(1)} aria-label={f.t('lg.cur.next', 'Next currency')} className={arrow}>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
