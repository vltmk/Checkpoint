import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Calculator,
  ArrowRight,
  RefreshCw,
  Coins,
  Settings2,
  ChevronDown,
  ChevronUp,
  Percent,
  DollarSign,
  Users,
  Check,
  X,
  Copy,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { CURRENCIES, formatMoney, sanitizePriceInput, convertCurrency } from '../lib/currencies';
import {
  calculateForwardQuote,
  calculateReverseQuote,
  PLATFORM_FEE_PRESETS,
  ADVERTISER_FEE_PRESETS,
} from '../lib/orderCalculator';
import MoneyDisplay from './ui/MoneyDisplay';
import { Button } from './ui/Button';
import { FrostedGlass } from './ui/FrostedGlass';

export function OrderCalculatorPopover({
  isOpen,
  onClose,
  rates = {},
  onSaveRates,
  onTransferToWorkModal,
  className = '',
}) {
  const { language, isRtl } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const drawerRef = useRef(null);

  // Modes: 'forward' (Client Price -> Booster Payout) | 'reverse' (Booster Payout -> Client Quote)
  const [mode, setMode] = useState('forward');
  const [currency, setCurrency] = useState('USD');
  const [clientPriceInput, setClientPriceInput] = useState('100');
  const [desiredPayoutInput, setDesiredPayoutInput] = useState('70');
  const [isPerBooster, setIsPerBooster] = useState(false);
  const [platformFeePct, setPlatformFeePct] = useState('0');
  const [feeType, setFeeType] = useState('percent'); // 'percent' | 'flat'
  const [feeValue, setFeeValue] = useState('30');
  const [boosterCount, setBoosterCount] = useState(1);
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);

  // Local rates for inline editing
  const [tempGoldRate, setTempGoldRate] = useState(String(rates?.goldRateTOMAN || 3200));
  const [tempUsdRate, setTempUsdRate] = useState(String(rates?.usdRateTOMAN || 95000));
  const [tempEurRate, setTempEurRate] = useState(String(rates?.eurRateUSD || 1.08));

  useEffect(() => {
    setTempGoldRate(String(rates?.goldRateTOMAN || 3200));
    setTempUsdRate(String(rates?.usdRateTOMAN || 95000));
    setTempEurRate(String(rates?.eurRateUSD || 1.08));
  }, [rates]);

  // Lock scroll & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const effectiveRates = {
    goldRateTOMAN: Number(tempGoldRate) || 3200,
    usdRateTOMAN: Number(tempUsdRate) || 95000,
    eurRateUSD: Number(tempEurRate) || 1.08,
  };

  const handleSaveInlineRates = () => {
    onSaveRates?.(effectiveRates);
    setShowRatesEditor(false);
  };

  // Convert inputs dynamically when currency changes
  const handleCurrencyChange = (newCur) => {
    if (newCur === currency) return;
    const oldCur = currency;
    setCurrency(newCur);

    try {
      const curClient = parseFloat(sanitizePriceInput(clientPriceInput, { allowDecimals: true })) || 0;
      if (curClient > 0) {
        const converted = convertCurrency(curClient, oldCur, newCur, effectiveRates);
        const rounded = (newCur === 'TOMAN' || newCur === 'GOLD') ? Math.round(converted) : Math.round(converted * 100) / 100;
        setClientPriceInput(String(rounded));
      }

      const curPayout = parseFloat(sanitizePriceInput(desiredPayoutInput, { allowDecimals: true })) || 0;
      if (curPayout > 0) {
        const converted = convertCurrency(curPayout, oldCur, newCur, effectiveRates);
        const rounded = (newCur === 'TOMAN' || newCur === 'GOLD') ? Math.round(converted) : Math.round(converted * 100) / 100;
        setDesiredPayoutInput(String(rounded));
      }
    } catch (e) {
      // Fallback: keep existing inputs on parse failure
    }
  };

  // Perform calculation
  const cleanPrice = parseFloat(sanitizePriceInput(clientPriceInput, { allowDecimals: true })) || 0;
  const cleanDesiredPayout = parseFloat(sanitizePriceInput(desiredPayoutInput, { allowDecimals: true })) || 0;
  const cleanPlatformFee = parseFloat(platformFeePct) || 0;
  const cleanFeeVal = parseFloat(sanitizePriceInput(feeValue, { allowDecimals: true })) || 0;

  const calculation = mode === 'forward'
    ? calculateForwardQuote({
        clientPrice: cleanPrice,
        platformFeePct: cleanPlatformFee,
        feeType,
        feeValue: cleanFeeVal,
        boosterCount,
        currency,
        rates: effectiveRates,
      })
    : calculateReverseQuote({
        desiredBoosterPayout: cleanDesiredPayout,
        isPerBooster: boosterCount > 1 ? isPerBooster : false,
        platformFeePct: cleanPlatformFee,
        feeType,
        feeValue: cleanFeeVal,
        boosterCount,
        currency,
        rates: effectiveRates,
      });

  const effectiveMarginPct = calculation.clientPrice > 0
    ? Math.round((calculation.advertiserProfit / calculation.clientPrice) * 1000) / 10
    : 0;

  const handleCopyQuote = () => {
    const quoteText = language === 'fa'
      ? `📦 قیمت مشتری: ${calculation.clientPrice.toLocaleString()} ${currency}\n💰 سهم بوستر: ${calculation.boosterPool.toLocaleString()} ${currency}${boosterCount > 1 ? ` (${boosterCount} نفر، هر نفر ${calculation.perBoosterCut.toLocaleString()} ${currency})` : ''}\n💼 کارمزد ادورتایزر: ${calculation.advertiserProfit.toLocaleString()} ${currency}`
      : `📦 Client Quote: ${calculation.clientPrice.toLocaleString()} ${currency}\n💰 Booster Payout: ${calculation.boosterPool.toLocaleString()} ${currency}${boosterCount > 1 ? ` (${boosterCount}x @ ${calculation.perBoosterCut.toLocaleString()} ${currency} each)` : ''}\n💼 Advertiser Cut: ${calculation.advertiserProfit.toLocaleString()} ${currency}`;

    navigator.clipboard.writeText(quoteText).then(() => {
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2000);
    }).catch(() => {});
  };

  const handleTransfer = () => {
    onTransferToWorkModal?.({
      clientPrice: calculation.clientPrice,
      feeRate: feeType === 'percent' ? calculation.feeValue : calculation.effectiveFeePercent,
      feeType,
      income: calculation.advertiserProfit,
      currency,
      boosterCount,
      boosterPool: calculation.boosterPool,
      perBoosterCut: calculation.perBoosterCut,
      platformFeePct: cleanPlatformFee,
      platformFeeAmount: calculation.platformFeeAmount,
    });
    onClose?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" dir="ltr" data-no-drag>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
          />

          {/* Right Sliding Drawer */}
          <FrostedGlass
            as="motion.div"
            variant="drawer"
            ref={drawerRef}
            initial={shouldReduceMotion ? { opacity: 0 } : { x: '100%', opacity: 0.7 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%', opacity: 0.7 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className={cn(
              'relative z-10 w-full sm:w-[460px] h-full flex flex-col justify-between border-l border-zinc-200/90 dark:border-zinc-800/90 shadow-2xl bg-white/95 dark:bg-zinc-950/95 overflow-hidden select-none',
              className
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
            role="dialog"
            aria-modal="true"
          >
            {/* Header: Title, Currency Switcher, and Close button */}
            <div className="px-5 py-4 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 bg-white/40 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
                    {language === 'fa' ? 'ماشین‌حساب ادورتایزر' : 'Order Calculator'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {language === 'fa' ? 'محاسبه سریع قیمت، سهم بوستر و سود' : 'Instant quotes, booster splits & profit'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Currency Picker */}
                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800" dir="ltr">
                  {['USD', 'EUR', 'TOMAN', 'GOLD'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleCurrencyChange(c)}
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-medium rounded-md transition-all cursor-pointer',
                        currency === c
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                      )}
                    >
                      {c === 'TOMAN' ? 'تومان' : c === 'GOLD' ? 'GOLD' : c}
                    </button>
                  ))}
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Body Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 gpu-scroll">
              {/* 1. TOP Conversion Rates Pill Bar */}
              <div className="p-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2 font-mono text-zinc-600 dark:text-zinc-400" dir="ltr">
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-400">1k Gold:</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">{effectiveRates.goldRateTOMAN.toLocaleString()} T</strong>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-400">USD:</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">{effectiveRates.usdRateTOMAN.toLocaleString()} T</strong>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-400">EUR:</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">${effectiveRates.eurRateUSD}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRatesEditor((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>{showRatesEditor ? (language === 'fa' ? 'بستن' : 'Done') : (language === 'fa' ? 'ویرایش نرخ‌ها' : 'Edit')}</span>
                  </button>
                </div>

                {/* Inline Exchange Rates Editor Drawer */}
                <AnimatePresence>
                  {showRatesEditor && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60"
                    >
                      <div className="grid grid-cols-3 gap-2 text-[10px]" dir="ltr">
                        <div>
                          <span className="block text-zinc-400 mb-1">1k Gold (Toman)</span>
                          <input
                            type="text"
                            value={tempGoldRate}
                            onChange={(e) => setTempGoldRate(e.target.value)}
                            className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        </div>
                        <div>
                          <span className="block text-zinc-400 mb-1">1 USD (Toman)</span>
                          <input
                            type="text"
                            value={tempUsdRate}
                            onChange={(e) => setTempUsdRate(e.target.value)}
                            className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        </div>
                        <div>
                          <span className="block text-zinc-400 mb-1">1 EUR (USD)</span>
                          <input
                            type="text"
                            value={tempEurRate}
                            onChange={(e) => setTempEurRate(e.target.value)}
                            className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={handleSaveInlineRates}
                          className="h-6 px-3 text-[10px]"
                        >
                          {language === 'fa' ? 'ذخیره نرخ‌ها' : 'Save Rates'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Caveman-Simple Mode Tabs (No '→') */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode('forward')}
                  className={cn(
                    'py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
                    mode === 'forward'
                      ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                  )}
                >
                  <div>{language === 'fa' ? 'قیمت مشتری' : 'Client Price'}</div>
                  <div className="text-[10px] font-normal text-zinc-400">
                    {language === 'fa' ? 'بر اساس پرداخت مشتری' : 'You have client total'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('reverse')}
                  className={cn(
                    'py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
                    mode === 'reverse'
                      ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                  )}
                >
                  <div>{language === 'fa' ? 'سهم بوستر' : 'Booster Payout'}</div>
                  <div className="text-[10px] font-normal text-zinc-400">
                    {language === 'fa' ? 'بر اساس درخواست بوستر' : 'You have booster cut'}
                  </div>
                </button>
              </div>

              {/* 3. Main Input Section */}
              <div className="space-y-3.5">
                {mode === 'forward' ? (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                      {language === 'fa' ? 'مبلغ کل سفارش مشتری:' : 'Gross Client Price:'}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={clientPriceInput}
                        onChange={(e) => setClientPriceInput(e.target.value)}
                        placeholder="100"
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                        dir="ltr"
                      />
                      <span className="absolute right-3 text-xs font-medium text-zinc-400 pointer-events-none" dir="ltr">
                        {currency}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                        {boosterCount > 1 && isPerBooster
                          ? (language === 'fa' ? 'سهم هر یک از بوسترها:' : 'Cut Per Booster:')
                          : (language === 'fa' ? 'مجموع سهم درخواستی بوسترها:' : 'Total Booster Payout Pool:')}
                      </label>

                      {/* Per Booster vs Total Pool Toggle */}
                      {boosterCount > 1 && (
                        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded border border-zinc-200 dark:border-zinc-800" dir="ltr">
                          <button
                            type="button"
                            onClick={() => setIsPerBooster(false)}
                            className={cn(
                              'px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors cursor-pointer',
                              !isPerBooster
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
                            )}
                          >
                            Total Pool
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPerBooster(true)}
                            className={cn(
                              'px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors cursor-pointer',
                              isPerBooster
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
                            )}
                          >
                            Per Booster
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={desiredPayoutInput}
                        onChange={(e) => setDesiredPayoutInput(e.target.value)}
                        placeholder="70"
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                        dir="ltr"
                      />
                      <span className="absolute right-3 text-xs font-medium text-zinc-400 pointer-events-none" dir="ltr">
                        {currency}
                      </span>
                    </div>
                  </div>
                )}

                {/* Platform Fee Presets (Direct, G2G, FunPay, Eldorado) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                      {language === 'fa' ? 'کارمزد پلتفرم / مارکت‌پلیس:' : 'Platform Fee (Marketplace):'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500" dir="ltr">
                      {calculation.platformFeeAmount > 0 ? (
                        <>
                          -{calculation.platformFeeAmount.toLocaleString()} {currency} ({platformFeePct}%)
                        </>
                      ) : (
                        '0%'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" dir="ltr">
                    {PLATFORM_FEE_PRESETS.map((p) => {
                      const isSelected = String(p.pct) === String(platformFeePct);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlatformFeePct(String(p.pct))}
                          className={cn(
                            'flex-1 py-1 px-1.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer text-center',
                            isSelected
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                    <div className="w-14 shrink-0">
                      <input
                        type="text"
                        value={platformFeePct}
                        onChange={(e) => setPlatformFeePct(e.target.value)}
                        placeholder="%"
                        className="w-full h-6 px-1 text-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[10px] font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Advertiser Cut (% vs Flat) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                      {language === 'fa' ? 'کارمزد ادورتایزر (سود شما):' : 'Advertiser Cut (Your Fee):'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFeeType(feeType === 'percent' ? 'flat' : 'percent')}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      {feeType === 'percent' ? (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          % {language === 'fa' ? 'درصدی' : 'Percent'}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {currency} {language === 'fa' ? 'مبلغ ثابت' : 'Flat'}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1" dir="ltr">
                    {feeType === 'percent' ? (
                      <>
                        {ADVERTISER_FEE_PRESETS.map((pr) => (
                          <button
                            key={pr}
                            type="button"
                            onClick={() => setFeeValue(pr)}
                            className={cn(
                              'flex-1 py-1 px-1 rounded-md text-[10px] font-medium border transition-colors cursor-pointer text-center',
                              feeValue === pr
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            )}
                          >
                            {pr}%
                          </button>
                        ))}
                        <div className="w-14 shrink-0">
                          <input
                            type="text"
                            value={feeValue}
                            onChange={(e) => setFeeValue(e.target.value)}
                            placeholder="%"
                            className="w-full h-6 px-1 text-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[10px] font-mono"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={feeValue}
                          onChange={(e) => setFeeValue(e.target.value)}
                          placeholder="e.g. 10"
                          className="w-full h-7 px-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 pointer-events-none">
                          {currency}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Financial Breakdown Preview Section */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Your Net Profit */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[9px] uppercase tracking-wider text-zinc-400 font-medium">
                        {language === 'fa' ? 'سود شما:' : 'Your Net Profit:'}
                      </span>
                      {effectiveMarginPct > 0 && (
                        <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          +{effectiveMarginPct}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      <MoneyDisplay amount={calculation.advertiserProfit} currency={currency} />
                    </div>
                  </div>

                  {/* Booster Payout Pool */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80">
                    <span className="block text-[9px] uppercase tracking-wider text-zinc-400 font-medium mb-1">
                      {language === 'fa' ? 'مجموع سهم بوسترها:' : 'Total Booster Pool:'}
                    </span>
                    <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      <MoneyDisplay amount={calculation.boosterPool} currency={currency} />
                    </div>
                  </div>
                </div>

                {/* Reverse mode: Prominent required Client Quote */}
                {mode === 'reverse' && (
                  <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        {language === 'fa' ? 'قیمت اعلامی به مشتری:' : 'Quote Price for Client:'}
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {language === 'fa' ? '(شامل کارمزد پلتفرم و سود شما)' : '(Includes platform fee & your cut)'}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                      <MoneyDisplay amount={calculation.clientPrice} currency={currency} />
                    </span>
                  </div>
                )}
              </div>

              {/* 5. Booster Count (Split) - MOVED BELOW PREVIEW & ABOVE MULTI-CURRENCY */}
              <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {language === 'fa' ? 'تعداد بوسترها (تقسیم سهم):' : 'Booster Count (Split):'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {boosterCount} {boosterCount > 1 ? (language === 'fa' ? 'نفر' : 'Boosters') : (language === 'fa' ? 'نفر (سولو)' : 'Solo')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5" dir="ltr">
                  {[1, 2, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setBoosterCount(cnt)}
                      className={cn(
                        'flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors cursor-pointer text-center',
                        boosterCount === cnt
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      {cnt === 1 ? '1 (Solo)' : `${cnt}x`}
                    </button>
                  ))}
                  <div className="w-16 shrink-0">
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={boosterCount}
                      onChange={(e) => setBoosterCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Live 4-Currency Booster Payout Matrix */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                  <span>{language === 'fa' ? 'سهم بوستر در ارزهای مختلف:' : 'Booster Cut in All Currencies:'}</span>
                  {boosterCount > 1 && (
                    <span className="text-[9px] text-zinc-400">
                      {language === 'fa' ? `(به ازای هر یک از ${boosterCount} نفر)` : `(Each of ${boosterCount})`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2" dir="ltr">
                  {['USD', 'EUR', 'TOMAN', 'GOLD'].map((curKey) => {
                    const data = calculation.currencyMatrix?.[curKey];
                    if (!data) return null;
                    return (
                      <div
                        key={curKey}
                        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 flex items-center justify-between"
                      >
                        <span className="text-[10px] font-mono text-zinc-400 font-medium">{curKey}</span>
                        <span className="text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200">
                          <MoneyDisplay
                            amount={boosterCount > 1 ? data.perBooster : data.total}
                            currency={curKey}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Actions: Copy Quote & Transfer to WorkModal */}
            <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2.5 shrink-0 bg-white/40 dark:bg-zinc-950/40">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyQuote}
                className="h-8 px-3 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                {copiedQuote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copiedQuote ? (language === 'fa' ? 'کپی شد!' : 'Copied!') : (language === 'fa' ? 'کپی پیش‌فاکتور' : 'Copy Quote')}</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {language === 'fa' ? 'بستن' : 'Close'}
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleTransfer}
                  className="h-8 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <span>{language === 'fa' ? 'انتقال به ثبت کار' : 'Transfer to Add Work'}</span>
                  <ArrowRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
                </Button>
              </div>
            </div>
          </FrostedGlass>
        </div>
      )}
    </AnimatePresence>
  );
}

export default OrderCalculatorPopover;
