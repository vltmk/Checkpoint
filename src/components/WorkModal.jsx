import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';
import { Select } from './ui/Select';
import { SourceCombobox } from './ui/SourceCombobox';
import { TeammatesCombobox } from './ui/TeammatesCombobox';
import { NumberStepperInput } from './ui/NumberStepperInput';
import { DateTimePicker, toLocalISOString } from './ui/DateTimePicker';
import { GameIcon } from './ui/GameIcon';
import { MoneyDisplay } from './ui/MoneyDisplay';
import { Tooltip, Kbd } from './ui/Tooltip';
import {
  ArrowRight,
  AlertTriangle,
  Copy,
  ImagePlus,
  ClipboardPaste,
  X,
  Check,
  Banknote,
  Coins,
  Users,
  Link2,
  Plus,
  Minus,
  Hash,
  Megaphone,
  TrendingUp,
  TrendingDown,
  Tag,
  Store,
  ArrowRightLeft,
  CircleDollarSign,
  RotateCcw,
  Calculator,
} from 'lucide-react';
import { DiscordIcon, TelegramIcon, SteamIcon, GoogleSheetsIcon, GithubIcon, TomanIcon } from './ui/Icons';
import { CategoryModal } from './ui/CategoryModal';
import { OrderCalculatorPopover } from './OrderCalculatorPopover';
import { trackerDB } from '../lib/db';
import { copyTextNative, optimizeImageProof } from '../lib/desktop';
import { detectAppLink } from '../lib/appLinks';
import { useLanguage, normalizeDigits } from '../lib/i18n';
import { sanitizePriceInput, convertCurrency, formatMoney } from '../lib/currencies';
import { cn } from '../lib/utils';
import { parseOrderText } from '../lib/orderParser.js';
import { ADVERTISER_LAST_FEE_KEY } from '../lib/profiles';

const DRAFT_KEY = 'checkpoint_work_draft';
const LEGACY_DRAFT_KEY = 'vault_work_draft';

export function WorkModal({
  isOpen,
  onClose,
  onSave,
  editingEntry = null,
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  onOpenLightbox,
  categories = [],
  latestEntryDefaults = null,
  onRefreshCategories,
  activeProfileId = 'booster',
  usdRateTOMAN = 95000,
  eurRateUSD = 1.08,
  onSaveRates,
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [fieldErrors, setFieldErrors] = useState({ title: false, game: false, dateTime: false, income: false });
  const [proofPasted, setProofPasted] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const handleApplyFromCalculator = (calcData) => {
    if (!calcData) return;
    const isMultiBooster = calcData?.boosterCount > 1;
    const boosterCuts = {};
    if (isMultiBooster && Array.isArray(formData.teammates) && formData.teammates.length > 0) {
      formData.teammates.forEach((tm) => {
        boosterCuts[tm] = String(calcData.perBoosterCut || '');
      });
    }

    updateFormData({
      pot: String(calcData?.clientPrice || ''),
      income: String(calcData?.income || ''),
      feeRate: String(calcData?.feeRate || '15'),
      feeType: calcData?.feeType || 'percent',
      platformFee: calcData?.platformFeePct || 0,
      currency: calcData?.currency || formData.currency || 'USD',
      teammateCuts: Object.keys(boosterCuts).length > 0 ? boosterCuts : formData.teammateCuts,
    });
    setIsCalculatorOpen(false);
  };

  const CURRENCY_OPTIONS = [
    {
      value: 'TOMAN',
      label: language === 'fa' ? 'تومان' : 'Toman',
      icon: <TomanIcon className="w-[24px] h-[24px] min-w-[24px] min-h-[24px]" />,
    },
    {
      value: 'GOLD',
      label: 'Gold',
      icon: <Coins className="w-3.5 h-3.5" />,
    },
    {
      value: 'USD',
      label: 'USD ($)',
      icon: <span className="font-semibold text-xs leading-none">$</span>,
    },
    {
      value: 'EUR',
      label: 'EUR (€)',
      icon: <span className="font-semibold text-xs leading-none">€</span>,
    },
  ];

  const STATUS_OPTIONS = [
    { value: 'Pending', label: t('status.Pending') },
    { value: 'Paid', label: t('status.Paid') },
    { value: 'Working', label: t('status.Working') },
    { value: 'On Hold', label: t('status.On Hold') },
    { value: 'Failed', label: t('status.Failed') },
  ];
  const [entryType, setEntryType] = useState('income'); // 'income' | 'expense'
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    game: 'World of Warcraft',
    isCustomGame: false,
    customGameText: '',
    source: '',
    orderId: '',
    feeRate: '15',
    feeType: 'percent', // 'percent' | 'flat'
    sourcePaid: false,
    boosterPaid: false,
    platformFee: 0,
    teamMode: false,
    teammates: [],
    teamInputMode: 'pot', // 'pot' | 'income'
    pot: '',
    income: '',
    teammateCuts: {},
    teammateNotes: {},
    currency: 'TOMAN',
    exchangeRate: String(goldRateTOMAN || 3200),
    status: 'Pending',
    notes: '',
    link: '',
  });

  const [isCustomRateActive, setIsCustomRateActive] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const activeCategorySupportsGold = useMemo(() => {
    const activeGameName = formData.isCustomGame ? formData.customGameText : formData.game;
    if (!activeGameName) return true;
    const cat = (categories || []).find(
      (c) => c.name?.toLowerCase().trim() === activeGameName.toLowerCase().trim()
    );
    if (cat && cat.supportsGold !== undefined) {
      return Boolean(cat.supportsGold);
    }
    return activeGameName.toLowerCase().includes('world of warcraft');
  }, [formData.game, formData.isCustomGame, formData.customGameText, categories]);

  const availableCurrencyOptions = useMemo(() => {
    if (activeCategorySupportsGold) {
      return CURRENCY_OPTIONS;
    }
    return CURRENCY_OPTIONS.filter((c) => c.value !== 'GOLD');
  }, [activeCategorySupportsGold, language]);

  useEffect(() => {
    if (!activeCategorySupportsGold && formData.currency === 'GOLD') {
      setFormData((prev) => ({ ...prev, currency: 'TOMAN' }));
    }
  }, [activeCategorySupportsGold, formData.currency]);

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

    // If editing an existing entry whose game is not in categories, include it
    if (
      editingEntry &&
      formData.game &&
      !opts.some((o) => o.value.toLowerCase() === formData.game.toLowerCase()) &&
      formData.game !== '__custom__'
    ) {
      opts.push({
        value: formData.game,
        label: formData.game,
        icon: <GameIcon game={formData.game} className="w-3.5 h-3.5" />,
      });
    }

    opts.push({
      value: '__custom__',
      label: `+ ${t('categories.newCategoryOption', 'Add / Manage Categories...')}`,
      icon: <Plus className="w-3.5 h-3.5 text-zinc-400" />,
    });

    return opts;
  }, [categories, formData.game, t]);

  const [isCustomCutsOpen, setIsCustomCutsOpen] = useState(false);
  const [proofs, setProofs] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const fileInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const entryIdRef = useRef(null);
  const initialValuesRef = useRef(null);

  const detectedLink = useMemo(() => {
    return detectAppLink(formData.link);
  }, [formData.link]);

  const renderPlatformIcon = (platform, className = 'w-3.5 h-3.5') => {
    switch (platform) {
      case 'discord':
        return <DiscordIcon className={className} />;
      case 'telegram':
        return <TelegramIcon className={className} />;
      case 'steam':
        return <SteamIcon className={className} />;
      case 'sheets':
        return <GoogleSheetsIcon className={className} />;
      case 'github':
        return <GithubIcon className={className} />;
      default:
        return <Link2 className={className} />;
    }
  };

  // Remembered values (draft, last currency for this profile, advertiser fee) come from the settings store.
  // They are read each time the form opens; the form is initialised once they arrive.
  const [storedDefaults, setStoredDefaults] = useState(null);
  useEffect(() => {
    if (!isOpen) {
      setStoredDefaults(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      trackerDB.getSetting(DRAFT_KEY, null),
      trackerDB.getSetting(`checkpoint_work_last_currency_${activeProfileId}`, null),
      trackerDB.getSetting(ADVERTISER_LAST_FEE_KEY, null),
    ]).then(([draft, currency, fee]) => {
      if (!cancelled) setStoredDefaults({ draft, currency, fee });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeProfileId]);

  useEffect(() => {
    if (!isOpen || (!editingEntry && storedDefaults === null)) return;

    setIsSaving(false);
    setSaveError(null);
    setDiagnosticsCopied(false);
    entryIdRef.current = editingEntry?.id || null;

    if (editingEntry) {
      setIsDraftRestored(false);
      const isStandardGame = GAME_OPTIONS.some(
        (g) => g.value !== '__custom__' && g.value === editingEntry.game
      );

      let entryCur = editingEntry.currency;
      if (entryCur === 'WOW_GOLD') entryCur = 'GOLD';
      if (!['USD', 'EUR', 'TOMAN', 'GOLD'].includes(entryCur)) entryCur = 'TOMAN';

      const entryTeammates = Array.isArray(editingEntry.teammates) ? editingEntry.teammates : [];
      const totalShares = 1 + entryTeammates.length;
      const initialPot =
        editingEntry.pot !== undefined && editingEntry.pot !== null
          ? String(editingEntry.pot)
          : editingEntry.clientPrice !== undefined && editingEntry.clientPrice !== null
          ? String(editingEntry.clientPrice)
          : editingEntry.income !== undefined
          ? String(Math.round(Number(editingEntry.income) * totalShares * 100) / 100)
          : '';
      const initialCuts =
        editingEntry.teammateCuts && typeof editingEntry.teammateCuts === 'object'
          ? { ...editingEntry.teammateCuts }
          : {};
      const initialNotes =
        editingEntry.teammateNotes && typeof editingEntry.teammateNotes === 'object'
          ? { ...editingEntry.teammateNotes }
          : {};

      const isExpense = editingEntry.income !== undefined && editingEntry.income !== null && Number(editingEntry.income) < 0;
      setEntryType(isExpense ? 'expense' : 'income');

      const isAdvertiser = activeProfileId === 'advertiser';

      setFormData({
        title: editingEntry.title || '',
        dateTime: editingEntry.dateTime || toLocalISOString(new Date()),
        game: editingEntry.game || 'World of Warcraft',
        isCustomGame: !isStandardGame && Boolean(editingEntry.game),
        customGameText: isStandardGame ? '' : editingEntry.game || '',
        source: editingEntry.source !== undefined && editingEntry.source !== null
          ? editingEntry.source
          : '',
        orderId: editingEntry.orderId || '',
        feeRate: editingEntry.feeRate !== undefined && editingEntry.feeRate !== null
          ? String(editingEntry.feeRate)
          : (storedDefaults?.fee || '15'),
        feeType: editingEntry.feeType || 'percent',
        sourcePaid: Boolean(editingEntry.sourcePaid),
        boosterPaid: Boolean(editingEntry.boosterPaid),
        platformFee: editingEntry.platformFee || 0,
        teamMode: !isExpense && Boolean(editingEntry.teamMode || entryTeammates.length > 0),
        teammates: isExpense ? [] : entryTeammates,
        teamInputMode: editingEntry.teamInputMode || (editingEntry.pot !== null && editingEntry.pot !== undefined ? 'pot' : 'income'),
        pot: initialPot,
        income: editingEntry.income !== undefined && editingEntry.income !== null ? String(Math.abs(Number(editingEntry.income))) : '',
        teammateCuts: initialCuts,
        teammateNotes: initialNotes,
        currency: entryCur,
        exchangeRate: String(editingEntry.exchangeRate || goldRateTOMAN || 3200),
        status: editingEntry.status || 'Pending',
        notes: editingEntry.notes || '',
        link: editingEntry.link || '',
      });
      initialValuesRef.current = {
        title: editingEntry.title || '',
        game: editingEntry.game || 'World of Warcraft',
        dateTime: editingEntry.dateTime || '',
        income: editingEntry.income !== undefined && editingEntry.income !== null ? String(Math.abs(Number(editingEntry.income))) : '',
        pot: initialPot,
        source: editingEntry.source !== undefined && editingEntry.source !== null ? editingEntry.source : '',
        orderId: editingEntry.orderId || '',
        status: editingEntry.status || 'Pending',
        currency: entryCur,
        notes: editingEntry.notes || '',
        link: editingEntry.link || '',
        feeRate: editingEntry.feeRate !== undefined && editingEntry.feeRate !== null ? String(editingEntry.feeRate) : '',
        entryType: isExpense ? 'expense' : 'income',
        teamMode: !isExpense && Boolean(editingEntry.teamMode || entryTeammates.length > 0),
        teammates: JSON.stringify(isExpense ? [] : entryTeammates),
        teammateCuts: JSON.stringify(initialCuts || {}),
        proofsCount: (editingEntry.proofs && editingEntry.proofs.length) || 0,
      };
      setProofs(editingEntry.proofs && editingEntry.proofs.length > 0 && editingEntry.proofs[0]?.data ? [...editingEntry.proofs] : []);
      const hasCustomRate = editingEntry.exchangeRate && Number(editingEntry.exchangeRate) !== Number(goldRateTOMAN || 3200);
      setIsCustomRateActive(Boolean(hasCustomRate));
      
      if (editingEntry.id) {
        trackerDB.getEntry(editingEntry.id).then((full) => {
          if (full && Array.isArray(full.proofs) && full.proofs.length > 0) {
            setProofs(full.proofs);
            if (initialValuesRef.current) {
              initialValuesRef.current.proofsCount = full.proofs.length;
            }
          }
        }).catch(() => {});
      }
    } else {
      initialValuesRef.current = null;
      const isAdvertiser = activeProfileId === 'advertiser';
      const latestEntryGame = latestEntryDefaults?.game || undefined;
      const entryCategoryMatch = (categories || []).find(
        (c) => c.name?.toLowerCase().trim() === latestEntryGame?.toLowerCase()
      )?.name;
      const defaultGame = entryCategoryMatch || categories?.[0]?.name || 'World of Warcraft';

      const savedProfileCurrency = storedDefaults?.currency || null;
      const latestEntryCurrency = latestEntryDefaults?.currency || undefined;
      const validProfileCur = (savedProfileCurrency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(savedProfileCurrency))
        ? savedProfileCurrency
        : (latestEntryCurrency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(latestEntryCurrency))
        ? latestEntryCurrency
        : null;
      const defaultCur = validProfileCur || globalCurrency || 'TOMAN';

      try {
        const savedDraft = storedDefaults?.draft && typeof storedDefaults.draft === 'object' ? storedDefaults.draft : null;
        if (savedDraft) {
          const parsed = savedDraft;
          const draftTeammates = Array.isArray(parsed.teammates) ? parsed.teammates : [];
          const draftSource = (parsed.source === 'Direct Client' ? '' : parsed.source) || '';
          const draftCategoryMatch = (categories || []).find(
            (c) => c.name?.toLowerCase().trim() === parsed.game?.toLowerCase()?.trim()
          )?.name;
          const gameToUse = draftCategoryMatch || (parsed.isCustomGame ? (parsed.game || defaultGame) : defaultGame);

          setFormData({
            title: parsed.title || '',
            dateTime: parsed.dateTime || toLocalISOString(new Date()),
            game: gameToUse,
            isCustomGame: Boolean(parsed.isCustomGame),
            customGameText: parsed.customGameText || '',
            source: draftSource || '',
            orderId: parsed.orderId || '',
            feeRate: parsed.feeRate || (storedDefaults?.fee || '15'),
            feeType: parsed.feeType || 'percent',
            sourcePaid: Boolean(parsed.sourcePaid),
            boosterPaid: Boolean(parsed.boosterPaid),
            platformFee: parsed.platformFee || 0,
            teamMode: Boolean(parsed.teamMode || draftTeammates.length > 0),
            teammates: draftTeammates,
            teamInputMode: parsed.teamInputMode || 'pot',
            pot: parsed.pot || '',
            income: parsed.income || '',
            teammateCuts: parsed.teammateCuts || {},
            teammateNotes: parsed.teammateNotes || {},
            currency: parsed.currency || defaultCur,
            exchangeRate: String(goldRateTOMAN || 3200),
            status: parsed.status || 'Pending',
            notes: parsed.notes || '',
            link: parsed.link || '',
          });
          setIsDraftRestored(Boolean(parsed.title || parsed.income || parsed.pot || parsed.notes || parsed.source || parsed.link || draftTeammates.length > 0));
          setIsCustomRateActive(false);
        } else {
          setIsDraftRestored(false);
          setEntryType('income');
          setFormData({
            title: '',
            dateTime: toLocalISOString(new Date()),
            game: defaultGame,
            isCustomGame: false,
            customGameText: '',
            source: '',
            orderId: '',
            feeRate: storedDefaults?.fee || '15',
            feeType: 'percent',
            sourcePaid: false,
            boosterPaid: false,
            platformFee: 0,
            teamMode: false,
            teammates: [],
            teamInputMode: 'pot',
            pot: '',
            income: '',
            teammateCuts: {},
            teammateNotes: {},
            currency: defaultCur,
            exchangeRate: String(goldRateTOMAN || 3200),
            status: 'Pending',
            notes: '',
            link: '',
          });
          setProofs([]);
          setIsCustomRateActive(false);
        }
      } catch (err) {
        setIsDraftRestored(false);
        setIsCustomRateActive(false);
      }
    }
    setFieldErrors({ title: false, game: false, dateTime: false, income: false });
  }, [isOpen, editingEntry, globalCurrency, goldRateTOMAN, activeProfileId, categories, latestEntryDefaults, storedDefaults]);

  // Draft writes are debounced: every keystroke used to write the whole form to the settings store.
  // A pending write is flushed when the dialog closes or the window unloads, and cancelled when the draft is cleared.
  const DRAFT_SAVE_DELAY_MS = 400;
  const draftSaveTimerRef = useRef(null);
  const pendingDraftRef = useRef(null);
  const draftDirtyRef = useRef(false);

  const writeDraftNow = (draft) => {
    try {
    } catch (e) {}
    trackerDB.setSetting(DRAFT_KEY, draft).catch(() => {});
  };

  const flushPendingDraft = () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    if (pendingDraftRef.current) {
      const draft = pendingDraftRef.current;
      pendingDraftRef.current = null;
      writeDraftNow(draft);
    }
  };

  const cancelPendingDraft = () => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    pendingDraftRef.current = null;
  };

  // Only user edits schedule a draft write; opening the form or restoring a draft does not
  useEffect(() => {
    if (!draftDirtyRef.current || editingEntry) return;
    pendingDraftRef.current = formData;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(flushPendingDraft, DRAFT_SAVE_DELAY_MS);
  }, [formData]);

  useEffect(() => {
    if (!isOpen) {
      flushPendingDraft();
      draftDirtyRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener('beforeunload', flushPendingDraft);
    return () => {
      window.removeEventListener('beforeunload', flushPendingDraft);
      flushPendingDraft();
    };
  }, []);

  const updateFormData = (patch) => {
    if (saveError) setSaveError(null);
    if (patch.title) setFieldErrors((prev) => ({ ...prev, title: false }));
    if (patch.game || patch.customGameText) setFieldErrors((prev) => ({ ...prev, game: false }));
    if (patch.dateTime) setFieldErrors((prev) => ({ ...prev, dateTime: false }));
    if (patch.income !== undefined || patch.pot !== undefined) setFieldErrors((prev) => ({ ...prev, income: false }));
    if (patch.currency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(patch.currency)) {
      try {
        trackerDB.setSetting(`checkpoint_work_last_currency_${activeProfileId}`, patch.currency).catch(() => {});
      } catch (e) {}
    }
    draftDirtyRef.current = true;
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const clearPersistedDraft = () => {
    cancelPendingDraft();
    try {
    } catch (err) {}
    trackerDB.setSetting(DRAFT_KEY, '').catch(() => {});
  };

  const isAdvertiser = activeProfileId === 'advertiser';

  const handleClearDraft = () => {
    clearPersistedDraft();
    setIsDraftRestored(false);
    setFieldErrors({ title: false, game: false, dateTime: false, income: false });
    const latestEntryGame = latestEntryDefaults?.game || undefined;
    const entryCategoryMatch = (categories || []).find(
      (c) => c.name?.toLowerCase().trim() === latestEntryGame?.toLowerCase()
    )?.name;
    const defaultGame = entryCategoryMatch || categories?.[0]?.name || 'World of Warcraft';
    const savedProfileCurrency = storedDefaults?.currency || null;
    const latestEntryCurrency = latestEntryDefaults?.currency || undefined;
    const validProfileCur = (savedProfileCurrency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(savedProfileCurrency))
      ? savedProfileCurrency
      : (latestEntryCurrency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(latestEntryCurrency))
      ? latestEntryCurrency
      : null;
    const defaultCur = validProfileCur || globalCurrency || 'TOMAN';
    setFormData({
      title: '',
      dateTime: toLocalISOString(new Date()),
      game: defaultGame,
      isCustomGame: false,
      customGameText: '',
      source: '',
      orderId: '',
      feeRate: storedDefaults?.fee || '15',
      sourcePaid: false,
      teamMode: false,
      teammates: [],
      teamInputMode: 'pot',
      pot: '',
      income: '',
      teammateCuts: {},
      teammateNotes: {},
      currency: defaultCur,
      exchangeRate: String(goldRateTOMAN || 3200),
      status: 'Pending',
      notes: '',
      link: '',
    });
    setProofs([]);
  };

  // Advertiser Financial Handlers
  const handleAdvertiserClientPriceChange = (valStr) => {
    const clean = sanitizePriceInput(valStr, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' }).replace(/[-+]/g, '');
    const clientPrice = parseFloat(clean);
    const rate = parseFloat(formData.feeRate);
    const activeType = formData.feeType || 'percent';

    if (entryType === 'expense') {
      updateFormData({
        pot: clean,
        income: clean,
        teammateCuts: {},
      });
      return;
    }

    if (!isNaN(clientPrice) && clientPrice >= 0) {
      let myProfit = 0;
      if (activeType === 'percent') {
        const feePct = !isNaN(rate) && rate >= 0 ? rate : 15;
        myProfit = Math.round((clientPrice * (feePct / 100)) * 100) / 100;
      } else {
        const flatFee = !isNaN(rate) && rate >= 0 ? rate : 0;
        myProfit = Math.min(clientPrice, flatFee);
      }
      const boosterPayout = Math.max(0, Math.round((clientPrice - myProfit) * 100) / 100);
      const boosterCount = (formData.teammates || []).length;
      const cuts = {};
      if (boosterCount > 0) {
        const eachBoosterCut = Math.round((boosterPayout / boosterCount) * 100) / 100;
        formData.teammates.forEach((b) => {
          cuts[b] = String(eachBoosterCut);
        });
      }
      updateFormData({
        pot: clean,
        income: String(myProfit),
        teammateCuts: cuts,
      });
    } else {
      updateFormData({
        pot: clean,
        income: '',
        teammateCuts: {},
      });
    }
  };

  const handleAdvertiserFeeRateChange = (newRateStr, overrideType = null) => {
    const activeType = overrideType || formData.feeType || 'percent';
    const cleanRate = normalizeDigits(newRateStr).replace(/[^0-9.]/g, '');
    const rate = parseFloat(cleanRate);
    if (activeType === 'percent') {
      try {
        trackerDB.setSetting(ADVERTISER_LAST_FEE_KEY, cleanRate).catch(() => {});
      } catch (e) {}
    }

    const clientPrice = parseFloat(formData.pot);
    if (!isNaN(clientPrice) && clientPrice >= 0 && !isNaN(rate) && rate >= 0) {
      const myProfit = activeType === 'percent'
        ? Math.round((clientPrice * (rate / 100)) * 100) / 100
        : Math.min(clientPrice, Math.round(rate * 100) / 100);
      const boosterPayout = Math.max(0, Math.round((clientPrice - myProfit) * 100) / 100);
      const boosterCount = (formData.teammates || []).length;
      const cuts = {};
      if (boosterCount > 0) {
        const eachBoosterCut = Math.round((boosterPayout / boosterCount) * 100) / 100;
        formData.teammates.forEach((b) => {
          cuts[b] = String(eachBoosterCut);
        });
      }
      updateFormData({
        feeRate: cleanRate,
        feeType: activeType,
        income: String(myProfit),
        teammateCuts: cuts,
      });
    } else {
      updateFormData({ feeRate: cleanRate, feeType: activeType });
    }
  };

  const handleAdvertiserNetProfitChange = (valStr) => {
    const clean = sanitizePriceInput(valStr, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' }).replace(/[-+]/g, '');
    const myProfit = parseFloat(clean);
    const clientPrice = parseFloat(formData.pot);

    if (!isNaN(clientPrice) && clientPrice > 0 && !isNaN(myProfit) && myProfit >= 0) {
      const calculatedRate = Math.round(((myProfit / clientPrice) * 100) * 10) / 10;
      const boosterPayout = Math.max(0, Math.round((clientPrice - myProfit) * 100) / 100);
      const boosterCount = (formData.teammates || []).length;
      const cuts = {};
      if (boosterCount > 0) {
        const eachBoosterCut = Math.round((boosterPayout / boosterCount) * 100) / 100;
        formData.teammates.forEach((b) => {
          cuts[b] = String(eachBoosterCut);
        });
      }
      updateFormData({
        income: clean,
        feeRate: String(calculatedRate),
        teammateCuts: cuts,
      });
    } else {
      updateFormData({ income: clean });
    }
  };

  const handleAdvertiserBoosterPayoutChange = (valStr) => {
    const clean = sanitizePriceInput(valStr, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' }).replace(/[-+]/g, '');
    const totalPayout = parseFloat(clean);
    const clientPrice = parseFloat(formData.pot);

    if (!isNaN(clientPrice) && clientPrice >= 0 && !isNaN(totalPayout) && totalPayout >= 0) {
      const myProfit = Math.max(0, Math.round((clientPrice - totalPayout) * 100) / 100);
      const calculatedRate = clientPrice > 0 ? Math.round(((myProfit / clientPrice) * 100) * 10) / 10 : 0;
      const boosterCount = (formData.teammates || []).length;
      const cuts = {};
      if (boosterCount > 0) {
        const eachBoosterCut = Math.round((totalPayout / boosterCount) * 100) / 100;
        formData.teammates.forEach((b) => {
          cuts[b] = String(eachBoosterCut);
        });
      }
      updateFormData({
        income: String(myProfit),
        feeRate: String(calculatedRate),
        teammateCuts: cuts,
      });
    }
  };

  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [parsedOrderPreview, setParsedOrderPreview] = useState(null);
  const [isParsingClipboard, setIsParsingClipboard] = useState(false);

  const handleSplitEvenly = () => {
    if (!formData.teammates || formData.teammates.length === 0) return;
    const clientPrice = parseFloat(formData.pot) || 0;
    const myProfit = parseFloat(formData.income) || 0;
    const totalPayout = Math.max(0, clientPrice - myProfit);
    const perBooster = Math.floor((totalPayout / formData.teammates.length) * 100) / 100;
    const newCuts = {};
    formData.teammates.forEach((tm) => {
      newCuts[tm] = String(perBooster);
    });
    updateFormData({ teammateCuts: newCuts });
  };

  const handleClipboardAutoFill = async () => {
    setIsParsingClipboard(true);
    try {
      let text = '';
      if (navigator?.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text || typeof text !== 'string' || !text.trim()) {
        setParsedOrderPreview({ error: language === 'fa' ? 'کلیپ‌بورد خالی است' : 'Clipboard is empty' });
        setTimeout(() => setParsedOrderPreview(null), 2500);
        return;
      }

      const parsed = parseOrderText(text);
      if (parsed.confidence > 0) {
        setParsedOrderPreview(parsed);
      } else {
        setParsedOrderPreview({ error: language === 'fa' ? 'اطلاعات سفارشی در متن کلیپ‌بورد یافت نشد' : 'No order details found in clipboard' });
        setTimeout(() => setParsedOrderPreview(null), 2500);
      }
    } catch (err) {
      console.warn('Smart clipboard parse failed:', err);
      setParsedOrderPreview({ error: language === 'fa' ? 'دسترسی به کلیپ‌بورد امکان‌پذیر نیست' : 'Cannot read clipboard' });
      setTimeout(() => setParsedOrderPreview(null), 2500);
    } finally {
      setIsParsingClipboard(false);
    }
  };

  const handleApplyParsedOrder = () => {
    if (!parsedOrderPreview || parsedOrderPreview.error) return;
    const updates = {};
    if (parsedOrderPreview.title) updates.title = parsedOrderPreview.title;
    if (parsedOrderPreview.orderId) updates.orderId = parsedOrderPreview.orderId;
    if (parsedOrderPreview.source) updates.source = parsedOrderPreview.source;
    if (parsedOrderPreview.link) updates.link = parsedOrderPreview.link;
    if (parsedOrderPreview.currency) updates.currency = parsedOrderPreview.currency;

    if (parsedOrderPreview.price !== null) {
      const priceStr = String(parsedOrderPreview.price);
      if (isAdvertiser) {
        updates.pot = priceStr;
        const pct = parseFloat(formData.feeRate) || 15;
        updates.income = String(Math.round(parsedOrderPreview.price * (pct / 100) * 100) / 100);
      } else {
        updates.income = priceStr;
      }
    }

    updateFormData(updates);
    setParsedOrderPreview(null);
    setPasteSuccess(true);
    setTimeout(() => setPasteSuccess(false), 2000);
  };

  // Team Share Calculations
  const totalTeamMembers = 1 + (formData.teammates ? formData.teammates.length : 0);

  const handlePotChange = (newPotStr) => {
    let cleanStr = sanitizePriceInput(newPotStr, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' });
    const hasMinus = cleanStr.includes('-');
    const hasPlus = cleanStr.includes('+');

    if (hasMinus) {
      if (entryType !== 'expense') {
        setEntryType('expense');
      }
      cleanStr = cleanStr.replace(/[-+]/g, '');
      updateFormData({
        teamMode: false,
        teammates: [],
        teammateCuts: {},
        income: cleanStr,
        pot: '',
      });
      return;
    }

    if (hasPlus) {
      if (entryType !== 'income') {
        setEntryType('income');
      }
      cleanStr = cleanStr.replace(/[-+]/g, '');
    }

    const potNum = parseFloat(cleanStr);
    if (!isNaN(potNum) && potNum >= 0 && totalTeamMembers > 0) {
      const equalShare = Math.round((potNum / totalTeamMembers) * 100) / 100;
      const shareStr = String(equalShare);
      const newCuts = Object.fromEntries((formData.teammates || []).map((tm) => [tm, shareStr]));
      updateFormData({
        pot: cleanStr,
        income: shareStr,
        teammateCuts: newCuts,
      });
    } else {
      updateFormData({
        pot: cleanStr,
        income: '',
        teammateCuts: Object.fromEntries((formData.teammates || []).map((tm) => [tm, ''])),
      });
    }
  };

  const handleIncomeChange = (newIncomeStr) => {
    let cleanStr = sanitizePriceInput(newIncomeStr, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' });
    const hasMinus = cleanStr.includes('-');
    const hasPlus = cleanStr.includes('+');

    if (hasMinus) {
      if (entryType !== 'expense') {
        setEntryType('expense');
      }
      cleanStr = cleanStr.replace(/[-+]/g, '');
      updateFormData({
        teamMode: false,
        teammates: [],
        teammateCuts: {},
        income: cleanStr,
        pot: '',
      });
      return;
    }

    if (hasPlus) {
      if (entryType !== 'income') {
        setEntryType('income');
      }
      cleanStr = cleanStr.replace(/[-+]/g, '');
    }

    const incNum = parseFloat(cleanStr);
    if (formData.teamMode) {
      if (!isNaN(incNum) && incNum >= 0) {
        const totalPot = Math.round((incNum * totalTeamMembers) * 100) / 100;
        const newCuts = Object.fromEntries((formData.teammates || []).map((tm) => [tm, cleanStr]));
        updateFormData({
          income: cleanStr,
          pot: String(totalPot),
          teammateCuts: newCuts,
        });
      } else {
        updateFormData({
          income: cleanStr,
          pot: '',
          teammateCuts: Object.fromEntries((formData.teammates || []).map((tm) => [tm, ''])),
        });
      }
    } else {
      updateFormData({ income: cleanStr });
    }
  };

  const handleTeammatesChange = (newTeammates) => {
    if (isAdvertiser) {
      const clientPrice = parseFloat(formData.pot) || 0;
      const myProfit = parseFloat(formData.income) || 0;
      const totalPayout = Math.max(0, Math.round((clientPrice - myProfit) * 100) / 100);
      const cuts = {};
      if (newTeammates.length > 0) {
        const eachBoosterCut = Math.round((totalPayout / newTeammates.length) * 100) / 100;
        newTeammates.forEach((b) => {
          cuts[b] = formData.teammateCuts?.[b] || String(eachBoosterCut);
        });
      }
      updateFormData({
        teammates: newTeammates,
        teammateCuts: cuts,
      });
      return;
    }

    const newCount = 1 + newTeammates.length;
    let nextPot = formData.pot;
    let nextIncome = formData.income;
    let nextCuts = {};

    if (formData.teamInputMode === 'pot' && formData.pot) {
      const potNum = parseFloat(formData.pot) || 0;
      const equalShare = newCount > 0 ? Math.round((potNum / newCount) * 100) / 100 : 0;
      nextIncome = String(equalShare);
      newTeammates.forEach((tm) => {
        nextCuts[tm] = formData.teammateCuts?.[tm] || String(equalShare);
      });
    } else if (formData.income) {
      const incNum = parseFloat(formData.income) || 0;
      nextPot = String(Math.round((incNum * newCount) * 100) / 100);
      newTeammates.forEach((tm) => {
        nextCuts[tm] = formData.teammateCuts?.[tm] || formData.income;
      });
    } else {
      newTeammates.forEach((tm) => {
        nextCuts[tm] = formData.teammateCuts?.[tm] || '';
      });
    }

    updateFormData({
      teammates: newTeammates,
      pot: nextPot,
      income: nextIncome,
      teammateCuts: nextCuts,
    });
  };

  const handleCustomCutChange = (memberKey, cutValue) => {
    let cleanCut = sanitizePriceInput(cutValue, { allowDecimals: formData.currency === 'USD' || formData.currency === 'EUR' });
    if (cleanCut.includes('-')) {
      if (entryType !== 'expense') {
        setEntryType('expense');
      }
      cleanCut = cleanCut.replace(/[-+]/g, '');
      updateFormData({
        teamMode: false,
        teammates: [],
        teammateCuts: {},
        income: cleanCut,
        pot: '',
      });
      return;
    }
    if (memberKey === '__user__') {
      const updatedIncome = cleanCut;
      const userCutNum = parseFloat(updatedIncome) || 0;
      const teamSum = (formData.teammates || []).reduce(
        (sum, tm) => sum + (parseFloat(formData.teammateCuts?.[tm]) || 0),
        0
      );
      updateFormData({
        income: updatedIncome,
        pot: String(Math.round((userCutNum + teamSum) * 100) / 100),
      });
    } else {
      const updatedCuts = {
        ...(formData.teammateCuts || {}),
        [memberKey]: cleanCut,
      };
      const userCutNum = parseFloat(formData.income) || 0;
      const teamSum = (formData.teammates || []).reduce(
        (sum, tm) => sum + (parseFloat(updatedCuts[tm]) || 0),
        0
      );
      updateFormData({
        teammateCuts: updatedCuts,
        pot: String(Math.round((userCutNum + teamSum) * 100) / 100),
      });
    }
  };

  const handleEqualizeShares = () => {
    const potNum = parseFloat(formData.pot) || (parseFloat(formData.income) || 0) * totalTeamMembers;
    if (potNum >= 0 && totalTeamMembers > 0) {
      const equalCut = Math.round((potNum / totalTeamMembers) * 100) / 100;
      const equalStr = String(equalCut);
      const equalCuts = Object.fromEntries((formData.teammates || []).map((tm) => [tm, equalStr]));
      updateFormData({
        pot: String(potNum),
        income: equalStr,
        teammateCuts: equalCuts,
      });
    }
  };

  // Live Allocation math
  const userCutNum = parseFloat(formData.income) || 0;
  const teamCutsSum = (formData.teammates || []).reduce(
    (sum, tm) => sum + (parseFloat(formData.teammateCuts?.[tm]) || 0),
    0
  );
  const totalAllocated = userCutNum + teamCutsSum;
  const currentPotNum = parseFloat(formData.pot) || 0;
  const potRemainder = Math.round((currentPotNum - totalAllocated) * 100) / 100;
  const isPotBalanced = Math.abs(potRemainder) < 0.01;

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData || !clipboardData.items) return;

      const items = clipboardData.items;
      let hasImage = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImage = true;
          const blob = items[i].getAsFile();
          if (blob) {
            readImageBlob(blob, `screenshot_paste_${Date.now()}.png`);
          }
        }
      }

      if (hasImage) {
        e.preventDefault();
        setProofPasted(true);
        setTimeout(() => setProofPasted(false), 1500);
      }
    };

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, formData, proofs, editingEntry, isSaving]);

  const readImageBlob = async (blob, fileName) => {
    try {
      const opt = await optimizeImageProof(blob);
      const dataUrl = opt?.dataUrl || '';
      if (!dataUrl) return;

      setProofs((prev) => [
        ...prev,
        {
          id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: fileName || 'Proof Screenshot',
          data: dataUrl,
          size: opt.size || blob.size || 0,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProofs((prev) => [
          ...prev,
          {
            id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: fileName || 'Proof Screenshot',
            data: ev.target.result,
            size: blob.size || 0,
            createdAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(blob);
    }
  };

  const handleFiles = (fileList) => {
    for (let i = 0; i < fileList.length; i++) {
      if (fileList[i].type.startsWith('image/')) {
        readImageBlob(fileList[i], fileList[i].name);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveProof = (idx) => {
    setProofs((prev) => prev.filter((_, i) => i !== idx));
  };

  const isClassic =
    formData.game === 'World of Warcraft Classic' ||
    (!formData.isCustomGame && formData.game?.toLowerCase().includes('classic'));

  const handleGameSelect = (val) => {
    if (val === '__custom__') {
      setEditingCategory(null);
      setIsCategoryModalOpen(true);
    } else {
      const isClassicVal = val === 'World of Warcraft Classic';
      const defaultRate = isClassicVal ? '7000' : String(goldRateTOMAN || 3200);
      updateFormData({
        game: val,
        isCustomGame: false,
        customGameText: '',
        exchangeRate: !editingEntry ? defaultRate : (formData.exchangeRate || defaultRate),
      });
    }
  };

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
    e?.preventDefault();
    if (isSaving) return;

    const effectiveTitle = formData.title;

    const selectedGame = formData.isCustomGame
      ? formData.customGameText.trim() || 'Custom Game'
      : formData.game;

    const titleMissing = !effectiveTitle.trim();
    const gameMissing = !selectedGame.trim();
    const effectiveDate = formData.dateTime || toLocalISOString(new Date());
    const dateMissing = !effectiveDate;
    const activeAmount = isAdvertiser
      ? (formData.pot || formData.income)
      : (formData.teamMode && formData.teamInputMode === 'pot' ? formData.pot : formData.income);
    const amountNumber = Number(activeAmount);
    const incomeMissing = String(activeAmount ?? '').trim() === '' || !Number.isFinite(amountNumber) || amountNumber < 0;

    if (titleMissing || gameMissing || dateMissing || incomeMissing) {
      setFieldErrors({
        title: titleMissing,
        game: gameMissing,
        dateTime: dateMissing,
        income: incomeMissing,
      });
      if (titleMissing) {
        titleInputRef.current?.focus();
      }
      return;
    }

    const rateNum = parseFloat(formData.exchangeRate) || (isClassic ? 7000 : goldRateTOMAN || 3200);
    const userIncomeNum = parseFloat(formData.income) || 0;
    const signedIncome = entryType === 'expense' ? -Math.abs(userIncomeNum) : Math.abs(userIncomeNum);
    const finalPot = isAdvertiser
      ? (formData.pot ? parseFloat(formData.pot) || 0 : null)
      : (entryType !== 'expense' && formData.teamMode
        ? parseFloat(formData.pot) || (userIncomeNum * totalTeamMembers)
        : null);

    let finalNotes = formData.notes.trim();

    entryIdRef.current ||= editingEntry?.id || 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const entryToSave = {
      id: entryIdRef.current,
      entryType: entryType,
      title: effectiveTitle.trim(),
      dateTime: effectiveDate,
      game: selectedGame,
      source: formData.source ? formData.source.trim() : '',
      orderId: isAdvertiser ? (formData.orderId ? formData.orderId.trim() : '') : '',
      feeRate: isAdvertiser ? (parseFloat(formData.feeRate) || null) : null,
      feeType: isAdvertiser ? (formData.feeType || 'percent') : 'percent',
      sourcePaid: isAdvertiser ? Boolean(formData.sourcePaid) : false,
      boosterPaid: isAdvertiser ? Boolean(formData.boosterPaid) : false,
      platformFee: isAdvertiser ? (parseFloat(formData.platformFee) || 0) : 0,
      teamMode: entryType === 'expense' ? false : (isAdvertiser ? ((formData.teammates || []).length > 0) : Boolean(formData.teamMode)),
      teammates: entryType === 'expense' ? [] : (formData.teammates || []),
      teamInputMode: isAdvertiser ? 'pot' : (formData.teamMode ? formData.teamInputMode : 'pot'),
      pot: finalPot,
      income: signedIncome,
      teammateCuts: entryType === 'expense' ? {} : (isAdvertiser || formData.teamMode ? (formData.teammateCuts || {}) : {}),
      teammateNotes: entryType === 'expense' ? {} : (isAdvertiser || formData.teamMode ? (formData.teammateNotes || {}) : {}),
      currency: formData.currency,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: formData.status,
      notes: finalNotes,
      link: formData.link ? formData.link.trim() : '',
      proofs,
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setSaveError(null);
    setDiagnosticsCopied(false);
    try {
      if (formData.currency && ['USD', 'EUR', 'TOMAN', 'GOLD'].includes(formData.currency)) {
        try {
          trackerDB.setSetting(`checkpoint_work_last_currency_${activeProfileId}`, formData.currency).catch(() => {});
        } catch (e) {}
      }
      await onSave(entryToSave);
      if (!editingEntry) {
        clearPersistedDraft();
        setIsDraftRestored(false);
      }
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

  const isDirty = useMemo(() => {
    if (!editingEntry || !initialValuesRef.current) return false;
    const init = initialValuesRef.current;
    if (init.title !== formData.title) return true;
    if (init.game !== formData.game) return true;
    if (init.dateTime !== formData.dateTime) return true;
    if (init.income !== formData.income) return true;
    if (init.pot !== formData.pot) return true;
    if (init.notes !== formData.notes) return true;
    if (init.link !== formData.link) return true;
    if (init.status !== formData.status) return true;
    if (init.currency !== formData.currency) return true;
    if (init.source !== formData.source) return true;
    if (init.orderId !== formData.orderId) return true;
    if (init.feeRate !== formData.feeRate) return true;
    if (init.entryType !== entryType) return true;
    if (init.teamMode !== formData.teamMode) return true;
    if (init.teammates !== JSON.stringify(formData.teammates || [])) return true;
    if (init.teammateCuts !== JSON.stringify(formData.teammateCuts || {})) return true;
    if (init.proofsCount !== proofs.length) return true;
    return false;
  }, [editingEntry, formData, entryType, proofs.length]);

  const handleSafeClose = useCallback(() => {
    if (isSaving) return;
    if (editingEntry && isDirty) {
      const confirmMsg =
        language === 'fa'
          ? 'تغییرات ذخیره‌نشده‌ای دارید. آیا مطمئنید می‌خواهید خارج شوید؟'
          : 'You have unsaved changes. Are you sure you want to discard them?';
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    onClose?.();
  }, [isSaving, editingEntry, isDirty, language, onClose]);

  // Floating Vertical Action Dock next to the top-right side of modal (Desktop only)
  const floatingActions = (
    <div
      className="hidden md:flex flex-col items-center gap-1.5 p-1.5 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/90 shadow-xl select-none"
      dir="ltr"
    >
      {/* Section 1: Entry Type (Income vs Expense) */}
      <div className="flex flex-col gap-1">
        <Tooltip
          content={language === 'fa' ? 'ثبت درآمد (+)' : 'Income (+)'}
          side="right"
        >
          <button
            type="button"
            onClick={() => {
              setEntryType('income');
              if (isAdvertiser && formData.pot) {
                handleAdvertiserClientPriceChange(formData.pot);
              }
            }}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
              entryType === 'income'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
            )}
            aria-label="Income"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip
          content={language === 'fa' ? 'ثبت هزینه / بدهی (−)' : 'Expense / Debt (−)'}
          side="right"
        >
          <button
            type="button"
            onClick={() => {
              setEntryType('expense');
              updateFormData({
                teamMode: false,
                teammates: [],
                teammateCuts: {},
                income: isAdvertiser ? (formData.pot || formData.income) : formData.income,
              });
            }}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
              entryType === 'expense'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
            )}
            aria-label="Expense"
          >
            <TrendingDown className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Section 2: Team Mode / Assigned Boosters Toggle (Only in Income mode) */}
      {entryType === 'income' && (
        <>
          <div className="w-5 h-px bg-zinc-200 dark:bg-zinc-800 my-0.5" />
          <Tooltip
            content={
              isAdvertiser
                ? (formData.teamMode
                    ? (language === 'fa' ? 'تخصیص بوستر (فعال)' : 'Assigned Boosters (Active)')
                    : (language === 'fa' ? 'تخصیص بوستر (تکی)' : 'Assigned Boosters (Solo)'))
                : (formData.teamMode
                    ? (language === 'fa' ? 'حالت تیمی (فعال)' : 'Team Mode (Active)')
                    : (language === 'fa' ? 'حالت تیمی (تکی)' : 'Team Mode (Solo)'))
            }
            side="right"
          >
            <button
              type="button"
              onClick={() => {
                if (formData.teamMode) {
                  updateFormData({ teamMode: false, teammates: [], teammateCuts: {} });
                } else {
                  updateFormData({ teamMode: true });
                }
              }}
              className={cn(
                'relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
                formData.teamMode
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
              )}
              aria-label="Toggle Team Mode"
            >
              <Users className="w-4 h-4" />
              <span
                className={cn(
                  'absolute top-1 right-1 w-1.5 h-1.5 rounded-full',
                  formData.teamMode ? 'bg-emerald-500 ring-1 ring-white dark:ring-black' : 'bg-transparent'
                )}
              />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );

  // Mobile Header Actions for screens < md
  const mobileHeaderActions = (
    <div className="flex md:hidden items-center gap-1">
      {/* Income / Expense toggle */}
      <button
        type="button"
        onClick={() => {
          if (entryType === 'income') {
            setEntryType('expense');
            updateFormData({
              teamMode: false,
              teammates: [],
              teammateCuts: {},
              income: isAdvertiser ? (formData.pot || formData.income) : formData.income,
            });
          } else {
            setEntryType('income');
            if (isAdvertiser && formData.pot) {
              handleAdvertiserClientPriceChange(formData.pot);
            }
          }
        }}
        className={cn(
          'h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium border transition-colors cursor-pointer select-none',
          entryType === 'income'
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
        )}
        title={entryType === 'income' ? (language === 'fa' ? 'تغییر به هزینه (−)' : 'Switch to Expense (−)') : (language === 'fa' ? 'تغییر به درآمد (+)' : 'Switch to Income (+)')}
        aria-label={entryType === 'income' ? 'Income mode' : 'Expense mode'}
      >
        {entryType === 'income' ? (
          <>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'درآمد' : 'Income'}</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{language === 'fa' ? 'هزینه' : 'Expense'}</span>
          </>
        )}
      </button>

      {/* Team mode toggle (Income only) */}
      {entryType === 'income' && (
        <button
          type="button"
          onClick={() => {
            if (formData.teamMode) {
              updateFormData({ teamMode: false, teammates: [], teammateCuts: {} });
            } else {
              updateFormData({ teamMode: true });
            }
          }}
          className={cn(
            'relative h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer select-none border',
            formData.teamMode
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
          )}
          title={
            isAdvertiser
              ? (formData.teamMode
                  ? (language === 'fa' ? 'تخصیص بوستر (فعال)' : 'Assigned Boosters (Active)')
                  : (language === 'fa' ? 'تخصیص بوستر (تکی)' : 'Assigned Boosters (Solo)'))
              : (formData.teamMode
                  ? (language === 'fa' ? 'حالت تیمی (فعال)' : 'Team Mode (Active)')
                  : (language === 'fa' ? 'حالت تیمی (تکی)' : 'Team Mode (Solo)'))
          }
          aria-label="Toggle Team Mode"
        >
          <Users className="w-3.5 h-3.5" />
          {formData.teamMode && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-black" />
          )}
        </button>
      )}
    </div>
  );

  // Fields shared by the booster and advertiser forms, so the two stay visually identical
  const gameSourceRow = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Select ariaLabel={t('work.gamePlatform')}
          value={formData.game}
          onChange={handleGameSelect}
          options={GAME_OPTIONS}
          prefixIcon={
            <Tooltip content={`${t('work.gamePlatform')} *`}>
              <span className="inline-flex items-center cursor-default">
                <GameIcon game={formData.game} categories={categories} className="w-4 h-4" />
              </span>
            </Tooltip>
          }
          className={cn(
            fieldErrors.game && 'border-rose-500/80 ring-1 ring-rose-500/60'
          )}
        />
        {formData.isCustomGame && (
          <div className="mt-2">
            <Input aria-label={t('work.gamePlatform')}
              required
              value={formData.customGameText}
              onChange={(e) => updateFormData({ customGameText: e.target.value })}
              prefixIcon={
                <Tooltip content={t('work.gamePlatform')}>
                  <Tag className="w-4 h-4 text-zinc-400" />
                </Tooltip>
              }
              placeholder={t('work.customGamePlaceholder') + ' *'}
              className={cn(
                fieldErrors.game && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
              )}
            />
          </div>
        )}
      </div>

      <div>
        <SourceCombobox ariaLabel={t('work.sellerSource')}
          value={formData.source}
          onChange={(val) => updateFormData({ source: val })}
          prefixIcon={
            <Tooltip content={t('work.sellerSource')}>
              <span className="inline-flex items-center cursor-default">
                <Store className="w-4 h-4 text-zinc-400" />
              </span>
            </Tooltip>
          }
          placeholder={isAdvertiser
            ? (language === 'fa' ? 'سورس / کانال مشتری: G2G، FunPay... (اختیاری)' : 'Channel / source: G2G, FunPay, client... (optional)')
            : (language === 'fa' ? 'سورس، دیسکورد مشتری... (اختیاری)' : 'Job source, seller, client... (optional)')}
        />
      </div>
    </div>
  );

  const titleField = (
    <div>
      <Input aria-label={(entryType === 'expense' ? (language === 'fa' ? 'عنوان هزینه' : 'Expense title') : t('work.workTitle'))}
        ref={titleInputRef}
        required
        value={formData.title}
        onChange={(e) => updateFormData({ title: e.target.value })}
        prefixIcon={
          <Tooltip content={`${entryType === 'expense' ? (language === 'fa' ? 'عنوان هزینه' : 'Expense Title') : t('work.workTitle')} *`}>
            <span className="inline-flex items-center cursor-default">
              <Tag className="w-4 h-4 text-zinc-400" />
            </span>
          </Tooltip>
        }
        placeholder={
          entryType === 'expense'
            ? (language === 'fa' ? 'عنوان هزینه / بدهی... *' : 'Expense / Debt title... *')
            : `${t('work.titlePlaceholder')} *`
        }
        className={cn(
          'h-9 transition-colors',
          fieldErrors.title && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
        )}
      />
      {entryType === 'expense' && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={cn('text-[10px] text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
            {language === 'fa' ? 'عناوین سریع:' : 'Quick tags:'}
          </span>
          {[
            { en: 'Boost / Carry', fa: 'خرید بوست' },
            { en: 'Gold Purchase', fa: 'خرید گلد' },
            { en: 'Gear / Token', fa: 'توکن / گیر' },
            { en: 'Commission', fa: 'کمیسیون' },
          ].map((chip) => (
            <button
              key={chip.en}
              type="button"
              onClick={() => updateFormData({ title: language === 'fa' ? chip.fa : chip.en })}
              className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            >
              {language === 'fa' ? chip.fa : chip.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const dateField = (
    <div>
      <DateTimePicker
        value={formData.dateTime}
        onChange={(iso) => updateFormData({ dateTime: iso })}
        className={cn(
          fieldErrors.dateTime && 'border-rose-500/80 ring-1 ring-rose-500/60'
        )}
      />
    </div>
  );

  const orderIdField = (
    <Input aria-label={language === 'fa' ? 'شناسه سفارش' : 'Order ID'}
      dir="auto"
      value={formData.orderId}
      onChange={(e) => updateFormData({ orderId: e.target.value })}
      prefixIcon={
        <Tooltip content={language === 'fa' ? 'شناسه سفارش (اختیاری)' : 'Order ID (optional)'}>
          <span className="inline-flex items-center cursor-default">
            <Hash className="w-4 h-4 text-zinc-400" />
          </span>
        </Tooltip>
      }
      placeholder={language === 'fa' ? 'شناسه سفارش (اختیاری)' : 'Order ID (optional)'}
      className="h-9 font-mono text-xs"
    />
  );

  const activeDefaultRate = isClassic ? 7000 : (goldRateTOMAN || 3200);

  // Gold rate override is optional in both forms: a compact toggle that expands into the rate input
  const rateControl = (
    activeCategorySupportsGold && (
      !isCustomRateActive ? (
        <Tooltip
          content={
            language === 'fa'
              ? `تنظیم نرخ گلد دلخواه (فعال: ${(isClassic ? 7000 : (goldRateTOMAN || 3200)).toLocaleString()} ت)`
              : `Custom gold rate (Active: ${(isClassic ? 7000 : (goldRateTOMAN || 3200)).toLocaleString()} T)`
          }
        >
          <button
            type="button"
            onClick={() => setIsCustomRateActive(true)}
            className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 text-xs font-mono shrink-0 transition-colors cursor-pointer select-none"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
            <span>{isClassic ? '1 G' : '1k G'}</span>
          </button>
        </Tooltip>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <NumberStepperInput aria-label={t('work.exchangeRate')}
            value={formData.exchangeRate}
            onChange={(e) => updateFormData({ exchangeRate: normalizeDigits(e.target.value) })}
            step={isClassic ? 100 : 50}
            placeholder={isClassic ? '7,000' : String(goldRateTOMAN || 3200)}
            className="w-32 sm:w-36"
            prefixIcon={
              <Tooltip content={t('work.exchangeRate')}>
                <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 font-medium cursor-default select-none px-0.5">
                  <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
                  <span>{isClassic ? '1 G' : '1k G'}</span>
                </span>
              </Tooltip>
            }
          />
          {Number(formData.exchangeRate) !== (isClassic ? 7000 : Number(goldRateTOMAN || 3200)) && (
            <Tooltip content={language === 'fa' ? `بازنشانی به نرخ فعال (${(isClassic ? 7000 : (goldRateTOMAN || 3200)).toLocaleString()} ت)` : `Reset to active rate (${(isClassic ? 7000 : (goldRateTOMAN || 3200)).toLocaleString()} T)`}>
              <button aria-label={t('a11y.resetToActiveRate', 'Reset to active rate')}
                type="button"
                onClick={() => updateFormData({ exchangeRate: String(isClassic ? 7000 : (goldRateTOMAN || 3200)) })}
                className="h-9 w-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip content={language === 'fa' ? 'بستن و استفاده از نرخ پیش‌فرض' : 'Dismiss and use default rate'}>
            <button aria-label={t('a11y.dismissCustomRate', 'Dismiss and use default rate')}
              type="button"
              onClick={() => {
                setIsCustomRateActive(false);
                updateFormData({ exchangeRate: String(isClassic ? 7000 : (goldRateTOMAN || 3200)) });
              }}
              className="h-9 w-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      )
    )
  );

  const amountValue = isAdvertiser
    ? (entryType === 'expense' ? formData.income : formData.pot)
    : (formData.teamMode && formData.teamInputMode === 'pot' ? formData.pot : formData.income);

  const handleAmountChange = (e) => {
    if (isAdvertiser) {
      handleAdvertiserClientPriceChange(e.target.value);
    } else if (formData.teamMode && formData.teamInputMode === 'pot') {
      handlePotChange(e.target.value);
    } else {
      handleIncomeChange(e.target.value);
    }
  };

  const amountTooltip = entryType === 'expense'
    ? (language === 'fa' ? 'مبلغ هزینه / بدهی' : 'Expense Amount')
    : isAdvertiser
      ? (language === 'fa' ? 'مبلغ ناخالص سورس (Source Price)' : 'Source Price (Gross)')
      : formData.teamMode
        ? (formData.teamInputMode === 'pot'
          ? (language === 'fa' ? 'مجموع پات کار تیمی' : 'Total Pot Amount')
          : (language === 'fa' ? 'سهم من از کار تیمی' : 'My Cut Amount'))
        : (language === 'fa' ? 'مبلغ دریافتی / دستمزد' : 'Work Amount / Income');

  const amountPlaceholder = entryType === 'expense'
    ? (language === 'fa' ? 'مبلغ هزینه / بدهی... *' : 'Expense amount... *')
    : isAdvertiser
      ? (language === 'fa' ? 'مبلغ ناخالص سورس... *' : 'Source price (gross)... *')
      : formData.teamMode
        ? (formData.teamInputMode === 'pot'
          ? (language === 'fa' ? 'مجموع پات... *' : 'Total pot amount... *')
          : (language === 'fa' ? 'سهم من... *' : 'My cut amount... *'))
        : (language === 'fa' ? 'مبلغ دریافتی... *' : 'Amount / Income... *');

  const amountRow = (
    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
      <div className="w-[120px] sm:w-[125px] shrink-0">
        <Select ariaLabel={(language === 'fa' ? 'ارز' : 'Currency')}
          value={formData.currency}
          onChange={(val) => updateFormData({ currency: val })}
          options={availableCurrencyOptions}
        />
      </div>
      <div className="flex-1 min-w-0">
        <NumberStepperInput aria-label={(language === 'fa' ? 'مبلغ' : 'Amount')}
          value={amountValue}
          onChange={handleAmountChange}
          currency={formData.currency}
          prefixIcon={
            <Tooltip content={amountTooltip}>
              <span className="inline-flex items-center cursor-default">
                {entryType === 'expense' ? (
                  <TrendingDown className="w-4 h-4 text-rose-500/80" />
                ) : formData.currency === 'GOLD' ? (
                  <Coins className="w-4 h-4 text-amber-500/80 dark:text-amber-400/80" />
                ) : (
                  <CircleDollarSign className="w-4 h-4 text-zinc-400" />
                )}
              </span>
            </Tooltip>
          }
          placeholder={amountPlaceholder}
          required
          className={cn(
            fieldErrors.income && 'border-rose-500/80 ring-1 ring-rose-500/60'
          )}
        />
      </div>

      {/* Order calculator (advertiser income only): works out profit and booster payout from the source price */}
      {isAdvertiser && entryType !== 'expense' && (
        <Tooltip content={language === 'fa' ? 'محاسبه‌گر سود و سهم بوستر' : 'Calculate order & booster cuts'}>
          <button aria-label={language === 'fa' ? 'محاسبه‌گر سود و سهم بوستر' : 'Calculate order & booster cuts'}
            type="button"
            onClick={() => setIsCalculatorOpen(true)}
            className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none"
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      )}

      {/* Gold Exchange Rate: Optional Activation as part of the Amount/Income field */}
      {rateControl}
    </div>
  );

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={isSaving ? undefined : handleSafeClose}
        maxWidth="max-w-xl"
        floatingActions={floatingActions}
      >
      <DialogHeader
        onClose={isSaving ? undefined : handleSafeClose}
        actions={mobileHeaderActions}
      >
        <div className="flex items-center gap-2">
          <DialogTitle className={cn(isRtl && 'font-farsi')}>
            {editingEntry ? t('work.editTitle') : t('work.addTitle')}
          </DialogTitle>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            {editingEntry ? t('work.editBadge') : t('work.newBadge')}
          </span>
          <button
            type="button"
            onClick={handleClipboardAutoFill}
            disabled={isParsingClipboard}
            title={language === 'fa' ? 'خواندن خودکار جزئیات سفارش از کلیپ‌بورد' : 'Auto-fill order details from clipboard'}
            className="flex items-center gap-1 h-6 px-2 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer select-none"
          >
            <ClipboardPaste className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{isParsingClipboard ? (language === 'fa' ? 'درحال خواندن...' : 'Parsing...') : (language === 'fa' ? 'خواندن کلیپ‌بورد' : 'Auto-Fill from Clipboard')}</span>
          </button>
        </div>

        {!editingEntry && isDraftRestored && (
          <div className="flex items-center gap-1.5 ml-auto mr-1">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
              {t('work.draftRestored')}
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              title="Discard saved draft"
            >
              {t('common.clear', 'Clear')}
            </button>
          </div>
        )}
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Smart Order Clipboard Preview Confirmation Chip */}
          <AnimatePresence>
            {parsedOrderPreview && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -6 }}
                transition={{ duration: 0.15 }}
                className="p-2.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-md text-xs space-y-2 select-none"
                dir={isRtl ? 'rtl' : 'ltr'}
              >
                {parsedOrderPreview.error ? (
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
                    <span>{parsedOrderPreview.error}</span>
                    <button aria-label={t('common.close', 'Close')} type="button" onClick={() => setParsedOrderPreview(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 pb-1.5 text-[11px]">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <ClipboardPaste className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>{language === 'fa' ? 'سفارش شناسایی‌شده از کلیپ‌بورد' : 'Detected Order from Clipboard'}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="primary" size="xs" onClick={handleApplyParsedOrder} className="h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-500 text-white">
                          <Check className="w-3 h-3" />
                          <span>{language === 'fa' ? 'اعمال' : 'Apply'}</span>
                        </Button>
                        <button aria-label={t('common.close', 'Close')} type="button" onClick={() => setParsedOrderPreview(null)} className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      {parsedOrderPreview.title && (
                        <div className="col-span-2">
                          <span className="text-zinc-400 block">{language === 'fa' ? 'عنوان:' : 'Title:'}</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">{parsedOrderPreview.title}</span>
                        </div>
                      )}
                      {parsedOrderPreview.price !== null && (
                        <div>
                          <span className="text-zinc-400 block">{language === 'fa' ? 'مبلغ:' : 'Amount:'}</span>
                          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {parsedOrderPreview.price.toLocaleString()} {parsedOrderPreview.currency || ''}
                          </span>
                        </div>
                      )}
                      {parsedOrderPreview.orderId && (
                        <div>
                          <span className="text-zinc-400 block">{language === 'fa' ? 'شناسه:' : 'Order ID:'}</span>
                          <span className="font-mono text-zinc-700 dark:text-zinc-300">#{parsedOrderPreview.orderId}</span>
                        </div>
                      )}
                      {parsedOrderPreview.source && (
                        <div>
                          <span className="text-zinc-400 block">{language === 'fa' ? 'منبع:' : 'Source:'}</span>
                          <span className="text-zinc-700 dark:text-zinc-300">{parsedOrderPreview.source}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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

          <div className="space-y-4">
            {/* Row 1: Game & Seller Source */}
            {gameSourceRow}

            {/* Row 2: Work Title (advertiser adds an Order ID beside it) */}
            {isAdvertiser ? (
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-3 items-start">
                {titleField}
                {orderIdField}
              </div>
            ) : (
              titleField
            )}

            {/* Row 3: Date & Time */}
            {dateField}

            {/* Row 4: Teammates (booster team mode / advertiser assigned boosters) */}
            {isAdvertiser ? (
              <AnimatePresence initial={false}>
                {entryType === 'income' && (formData.teamMode || (formData.teammates && formData.teammates.length > 0)) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                      <TeammatesCombobox ariaLabel={t('work.teammatesCrew')}
                        value={formData.teammates}
                        onChange={handleTeammatesChange}
                        prefixIcon={
                          <Tooltip content={language === 'fa' ? 'بوستر(ها)ی مجری' : 'Assigned booster(s)'}>
                            <span className="inline-flex items-center cursor-default">
                              <Users className="w-4 h-4 text-zinc-400" />
                            </span>
                          </Tooltip>
                        }
                        placeholder={language === 'fa' ? 'بوستر(ها)ی مجری: نام را وارد کرده و Enter بزنید... (اختیاری)' : 'Assigned booster(s): type username, press Enter... (optional)'}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <AnimatePresence initial={false}>
                {entryType === 'income' && formData.teamMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className={cn('flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal', isRtl && 'font-farsi')}>
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{formatNumber(totalTeamMembers)} {language === 'fa' ? 'سهم کل' : 'total shares'}</span>
                          <span className="text-zinc-400 dark:text-zinc-600">•</span>
                          <span className="text-zinc-500">({language === 'fa' ? `شما + ${formatNumber(formData.teammates.length)} هم‌تیمی` : `You + ${formData.teammates.length} teammate`})</span>
                        </div>

                        {/* Mode Selector: Input Pot vs Input My Cut */}
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-[10px]" dir="ltr">
                          <button
                            type="button"
                            onClick={() => updateFormData({ teamInputMode: 'pot' })}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              formData.teamInputMode === 'pot'
                                ? 'bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 font-medium shadow-xs border border-zinc-200/80 dark:border-transparent'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                          >
                            {language === 'fa' ? 'پات کل' : 'Pot'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateFormData({ teamInputMode: 'income' })}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              formData.teamInputMode === 'income'
                                ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 font-medium shadow-xs border border-zinc-200/80 dark:border-transparent'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                          >
                            {language === 'fa' ? 'سهم من' : 'My Cut'}
                          </button>
                        </div>
                      </div>

                      <TeammatesCombobox ariaLabel={t('work.teammatesCrew')}
                        value={formData.teammates}
                        onChange={handleTeammatesChange}
                        prefixIcon={
                          <Tooltip content={t('work.teammatesCrew')}>
                            <span className="inline-flex items-center cursor-default">
                              <Users className="w-4 h-4 text-zinc-400" />
                            </span>
                          </Tooltip>
                        }
                        placeholder={language === 'fa' ? 'نام هم‌تیمی را وارد کرده و Enter بزنید...' : 'Type teammate username and press Enter...'}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Row 5: Financial Engine */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 space-y-2.5">
              {amountRow}

              {isAdvertiser ? (
                <AnimatePresence initial={false}>
                  {entryType === 'income' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-xl border bg-zinc-50/70 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                              {language === 'fa' ? 'کارمزد شما:' : 'Your Commission:'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextType = formData.feeType === 'flat' ? 'percent' : 'flat';
                                const defaultVal = nextType === 'percent' ? '30' : '10';
                                handleAdvertiserFeeRateChange(defaultVal, nextType);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                              {formData.feeType === 'flat' ? `${formData.currency} Flat` : '% Percent'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1" dir="ltr">
                            {formData.feeType !== 'flat' ? (
                              <>
                                {['10', '15', '20', '25', '30'].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleAdvertiserFeeRateChange(preset)}
                                    className={cn(
                                      'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
                                      formData.feeRate === preset
                                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-xs'
                                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                    )}
                                  >
                                    {preset}%
                                  </button>
                                ))}
                                <div className="w-16 ml-1">
                                  <Input aria-label={(language === 'fa' ? 'درصد کارمزد' : 'Fee percentage')}
                                    type="text"
                                    value={formData.feeRate}
                                    onChange={(e) => handleAdvertiserFeeRateChange(e.target.value)}
                                    className="h-6 text-[11px] font-mono text-center px-1"
                                    placeholder="%"
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="w-24">
                                <Input aria-label={(language === 'fa' ? 'کارمزد ثابت' : 'Flat fee')}
                                  type="text"
                                  value={formData.feeRate}
                                  onChange={(e) => handleAdvertiserFeeRateChange(e.target.value)}
                                  className="h-6 text-[11px] font-mono text-center px-1"
                                  placeholder="Flat Fee"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                          <div className="p-2 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                            <span className={cn('block text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5', isRtl && 'font-farsi')}>
                              {language === 'fa' ? 'سود خالص شما (Net Profit):' : 'Your Net Profit:'}
                            </span>
                            <strong className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {formData.income ? <MoneyDisplay amount={formData.income} currency={formData.currency} /> : '--'}
                            </strong>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                            <span className={cn('block text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5', isRtl && 'font-farsi')}>
                              {language === 'fa' ? 'سهم پرداختی بوستر (Payout):' : 'Booster Payout:'}
                            </span>
                            <strong className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                              {formData.pot && formData.income
                                ? <MoneyDisplay amount={Math.max(0, (parseFloat(formData.pot) || 0) - (parseFloat(formData.income) || 0))} currency={formData.currency} />
                                : '--'}
                            </strong>
                          </div>
                        </div>

                        {/* Two-Way Settlement Toggles */}
                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={Boolean(formData.sourcePaid)}
                            onClick={() => updateFormData({ sourcePaid: !formData.sourcePaid })}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg border transition-all text-xs cursor-pointer',
                              formData.sourcePaid
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            )}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                                  formData.sourcePaid
                                    ? 'bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-600 dark:border-emerald-500'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950'
                                )}
                              >
                                {formData.sourcePaid && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              {language === 'fa' ? 'دریافت از سورس:' : 'Source Paid:'}
                            </span>
                            <span className="text-[11px] font-semibold">
                              {formData.sourcePaid ? (language === 'fa' ? 'تسویه شده' : 'Paid') : (language === 'fa' ? 'در انتظار' : 'Pending')}
                            </span>
                          </button>

                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={Boolean(formData.boosterPaid)}
                            onClick={() => updateFormData({ boosterPaid: !formData.boosterPaid })}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg border transition-all text-xs cursor-pointer',
                              formData.boosterPaid
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            )}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                                  formData.boosterPaid
                                    ? 'bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-600 dark:border-emerald-500'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950'
                                )}
                              >
                                {formData.boosterPaid && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                              {language === 'fa' ? 'پرداخت به بوستر:' : 'Booster Paid:'}
                            </span>
                            <span className="text-[11px] font-semibold">
                              {formData.boosterPaid ? (language === 'fa' ? 'پرداخت شده' : 'Paid') : (language === 'fa' ? 'در انتظار' : 'Pending')}
                            </span>
                          </button>
                        </div>

                        {formData.teammates?.length > 0 && (() => {
                          const clientPrice = parseFloat(formData.pot) || 0;
                          const myProfit = parseFloat(formData.income) || 0;
                          const totalPayout = Math.max(0, clientPrice - myProfit);
                          const sumCuts = (formData.teammates || []).reduce((acc, tm) => acc + (parseFloat(formData.teammateCuts?.[tm]) || 0), 0);
                          const isOverAllocated = totalPayout > 0 && sumCuts > totalPayout + 0.01;

                          return (
                            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                              <div className="flex items-center justify-between">
                                <span className={cn('text-[10px] text-zinc-400 font-medium uppercase tracking-wider', isRtl && 'font-farsi')}>
                                  {language === 'fa' ? 'سهم بوسترها:' : 'Booster Cuts & Splits:'}
                                </span>
                                {formData.teammates.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={handleSplitEvenly}
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors font-medium cursor-pointer"
                                  >
                                    {language === 'fa' ? 'تقسیم مساوی' : 'Split Evenly'}
                                  </button>
                                )}
                              </div>

                              {isOverAllocated && (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-md border border-rose-200 dark:border-rose-900/50">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>
                                    {language === 'fa'
                                      ? `مجموع سهم بوسترها (${formatMoney(sumCuts, formData.currency)}) از سهم پرداختی (${formatMoney(totalPayout, formData.currency)}) بیشتر است!`
                                      : `Total cuts (${formatMoney(sumCuts, formData.currency)}) exceed booster payout (${formatMoney(totalPayout, formData.currency)})!`}
                                  </span>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                {formData.teammates.map((b) => (
                                  <div key={b} className="p-2 rounded-lg bg-white dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/80 text-xs space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate text-[11px]">{b}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                                        <Input aria-label={(language === 'fa' ? `سهم ${b}` : `${b} cut`)}
                                          type="text"
                                          dir="ltr"
                                          value={formData.teammateCuts?.[b] ?? ''}
                                          onChange={(e) => {
                                            const val = normalizeDigits(e.target.value);
                                            updateFormData({
                                              teammateCuts: {
                                                ...(formData.teammateCuts || {}),
                                                [b]: val,
                                              },
                                            });
                                          }}
                                          placeholder="0"
                                          className="h-6 w-24 text-[11px] font-mono text-right px-2"
                                        />
                                        <span className="text-[10px] text-zinc-400">{formData.currency}</span>
                                      </div>
                                    </div>
                                    <Input aria-label={(language === 'fa' ? `یادداشت ${b}` : `Note for ${b}`)}
                                      type="text"
                                      value={formData.teammateNotes?.[b] ?? ''}
                                      onChange={(e) => {
                                        updateFormData({
                                          teammateNotes: {
                                            ...(formData.teammateNotes || {}),
                                            [b]: e.target.value,
                                          },
                                        });
                                      }}
                                      placeholder={language === 'fa' ? `یادداشت برای ${b} (پرداخت، کاراکتر، اکانت...)` : `Note for ${b} (character, spec, payout note...)`}
                                      className="h-6 text-[10px] px-2 bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 placeholder:text-zinc-400"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                <AnimatePresence initial={false}>
                  {entryType === 'income' && formData.teamMode && formData.teamInputMode === 'pot' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-2 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                          <span className={cn('text-zinc-500 leading-normal inline-flex items-center', isRtl && 'font-farsi')}>{language === 'fa' ? 'سهم خالص شما:' : 'Your Share:'}</span>
                          <strong className="text-emerald-600 dark:text-emerald-300 font-medium inline-flex items-center">
                            {formData.income ? <MoneyDisplay amount={formData.income} currency={formData.currency} /> : '--'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                          <span className={cn('text-zinc-500 leading-normal inline-flex items-center', isRtl && 'font-farsi')}>{language === 'fa' ? 'پات کل:' : 'Pot:'}</span>
                          <strong className="text-amber-600 dark:text-amber-300 font-medium inline-flex items-center">
                            {formData.pot ? <MoneyDisplay amount={formData.pot} currency={formData.currency} /> : '--'}
                          </strong>
                        </div>

                        {/* Toggle Custom Cuts Breakdown */}
                        <div className="pt-1 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/60">
                          <button
                            type="button"
                            onClick={() => setIsCustomCutsOpen((prev) => !prev)}
                            className={cn('text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer leading-normal', isRtl && 'font-farsi')}
                          >
                            {isCustomCutsOpen
                              ? (language === 'fa' ? 'بستن سهم اختصاصی' : 'Hide Custom Cuts')
                              : (language === 'fa' ? 'تنظیم سهم اختصاصی هم‌تیمی‌ها' : 'Edit Individual Cuts (Custom Split)')}
                          </button>
                          <button
                            type="button"
                            onClick={handleEqualizeShares}
                            className={cn('text-[10px] text-amber-600 dark:text-amber-400/90 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors leading-normal', isRtl && 'font-farsi')}
                            title="Reset all shares to exact equal split"
                          >
                            {language === 'fa' ? 'تقسیم مساوی' : 'Equalize Shares'}
                          </button>
                        </div>

                        {/* Expandable Custom Cuts Table */}
                        <AnimatePresence>
                          {isCustomCutsOpen && (
                            <motion.div
                              initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                              animate={{ opacity: 1, transform: 'translateY(0px)' }}
                              exit={{ opacity: 0, transform: 'translateY(-4px)' }}
                              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                              className="space-y-1.5 pt-1.5 overflow-hidden"
                            >
                              {/* You (Host) */}
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-[10px] text-zinc-600 dark:text-zinc-400 font-medium truncate leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'شما (میزبان):' : 'You (Host):'}</span>
                                <NumberStepperInput aria-label={(language === 'fa' ? 'سهم شما' : 'Your cut')}
                                  value={formData.income}
                                  onChange={(e) => handleCustomCutChange('__user__', e.target.value)}
                                  currency={formData.currency}
                                  className="w-32 h-7"
                                  placeholder="0"
                                />
                              </div>

                              {/* Each Teammate */}
                              {formData.teammates.map((tm) => (
                                <div key={tm} className="p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium truncate">{tm}:</span>
                                    <NumberStepperInput aria-label={(language === 'fa' ? `سهم ${tm}` : `${tm} cut`)}
                                      value={formData.teammateCuts?.[tm] || ''}
                                      onChange={(e) => handleCustomCutChange(tm, e.target.value)}
                                      currency={formData.currency}
                                      className="w-32 h-7"
                                      placeholder="0"
                                    />
                                  </div>
                                  <Input aria-label={(language === 'fa' ? `یادداشت ${tm}` : `Note for ${tm}`)}
                                    type="text"
                                    value={formData.teammateNotes?.[tm] ?? ''}
                                    onChange={(e) => {
                                      updateFormData({
                                        teammateNotes: {
                                          ...(formData.teammateNotes || {}),
                                          [tm]: e.target.value,
                                        },
                                      });
                                    }}
                                    placeholder={language === 'fa' ? `یادداشت برای ${tm}...` : `Note for ${tm}...`}
                                    className="h-6 text-[10px] px-2 bg-white dark:bg-zinc-900/60 border-zinc-200/60 dark:border-zinc-800/60 placeholder:text-zinc-400"
                                  />
                                </div>
                              ))}

                              {/* Balance Status Line */}
                              <div className={cn('pt-1 flex items-center justify-between text-[10px] leading-normal', isRtl && 'font-farsi')}>
                                <span className="text-zinc-500">{language === 'fa' ? 'تخصیص‌یافته:' : 'Allocated:'} {totalAllocated.toLocaleString()}</span>
                                <span className={isPotBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                                  {isPotBalanced ? (language === 'fa' ? '✓ تراز شده' : '✓ Balanced') : `${language === 'fa' ? 'باقی‌مانده:' : 'Remaining:'} ${potRemainder > 0 ? `+${potRemainder.toLocaleString()}` : potRemainder.toLocaleString()}`}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Row 6: Notes */}
            <div>
              <Textarea aria-label={t('work.notes')}
                rows={2}
                value={formData.notes}
                onChange={(e) => updateFormData({ notes: e.target.value })}
                placeholder={language === 'fa' ? 'یادداشت، شرایط سفارش یا جزئیات کار... (اختیاری)' : 'Add notes, customer requirements, or details... (optional)'}
              />
            </div>

            {/* Row 7: Reference Link / URL */}
            <div className="relative flex items-center">
              <Input aria-label={t('work.link')}
                type="text"
                value={formData.link}
                onChange={(e) => updateFormData({ link: e.target.value })}
                prefixIcon={
                  <Tooltip content={detectedLink ? (language === 'fa' && detectedLink.labelFa ? detectedLink.labelFa : detectedLink.label) : t('work.link')}>
                    <span className="inline-flex items-center cursor-default">
                      {detectedLink ? (
                        renderPlatformIcon(detectedLink.platform, 'w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0')
                      ) : (
                        <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                    </span>
                  </Tooltip>
                }
                placeholder={language === 'fa' ? 'لینک شیت، دیسکورد، استریم یا چت مشتری... (اختیاری)' : 'Reference URL, sheet, Discord message... (optional)'}
                className={cn(
                  'text-xs bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 transition-colors',
                  detectedLink && 'pr-28 rtl:pr-8 rtl:pl-28'
                )}
                dir="ltr"
              />
              {detectedLink && (
                <div className="absolute right-2 rtl:right-auto rtl:left-2 flex items-center pointer-events-none">
                  <div
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300"
                    dir="ltr"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium truncate max-w-[80px]">
                      {language === 'fa' && detectedLink.labelFa ? detectedLink.labelFa : detectedLink.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 8: Proof Upload & Screenshot Paste */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {proofPasted && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{language === 'fa' ? 'اسکرین‌شات پیوست شد' : 'Proof attached'}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                                </div>

              <div
                role="button"
                                  tabIndex={0}
                                  aria-label={t('work.clickUpload')}
                                  onClick={() => fileInputRef.current?.click()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      fileInputRef.current?.click();
                                    }
                                  }}
                                  onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl px-3 py-2.5 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
                  isDragOver
                    ? 'border-zinc-400 bg-zinc-100 dark:bg-zinc-900'
                    : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"><ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className={cn('font-medium text-zinc-700 dark:text-zinc-300', isRtl && 'font-farsi')}>{t('work.clickUpload')}</span><span className="inline-flex items-center gap-0.5 ms-1" aria-hidden="true"><Kbd>Ctrl</Kbd><Kbd>V</Kbd></span></div>
              </div>

              {proofs.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-2.5">
                  {proofs.map((proof, idx) => (
                    <div
                      key={proof.id || idx}
                      className="group relative h-16 w-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900"
                    >
                      <img
                        src={proof.data}
                        alt={proof.name || 'Proof'}
                        onClick={() =>
                          onOpenLightbox?.(proof.data, proof.name || 'Attached Proof')
                        }
                        className="h-full w-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveProof(idx);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded bg-black/80 hover:bg-rose-600 text-zinc-300 hover:text-zinc-100 transition-colors"
                        title="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>

        {/* Footer with Anchored Status Selector */}
        <DialogFooter className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-white/25 dark:bg-zinc-950/25">
          {/* Status Selector */}
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500', isRtl && 'font-farsi')}>
              {t('work.status')}:
            </span>
            <div className="w-28 sm:w-32">
              <Select ariaLabel={t('work.status')}
                dropUp={true}
                value={formData.status}
                onChange={(val) => updateFormData({ status: val })}
                options={STATUS_OPTIONS}
                className="h-7 text-xs bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-400 focus:text-zinc-900 dark:focus:text-zinc-200 opacity-90 hover:opacity-100"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSafeClose} type="button" disabled={isSaving} className={cn(isRtl && 'font-farsi')}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSaving} className={cn(isRtl && 'font-farsi')}>
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? (language === 'fa' ? 'در حال ذخیره...' : 'Saving...') : (editingEntry ? t('work.updateRecord') : t('work.saveRecord'))}</span>
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>

    <CategoryModal
      isOpen={isCategoryModalOpen}
      category={editingCategory}
      onClose={() => setIsCategoryModalOpen(false)}
      onSave={async (savedCat) => {
        await onRefreshCategories?.();
        const isClassicVal = savedCat.name === 'World of Warcraft Classic';
        const defaultRate = isClassicVal ? '7000' : String(goldRateTOMAN || 3200);
        updateFormData({
          game: savedCat.name,
          isCustomGame: false,
          customGameText: '',
          exchangeRate: !editingEntry ? defaultRate : (formData.exchangeRate || defaultRate),
        });
        setIsCategoryModalOpen(false);
      }}
    />

    <OrderCalculatorPopover
      isOpen={isCalculatorOpen}
      onClose={() => setIsCalculatorOpen(false)}
      rates={{
        goldRateTOMAN,
        usdRateTOMAN,
        eurRateUSD,
      }}
      onSaveRates={onSaveRates}
      onTransferToWorkModal={handleApplyFromCalculator}
    />
  </>
  );
}

export default WorkModal;
