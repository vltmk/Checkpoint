import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Calculator,
  ArrowRight,
  Coins,
  Settings2,
  ChevronDown,
  Check,
  X,
  Copy,
  Users,
  Percent,
  DollarSign,
  TrendingUp,
  Sparkles,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';
import { CURRENCIES, formatMoney, sanitizePriceInput, convertCurrency } from '../lib/currencies';
import {
  calculateForwardQuote,
  calculateReverseQuote,
  PLATFORM_FEE_PRESETS,
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

  // Accordion Step State: 1 | 2 | 3
  const [activeStep, setActiveStep] = useState(1);
  const [confirmedSteps, setConfirmedSteps] = useState(() => new Set());

  // Core Calculator Configuration
  const [currency, setCurrency] = useState('USD');
  const [mode, setMode] = useState('forward'); // 'forward' (Source Price) | 'reverse' (Booster Payout)
  const [clientPriceInput, setClientPriceInput] = useState('');
  const [desiredPayoutInput, setDesiredPayoutInput] = useState('');
  const [isPerBooster, setIsPerBooster] = useState(false);

  // Advertiser Cut & Splits
  const [feeType, setFeeType] = useState('percent'); // 'percent' | 'flat'
  const [feePercent, setFeePercent] = useState(30); // 0 to 100 via slider
  const [feeFlatInput, setFeeFlatInput] = useState('20');
  const [boosterCount, setBoosterCount] = useState(1); // 1 to 10 via slider

  // Optional Marketplace & Splits disclosure
  const [isMarketplaceSplitsOpen, setIsMarketplaceSplitsOpen] = useState(false);
  const [platformFeePct, setPlatformFeePct] = useState('0');

  // Inline rates editor in Step 1
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const [tempGoldRate, setTempGoldRate] = useState(String(rates?.goldRateTOMAN || 3200));
  const [tempUsdRate, setTempUsdRate] = useState(String(rates?.usdRateTOMAN || 95000));
  const [tempEurRate, setTempEurRate] = useState(String(rates?.eurRateUSD || 1.08));

  // Copy Feedback
  const [copiedQuote, setCopiedQuote] = useState(false);

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
      // Keep existing inputs on fallback
    }
  };

  // Parsing values for calculation
  const cleanPrice = parseFloat(sanitizePriceInput(clientPriceInput, { allowDecimals: true })) || 0;
  const cleanDesiredPayout = parseFloat(sanitizePriceInput(desiredPayoutInput, { allowDecimals: true })) || 0;
  const cleanPlatformFee = parseFloat(platformFeePct) || 0;
  const feeValue = feeType === 'percent' ? feePercent : (parseFloat(sanitizePriceInput(feeFlatInput, { allowDecimals: true })) || 0);

  // Perform calculation via orderCalculator engine
  const calculation = mode === 'forward'
    ? calculateForwardQuote({
        clientPrice: cleanPrice,
        platformFeePct: cleanPlatformFee,
        feeType,
        feeValue,
        boosterCount,
        currency,
        rates: effectiveRates,
      })
    : calculateReverseQuote({
        desiredBoosterPayout: cleanDesiredPayout,
        isPerBooster: boosterCount > 1 ? isPerBooster : false,
        platformFeePct: cleanPlatformFee,
        feeType,
        feeValue,
        boosterCount,
        currency,
        rates: effectiveRates,
      });

  const effectiveMarginPct = calculation.clientPrice > 0
    ? Math.round((calculation.advertiserProfit / calculation.clientPrice) * 1000) / 10
    : 0;

  // Step Completion Validation (No premature checkmarks on initial load)
  const isStep1Complete = confirmedSteps.has(1);
  const isStep2Complete = (mode === 'forward' ? cleanPrice > 0 : cleanDesiredPayout > 0) && confirmedSteps.has(2);
  const isStep3Complete = (mode === 'forward' ? cleanPrice > 0 : cleanDesiredPayout > 0) && feeValue >= 0 && confirmedSteps.has(3);

  // Step Navigation Helper
  const goToNextStep = (current) => {
    setConfirmedSteps((prev) => {
      const next = new Set(prev);
      next.add(current);
      return next;
    });
    if (current === 1) {
      setActiveStep(2);
    } else if (current === 2) {
      setActiveStep(3);
    }
  };

  const handleReset = () => {
    setClientPriceInput('');
    setDesiredPayoutInput('');
    setFeePercent(30);
    setFeeFlatInput('20');
    setFeeType('percent');
    setBoosterCount(1);
    setPlatformFeePct('0');
    setIsPerBooster(false);
    setConfirmedSteps(new Set());
    setActiveStep(1);
  };

  const handleCopyQuote = () => {
    const quoteText = language === 'fa'
      ? `📦 قیمت سورس: ${calculation.clientPrice.toLocaleString()} ${currency}\n💰 سهم بوستر: ${calculation.boosterPool.toLocaleString()} ${currency}${boosterCount > 1 ? ` (${boosterCount} نفر، هر نفر ${calculation.perBoosterCut.toLocaleString()} ${currency})` : ''}\n💼 کارمزد ادورتایزر: ${calculation.advertiserProfit.toLocaleString()} ${currency}`
      : `📦 Source Quote: ${calculation.clientPrice.toLocaleString()} ${currency}\n💰 Booster Payout: ${calculation.boosterPool.toLocaleString()} ${currency}${boosterCount > 1 ? ` (${boosterCount}x @ ${calculation.perBoosterCut.toLocaleString()} ${currency} each)` : ''}\n💼 Advertiser Cut: ${calculation.advertiserProfit.toLocaleString()} ${currency}`;

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
        <div
          className={cn(
            'fixed inset-0 z-50 overflow-hidden flex',
            isRtl ? 'justify-start' : 'justify-end'
          )}
          dir={isRtl ? 'rtl' : 'ltr'}
          data-no-drag
        >
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
          />

          {/* Sliding Drawer */}
          <FrostedGlass
            as="motion.div"
            variant="drawer"
            ref={drawerRef}
            initial={shouldReduceMotion ? { opacity: 0 } : { x: isRtl ? '-100%' : '100%', opacity: 0.8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: isRtl ? '-100%' : '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'relative z-10 w-full sm:w-[480px] h-full flex flex-col justify-between shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden select-none',
              isRtl ? 'border-r border-zinc-200 dark:border-zinc-800' : 'border-l border-zinc-200 dark:border-zinc-800',
              className
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
            role="dialog"
            aria-modal="true"
          >
            {/* Header: Title, Reset & Close */}
            <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>{language === 'fa' ? 'ماشین‌حساب ادورتایزر' : 'Order Calculator'}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                      Step {activeStep}/3
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {language === 'fa' ? 'فرمول قیمت، کارمزد ادورتایزر و سهم بوسترها' : 'Step-by-step pricing, booster split & profit'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Header Summary Chips when price is set */}
                {(cleanPrice > 0 || cleanDesiredPayout > 0) && (
                  <div className="hidden sm:flex items-center gap-1.5" dir="ltr">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      {formatMoney(calculation.clientPrice, currency)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                      {formatMoney(calculation.boosterPool, currency)}
                    </span>
                  </div>
                )}
                {/* Reset Button */}
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  title={language === 'fa' ? 'بازنشانی فرم' : 'Reset calculator'}
                  aria-label="Reset"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
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

            {/* Scrollable Accordion Steps Area */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 gpu-scroll">

              {/* ========================================================================= */}
              {/* STEP #1: Currency & Exchange Rates (Merged Minimal Section)               */}
              {/* ========================================================================= */}
              <div
                className={cn(
                  'rounded-xl border transition-all duration-200 overflow-hidden',
                  activeStep === 1
                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/20 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                {/* Step Header */}
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep === 1 ? 0 : 1)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-start cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Number Badge with interactive green checkmark */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                        isStep1Complete && activeStep !== 1
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : activeStep === 1
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {isStep1Complete && activeStep !== 1 ? <Check className="w-3 h-3" /> : '1'}
                    </div>

                    <div className="truncate">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {language === 'fa' ? 'ارز سفارش و نرخ تبدیل' : 'Currency & Exchange Rates'}
                      </span>
                      {activeStep !== 1 && (
                        <span className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate" dir="ltr">
                          {currency} · 1k G: {effectiveRates.goldRateTOMAN.toLocaleString()} T · USD: {effectiveRates.usdRateTOMAN.toLocaleString()} T
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeStep !== 1 && (
                      <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {currency}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-zinc-400 transition-transform duration-200',
                        activeStep === 1 && 'rotate-180'
                      )}
                    />
                  </div>
                </button>

                {/* Step Body (Accordion Content) */}
                <AnimatePresence initial={false}>
                  {activeStep === 1 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800/60">
                        {/* Currency Selector Pills */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium mb-1.5">
                            {language === 'fa' ? 'واحد ارز سفارش:' : 'Order Currency:'}
                          </label>
                          <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800" dir="ltr">
                            {['USD', 'EUR', 'TOMAN', 'GOLD'].map((c) => {
                              const isSelected = currency === c;
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => handleCurrencyChange(c)}
                                  className={cn(
                                    'py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center',
                                    isSelected
                                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                  )}
                                >
                                  {c === 'TOMAN' ? (language === 'fa' ? 'تومان' : 'TOMAN') : c === 'GOLD' ? (language === 'fa' ? 'گلد' : 'GOLD') : c}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Merged Inline Exchange Rates Strip */}
                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-2 font-mono text-zinc-600 dark:text-zinc-400" dir="ltr">
                              <span className="flex items-center gap-1">
                                <span className="text-zinc-400">1k G:</span>
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
                              <span>{showRatesEditor ? (language === 'fa' ? 'بستن' : 'Done') : (language === 'fa' ? 'ویرایش' : 'Edit')}</span>
                            </button>
                          </div>

                          {/* Collapsible Rate Editor Inputs */}
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
                                    <span className="block text-zinc-400 mb-1">1k Gold (T)</span>
                                    <input
                                      type="text"
                                      value={tempGoldRate}
                                      onChange={(e) => setTempGoldRate(e.target.value)}
                                      className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-zinc-400 mb-1">1 USD (T)</span>
                                    <input
                                      type="text"
                                      value={tempUsdRate}
                                      onChange={(e) => setTempUsdRate(e.target.value)}
                                      className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-zinc-400 mb-1">1 EUR ($)</span>
                                    <input
                                      type="text"
                                      value={tempEurRate}
                                      onChange={(e) => setTempEurRate(e.target.value)}
                                      className="w-full h-7 px-1.5 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end pt-0.5">
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

                        {/* Step 1 Confirmation Button with monochromatic styling */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => goToNextStep(1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 transition-all shadow-xs active:scale-98 cursor-pointer select-none"
                          >
                            <span>{language === 'fa' ? 'مرحله بعد: تعیین مبلغ' : 'Next: Set Price'}</span>
                            <ArrowRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ========================================================================= */}
              {/* STEP #2: 'Client price' or 'Booster payout' and payout amount section      */}
              {/* ========================================================================= */}
              <div
                className={cn(
                  'rounded-xl border transition-all duration-200 overflow-hidden',
                  activeStep === 2
                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/20 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                {/* Step Header */}
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep === 2 ? 0 : 2)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-start cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Number Badge with interactive green checkmark */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                        isStep2Complete && activeStep !== 2
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : activeStep === 2
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {isStep2Complete && activeStep !== 2 ? <Check className="w-3 h-3" /> : '2'}
                    </div>

                    <div className="truncate">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {language === 'fa' ? 'جهت سفارش و مبلغ' : 'Order Direction & Price'}
                      </span>
                      {activeStep !== 2 && (
                        <span className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate" dir="ltr">
                          {mode === 'forward'
                            ? `Source Price: ${cleanPrice.toLocaleString()} ${currency}`
                            : `Booster Payout: ${cleanDesiredPayout.toLocaleString()} ${currency}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeStep !== 2 && isStep2Complete && (
                      <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {mode === 'forward' ? `${cleanPrice} ${currency}` : `${cleanDesiredPayout} ${currency}`}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-zinc-400 transition-transform duration-200',
                        activeStep === 2 && 'rotate-180'
                      )}
                    />
                  </div>
                </button>

                {/* Step Body (Accordion Content) */}
                <AnimatePresence initial={false}>
                  {activeStep === 2 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-zinc-100 dark:border-zinc-800/60">
                        {/* Mode Switcher Tabs */}
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
                            <div>{language === 'fa' ? 'قیمت سورس' : 'Source Price'}</div>
                            <div className="text-[9px] font-normal text-zinc-400">
                              {language === 'fa' ? 'بر اساس پرداخت سورس' : 'Gross source price'}
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
                            <div className="text-[9px] font-normal text-zinc-400">
                              {language === 'fa' ? 'بر اساس درخواست بوستر' : 'Desired booster payout'}
                            </div>
                          </button>
                        </div>

                        {/* Numeric Input */}
                        {mode === 'forward' ? (
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                              {language === 'fa' ? 'مبلغ کل سفارش سورس:' : 'Gross Source Price:'}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                value={clientPriceInput}
                                onChange={(e) => setClientPriceInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(sanitizePriceInput(clientPriceInput, { allowDecimals: true })) || 0;
                                    if (val > 0) goToNextStep(2);
                                  }
                                }}
                                placeholder={currency === 'GOLD' ? '10,000' : '100'}
                                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                dir="ltr"
                              />
                              <span className="absolute right-3 text-xs font-semibold text-zinc-400 pointer-events-none" dir="ltr">
                                {currency}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                                {boosterCount > 1 && isPerBooster
                                  ? (language === 'fa' ? 'سهم هر بوستر:' : 'Cut Per Booster:')
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
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(sanitizePriceInput(desiredPayoutInput, { allowDecimals: true })) || 0;
                                    if (val > 0) goToNextStep(2);
                                  }
                                }}
                                placeholder={currency === 'GOLD' ? '7,000' : '70'}
                                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                dir="ltr"
                              />
                              <span className="absolute right-3 text-xs font-semibold text-zinc-400 pointer-events-none" dir="ltr">
                                {currency}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Step 2 Confirmation Button with interactive green styling */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => goToNextStep(2)}
                            disabled={!((mode === 'forward' ? cleanPrice > 0 : cleanDesiredPayout > 0))}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer select-none',
                              (mode === 'forward' ? cleanPrice > 0 : cleanDesiredPayout > 0)
                                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 active:scale-98'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                            )}
                          >
                            <span>{language === 'fa' ? 'مرحله بعد: کارمزد و تقسیم سهم' : 'Next: Cut & Splits'}</span>
                            <ArrowRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ========================================================================= */}
              {/* STEP #3: 'Advertiser cut' with optional Marketplace & splits section     */}
              {/* ========================================================================= */}
              <div
                className={cn(
                  'rounded-xl border transition-all duration-200 overflow-hidden',
                  activeStep === 3
                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/20 hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                {/* Step Header */}
                <button
                  type="button"
                  onClick={() => setActiveStep(activeStep === 3 ? 0 : 3)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-start cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Number Badge with interactive green checkmark */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                        isStep3Complete && activeStep !== 3
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : activeStep === 3
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      {isStep3Complete && activeStep !== 3 ? <Check className="w-3 h-3" /> : '3'}
                    </div>

                    <div className="truncate">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {language === 'fa' ? 'کارمزد ادورتایزر و تقسیم سهم' : 'Advertiser Cut & Splits'}
                      </span>
                      {activeStep !== 3 && (
                        <span className="block text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate" dir="ltr">
                          Cut: {feeType === 'percent' ? `${feePercent}%` : `${feeFlatInput} ${currency}`} · {boosterCount > 1 ? `${boosterCount}x Boosters` : 'Solo'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeStep !== 3 && (
                      <span className="text-[10px] font-medium font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {feeType === 'percent' ? `${feePercent}%` : `${feeFlatInput} ${currency}`}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-zinc-400 transition-transform duration-200',
                        activeStep === 3 && 'rotate-180'
                      )}
                    />
                  </div>
                </button>

                {/* Step Body (Accordion Content) */}
                <AnimatePresence initial={false}>
                  {activeStep === 3 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 pt-1 space-y-3.5 border-t border-zinc-100 dark:border-zinc-800/60">
                        {/* Advertiser Cut Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                              {language === 'fa' ? 'کارمزد ادورتایزر (سود شما):' : 'Advertiser Cut (Your Fee):'}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFeeType('percent')}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer',
                                  feeType === 'percent'
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                                )}
                              >
                                % {language === 'fa' ? 'درصدی' : 'Percent'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setFeeType('flat')}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer',
                                  feeType === 'flat'
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                                )}
                              >
                                {currency} {language === 'fa' ? 'ثابت' : 'Flat'}
                              </button>
                            </div>
                          </div>

                          {/* PERCENT MODE: Smooth Range Slider with Nudge Buttons & Direct Input */}
                          {feeType === 'percent' ? (
                            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {feePercent}% {language === 'fa' ? 'کارمزد' : 'Cut'}
                                </span>
                                <div className="flex items-center gap-1.5" dir="ltr">
                                  <button
                                    type="button"
                                    onClick={() => setFeePercent((p) => Math.max(0, p - 5))}
                                    className="w-6 h-6 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-xs"
                                    aria-label="Decrease 5%"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={feePercent}
                                    onChange={(e) => setFeePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                                    className="w-12 h-6 px-1 text-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setFeePercent((p) => Math.min(100, p + 5))}
                                    className="w-6 h-6 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-xs"
                                    aria-label="Increase 5%"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Interactive Range Slider */}
                              <div className="pt-1">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={feePercent}
                                  onChange={(e) => setFeePercent(Number(e.target.value))}
                                  className="checkpoint-slider accent-emerald-600 dark:accent-emerald-500"
                                  dir="ltr"
                                />
                                <div className="flex justify-between text-[9px] text-zinc-400 font-mono mt-1" dir="ltr">
                                  <span>0%</span>
                                  <span>25%</span>
                                  <span>50%</span>
                                  <span>75%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* FLAT MODE: Direct numeric input */
                            <div className="relative w-full">
                              <input
                                type="text"
                                value={feeFlatInput}
                                onChange={(e) => setFeeFlatInput(e.target.value)}
                                placeholder="e.g. 20"
                                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono font-medium text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                dir="ltr"
                              />
                              <span className="absolute right-3 top-2.5 text-xs font-semibold text-zinc-400 pointer-events-none" dir="ltr">
                                {currency}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Minimal Optional Marketplace Fee & Booster Split Disclosure */}
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => setIsMarketplaceSplitsOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 transition-colors text-xs font-medium text-zinc-600 dark:text-zinc-400 select-none cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{language === 'fa' ? '⚙️ مارکت‌پلیس و تقسیم سهم (اختیاری)' : '⚙️ Marketplace & Splits (Optional)'}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {(platformFeePct !== '0' || boosterCount > 1) && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  {platformFeePct !== '0' ? `${platformFeePct}% fee` : ''}
                                  {platformFeePct !== '0' && boosterCount > 1 ? ' · ' : ''}
                                  {boosterCount > 1 ? `${boosterCount} boosters` : ''}
                                </span>
                              )}
                              <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 transition-transform duration-200', isMarketplaceSplitsOpen && 'rotate-180')} />
                            </div>
                          </button>

                          <AnimatePresence>
                            {isMarketplaceSplitsOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.16 }}
                                className="overflow-hidden space-y-3 pt-2.5"
                              >
                                {/* Platform Fee Presets (Direct, G2G, FunPay, Eldorado) */}
                                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 space-y-1.5">
                                  <div className="flex items-center justify-between">
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

                                {/* Booster Split SLIDER (Replaced predefined % buttons with slider) */}
                                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                                      {language === 'fa' ? 'تعداد بوسترها (تقسیم سهم):' : 'Booster Count (Split):'}
                                    </span>
                                    <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                                      {boosterCount === 1 ? (language === 'fa' ? '۱ (سولو)' : '1 (Solo)') : `${boosterCount}x`}
                                    </span>
                                  </div>

                                  <div className="pt-1">
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      step="1"
                                      value={boosterCount}
                                      onChange={(e) => setBoosterCount(Number(e.target.value))}
                                      className="checkpoint-slider accent-zinc-900 dark:accent-zinc-100"
                                      dir="ltr"
                                    />
                                    <div className="flex justify-between text-[9px] text-zinc-400 font-mono mt-1" dir="ltr">
                                      <span>1 (Solo)</span>
                                      <span>2x</span>
                                      <span>4x</span>
                                      <span>6x</span>
                                      <span>8x</span>
                                      <span>10x</span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* ========================================================================= */}
            {/* ANCHORED BOTTOM SECTION: Live Preview Metric Cards & Multi-Currency Matrix*/}
            {/* ========================================================================= */}
            <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md p-4 space-y-3">
              {/* Financial Breakdown Preview Cards */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Your Net Profit */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-center justify-between mb-0.5">
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
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80">
                    <span className="block text-[9px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">
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
                      <span className="block text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                        {language === 'fa' ? 'قیمت اعلامی به سورس:' : 'Quote Price for Source:'}
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

              {/* Live 4-Currency Booster Payout Matrix */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                  <span>{language === 'fa' ? 'سهم بوستر در تمام ارزها:' : 'Booster Cut in All Currencies:'}</span>
                  {boosterCount > 1 && (
                    <span className="text-[9px] text-zinc-400">
                      {language === 'fa' ? `(به ازای هر یک از ${boosterCount} نفر)` : `(Each of ${boosterCount})`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5" dir="ltr">
                  {['USD', 'EUR', 'TOMAN', 'GOLD'].map((curKey) => {
                    const data = calculation.currencyMatrix?.[curKey];
                    if (!data) return null;
                    return (
                      <div
                        key={curKey}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center"
                      >
                        <span className="block text-[9px] font-mono text-zinc-400 font-medium">{curKey}</span>
                        <span className="block text-[11px] font-bold font-mono text-zinc-800 dark:text-zinc-200 truncate">
                          <MoneyDisplay
                            amount={boosterCount > 1 ? data.perBooster : data.total}
                            currency={curKey}
                            compact={curKey === 'TOMAN' || curKey === 'GOLD'}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions: Copy Quote & Transfer to WorkModal */}
              <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyQuote}
                  className="h-8 px-2.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedQuote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{copiedQuote ? (language === 'fa' ? 'کپی شد!' : 'Copied!') : (language === 'fa' ? 'کپی پیش‌فاکتور' : 'Copy Quote')}</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 px-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {language === 'fa' ? 'بستن' : 'Close'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTransfer}
                    className="h-8 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <span>{language === 'fa' ? 'انتقال به ثبت کار' : 'Transfer to Work'}</span>
                    <ArrowRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
                  </Button>
                </div>
              </div>
            </div>
          </FrostedGlass>
        </div>
      )}
    </AnimatePresence>
  );
}

export default OrderCalculatorPopover;
