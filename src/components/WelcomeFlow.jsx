import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Megaphone, ReceiptText, Sparkles, Wallet, Wrench, Zap } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { CheckpointLogo, TomanIcon } from './ui/Icons';
import { useLanguage } from '../lib/i18n';
import { RELEASE_NOTES_REGISTRY } from '../lib/releaseNotes';
import { WELCOME_RELEASE } from '../lib/welcome';
import { EASE_OUT } from '../lib/motion';
import { cn } from '../lib/utils';

const STEP = { duration: 0.22, ease: EASE_OUT };
const TAG_ICON = { new: Sparkles, improved: Wrench, fixed: Check };

/**
 * The welcome screen, in short steps.
 *  - mode 'new': welcome, pick a role, pick a currency and language
 *  - mode 'returning': welcome back, then what is new in this release (the profile is left as it is)
 * Esc or the last button finishes; nothing here can lose data, so skipping is always allowed.
 */
export function WelcomeFlow({ open, mode = 'new', currentProfile = 'booster', currency = 'TOMAN', onCurrencyChange, onOpenNotes, onDone }) {
  const { t, language, setLanguage, isRtl, formatNumber } = useLanguage();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState(currentProfile);

  useEffect(() => {
    if (open) { setStep(0); setDir(1); setRole(currentProfile); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = mode === 'returning' ? ['hello', 'news'] : ['hello', 'role', 'setup'];
  const last = step === steps.length - 1;
  const go = (d) => { setDir(d); setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d))); };
  const finish = () => onDone?.({ role: mode === 'new' ? role : currentProfile });

  // in Farsi the screen reads right to left, so "forward" slides the other way
  const shift = (d) => (reduce ? 0 : (isRtl ? -d : d) * 24);
  const lang = language === 'fa' ? 'fa' : 'en';
  const notes = RELEASE_NOTES_REGISTRY[WELCOME_RELEASE];
  const version = language === 'fa' ? formatNumber(WELCOME_RELEASE) : WELCOME_RELEASE;

  const hello = (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
      >
        <CheckpointLogo className="h-8 w-8 text-zinc-900 dark:text-zinc-100" />
      </motion.div>
      <Rise i={1}>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {mode === 'returning' ? t('welcome.backTitle', 'Welcome back') : t('welcome.title', 'Welcome to Checkpoint')}
        </h2>
      </Rise>
      <Rise i={2}>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {mode === 'returning'
            ? t('welcome.backBody', 'Checkpoint {version} is here. Here is what changed, in one minute.').replace('{version}', version)
            : t('welcome.body', 'A ledger for your boosting and reselling work. Everything stays on this computer.')}
        </p>
      </Rise>
      {mode === 'new' && (
        <ul className="mt-6 w-full max-w-sm space-y-2.5 text-start">
          {[
            [ClipboardList, t('welcome.point1', 'Log a job or an order in seconds')],
            [Wallet, t('welcome.point2', 'See who owes you, and who you owe')],
            [ReceiptText, t('welcome.point3', 'Share receipts and reports')],
          ].map(([Icon, text], i) => (
            <Rise key={text} i={3 + i} as="li" className="flex items-center gap-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2.5">
              <Icon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              <span className="text-xs text-zinc-800 dark:text-zinc-200">{text}</span>
            </Rise>
          ))}
        </ul>
      )}
    </div>
  );

  const roles = [
    { id: 'booster', Icon: Zap, title: t('welcome.booster', 'Booster'), body: t('welcome.boosterBody', 'You do the work. Track your jobs, who pays you, and what you earned.') },
    { id: 'advertiser', Icon: Megaphone, title: t('welcome.advertiser', 'Advertiser'), body: t('welcome.advertiserBody', 'You sell the work. Track orders, pay your boosters, and see your margin.') },
  ];
  const rolePick = (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t('welcome.roleTitle', 'How do you work?')}</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('welcome.roleBody', 'Pick one to start. You can use both and switch anytime from the top bar.')}</p>
      <div role="radiogroup" aria-label={t('welcome.roleTitle', 'How do you work?')} className="mt-5 grid grid-cols-2 gap-3">
        {roles.map(({ id, Icon, title, body }, i) => {
          const on = role === id;
          return (
            <Rise key={id} i={i + 1}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRole(id)}
                className={cn(
                  'flex h-full w-full flex-col items-start gap-3 rounded-xl border p-4 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
                  on ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className={cn('inline-flex h-4 w-4 items-center justify-center rounded-full border transition-colors', on ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700')}>
                    {on && <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />}
                  </span>
                </span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
                <span className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</span>
              </button>
            </Rise>
          );
        })}
      </div>
    </div>
  );

  const choice = (on) => cn(
    'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors duration-150',
    on ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
  );
  const setup = (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{t('welcome.setupTitle', 'Two quick choices')}</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('welcome.setupBody', 'Both can be changed later in Settings.')}</p>
      <Rise i={1}>
        <div className="mt-5 text-xs text-zinc-600 dark:text-zinc-400">{t('welcome.language', 'Language')}</div>
        <div className="mt-1.5 flex gap-2">
          <button type="button" className={choice(language === 'en')} onClick={() => setLanguage('en')}>English</button>
          <button type="button" className={cn(choice(language === 'fa'), 'font-farsi')} onClick={() => setLanguage('fa')}>فارسی</button>
        </div>
      </Rise>
      <Rise i={2}>
        <div className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">{t('welcome.currency', 'Show amounts in')}</div>
        <div className="mt-1.5 flex gap-2" dir="ltr">
          {[['TOMAN', <TomanIcon key="t" className="h-4 w-4" />], ['USD', '$'], ['EUR', '€']].map(([c, glyph]) => (
            <button key={c} type="button" className={choice(currency === c)} onClick={() => onCurrencyChange?.(c)}>
              <span aria-hidden="true">{glyph}</span>{c === 'TOMAN' ? t('welcome.toman', 'Toman') : c}
            </button>
          ))}
        </div>
      </Rise>
    </div>
  );

  const news = (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{notes?.title?.[lang] || t('welcome.newsTitle', "What's new")}</h2>
      {notes?.summary?.[lang] && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{notes.summary[lang]}</p>}
      <ul className="mt-5 space-y-2">
        {(notes?.items?.[lang] || []).slice(0, 5).map((it, i) => {
          const Icon = TAG_ICON[it.tag] || Sparkles;
          return (
            <Rise key={it.text} i={i + 1} as="li" className="flex items-start gap-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2.5">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              <span className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">{it.text}</span>
            </Rise>
          );
        })}
      </ul>
      {onOpenNotes && (
        <button type="button" onClick={() => { finish(); onOpenNotes(); }} className="mt-3 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline-offset-2 hover:underline">
          {t('welcome.allNotes', 'All patch notes are in the notification center')}
        </button>
      )}
    </div>
  );

  const body = { hello, role: rolePick, setup, news }[steps[step]];

  return (
    <Dialog open={open} onClose={finish} maxWidth="max-w-[520px]">
      <div className="flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="relative min-h-[340px] overflow-hidden px-7 pt-8 pb-4">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={steps[step]}
              custom={dir}
              variants={{
                enter: (d) => ({ opacity: 0, x: shift(d) }),
                center: { opacity: 1, x: 0 },
                exit: (d) => ({ opacity: 0, x: shift(-d) }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={STEP}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200/80 dark:border-zinc-800/80 px-5 py-3">
          <div className="flex items-center gap-1.5" aria-label={t('welcome.progress', 'Step {n} of {total}').replace('{n}', formatNumber(step + 1)).replace('{total}', formatNumber(steps.length))}>
            {steps.map((s, i) => (
              <span key={s} aria-hidden="true" className={cn('h-1.5 rounded-full transition-[width,background-color] duration-200', i === step ? 'w-5 bg-zinc-900 dark:bg-zinc-100' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700')} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => go(-1)}>
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />{t('welcome.back', 'Back')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={finish}>{t('welcome.skip', 'Skip')}</Button>
            )}
            <Button variant="primary" onClick={last ? finish : () => go(1)} autoFocus>
              {last ? (mode === 'returning' ? t('welcome.continue', 'Continue') : t('welcome.start', 'Start')) : t('welcome.next', 'Next')}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/** A block that rises into place a beat after the one before it (40ms stagger), so a step reads top to bottom. */
function Rise({ i = 0, as = 'div', className, children }) {
  const reduce = useReducedMotion();
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay: 0.05 + i * 0.04 }}
    >
      {children}
    </Tag>
  );
}
