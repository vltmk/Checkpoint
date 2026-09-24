import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { SourceCombobox } from './ui/SourceCombobox';
import { GameIcon } from './ui/GameIcon';
import { CategoryModal } from './ui/CategoryModal';
import { Kbd } from './ui/Tooltip';
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Check,
  Coins,
  Copy,
  Zap,
  Edit2,
  Plus,
  Minus,
  Sparkles,
  Swords,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { toLocalISOString } from './ui/DateTimePicker';
import { TomanIcon } from './ui/Icons';
import { convertCurrency, formatMoney, sanitizePriceInput } from '../lib/currencies';
import { useLanguage, normalizeDigits } from '../lib/i18n';
import { trackerDB } from '../lib/db';
import { copyTextNative } from '../lib/desktop';
import { cn } from '../lib/utils';

const LAST_GAME_KEY = 'checkpoint_quick_last_game';
const LEGACY_LAST_GAME_KEY = 'vault_quick_last_game';
const LAST_CUSTOM_GAME_KEY = 'checkpoint_quick_last_custom_game';
const LEGACY_LAST_CUSTOM_GAME_KEY = 'vault_quick_last_custom_game';
const LAST_CURRENCY_KEY = 'checkpoint_quick_last_currency';
const LEGACY_LAST_CURRENCY_KEY = 'vault_quick_last_currency';

const MYTHIC_KEYS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const RUN_PRESETS = [1, 2, 4, 8];
const RAID_DIFFICULTIES = ['Normal', 'Heroic', 'Mythic'];
const RAID_TYPES = ['Full Clear', 'Specific Bosses', 'Awakened'];
const LEVEL_PRESETS = ['80-90', '70-80', '1-90', '1-80', '1-70', 'Custom'];
const SEASONAL_DUNGEONS = [
  'Murder Row',
  'The Blinding Vale',
  'Temple of Sethraliss',
  "King's Rest",
  'Den of Nalorakk',
  'Voidscar Arena',
  'Ruby Life Pools',
  'Altar of Fangs',
];

export function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  categories = [],
  entries = [],
  onRefreshCategories,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();

  const [activityTab, setActivityTab] = useState('mythic'); // 'mythic' | 'raid' | 'levelup' | 'custom'
  const [title, setTitle] = useState('');
  const [hasTitleError, setHasTitleError] = useState(false);
  const [hasGameError, setHasGameError] = useState(false);
  const [hasPriceError, setHasPriceError] = useState(false);
  const [game, setGame] = useState(() => categories?.[0]?.name || 'World of Warcraft');
  const [isCustomGame, setIsCustomGame] = useState(false);
  const [customGameText, setCustomGameText] = useState('');
  const [source, setSource] = useState('');
  const [currency, setCurrency] = useState(globalCurrency);
  const [price, setPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);

  // Template builder state
  const [keyLevel, setKeyLevel] = useState(10);
  const [runs, setRuns] = useState(1);
  const [selectedDungeons, setSelectedDungeons] = useState([]);
  const [raidDiff, setRaidDiff] = useState('Heroic');
  const [raidType, setRaidType] = useState('Full Clear');
  const [lvlPreset, setLvlPreset] = useState('80-90');
  const [customLvlFrom, setCustomLvlFrom] = useState(80);
  const [customLvlTo, setCustomLvlTo] = useState(90);
  const [charMult, setCharMult] = useState(1);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Ensure active category is always valid against current categories list
  useEffect(() => {
    if (!categories || categories.length === 0) return;
    if (isCustomGame || game === '__custom__') return;

    const isValid = categories.some(
      (c) => c.name?.toLowerCase().trim() === game?.toLowerCase()?.trim()
    );
    if (!isValid) {
      const fallback = categories[0]?.name || 'World of Warcraft';
      setGame(fallback);
    }
  }, [categories, game, isCustomGame]);

  const activeCategorySupportsGold = useMemo(() => {
    const activeGameName = isCustomGame ? customGameText : game;
    if (!activeGameName) return true;
    const cat = (categories || []).find(
      (c) => c.name?.toLowerCase().trim() === activeGameName.toLowerCase().trim()
    );
    if (cat && cat.supportsGold !== undefined) {
      return Boolean(cat.supportsGold);
    }
    return activeGameName.toLowerCase().includes('world of warcraft');
  }, [game, isCustomGame, customGameText, categories]);

  useEffect(() => {
    if (!activeCategorySupportsGold && currency === 'GOLD') {
      setCurrency('TOMAN');
    }
  }, [activeCategorySupportsGold, currency]);

  // Sync generated title from activity templates
  useEffect(() => {
    const activeGame = isCustomGame ? (customGameText || 'Game') : (game || 'World of Warcraft');
    if (activityTab === 'mythic') {
      if (selectedDungeons.length === 1) {
        setTitle(`${activeGame} ${selectedDungeons[0]} +${keyLevel} [${runs}x]`);
      } else if (selectedDungeons.length >= 2) {
        setTitle(`${activeGame} ${language === 'fa' ? 'چندین دانجن' : 'Multi-Dungeon'} +${keyLevel} [${runs}x]`);
      } else {
        setTitle(`${activeGame} Mythic+${keyLevel} [${runs}x]`);
      }
    } else if (activityTab === 'raid') {
      setTitle(`${activeGame} ${raidDiff} Raid [${raidType}]`);
    } else if (activityTab === 'levelup') {
      const range = lvlPreset === 'Custom' ? `${customLvlFrom}-${Math.min(90, customLvlTo)}` : lvlPreset;
      setTitle(`${activeGame} Level-up ${range} [${charMult}x]`);
    }
  }, [
    activityTab,
    keyLevel,
    runs,
    selectedDungeons,
    raidDiff,
    raidType,
    lvlPreset,
    customLvlFrom,
    customLvlTo,
    charMult,
    game,
    isCustomGame,
    customGameText,
    language,
  ]);

  const handleToggleDungeon = (dungeon) => {
    setSelectedDungeons((prev) => {
      const exists = prev.includes(dungeon);
      const next = exists ? prev.filter((d) => d !== dungeon) : [...prev, dungeon];
      if (!exists && next.length >= 2 && runs === 1) {
        setRuns(next.length);
      }
      return next;
    });
  };

  const handleClearDungeons = () => {
    setSelectedDungeons([]);
  };

  const GAME_OPTIONS = useMemo(() => {
    const opts = (categories || []).map((cat) => ({
      value: cat.name,
      label: cat.name,
      icon: (
        <div className="flex items-center gap-1.5 shrink-0">
          <GameIcon game={cat.name} customIcon={cat.icon} className="w-3.5 h-3.5" />
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: cat.color || '#71717A' }}
          />
        </div>
      ),
    }));

    opts.push({
      value: '__custom__',
      label: `+ ${t('categories.newCategoryOption', 'Add / Manage Categories...')}`,
      icon: <Plus className="w-3.5 h-3.5 text-zinc-400" />,
    });

    return opts;
  }, [categories, t]);
  
  const titleInputRef = useRef(null);
  const entryIdRef = useRef(null);

  // Initialize and load sticky memory when opened
  useEffect(() => {
    if (!isOpen) return;

    setTitle('');
    setPrice('');
    setSource('');
    setSelectedDungeons([]);
    setHasTitleError(false);
    setHasGameError(false);
    setHasPriceError(false);
    setIsSaving(false);
    setSaveError(null);
    setDiagnosticsCopied(false);
    entryIdRef.current = null;

    try {
      // Purge any legacy cached source key
      localStorage.removeItem('checkpoint_quick_last_source');
      localStorage.removeItem('vault_quick_last_source');

      const savedGame = localStorage.getItem(LAST_GAME_KEY) || localStorage.getItem(LEGACY_LAST_GAME_KEY);
      const savedCustomGame = localStorage.getItem(LAST_CUSTOM_GAME_KEY) || localStorage.getItem(LEGACY_LAST_CUSTOM_GAME_KEY);
      const savedCurrency = localStorage.getItem(LAST_CURRENCY_KEY) || localStorage.getItem(LEGACY_LAST_CURRENCY_KEY);

      const resolveCategory = (rawGame, rawCustomGame) => {
        if (rawGame === '__custom__') {
          return { game: '__custom__', isCustom: true, customText: rawCustomGame || '' };
        }

        // 1. Check user's last used category from ledger entries
        const latestEntryGame = entries?.find((e) => e?.game?.trim())?.game?.trim();
        const entryGameMatch = (categories || []).find(
          (c) => c.name?.toLowerCase().trim() === latestEntryGame?.toLowerCase()
        )?.name;

        // 2. Check sticky saved game
        const savedGameMatch = (categories || []).find(
          (c) => c.name?.toLowerCase().trim() === rawGame?.toLowerCase()?.trim()
        )?.name;

        // If rawGame was set to something that does not exist in categories (e.g. stale 'test'), purge it
        if (rawGame && !savedGameMatch && rawGame !== '__custom__') {
          try {
            localStorage.removeItem(LAST_GAME_KEY);
            localStorage.removeItem(LEGACY_LAST_GAME_KEY);
            trackerDB.setSetting(LAST_GAME_KEY, '').catch(() => {});
          } catch (e) {}
        }

        // Target category priority:
        // - Last used category from user's entries (if valid in categories)
        // - Or last used category from saved preference (if valid in categories)
        // - Or first category in the list
        const chosen =
          entryGameMatch ||
          savedGameMatch ||
          categories?.[0]?.name ||
          'World of Warcraft';

        return { game: chosen, isCustom: false, customText: '' };
      };

      const applySticky = (g, cg, c) => {
        const resolved = resolveCategory(g, cg);
        setGame(resolved.game);
        setIsCustomGame(resolved.isCustom);
        setCustomGameText(resolved.customText);

        if (c && ['TOMAN', 'GOLD'].includes(c)) {
          setCurrency(c);
        } else {
          setCurrency(globalCurrency || 'TOMAN');
        }
      };

      applySticky(savedGame, savedCustomGame, savedCurrency);

      // Also hydrate missing values from SQLite trackerDB
      Promise.all([
        trackerDB.getSetting(LAST_GAME_KEY, null),
        trackerDB.getSetting(LAST_CUSTOM_GAME_KEY, null),
        trackerDB.getSetting(LAST_CURRENCY_KEY, null),
      ]).then(([dbGame, dbCustomGame, dbCurrency]) => {
        const finalGame = savedGame || dbGame;
        const finalCustomGame = savedCustomGame || dbCustomGame;
        const finalCurrency = savedCurrency || dbCurrency;
        applySticky(finalGame, finalCustomGame, finalCurrency);
      }).catch(() => {});
    } catch (e) {
      const fallbackGame = categories?.[0]?.name || 'World of Warcraft';
      setGame(fallbackGame);
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
  }, [isOpen, globalCurrency, categories, entries]);

  const isClassic =
    game === 'World of Warcraft Classic' ||
    (!isCustomGame && game?.toLowerCase().includes('classic'));

  const rateNum = isClassic ? 7000 : (Number(goldRateTOMAN) || 3200);

  const handleGameSelect = (val) => {
    setHasGameError(false);
    if (saveError) setSaveError(null);
    if (val === '__custom__') {
      setEditingCategory(null);
      setIsCategoryModalOpen(true);
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
      localStorage.setItem(LAST_CURRENCY_KEY, currency);
      trackerDB.setSetting(LAST_CURRENCY_KEY, currency).catch(() => {});
    } catch (err) {}

    entryIdRef.current ||= 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    let finalNotes = '';
    if (activityTab === 'mythic' && selectedDungeons.length >= 2) {
      finalNotes = (language === 'fa' ? 'دانجن‌ها: ' : 'Dungeons: ') + selectedDungeons.join(', ');
    }

    const entryToSave = {
      id: entryIdRef.current,
      title: title.trim(),
      dateTime: toLocalISOString(new Date()),
      game: selectedGame,
      source: source.trim(),
      teamMode: false,
      teammates: [],
      currency,
      income: numericPrice,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: 'Pending',
      notes: finalNotes,
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
    <>
      <Dialog open={isOpen} onClose={isSaving ? undefined : onClose} maxWidth="max-w-lg">
        <DialogHeader onClose={isSaving ? undefined : onClose}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" strokeWidth={1.75} />
            </div>
            <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('quickAdd.title')}</DialogTitle>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
              {t('quickAdd.badge')}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="flex flex-col flex-1 min-h-0">
          <DialogContent className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {saveError && (
              <div role="alert" className="flex items-start gap-2.5 rounded-md border border-rose-800/70 bg-rose-950/30 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn('font-medium text-rose-200', isRtl && 'font-farsi')}>
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

            {/* Apple-style Activity Segmented Control */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
                  {t('quickAdd.activity', 'Activity Template')}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Fluid Builder</span>
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                {[
                  { id: 'mythic', label: t('quickAdd.mythicPlus', 'Mythic+'), icon: Swords },
                  { id: 'raid', label: t('quickAdd.raid', 'Raid'), icon: Shield },
                  { id: 'levelup', label: t('quickAdd.levelUp', 'Level-up'), icon: TrendingUp },
                  { id: 'custom', label: t('quickAdd.custom', 'Custom'), icon: Sparkles },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activityTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivityTab(tab.id)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-colors cursor-pointer border',
                        isActive
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs border-zinc-200/80 dark:border-zinc-700/50'
                          : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity Template Sub-Panels */}
            {activityTab === 'mythic' && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                {/* Key Level Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                      {t('quickAdd.keyLevel', 'Key Level')}: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">+{keyLevel}</strong>
                    </span>
                    <span className="text-[10px] text-zinc-400">+6 to +22</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {MYTHIC_KEYS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setKeyLevel(lvl)}
                        className={cn(
                          'h-7 min-w-[32px] px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                          keyLevel === lvl
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/60'
                        )}
                      >
                        +{lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Runs Multiplier */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                      {t('quickAdd.runs', 'Runs')}: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{runs}x</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {RUN_PRESETS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRuns(r)}
                          className={cn(
                            'h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                            runs === r
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/60'
                          )}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 h-7 px-1 ms-auto">
                      <button
                        type="button"
                        onClick={() => setRuns((prev) => Math.max(1, prev - 1))}
                        className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                        title="Decrease runs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-medium px-2 min-w-[24px] text-center text-zinc-800 dark:text-zinc-200">
                        {runs}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRuns((prev) => prev + 1)}
                        className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                        title="Increase runs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seasonal Active Dungeons Multi-Select */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                      <span>{t('quickAdd.dungeons', 'Seasonal Dungeons')}</span>
                      {selectedDungeons.length > 0 && (
                        <span className="text-[10px] text-zinc-800 dark:text-zinc-200 font-semibold lowercase">
                          ({selectedDungeons.length})
                        </span>
                      )}
                    </span>
                    {selectedDungeons.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDungeons}
                        className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline cursor-pointer"
                      >
                        {t('quickAdd.clearDungeons', 'Clear')}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SEASONAL_DUNGEONS.map((dungeon) => {
                      const isSelected = selectedDungeons.includes(dungeon);
                      return (
                        <button
                          key={dungeon}
                          type="button"
                          onClick={() => handleToggleDungeon(dungeon)}
                          className={cn(
                            'h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer border',
                            isSelected
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-transparent shadow-xs font-semibold'
                              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border-zinc-200 dark:border-zinc-700/60'
                          )}
                        >
                          {dungeon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activityTab === 'raid' && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                {/* Difficulty */}
                <div>
                  <span className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5', isRtl && 'font-farsi')}>
                    {t('quickAdd.difficulty', 'Difficulty')}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {RAID_DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRaidDiff(d)}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-xs font-medium transition-colors text-center cursor-pointer',
                          raidDiff === d
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/60'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Run Type */}
                <div>
                  <span className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5', isRtl && 'font-farsi')}>
                    {t('quickAdd.runType', 'Run Type')}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {RAID_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRaidType(type)}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-xs font-medium transition-colors text-center truncate cursor-pointer',
                          raidType === type
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/60'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activityTab === 'levelup' && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                {/* Level Bracket Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                      {t('quickAdd.levelRange', 'Level Range (Max 90)')}
                    </span>
                    <span className="text-[10px] text-zinc-400">Cap: 90</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LEVEL_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLvlPreset(p)}
                        className={cn(
                          'py-1 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                          lvlPreset === p
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/60'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Level Range (Max 90) */}
                {lvlPreset === 'Custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1">
                      <label className="block text-[9px] text-zinc-400 mb-1">From Lvl</label>
                      <Input
                        type="number"
                        min="1"
                        max="89"
                        value={customLvlFrom}
                        onChange={(e) => setCustomLvlFrom(Math.max(1, Math.min(89, parseInt(e.target.value) || 1)))}
                        className="h-8 text-xs bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <span className="text-zinc-400 mt-4">→</span>
                    <div className="flex-1">
                      <label className="block text-[9px] text-zinc-400 mb-1">To Lvl (Max 90)</label>
                      <Input
                        type="number"
                        min="2"
                        max="90"
                        value={customLvlTo}
                        onChange={(e) => setCustomLvlTo(Math.max(2, Math.min(90, parseInt(e.target.value) || 90)))}
                        className="h-8 text-xs bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                )}

                {/* Characters Multiplier */}
                <div className="flex items-center justify-between pt-1">
                  <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                    {t('quickAdd.characters', 'Characters')}: <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">{charMult}x</strong>
                  </span>
                  <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 h-7 px-1">
                    <button
                      type="button"
                      onClick={() => setCharMult((prev) => Math.max(1, prev - 1))}
                      className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                      title="Decrease characters"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-medium px-2 min-w-[24px] text-center text-zinc-800 dark:text-zinc-200">
                      {charMult}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCharMult((prev) => prev + 1)}
                      className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                      title="Increase characters"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Generated Work Title (Editable Preview) */}
            <div>
              <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span>{t('quickAdd.boostTitle')} *</span>
                {hasTitleError ? (
                  <span className="text-[9px] text-rose-500 font-medium">Required</span>
                ) : (
                  <span className="text-[9px] text-zinc-500">Preview & fine-tune</span>
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
                  'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium transition-colors',
                  hasTitleError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                )}
              />
            </div>

            {/* Game / Category & Seller Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                  <GameIcon game={game} categories={categories} className="w-3.5 h-3.5" />
                  <span>{t('work.gamePlatform')} *</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={game}
                      onChange={handleGameSelect}
                      options={GAME_OPTIONS}
                    />
                  </div>
                  {game && (
                    <button
                      type="button"
                      onClick={() => {
                        const matched = (categories || []).find(
                          (c) => c.name.toLowerCase() === game.toLowerCase()
                        );
                        setEditingCategory(matched || { name: game });
                        setIsCategoryModalOpen(true);
                      }}
                      title={t('categories.editCategory', 'Edit Category')}
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 transition-colors shrink-0 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
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
                        'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200',
                        hasGameError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                      )}
                    />
                    {hasGameError && <p className="mt-1 text-[10px] text-rose-500">Required</p>}
                  </div>
                )}
              </div>

              <div>
                <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                  <span>{t('work.sellerSource')}</span>
                  <span className="text-[9px] text-zinc-500">Saved Sources</span>
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
            </div>

            {/* Price & Scoped Currency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                  {currency === 'TOMAN' ? (
                    <Banknote className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  )}
                  <span>{t('quickAdd.priceIncome')}</span>
                </label>

                {/* Currency Selector (Scoped: only if category supports gold) */}
                {activeCategorySupportsGold ? (
                  <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => setCurrency('TOMAN')}
                      className={`flex items-center justify-center gap-1.5 h-7 min-w-[56px] px-2.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        currency === 'TOMAN'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <TomanIcon className="w-3.5 h-3.5 min-w-[14px] min-h-[14px]" />
                      <span>{language === 'fa' ? 'تومان' : 'Toman'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('GOLD')}
                      className={`flex items-center justify-center h-7 min-w-[56px] px-2.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        currency === 'GOLD'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-transparent'
                          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <span>Gold</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 h-7 px-2.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                    <TomanIcon className="w-3.5 h-3.5 min-w-[14px] min-h-[14px]" />
                    <span>{language === 'fa' ? 'تومان' : 'Toman'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onPaste={(e) => {
                      const clipboard = e.clipboardData?.getData('text');
                      if (clipboard) {
                        const cleaned = sanitizePriceInput(clipboard);
                        if (cleaned) {
                          e.preventDefault();
                          setPrice(cleaned);
                          if (hasPriceError) setHasPriceError(false);
                          if (saveError) setSaveError(null);
                        }
                      }
                    }}
                    onChange={(e) => {
                      let val = sanitizePriceInput(e.target.value);
                      setPrice(val);
                      if (hasPriceError) setHasPriceError(false);
                      if (saveError) setSaveError(null);
                    }}
                    placeholder="0"
                    className={cn(
                      'text-sm bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200',
                      isRtl ? 'pl-12 pr-3 font-farsi' : 'pr-12 pl-3',
                      hasPriceError && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                    )}
                    required
                  />
                  <div className={cn(
                    'absolute top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400 pointer-events-none flex items-center',
                    isRtl ? 'left-3' : 'right-3'
                  )}>
                    {currency === 'TOMAN' ? <TomanIcon className="w-[22px] h-[22px] min-w-[22px] min-h-[22px]" /> : 'G'}
                  </div>
                </div>

                {hasPriceError && <p className="text-[10px] text-rose-500">Required</p>}

                {/* Real-time Dual-Currency Conversion Pill (Only if category supports gold) */}
                {numericPrice > 0 && activeCategorySupportsGold && (
                  <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500">{t('quickAdd.liveEquivalent')}:</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-200">
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

          <DialogFooter className="flex items-center justify-between sm:justify-between px-5 py-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-white/25 dark:bg-zinc-950/25">
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
            className={cn('gap-1.5 font-medium active:scale-[0.98] shadow-sm', isRtl && 'font-farsi')}
          >
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{isSaving ? (language === 'fa' ? 'در حال ذخیره...' : 'Saving...') : t('quickAdd.addRecord')}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>

    <CategoryModal
      isOpen={isCategoryModalOpen}
      category={editingCategory}
      onClose={() => setIsCategoryModalOpen(false)}
      onSave={async (savedCat) => {
        await onRefreshCategories?.();
        setGame(savedCat.name);
        setIsCustomGame(false);
        setCustomGameText('');
        setIsCategoryModalOpen(false);
      }}
    />
  </>
  );
}

export default QuickAddModal;
