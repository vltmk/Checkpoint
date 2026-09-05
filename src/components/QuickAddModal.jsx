import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { SourceCombobox } from './ui/SourceCombobox';
import { GameIcon } from './ui/GameIcon';
import { Kbd } from './ui/Tooltip';
import { AlertTriangle, ArrowRightLeft, Banknote, Check, Coins, Copy, Zap } from 'lucide-react';
import { toLocalISOString } from './ui/DateTimePicker';
import { convertCurrency, formatMoney } from '../lib/currencies';
import { useLanguage, normalizeDigits } from '../lib/i18n';
import { trackerDB } from '../lib/db';
import { copyTextNative } from '../lib/desktop';
import { cn } from '../lib/utils';

const LAST_GAME_KEY = 'checkpoint_quick_last_game';
const LEGACY_LAST_GAME_KEY = 'vault_quick_last_game';
const LAST_CUSTOM_GAME_KEY = 'checkpoint_quick_last_custom_game';
const LEGACY_LAST_CUSTOM_GAME_KEY = 'vault_quick_last_custom_game';
const LAST_SOURCE_KEY = 'checkpoint_quick_last_source';
const LEGACY_LAST_SOURCE_KEY = 'vault_quick_last_source';
const LAST_CURRENCY_KEY = 'checkpoint_quick_last_currency';
const LEGACY_LAST_CURRENCY_KEY = 'vault_quick_last_currency';

export function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();

  const GAME_OPTIONS = [
    { value: 'World of Warcraft', label: 'World of Warcraft' },
    { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
    { value: '__custom__', label: `+ ${t('work.customGameOption', 'Custom Game / Realm')}` },
  ];
  const [title, setTitle] = useState('');
  const [hasTitleError, setHasTitleError] = useState(false);
  const [hasGameError, setHasGameError] = useState(false);
  const [hasPriceError, setHasPriceError] = useState(false);
  const [game, setGame] = useState('World of Warcraft');
  const [isCustomGame, setIsCustomGame] = useState(false);
  const [customGameText, setCustomGameText] = useState('');
  const [source, setSource] = useState('');
  const [currency, setCurrency] = useState(globalCurrency);
  const [price, setPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  
  const titleInputRef = useRef(null);
  const entryIdRef = useRef(null);

  // Initialize and load sticky memory when opened
  useEffect(() => {
    if (!isOpen) return;

    setTitle('');
    setPrice('');
    setHasTitleError(false);
    setHasGameError(false);
    setHasPriceError(false);
    setIsSaving(false);
    setSaveError(null);
    setDiagnosticsCopied(false);
    entryIdRef.current = null;

    try {
      const savedGame = localStorage.getItem(LAST_GAME_KEY) || localStorage.getItem(LEGACY_LAST_GAME_KEY);
      const savedCustomGame = localStorage.getItem(LAST_CUSTOM_GAME_KEY) || localStorage.getItem(LEGACY_LAST_CUSTOM_GAME_KEY);
      const savedSource = localStorage.getItem(LAST_SOURCE_KEY) || localStorage.getItem(LEGACY_LAST_SOURCE_KEY);
      const savedCurrency = localStorage.getItem(LAST_CURRENCY_KEY) || localStorage.getItem(LEGACY_LAST_CURRENCY_KEY);

      const applySticky = (g, cg, s, c) => {
        if (g) {
          if (g === '__custom__') {
            setGame('__custom__');
            setIsCustomGame(true);
            setCustomGameText(cg || '');
          } else {
            setGame(g);
            setIsCustomGame(false);
            setCustomGameText('');
          }
        } else {
          setGame('World of Warcraft');
          setIsCustomGame(false);
          setCustomGameText('');
        }

        if (s) {
          setSource(s);
        }

        if (c && ['TOMAN', 'GOLD'].includes(c)) {
          setCurrency(c);
        } else {
          setCurrency(globalCurrency || 'TOMAN');
        }
      };

      applySticky(savedGame, savedCustomGame, savedSource, savedCurrency);

      // Also hydrate missing values from SQLite trackerDB
      Promise.all([
        trackerDB.getSetting(LAST_GAME_KEY, null),
        trackerDB.getSetting(LAST_CUSTOM_GAME_KEY, null),
        trackerDB.getSetting(LAST_SOURCE_KEY, null),
        trackerDB.getSetting(LAST_CURRENCY_KEY, null),
      ]).then(([dbGame, dbCustomGame, dbSource, dbCurrency]) => {
        const finalGame = savedGame || dbGame;
        const finalCustomGame = savedCustomGame || dbCustomGame;
        const finalSource = savedSource || dbSource;
        const finalCurrency = savedCurrency || dbCurrency;
        applySticky(finalGame, finalCustomGame, finalSource, finalCurrency);
      }).catch(() => {});
    } catch (e) {
      setGame('World of Warcraft');
      setIsCustomGame(false);
      setCurrency(globalCurrency || 'TOMAN');
    }

    // Focus title input immediately
    const timer = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, globalCurrency]);

  const isClassic =
    game === 'World of Warcraft Classic' ||
    (!isCustomGame && game?.toLowerCase().includes('classic'));

  const rateNum = isClassic ? 7000 : (Number(goldRateTOMAN) || 3200);

  const handleGameSelect = (val) => {
    setHasGameError(false);
    if (saveError) setSaveError(null);
    if (val === '__custom__') {
      setGame('__custom__');
      setIsCustomGame(true);
    } else {
      setGame(val);
      setIsCustomGame(false);
      setCustomGameText('');
    }
  };

  const handleToggleCurrency = () => {
    setCurrency((prev) => (prev === 'TOMAN' ? 'GOLD' : 'TOMAN'));
  };

  // Real-time alternate currency calculation
  const numericPrice = parseFloat(price) || 0;
  const altCurrency = currency === 'TOMAN' ? 'GOLD' : 'TOMAN';
  const convertedPrice = numericPrice > 0
    ? convertCurrency(
        numericPrice,
        currency,
        altCurrency,
        { goldRateTOMAN: rateNum },
        rateNum,
        isClassic
      )
    : 0;

  const handleCopyDiagnostics = async () => {
    try {
      const report = await trackerDB.getStorageDiagnostics();
      const copied = await copyTextNative(report);
      setDiagnosticsCopied(Boolean(copied));
    } catch (err) {
      setDiagnosticsCopied(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    const selectedGame = isCustomGame
      ? customGameText.trim() || 'Custom Game'
      : game;

    const titleMissing = !title.trim();
    const gameMissing = isCustomGame && !customGameText.trim();
    const priceNumber = Number(price);
    const priceMissing = !price.trim() || !Number.isFinite(priceNumber) || priceNumber < 0;

    if (titleMissing || gameMissing || priceMissing) {
      setHasTitleError(titleMissing);
      setHasGameError(gameMissing);
      setHasPriceError(priceMissing);
      if (titleMissing) {
        titleInputRef.current?.focus();
      }
      return;
    }

    // Save sticky preferences
    try {
      localStorage.setItem(LAST_GAME_KEY, game);
      trackerDB.setSetting(LAST_GAME_KEY, game).catch(() => {});
      if (isCustomGame) {
        localStorage.setItem(LAST_CUSTOM_GAME_KEY, customGameText);
        trackerDB.setSetting(LAST_CUSTOM_GAME_KEY, customGameText).catch(() => {});
      }
      if (source.trim()) {
        localStorage.setItem(LAST_SOURCE_KEY, source.trim());
        trackerDB.setSetting(LAST_SOURCE_KEY, source.trim()).catch(() => {});
      }
      localStorage.setItem(LAST_CURRENCY_KEY, currency);
      trackerDB.setSetting(LAST_CURRENCY_KEY, currency).catch(() => {});
    } catch (err) {}

    entryIdRef.current ||= 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const entryToSave = {
      id: entryIdRef.current,
      title: title.trim(),
      dateTime: toLocalISOString(new Date()),
      game: selectedGame,
      source: source.trim() || 'Direct Client',
      teamMode: false,
      teammates: [],
      currency,
      income: numericPrice,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: 'Pending',
      notes: '',
      proofs: [],
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setSaveError(null);
    setDiagnosticsCopied(false);
    try {
      await onSave(entryToSave);
    } catch (err) {
      setSaveError({
        message: err?.userMessage || 'CHECKPOINT could not save this record. Your form has been kept intact.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetrySave = async () => {
    if (isSaving) return;
    await trackerDB.retryStorage();
    await handleSubmit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Avoid triggering when user is selecting in a dropdown or combobox
      if (e.target.tagName === 'INPUT') {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  return (
    <Dialog open={isOpen} onClose={isSaving ? undefined : onClose} maxWidth="max-w-md">
      <DialogHeader onClose={isSaving ? undefined : onClose}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
          </div>
          <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('quickAdd.title')}</DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {t('quickAdd.badge')}
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <DialogContent className="p-5 space-y-4">
          {saveError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md border border-rose-800/70 bg-rose-950/30 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className={cn('font-semibold text-rose-200', isRtl && 'font-farsi')}>
                  {language === 'fa' ? 'ذخیره رکورد انجام نشد' : 'Record was not saved'}
                </p>
                <p className={cn('text-[11px] leading-5 text-rose-200/80', isRtl && 'font-farsi')}>{saveError.message}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button type="button" variant="outline" size="xs" onClick={handleRetrySave} disabled={isSaving}>
                    {language === 'fa' ? 'تلاش مجدد' : 'Retry'}
                  </Button>
                  <Button type="button" variant="ghost" size="xs" onClick={handleCopyDiagnostics} disabled={isSaving}>
                    {diagnosticsCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {diagnosticsCopied
                      ? (language === 'fa' ? 'کپی شد' : 'Copied')
                      : (language === 'fa' ? 'کپی گزارش' : 'Copy diagnostics')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 1. Boost Title (Autofocused) */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
              <span>{t('quickAdd.boostTitle')} *</span>
              {hasTitleError ? (
                <span className="text-[9px] font-mono text-rose-400 font-medium">Required</span>
              ) : (
                <span className="text-[9px] font-mono text-zinc-500">Required</span>
              )}
            </label>
            <Input
              ref={titleInputRef}
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (hasTitleError) setHasTitleError(false);
                if (saveError) setSaveError(null);
              }}
              placeholder={t('work.titlePlaceholder')}
              className={cn(
                'bg-zinc-900/80 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 font-medium transition-colors',
                hasTitleError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
              )}
            />
          </div>

          {/* 2. Game / Platform */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5', isRtl && 'font-farsi')}>
              <GameIcon game={game} className="w-3.5 h-3.5" />
              <span>{t('work.gamePlatform')} *</span>
            </label>
            <Select
              value={game}
              onChange={handleGameSelect}
              options={GAME_OPTIONS}
            />
            {isCustomGame && (
              <div className="mt-2">
                <Input
                  required
                  value={customGameText}
                  onChange={(e) => {
                    setCustomGameText(e.target.value);
                    if (hasGameError) setHasGameError(false);
                    if (saveError) setSaveError(null);
                  }}
                  placeholder={t('work.customGamePlaceholder')}
                  className={cn(
                    'bg-zinc-900/80 border-zinc-700/80 text-zinc-100',
                    hasGameError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                  )}
                />
                {hasGameError && <p className="mt-1 text-[10px] font-mono text-rose-400">Required</p>}
              </div>
            )}
          </div>

          {/* 3. Seller / Job Source */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
              <span>{t('work.sellerSource')}</span>
              <span className="text-[9px] font-mono text-zinc-500">Saved Sources</span>
            </label>
            <SourceCombobox
              value={source}
              onChange={(val) => {
                setSource(val);
                if (saveError) setSaveError(null);
              }}
              placeholder="e.g. Enter seller, broker, or client..."
            />
          </div>

          {/* 4. Price & Live Dual Currency Conversion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                {currency === 'TOMAN' ? (
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{t('quickAdd.priceIncome')}</span>
              </label>

              {/* Currency Selector Pill */}
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setCurrency('TOMAN')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    currency === 'TOMAN'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {language === 'fa' ? 'تومان' : 'Toman'}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('GOLD')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    currency === 'GOLD'
                      ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Gold
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    let val = normalizeDigits(e.target.value)
                      .replace(/,/g, '').replace(/\s/g, '')
                      .replace(/(?!^)-/g, '')
                      .replace(/[^0-9.-]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('').replace(/\./g, '');
                    setPrice(val);
                    if (hasPriceError) setHasPriceError(false);
                    if (saveError) setSaveError(null);
                  }}
                  placeholder="0"
                  className={cn(
                    'font-mono text-sm bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 pr-12',
                    hasPriceError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                  )}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 pointer-events-none">
                  {currency === 'TOMAN' ? 'تومان' : 'G'}
                </div>
              </div>

              {hasPriceError && <p className="text-[10px] font-mono text-rose-400">Required</p>}

              {/* Real-time Dual-Currency Conversion Pill */}
              {numericPrice > 0 && (
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">{t('quickAdd.liveEquivalent')}:</span>
                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                      ≈ {formatMoney(convertedPrice, altCurrency, false, language === 'fa')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCurrency}
                    className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Swap primary currency"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{t('quickAdd.swap')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Context Footer Hint */}
          <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-200 dark:border-zinc-800/60">
            <span className={cn('text-[11px]', isRtl && 'font-farsi')}>{t('quickAdd.statusHint')}</span>
            <div className="flex items-center gap-1">
              <span>{t('quickAdd.submitWithEnter')}</span>
              <Kbd>Enter</Kbd>
            </div>
          </div>
        </DialogContent>

        <DialogFooter className="flex items-center justify-between sm:justify-between px-5 py-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className={cn('text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200', isRtl && 'font-farsi')}
          >
            {t('common.cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className={cn('gap-1.5 font-semibold active:scale-[0.98] shadow-sm', isRtl && 'font-farsi')}
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{isSaving ? (language === 'fa' ? 'در حال ذخیره...' : 'Saving...') : t('quickAdd.addRecord')}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default QuickAddModal;
