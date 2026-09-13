import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Kbd } from './ui/Tooltip';
import { AlertTriangle, Copy, UploadCloud, X, Check, Banknote, Coins, Users, Link2, Edit2, Plus, Hash, Megaphone } from 'lucide-react';
import { DiscordIcon, TelegramIcon, SteamIcon, GoogleSheetsIcon, GithubIcon, TomanIcon } from './ui/Icons';
import { CategoryModal } from './ui/CategoryModal';
import { trackerDB } from '../lib/db';
import { copyTextNative, optimizeImageProof } from '../lib/desktop';
import { detectAppLink } from '../lib/appLinks';
import { useLanguage, normalizeDigits } from '../lib/i18n';
import { cn } from '../lib/utils';
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
  entries = [],
  onRefreshCategories,
  activeProfileId = 'booster',
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [fieldErrors, setFieldErrors] = useState({ title: false, game: false, dateTime: false, income: false });
  const [proofPasted, setProofPasted] = useState(false);

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
    feeRate: typeof localStorage !== 'undefined' ? (localStorage.getItem(ADVERTISER_LAST_FEE_KEY) || '15') : '15',
    sourcePaid: false,
    teamMode: false,
    teammates: [],
    teamInputMode: 'pot', // 'pot' | 'income'
    pot: '',
    income: '',
    teammateCuts: {},
    currency: 'TOMAN',
    exchangeRate: String(goldRateTOMAN || 3200),
    status: 'Pending',
    notes: '',
    link: '',
  });

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

  useEffect(() => {
    if (!isOpen) return;

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
      if (!['TOMAN', 'GOLD'].includes(entryCur)) entryCur = 'TOMAN';

      const entryTeammates = Array.isArray(editingEntry.teammates) ? editingEntry.teammates : [];
      const totalShares = 1 + entryTeammates.length;
      const initialPot =
        editingEntry.pot !== undefined && editingEntry.pot !== null
          ? String(editingEntry.pot)
          : editingEntry.income !== undefined
          ? String(Math.round(Number(editingEntry.income) * totalShares * 100) / 100)
          : '';
      const initialCuts =
        editingEntry.teammateCuts && typeof editingEntry.teammateCuts === 'object'
          ? { ...editingEntry.teammateCuts }
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
          : (typeof localStorage !== 'undefined' ? (localStorage.getItem(ADVERTISER_LAST_FEE_KEY) || '15') : '15'),
        sourcePaid: Boolean(editingEntry.sourcePaid),
        teamMode: !isExpense && Boolean(editingEntry.teamMode || entryTeammates.length > 0),
        teammates: isExpense ? [] : entryTeammates,
        teamInputMode: editingEntry.teamInputMode || (editingEntry.pot !== null && editingEntry.pot !== undefined ? 'pot' : 'income'),
        pot: initialPot,
        income: editingEntry.income !== undefined && editingEntry.income !== null ? String(Math.abs(Number(editingEntry.income))) : '',
        teammateCuts: initialCuts,
        currency: entryCur,
        exchangeRate: String(editingEntry.exchangeRate || goldRateTOMAN || 3200),
        status: editingEntry.status || 'Pending',
        notes: editingEntry.notes || '',
        link: editingEntry.link || '',
      });
      setProofs(editingEntry.proofs && editingEntry.proofs.length > 0 && editingEntry.proofs[0]?.data ? [...editingEntry.proofs] : []);
      
      if (editingEntry.id) {
        trackerDB.getEntry(editingEntry.id).then((full) => {
          if (full && Array.isArray(full.proofs) && full.proofs.length > 0) {
            setProofs(full.proofs);
          }
        }).catch(() => {});
      }
    } else {
      const isAdvertiser = activeProfileId === 'advertiser';
      const latestEntryGame = entries?.find((e) => e?.game?.trim())?.game?.trim();
      const entryCategoryMatch = (categories || []).find(
        (c) => c.name?.toLowerCase().trim() === latestEntryGame?.toLowerCase()
      )?.name;
      const defaultGame = entryCategoryMatch || categories?.[0]?.name || 'World of Warcraft';

      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY) || localStorage.getItem(LEGACY_DRAFT_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
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
            feeRate: parsed.feeRate || (typeof localStorage !== 'undefined' ? (localStorage.getItem(ADVERTISER_LAST_FEE_KEY) || '15') : '15'),
            sourcePaid: Boolean(parsed.sourcePaid),
            teamMode: Boolean(parsed.teamMode || draftTeammates.length > 0),
            teammates: draftTeammates,
            teamInputMode: parsed.teamInputMode || 'pot',
            pot: parsed.pot || '',
            income: parsed.income || '',
            teammateCuts: parsed.teammateCuts || {},
            currency: parsed.currency || globalCurrency || 'TOMAN',
            exchangeRate: String(goldRateTOMAN || 3200),
            status: parsed.status || 'Pending',
            notes: parsed.notes || '',
            link: parsed.link || '',
          });
          setIsDraftRestored(Boolean(parsed.title || parsed.income || parsed.pot || parsed.notes || parsed.source || parsed.link || draftTeammates.length > 0));
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
            feeRate: typeof localStorage !== 'undefined' ? (localStorage.getItem(ADVERTISER_LAST_FEE_KEY) || '15') : '15',
            sourcePaid: false,
            teamMode: false,
            teammates: [],
            teamInputMode: 'pot',
            pot: '',
            income: '',
            teammateCuts: {},
            currency: globalCurrency || 'TOMAN',
            exchangeRate: String(goldRateTOMAN || 3200),
            status: 'Pending',
            notes: '',
            link: '',
          });
          setProofs([]);
        }
      } catch (err) {
        setIsDraftRestored(false);
      }
    }
    setFieldErrors({ title: false, game: false, dateTime: false, income: false });
  }, [isOpen, editingEntry, globalCurrency, goldRateTOMAN, activeProfileId, categories, entries]);

  const updateFormData = (patch) => {
    if (saveError) setSaveError(null);
    if (patch.title) setFieldErrors((prev) => ({ ...prev, title: false }));
    if (patch.game || patch.customGameText) setFieldErrors((prev) => ({ ...prev, game: false }));
    if (patch.dateTime) setFieldErrors((prev) => ({ ...prev, dateTime: false }));
    if (patch.income !== undefined || patch.pot !== undefined) setFieldErrors((prev) => ({ ...prev, income: false }));
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      if (!editingEntry) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
          trackerDB.setSetting(DRAFT_KEY, next).catch(() => {});
        } catch (e) {}
      }
      return next;
    });
  };

  const clearPersistedDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch (err) {}
    trackerDB.setSetting(DRAFT_KEY, '').catch(() => {});
  };

  const isAdvertiser = activeProfileId === 'advertiser';

  const handleClearDraft = () => {
    clearPersistedDraft();
    setIsDraftRestored(false);
    setFieldErrors({ title: false, game: false, dateTime: false, income: false });
    const latestEntryGame = entries?.find((e) => e?.game?.trim())?.game?.trim();
    const entryCategoryMatch = (categories || []).find(
      (c) => c.name?.toLowerCase().trim() === latestEntryGame?.toLowerCase()
    )?.name;
    const defaultGame = entryCategoryMatch || categories?.[0]?.name || 'World of Warcraft';
    setFormData({
      title: '',
      dateTime: toLocalISOString(new Date()),
      game: defaultGame,
      isCustomGame: false,
      customGameText: '',
      source: '',
      orderId: '',
      feeRate: typeof localStorage !== 'undefined' ? (localStorage.getItem(ADVERTISER_LAST_FEE_KEY) || '15') : '15',
      sourcePaid: false,
      teamMode: false,
      teammates: [],
      teamInputMode: 'pot',
      pot: '',
      income: '',
      teammateCuts: {},
      currency: globalCurrency || 'TOMAN',
      exchangeRate: String(goldRateTOMAN || 3200),
      status: 'Pending',
      notes: '',
      link: '',
    });
    setProofs([]);
  };

  // Advertiser Financial Handlers
  const handleAdvertiserClientPriceChange = (valStr) => {
    const clean = normalizeDigits(valStr).replace(/[-+]/g, '');
    const clientPrice = parseFloat(clean);
    const rate = parseFloat(formData.feeRate);

    if (!isNaN(clientPrice) && clientPrice >= 0) {
      const feePct = !isNaN(rate) && rate >= 0 ? rate : 15;
      const myProfit = Math.round((clientPrice * (feePct / 100)) * 100) / 100;
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

  const handleAdvertiserFeeRateChange = (newRateStr) => {
    const cleanRate = normalizeDigits(newRateStr).replace(/[^0-9.]/g, '');
    const rate = parseFloat(cleanRate);
    try {
      localStorage.setItem(ADVERTISER_LAST_FEE_KEY, cleanRate);
    } catch (e) {}

    const clientPrice = parseFloat(formData.pot);
    if (!isNaN(clientPrice) && clientPrice >= 0 && !isNaN(rate) && rate >= 0) {
      const myProfit = Math.round((clientPrice * (rate / 100)) * 100) / 100;
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
        income: String(myProfit),
        teammateCuts: cuts,
      });
    } else {
      updateFormData({ feeRate: cleanRate });
    }
  };

  const handleAdvertiserNetProfitChange = (valStr) => {
    const clean = normalizeDigits(valStr).replace(/[-+]/g, '');
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
    const clean = normalizeDigits(valStr).replace(/[-+]/g, '');
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

  // Team Share Calculations
  const totalTeamMembers = 1 + (formData.teammates ? formData.teammates.length : 0);

  const handlePotChange = (newPotStr) => {
    let cleanStr = normalizeDigits(newPotStr);
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
    let cleanStr = normalizeDigits(newIncomeStr);
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
    let cleanCut = normalizeDigits(cutValue);
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

    const selectedGame = formData.isCustomGame
      ? formData.customGameText.trim() || 'Custom Game'
      : formData.game;

    const titleMissing = !formData.title.trim();
    const gameMissing = !selectedGame.trim();
    const dateMissing = !formData.dateTime;
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

    entryIdRef.current ||= editingEntry?.id || 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const entryToSave = {
      id: entryIdRef.current,
      entryType: entryType,
      title: formData.title.trim(),
      dateTime: formData.dateTime,
      game: selectedGame,
      source: formData.source ? formData.source.trim() : '',
      orderId: isAdvertiser ? (formData.orderId ? formData.orderId.trim() : '') : '',
      feeRate: isAdvertiser ? (parseFloat(formData.feeRate) || null) : null,
      sourcePaid: isAdvertiser ? Boolean(formData.sourcePaid) : false,
      teamMode: entryType === 'expense' ? false : (isAdvertiser ? ((formData.teammates || []).length > 0) : Boolean(formData.teamMode)),
      teammates: entryType === 'expense' ? [] : (formData.teammates || []),
      teamInputMode: isAdvertiser ? 'pot' : (formData.teamMode ? formData.teamInputMode : 'pot'),
      pot: finalPot,
      income: signedIncome,
      teammateCuts: entryType === 'expense' ? {} : (isAdvertiser || formData.teamMode ? (formData.teammateCuts || {}) : {}),
      currency: formData.currency,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: formData.status,
      notes: formData.notes.trim(),
      link: formData.link ? formData.link.trim() : '',
      proofs,
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setSaveError(null);
    setDiagnosticsCopied(false);
    try {
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

  return (
    <>
      <Dialog open={isOpen} onClose={isSaving ? undefined : onClose} maxWidth="max-w-xl">
      <DialogHeader
        onClose={isSaving ? undefined : onClose}
        actions={
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-[11px]" dir="ltr">
            <button
              type="button"
              onClick={() => setEntryType('income')}
              className={cn(
                "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded font-medium transition-colors flex items-center gap-1.5 border",
                entryType === 'income'
                  ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs border-zinc-200/80 dark:border-transparent"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border-transparent"
              )}
            >
              <span className="font-bold">+</span>
              <span>{t('work.incomeMode', 'Income (+)')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryType('expense');
                updateFormData({ teamMode: false, teammates: [], teammateCuts: {} });
              }}
              className={cn(
                "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded font-medium transition-colors flex items-center gap-1.5 border",
                entryType === 'expense'
                  ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs border-zinc-200/80 dark:border-transparent"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border-transparent"
              )}
            >
              <span className="font-bold">−</span>
              <span>{t('work.expenseMode', 'Expense / Debt (-)')}</span>
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <DialogTitle className={cn(isRtl && 'font-farsi')}>
            {editingEntry ? t('work.editTitle') : t('work.addTitle')}
          </DialogTitle>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
            {editingEntry ? t('work.editBadge') : t('work.newBadge')}
          </span>
        </div>

        {!editingEntry && isDraftRestored && (
          <div className="flex items-center gap-1.5 ml-auto mr-1">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
              {t('work.draftRestored')}
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              title="Discard saved draft"
            >
              {t('common.clear', 'Clear')}
            </button>
          </div>
        )}
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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

          {/* Row 1: Game & Seller Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span className="flex items-center gap-1.5">
                  <GameIcon game={formData.game} categories={categories} className="w-3.5 h-3.5" />
                  <span>{t('work.gamePlatform')} *</span>
                </span>
                {fieldErrors.game && (
                  <span className="text-[9px] text-rose-400 font-medium">Required</span>
                )}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <Select
                    value={formData.game}
                    onChange={handleGameSelect}
                    options={GAME_OPTIONS}
                  />
                </div>
                {formData.game && (
                  <button
                    type="button"
                    onClick={() => {
                      const matched = (categories || []).find(
                        (c) => c.name.toLowerCase() === formData.game.toLowerCase()
                      );
                      setEditingCategory(matched || { name: formData.game });
                      setIsCategoryModalOpen(true);
                    }}
                    title={t('categories.editCategory', 'Edit Category')}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {formData.isCustomGame && (
                <div className="mt-2">
                  <Input
                    required
                    value={formData.customGameText}
                    onChange={(e) => updateFormData({ customGameText: e.target.value })}
                    placeholder={t('work.customGamePlaceholder')}
                    className={cn(
                      fieldErrors.game && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
                    )}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span>{isAdvertiser ? (language === 'fa' ? 'سورس / کانال مشتری' : 'Channel / Source') : t('work.sellerSource')}</span>
                <span className={cn('text-[9px] text-zinc-500 leading-normal', isRtl && 'font-farsi')}>{language === 'fa' ? 'سورس‌های ذخیره' : 'Saved Sources'}</span>
              </label>
              <SourceCombobox
                value={formData.source}
                onChange={(val) => updateFormData({ source: val })}
                placeholder={isAdvertiser ? (language === 'fa' ? 'مثال: Personal, G2G, FunPay یا مشتری...' : 'e.g. Personal, G2G, FunPay, Client...') : (language === 'fa' ? 'مثال: سورس، دیسکورد مشتری...' : 'e.g. Enter seller, broker, or client...')}
              />
            </div>
          </div>

          {/* Row 2: Work Title & Order ID (2-column layout in Advertiser mode) */}
          <div className={cn(isAdvertiser && 'grid grid-cols-1 sm:grid-cols-2 gap-3')}>
            {/* Col 1: Work Title */}
            <div>
              <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isAdvertiser && 'h-4 leading-none', isRtl && 'font-farsi')}>
                <span>{t('work.workTitle')} *</span>
                {fieldErrors.title && (
                  <span className="text-[9px] text-rose-400 font-medium">Required</span>
                )}
              </label>
              <Input
                ref={titleInputRef}
                required
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                placeholder={entryType === 'expense' ? (language === 'fa' ? 'مثال: خرید بوست، خرید گلد، کمیسیون...' : 'e.g. Boost / Carry bought, Gold Purchase, Commission...') : t('work.titlePlaceholder')}
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

            {/* Col 2: Order ID (Advertiser only) */}
            {isAdvertiser && (
              <div>
                <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between h-4 leading-none', isRtl && 'font-farsi')}>
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-zinc-400" />
                    <span>{language === 'fa' ? 'شناسه سفارش' : 'Order ID'}</span>
                  </span>
                  <span className="text-[9px] text-zinc-500 font-normal">
                    {language === 'fa' ? 'اختیاری' : 'Optional'}
                  </span>
                </label>
                <div className="relative" dir="ltr">
                  <Input
                    value={formData.orderId}
                    onChange={(e) => updateFormData({ orderId: e.target.value })}
                    placeholder={language === 'fa' ? 'مثال: #ORD-98234...' : 'e.g. #ORD-98234...'}
                    className="font-mono text-xs pl-7 h-9 text-left"
                  />
                  <Hash className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Date & Time */}
          <div>
            <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
              <span>{t('work.dateTime')} *</span>
              {fieldErrors.dateTime && (
                <span className="text-[9px] text-rose-400 font-medium">Required</span>
              )}
            </label>
            <DateTimePicker
              value={formData.dateTime}
              onChange={(iso) => updateFormData({ dateTime: iso })}
              className={cn(
                fieldErrors.dateTime && 'border-rose-500/80 ring-1 ring-rose-500/60'
              )}
            />
          </div>

          {/* Row 4: Assigned Booster(s) (Advertiser) vs Team Mode (Booster) */}
          {isAdvertiser ? (
            entryType === 'income' && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{language === 'fa' ? 'بوستر(ها)ی مجری' : 'Assigned Booster(s)'}</span>
                  </label>
                  <span className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>
                    {formData.teammates?.length > 0
                      ? `${formatNumber(formData.teammates.length)} ${language === 'fa' ? 'بوستر انتخاب شده' : 'booster(s)'}`
                      : (language === 'fa' ? 'اختیاری (در صورت تخصیص)' : 'Optional (unassigned if empty)')}
                  </span>
                </div>
                <TeammatesCombobox
                  value={formData.teammates}
                  onChange={handleTeammatesChange}
                  placeholder={language === 'fa' ? 'نام بوستر را وارد کرده و Enter بزنید...' : 'Type booster username and press Enter...'}
                />
              </div>
            )
          ) : (
            entryType === 'income' && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const nextTeamMode = !formData.teamMode;
                      updateFormData({ teamMode: nextTeamMode });
                    }}
                    className={cn(`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      formData.teamMode
                        ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700 font-medium shadow-sm'
                        : 'bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-200/80 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border-zinc-200 dark:border-zinc-800'
                    }`, isRtl && 'font-farsi')}
                  >
                    <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>{t('work.teamMode')}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ml-1 ${
                        formData.teamMode ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-zinc-400 dark:bg-zinc-600'
                      }`}
                    />
                  </button>

                  {formData.teamMode && (
                    <div className={cn('flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal', isRtl && 'font-farsi')}>
                      <span>{formatNumber(totalTeamMembers)} {language === 'fa' ? 'سهم کل' : 'total shares'}</span>
                      <span className="text-zinc-400 dark:text-zinc-600">•</span>
                      <span className="text-zinc-500">({language === 'fa' ? `شما + ${formatNumber(formData.teammates.length)} هم‌تیمی` : `You + ${formData.teammates.length} teammate`})</span>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {formData.teamMode && (
                    <motion.div
                      initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-4px)' }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                      className="space-y-2.5 pt-1 border-t border-zinc-200 dark:border-zinc-800/60 relative z-40"
                    >
                      <div>
                        <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1', isRtl && 'font-farsi')}>
                          {t('work.teammatesCrew')}
                        </label>
                        <TeammatesCombobox
                          value={formData.teammates}
                          onChange={handleTeammatesChange}
                          placeholder={language === 'fa' ? 'نام هم‌تیمی را وارد کرده و Enter بزنید...' : 'Type teammate username and press Enter...'}
                        />
                      </div>

                      {/* Mode Selector: Input Pot vs Input My Cut */}
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn('text-[10px] uppercase font-medium text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                          {language === 'fa' ? 'مبنای محاسبه:' : 'Calculation Target:'}
                        </span>
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          )}

          {/* Row 5: Financial Engine */}
          {isAdvertiser ? (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                {/* Client Gross Price Input */}
                <div className={activeCategorySupportsGold ? 'sm:col-span-7' : 'sm:col-span-12'}>
                  <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                    <span>{language === 'fa' ? 'مبلغ ناخالص مشتری (Client Price) *' : 'Client Price (Gross) *'}</span>
                    {fieldErrors.income && (
                      <span className="text-[9px] text-rose-400 font-medium">Required</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <div className="w-[125px] shrink-0">
                      <Select
                        value={formData.currency}
                        onChange={(val) => updateFormData({ currency: val })}
                        options={availableCurrencyOptions}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <NumberStepperInput
                        value={formData.pot}
                        onChange={(e) => handleAdvertiserClientPriceChange(e.target.value)}
                        currency={formData.currency}
                        placeholder={formData.currency === 'GOLD' ? '10,000' : '100,000'}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Exchange Rate if Gold is supported */}
                {activeCategorySupportsGold && (
                  <div className="sm:col-span-5">
                    <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                      <span className="truncate">{t('work.exchangeRate')}</span>
                      {Number(formData.exchangeRate) !== Number(goldRateTOMAN) ? (
                        <button
                          type="button"
                          onClick={() => updateFormData({ exchangeRate: String(goldRateTOMAN || 3200) })}
                          className="text-[9px] text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                        >
                          {language === 'fa' ? `ریست (${goldRateTOMAN?.toLocaleString()} ت)` : `Reset (${goldRateTOMAN?.toLocaleString()} T)`}
                        </button>
                      ) : (
                        <span className="text-[9px] text-zinc-500 shrink-0">
                          {language === 'fa' ? `فعال (${goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}ک` : goldRateTOMAN} ت)` : `Active (${goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}k` : goldRateTOMAN} T)`}
                        </span>
                      )}
                    </label>
                    <NumberStepperInput
                      value={formData.exchangeRate}
                      onChange={(e) => updateFormData({ exchangeRate: normalizeDigits(e.target.value) })}
                      step={50}
                      placeholder={String(goldRateTOMAN || 3200)}
                    />
                  </div>
                )}
              </div>

              {/* Commission Rate Presets & Custom Stepper */}
              <div className="p-3 rounded-xl border bg-zinc-50/70 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400', isRtl && 'font-farsi')}>
                    {language === 'fa' ? 'درصد کارمزد شما (Fee %):' : 'Your Commission Rate:'}
                  </span>
                  <div className="flex items-center gap-1" dir="ltr">
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
                      <Input
                        type="text"
                        value={formData.feeRate}
                        onChange={(e) => handleAdvertiserFeeRateChange(e.target.value)}
                        className="h-6 text-[11px] font-mono text-center px-1"
                        placeholder="%"
                      />
                    </div>
                  </div>
                </div>

                {/* Net Profit & Booster Payout Live Breakdown */}
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

                {/* Assigned Boosters Individual Breakdown if > 1 booster */}
                {formData.teammates?.length > 1 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                    <span className={cn('block text-[10px] text-zinc-400 font-medium', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'تقسیم سهم بین بوسترها:' : 'Payout per Booster:'}
                    </span>
                    {formData.teammates.map((b) => (
                      <div key={b} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">{b}:</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
                          <MoneyDisplay amount={formData.teammateCuts?.[b] || '0'} currency={formData.currency} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                <div className={activeCategorySupportsGold ? 'sm:col-span-7' : 'sm:col-span-12'}>
                  <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                    <span>
                      {entryType === 'expense'
                        ? (language === 'fa' ? 'مبلغ هزینه / بدهی *' : 'Expense / Debt Amount *')
                        : formData.teamMode
                        ? formData.teamInputMode === 'pot'
                          ? (language === 'fa' ? 'مجموع پات *' : 'Pot *')
                          : (language === 'fa' ? 'سهم من *' : 'My Cut *')
                        : `${t('work.incomeCurrency')} *`}
                    </span>
                    {fieldErrors.income && (
                      <span className="text-[9px] text-rose-400 font-medium">Required</span>
                    )}
                    {entryType === 'income' && formData.teamMode && (
                      <span className={cn('text-[9px] text-zinc-400 leading-normal', isRtl && 'font-farsi')}>
                        {formData.teamInputMode === 'pot' ? `÷ ${formatNumber(totalTeamMembers)} ${language === 'fa' ? 'سهم' : 'cuts'}` : `× ${formatNumber(totalTeamMembers)} ${language === 'fa' ? 'عضو' : 'members'}`}
                      </span>
                    )}
                  </label>

                  <div className="flex gap-2">
                    <div className="w-[125px] shrink-0">
                      <Select
                        value={formData.currency}
                        onChange={(val) => updateFormData({ currency: val })}
                        options={availableCurrencyOptions}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <NumberStepperInput
                        value={formData.teamMode && formData.teamInputMode === 'pot' ? formData.pot : formData.income}
                        onChange={(e) => {
                          if (formData.teamMode && formData.teamInputMode === 'pot') {
                            handlePotChange(e.target.value);
                          } else {
                            handleIncomeChange(e.target.value);
                          }
                        }}
                        currency={formData.currency}
                        placeholder={formData.currency === 'GOLD' ? '10,000' : '100,000'}
                        required
                      />
                    </div>
                  </div>

                  {/* Team Split Live Indicator (Visible only when 'Pot' mode is selected) */}
                  {entryType === 'income' && formData.teamMode && formData.teamInputMode === 'pot' && (
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

                      {/* Expandable Custom Cuts Table with Checkpoint NumberStepperInput */}
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
                              <NumberStepperInput
                                value={formData.income}
                                onChange={(e) => handleCustomCutChange('__user__', e.target.value)}
                                currency={formData.currency}
                                className="w-32 h-7"
                                placeholder="0"
                              />
                            </div>

                            {/* Each Teammate */}
                            {formData.teammates.map((tm) => (
                              <div key={tm} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium truncate">{tm}:</span>
                                <NumberStepperInput
                                  value={formData.teammateCuts?.[tm] || ''}
                                  onChange={(e) => handleCustomCutChange(tm, e.target.value)}
                                  currency={formData.currency}
                                  className="w-32 h-7"
                                  placeholder="0"
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
                  )}
                </div>

                {activeCategorySupportsGold && (
                  <div className="sm:col-span-5">
                    <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                      <span className="truncate">
                        {t('work.exchangeRate')}
                      </span>
                      {isClassic ? (
                        Number(formData.exchangeRate) !== 7000 ? (
                          <button
                            type="button"
                            onClick={() => updateFormData({ exchangeRate: '7000' })}
                            className="text-[9px] text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                            title="Reset to classic default (7,000 T)"
                          >
                            {language === 'fa' ? 'ریست (۷ک ت)' : 'Reset (7k T)'}
                          </button>
                        ) : (
                          <span className="text-[9px] text-zinc-500 shrink-0">{language === 'fa' ? 'کلاسیک (۱ گلد)' : 'Classic (1 G)'}</span>
                        )
                      ) : Number(formData.exchangeRate) !== Number(goldRateTOMAN) ? (
                        <button
                          type="button"
                          onClick={() => updateFormData({ exchangeRate: String(goldRateTOMAN || 3200) })}
                          className="text-[9px] text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                          title="Reset to current navbar rate"
                        >
                          {language === 'fa' ? `ریست (${goldRateTOMAN?.toLocaleString()} ت)` : `Reset (${goldRateTOMAN?.toLocaleString()} T)`}
                        </button>
                      ) : (
                        <span className="text-[9px] text-zinc-500 shrink-0">
                          {language === 'fa' ? `فعال (${goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}ک` : goldRateTOMAN} ت)` : `Active (${goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}k` : goldRateTOMAN} T)`}
                        </span>
                      )}
                    </label>
                    <NumberStepperInput
                      value={formData.exchangeRate}
                      onChange={(e) => updateFormData({ exchangeRate: normalizeDigits(e.target.value) })}
                      step={isClassic ? 100 : 50}
                      placeholder={isClassic ? '7,000' : String(goldRateTOMAN || 3200)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 6: Notes */}
          <div>
            <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5', isRtl && 'font-farsi')}>
              {t('work.notes')}
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              placeholder={t('work.notesPlaceholder')}
            />
          </div>

          {/* Row 7: Reference Link / URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5', isRtl && 'font-farsi')}>
                {detectedLink ? (
                  renderPlatformIcon(detectedLink.platform, 'w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0')
                ) : (
                  <Link2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                )}
                <span>{t('work.link')}</span>
              </label>

              {detectedLink ? (
                <div
                  className="flex items-center gap-1.5 text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 shadow-2xs"
                  dir="ltr"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-medium">
                    {language === 'fa' && detectedLink.labelFa ? detectedLink.labelFa : detectedLink.label}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {detectedLink.appLaunchable
                      ? '• ' + (language === 'fa' ? 'برنامه دسکتاپ' : 'Desktop App')
                      : '• ' + (language === 'fa' ? 'مرورگر' : 'Browser')}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-zinc-500 lowercase">
                  Optional
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <Input
                type="text"
                value={formData.link}
                onChange={(e) => updateFormData({ link: e.target.value })}
                placeholder={t('work.linkPlaceholder')}
                className={cn(
                  'text-xs bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 transition-colors',
                  detectedLink && 'border-zinc-300 dark:border-zinc-700/80 pr-8',
                  isRtl && 'text-left'
                )}
                dir="ltr"
              />
              {detectedLink && (
                <div className="absolute right-2.5 pointer-events-none text-zinc-400 dark:text-zinc-500 flex items-center">
                  {renderPlatformIcon(detectedLink.platform, 'w-3.5 h-3.5')}
                </div>
              )}
            </div>
          </div>

          {/* Row 8: Proof Upload & Screenshot Paste */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className={cn('block text-[10px] font-medium uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
                  {t('work.proof')}
                </label>
                <AnimatePresence>
                  {proofPasted && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>{language === 'fa' ? 'اسکرین‌شات پیوست شد' : 'Proof attached'}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className={cn('text-[10px] text-zinc-400 leading-normal', isRtl && 'font-farsi')}>
                {language === 'fa' ? '⚡ کلید Ctrl+V برای چسباندن اسکرین‌شات' : '⚡ Press Ctrl+V to paste screenshot'}
              </span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors ${
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
              <div className="flex flex-col items-center justify-center gap-1">
                <UploadCloud className="w-4 h-4 text-zinc-500" />
                <div className={cn('text-xs text-zinc-700 dark:text-zinc-300', isRtl && 'font-farsi')}>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{t('work.clickUpload')}</span>
                </div>
                <div className={cn('text-[10px] text-zinc-500', isRtl && 'font-farsi')}>
                  {language === 'fa' ? 'یا مستقیماً با Ctrl+V از Snipping Tool تصویر را بچسبانید' : <>Or press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> anywhere from Snipping Tool</>}
                </div>
              </div>
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
        </DialogContent>

        {/* Footer with Anchored Status Selector */}
        <DialogFooter className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-white/25 dark:bg-zinc-950/25">
          {/* Status Selector */}
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-medium uppercase tracking-wider text-zinc-500', isRtl && 'font-farsi')}>
              {t('work.status')}:
            </span>
            <div className="w-28 sm:w-32">
              <Select
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
            <Button variant="ghost" size="sm" onClick={onClose} type="button" disabled={isSaving} className={cn(isRtl && 'font-farsi')}>
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
  </>
  );
}

export default WorkModal;
