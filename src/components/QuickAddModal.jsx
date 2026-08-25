import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { SourceCombobox } from './ui/SourceCombobox';
import { GameIcon } from './ui/GameIcon';
import { Kbd } from './ui/Tooltip';
import { Zap, Banknote, Coins, ArrowRightLeft } from 'lucide-react';
import { toLocalISOString } from './ui/DateTimePicker';
import { convertCurrency, formatMoney } from '../lib/currencies';

const GAME_OPTIONS = [
  { value: 'World of Warcraft', label: 'World of Warcraft' },
  { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
  { value: 'Diablo IV', label: 'Diablo IV' },
  { value: 'Path of Exile', label: 'Path of Exile' },
  { value: 'League of Legends', label: 'League of Legends' },
  { value: '__custom__', label: '+ Custom Game / Realm' },
];

const LAST_GAME_KEY = 'checkpoint_quick_last_game';
const LAST_CUSTOM_GAME_KEY = 'checkpoint_quick_last_custom_game';
const LAST_SOURCE_KEY = 'checkpoint_quick_last_source';
const LAST_CURRENCY_KEY = 'checkpoint_quick_last_currency';

const LEGACY_LAST_GAME_KEY = 'vault_quick_last_game';
const LEGACY_LAST_CUSTOM_GAME_KEY = 'vault_quick_last_custom_game';
const LEGACY_LAST_SOURCE_KEY = 'vault_quick_last_source';
const LEGACY_LAST_CURRENCY_KEY = 'vault_quick_last_currency';

export function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  onToast,
}) {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState('World of Warcraft');
  const [isCustomGame, setIsCustomGame] = useState(false);
  const [customGameText, setCustomGameText] = useState('');
  const [source, setSource] = useState('');
  const [currency, setCurrency] = useState(globalCurrency);
  const [price, setPrice] = useState('');
  
  const titleInputRef = useRef(null);

  // Initialize and load sticky memory when opened
  useEffect(() => {
    if (!isOpen) return;

    setTitle('');
    setPrice('');

    try {
      const savedGame = localStorage.getItem(LAST_GAME_KEY) || localStorage.getItem(LEGACY_LAST_GAME_KEY);
      const savedCustomGame = localStorage.getItem(LAST_CUSTOM_GAME_KEY) || localStorage.getItem(LEGACY_LAST_CUSTOM_GAME_KEY);
      const savedSource = localStorage.getItem(LAST_SOURCE_KEY) || localStorage.getItem(LEGACY_LAST_SOURCE_KEY);
      const savedCurrency = localStorage.getItem(LAST_CURRENCY_KEY) || localStorage.getItem(LEGACY_LAST_CURRENCY_KEY);

      if (savedGame) {
        if (savedGame === '__custom__') {
          setGame('__custom__');
          setIsCustomGame(true);
          setCustomGameText(savedCustomGame || '');
        } else {
          setGame(savedGame);
          setIsCustomGame(false);
          setCustomGameText('');
        }
      } else {
        setGame('World of Warcraft');
        setIsCustomGame(false);
        setCustomGameText('');
      }

      if (savedSource) {
        setSource(savedSource);
      }

      if (savedCurrency && ['TOMAN', 'GOLD'].includes(savedCurrency)) {
        setCurrency(savedCurrency);
      } else {
        setCurrency(globalCurrency || 'TOMAN');
      }
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

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    const selectedGame = isCustomGame
      ? customGameText.trim() || 'Custom Game'
      : game;

    if (!title.trim()) {
      onToast?.('Please enter a boost title', { variant: 'destructive' });
      titleInputRef.current?.focus();
      return;
    }

    // Save sticky preferences
    try {
      localStorage.setItem(LAST_GAME_KEY, game);
      if (isCustomGame) {
        localStorage.setItem(LAST_CUSTOM_GAME_KEY, customGameText);
      }
      if (source.trim()) {
        localStorage.setItem(LAST_SOURCE_KEY, source.trim());
      }
      localStorage.setItem(LAST_CURRENCY_KEY, currency);
    } catch (err) {}

    const entryToSave = {
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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

    onSave(entryToSave);
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
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
          </div>
          <DialogTitle>Quick Add Work</DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            QUICK
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <DialogContent className="p-5 space-y-4">
          {/* 1. Boost Title (Autofocused) */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Boost Title *</span>
              <span className="text-[9px] font-mono text-zinc-500">Required</span>
            </label>
            <Input
              ref={titleInputRef}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Keystone +20, GDKP Raid Pot, Heroic Carry"
              className="bg-zinc-900/80 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 font-medium"
            />
          </div>

          {/* 2. Game / Platform */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <GameIcon game={game} className="w-3.5 h-3.5" />
              <span>Game / Platform *</span>
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
                  onChange={(e) => setCustomGameText(e.target.value)}
                  placeholder="Custom game or realm name..."
                  className="bg-zinc-900/80 border-zinc-700/80 text-zinc-100"
                />
              </div>
            )}
          </div>

          {/* 3. Seller / Job Source */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Seller / Job Source</span>
              <span className="text-[9px] font-mono text-zinc-500">Saved Sources</span>
            </label>
            <SourceCombobox
              value={source}
              onChange={(val) => setSource(val)}
              onToast={onToast}
              placeholder="e.g. Enter seller, broker, or client..."
            />
          </div>

          {/* 4. Price & Live Dual Currency Conversion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                {currency === 'TOMAN' ? (
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Price / Income</span>
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
                  تومان
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
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="font-mono text-sm bg-zinc-900/80 border-zinc-700/80 text-zinc-100 pr-12"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 pointer-events-none">
                  {currency === 'TOMAN' ? 'تومان' : 'G'}
                </div>
              </div>

              {/* Real-time Dual-Currency Conversion Pill */}
              {numericPrice > 0 && (
                <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Live Equivalent:</span>
                    <span className="font-mono font-semibold text-zinc-200">
                      ≈ {formatMoney(convertedPrice, altCurrency)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCurrency}
                    className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Swap primary currency"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Swap</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Context Footer Hint */}
          <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/60">
            <span className="font-mono">Status: Pending · Time: Now</span>
            <div className="flex items-center gap-1">
              <span>Submit with</span>
              <Kbd>Enter</Kbd>
            </div>
          </div>
        </DialogContent>

        <DialogFooter className="flex items-center justify-between sm:justify-between px-5 py-3 border-t border-zinc-800/80 bg-zinc-950/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="gap-1.5 font-semibold bg-zinc-100 text-zinc-950 hover:bg-white active:scale-98 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Add Record</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default QuickAddModal;
