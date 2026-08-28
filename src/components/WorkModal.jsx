import React, { useState, useEffect, useRef } from 'react';
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
import { Kbd } from './ui/Tooltip';
import { UploadCloud, X, Check, Banknote, Coins, Users } from 'lucide-react';
import { trackerDB } from '../lib/db';
import { optimizeImageProof } from '../lib/desktop';
import { useLanguage, normalizeDigits } from '../lib/i18n';
import { cn } from '../lib/utils';

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
}) {
  const { t, language, isRtl, formatNumber } = useLanguage();
  const [fieldErrors, setFieldErrors] = useState({ title: false, game: false, dateTime: false });
  const [proofPasted, setProofPasted] = useState(false);

  const GAME_OPTIONS = [
    { value: 'World of Warcraft', label: 'World of Warcraft' },
    { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
    { value: 'Diablo IV', label: 'Diablo IV' },
    { value: 'Path of Exile', label: 'Path of Exile' },
    { value: 'League of Legends', label: 'League of Legends' },
    { value: '__custom__', label: `+ ${t('work.customGameOption', 'Custom Game / Realm')}` },
  ];

  const CURRENCY_OPTIONS = [
    {
      value: 'TOMAN',
      label: language === 'fa' ? 'تومان' : 'Toman',
      icon: <Banknote className="w-3.5 h-3.5" />,
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
  ];
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    game: 'World of Warcraft',
    isCustomGame: false,
    customGameText: '',
    source: '',
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
  });

  const [isCustomCutsOpen, setIsCustomCutsOpen] = useState(false);
  const [proofs, setProofs] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const fileInputRef = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

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
          : Object.fromEntries(
              entryTeammates.map((tm) => [tm, editingEntry.income ? String(editingEntry.income) : ''])
            );

      setFormData({
        title: editingEntry.title || '',
        dateTime: editingEntry.dateTime || toLocalISOString(new Date()),
        game: isStandardGame ? editingEntry.game : '__custom__',
        isCustomGame: !isStandardGame && Boolean(editingEntry.game),
        customGameText: isStandardGame ? '' : editingEntry.game || '',
        source: editingEntry.source || '',
        teamMode: Boolean(editingEntry.teamMode || entryTeammates.length > 0),
        teammates: entryTeammates,
        teamInputMode: editingEntry.pot ? 'pot' : 'income',
        pot: initialPot,
        income: editingEntry.income !== undefined && editingEntry.income !== null ? String(editingEntry.income) : '',
        teammateCuts: initialCuts,
        currency: entryCur,
        exchangeRate: String(editingEntry.exchangeRate || goldRateTOMAN || 3200),
        status: editingEntry.status || 'Pending',
        notes: editingEntry.notes || '',
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
      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY) || localStorage.getItem(LEGACY_DRAFT_KEY);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          const draftTeammates = Array.isArray(parsed.teammates) ? parsed.teammates : [];
          setFormData({
            title: parsed.title || '',
            dateTime: parsed.dateTime || toLocalISOString(new Date()),
            game: parsed.game || 'World of Warcraft',
            isCustomGame: Boolean(parsed.isCustomGame),
            customGameText: parsed.customGameText || '',
            source: parsed.source || '',
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
          });
          setIsDraftRestored(Boolean(parsed.title || parsed.income || parsed.pot || parsed.notes || parsed.source || draftTeammates.length > 0));
        } else {
          setIsDraftRestored(false);
          setFormData({
            title: '',
            dateTime: toLocalISOString(new Date()),
            game: 'World of Warcraft',
            isCustomGame: false,
            customGameText: '',
            source: '',
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
          });
          setProofs([]);
        }
      } catch (err) {
        setIsDraftRestored(false);
      }
    }
    setFieldErrors({ title: false, game: false, dateTime: false });
  }, [isOpen, editingEntry, globalCurrency, goldRateTOMAN]);

  const updateFormData = (patch) => {
    if (patch.title) setFieldErrors((prev) => ({ ...prev, title: false }));
    if (patch.game || patch.customGameText) setFieldErrors((prev) => ({ ...prev, game: false }));
    if (patch.dateTime) setFieldErrors((prev) => ({ ...prev, dateTime: false }));
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

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    trackerDB.setSetting(DRAFT_KEY, '').catch(() => {});
    setIsDraftRestored(false);
    setFieldErrors({ title: false, game: false, dateTime: false });
    setFormData({
      title: '',
      dateTime: toLocalISOString(new Date()),
      game: 'World of Warcraft',
      isCustomGame: false,
      customGameText: '',
      source: '',
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
    });
    setProofs([]);
  };

  // Team Share Calculations
  const totalTeamMembers = 1 + (formData.teammates ? formData.teammates.length : 0);

  const handlePotChange = (newPotStr) => {
    const cleanStr = normalizeDigits(newPotStr);
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
    const cleanStr = normalizeDigits(newIncomeStr);
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
    const cleanCut = normalizeDigits(cutValue);
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
  }, [isOpen, formData, proofs, editingEntry]);

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
      updateFormData({ game: '__custom__', isCustomGame: true });
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

  const handleSubmit = (e) => {
    e.preventDefault();

    const selectedGame = formData.isCustomGame
      ? formData.customGameText.trim() || 'Custom Game'
      : formData.game;

    const titleMissing = !formData.title.trim();
    const gameMissing = !selectedGame.trim();
    const dateMissing = !formData.dateTime;

    if (titleMissing || gameMissing || dateMissing) {
      setFieldErrors({
        title: titleMissing,
        game: gameMissing,
        dateTime: dateMissing,
      });
      if (titleMissing) {
        titleInputRef.current?.focus();
      }
      return;
    }

    const rateNum = parseFloat(formData.exchangeRate) || (isClassic ? 7000 : goldRateTOMAN || 3200);
    const userIncomeNum = parseFloat(formData.income) || 0;
    const finalPot = formData.teamMode
      ? parseFloat(formData.pot) || (userIncomeNum * totalTeamMembers)
      : null;

    const entryToSave = {
      id:
        editingEntry?.id ||
        'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: formData.title.trim(),
      dateTime: formData.dateTime,
      game: selectedGame,
      source: formData.source.trim() || 'Direct Client',
      teamMode: Boolean(formData.teamMode),
      teammates: formData.teamMode ? formData.teammates : [],
      pot: finalPot,
      income: userIncomeNum,
      teammateCuts: formData.teamMode ? formData.teammateCuts : {},
      currency: formData.currency,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: formData.status,
      notes: formData.notes.trim(),
      proofs,
      updatedAt: new Date().toISOString(),
    };

    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    trackerDB.setSetting(DRAFT_KEY, '').catch(() => {});
    onSave(entryToSave);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle className={cn(isRtl && 'font-farsi')}>
            {editingEntry ? t('work.editTitle') : t('work.addTitle')}
          </DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {editingEntry ? t('work.editBadge') : t('work.newBadge')}
          </span>
        </div>

        {!editingEntry && isDraftRestored && (
          <div className="flex items-center gap-1.5 ml-auto mr-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
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

      <form onSubmit={handleSubmit}>
        <DialogContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Game & Seller Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span className="flex items-center gap-1.5">
                  <GameIcon game={formData.game} className="w-3.5 h-3.5" />
                  <span>{t('work.gamePlatform')} *</span>
                </span>
                {fieldErrors.game && (
                  <span className="text-[9px] font-mono text-rose-400 font-medium">Required</span>
                )}
              </label>
              <Select
                value={formData.game}
                onChange={handleGameSelect}
                options={GAME_OPTIONS}
              />
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
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span>{t('work.sellerSource')}</span>
                <span className="text-[9px] font-mono text-zinc-500">{language === 'fa' ? 'سورس‌های ذخیره' : 'Saved Sources'}</span>
              </label>
              <SourceCombobox
                value={formData.source}
                onChange={(val) => updateFormData({ source: val })}
                placeholder={language === 'fa' ? 'مثال: سورس، دیسکورد مشتری...' : 'e.g. Enter seller, broker, or client...'}
              />
            </div>
          </div>

          {/* Row 2: Work Title */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
              <span>{t('work.workTitle')} *</span>
              {fieldErrors.title && (
                <span className="text-[9px] font-mono text-rose-400 font-medium">Required</span>
              )}
            </label>
            <Input
              ref={titleInputRef}
              required
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              placeholder={t('work.titlePlaceholder')}
              className={cn(
                'transition-colors',
                fieldErrors.title && 'border-rose-500/80 ring-1 ring-rose-500/60 focus:border-rose-500'
              )}
            />
          </div>

          {/* Row 3: Date & Time */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
              <span>{t('work.dateTime')} *</span>
              {fieldErrors.dateTime && (
                <span className="text-[9px] font-mono text-rose-400 font-medium">Required</span>
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

          {/* Row 4: Team / Split Mode Toggle */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const nextTeamMode = !formData.teamMode;
                  updateFormData({ teamMode: nextTeamMode });
                }}
                className={cn(`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  formData.teamMode
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold shadow-sm'
                    : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                }`, isRtl && 'font-farsi')}
              >
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('work.teamMode')}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ml-1 ${
                    formData.teamMode ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
              </button>

              {formData.teamMode && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                  <span>{formatNumber(totalTeamMembers)} {language === 'fa' ? 'سهم کل' : 'total shares'}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-500">({language === 'fa' ? `شما + ${formatNumber(formData.teammates.length)} هم‌تیمی` : `You + ${formData.teammates.length} teammate`})</span>
                </div>
              )}
            </div>

            <AnimatePresence>
              {formData.teamMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="space-y-2.5 pt-1 border-t border-zinc-800/60 relative z-30"
                >
                  <div>
                    <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1', isRtl && 'font-farsi')}>
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
                    <span className={cn('text-[10px] uppercase font-semibold text-zinc-400', isRtl && 'font-farsi')}>
                      {language === 'fa' ? 'مبنای محاسبه:' : 'Calculation Target:'}
                    </span>
                    <div className="flex items-center bg-zinc-900 p-0.5 rounded-md border border-zinc-800 text-[10px]" dir="ltr">
                      <button
                        type="button"
                        onClick={() => updateFormData({ teamInputMode: 'pot' })}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          formData.teamInputMode === 'pot'
                            ? 'bg-zinc-800 text-amber-300 font-semibold shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {language === 'fa' ? 'پات کل' : 'Pot'}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFormData({ teamInputMode: 'income' })}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          formData.teamInputMode === 'income'
                            ? 'bg-zinc-800 text-emerald-300 font-semibold shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200'
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

          {/* Row 5: Income / Pot & Currency and Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start pt-1 border-t border-zinc-800/60">
            <div className="sm:col-span-7">
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span>
                  {formData.teamMode
                    ? formData.teamInputMode === 'pot'
                      ? (language === 'fa' ? 'مجموع پات *' : 'Pot *')
                      : (language === 'fa' ? 'سهم من *' : 'My Cut *')
                    : `${t('work.incomeCurrency')} *`}
                </span>
                {formData.teamMode && (
                  <span className="text-[9px] font-mono text-zinc-400">
                    {formData.teamInputMode === 'pot' ? `÷ ${formatNumber(totalTeamMembers)} ${language === 'fa' ? 'سهم' : 'cuts'}` : `× ${formatNumber(totalTeamMembers)} ${language === 'fa' ? 'عضو' : 'members'}`}
                  </span>
                )}
              </label>

              <div className="flex gap-2">
                <div className="w-[125px] shrink-0">
                  <Select
                    value={formData.currency}
                    onChange={(val) => updateFormData({ currency: val })}
                    options={CURRENCY_OPTIONS}
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
              {formData.teamMode && formData.teamInputMode === 'pot' && (
                <div className="mt-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">{language === 'fa' ? 'سهم خالص شما:' : 'Your Share:'}</span>
                    <strong className="font-mono text-emerald-300 font-semibold">
                      {formData.income ? `${Number(formData.income).toLocaleString()} ${formData.currency === 'TOMAN' ? (language === 'fa' ? 'تومان' : 'TOMAN') : 'GOLD'}` : '--'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">{language === 'fa' ? 'پات کل:' : 'Pot:'}</span>
                    <strong className="font-mono text-amber-300 font-semibold">
                      {formData.pot ? `${Number(formData.pot).toLocaleString()} ${formData.currency === 'TOMAN' ? (language === 'fa' ? 'تومان' : 'TOMAN') : 'GOLD'}` : '--'}
                    </strong>
                  </div>

                  {/* Toggle Custom Cuts Breakdown */}
                  <div className="pt-1 flex items-center justify-between border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => setIsCustomCutsOpen((prev) => !prev)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                    >
                      {isCustomCutsOpen
                        ? (language === 'fa' ? 'بستن سهم اختصاصی' : 'Hide Custom Cuts')
                        : (language === 'fa' ? 'تنظیم سهم اختصاصی هم‌تیمی‌ها' : 'Edit Individual Cuts (Custom Split)')}
                    </button>
                    <button
                      type="button"
                      onClick={handleEqualizeShares}
                      className="text-[10px] text-amber-400/90 hover:text-amber-300 font-mono transition-colors"
                      title="Reset all shares to exact equal split"
                    >
                      {language === 'fa' ? 'تقسیم مساوی' : 'Equalize Shares'}
                    </button>
                  </div>

                  {/* Expandable Custom Cuts Table with Checkpoint NumberStepperInput */}
                  <AnimatePresence>
                    {isCustomCutsOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 pt-1.5"
                      >
                        {/* You (Host) */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{language === 'fa' ? 'شما (میزبان):' : 'You (Host):'}</span>
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
                            <span className="text-[10px] text-zinc-400 font-medium truncate">{tm}:</span>
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
                        <div className="pt-1 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-500">{language === 'fa' ? 'تخصیص‌یافته:' : 'Allocated:'} {totalAllocated.toLocaleString()}</span>
                          <span className={isPotBalanced ? 'text-emerald-400' : 'text-amber-400 font-semibold'}>
                            {isPotBalanced ? (language === 'fa' ? '✓ تراز شده' : '✓ Balanced') : `${language === 'fa' ? 'باقی‌مانده:' : 'Remaining:'} ${potRemainder > 0 ? `+${potRemainder.toLocaleString()}` : potRemainder.toLocaleString()}`}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="sm:col-span-5">
              <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between', isRtl && 'font-farsi')}>
                <span className="truncate">
                  {t('work.exchangeRate')}
                </span>
                {isClassic ? (
                  Number(formData.exchangeRate) !== 7000 ? (
                    <button
                      type="button"
                      onClick={() => updateFormData({ exchangeRate: '7000' })}
                      className="text-[9px] font-mono text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                      title="Reset to classic default (7,000 T)"
                    >
                      {language === 'fa' ? 'ریست (۷ک ت)' : 'Reset (7k T)'}
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-zinc-500 shrink-0">{language === 'fa' ? 'کلاسیک (۱ گلد)' : 'Classic (1 G)'}</span>
                  )
                ) : Number(formData.exchangeRate) !== Number(goldRateTOMAN) ? (
                  <button
                    type="button"
                    onClick={() => updateFormData({ exchangeRate: String(goldRateTOMAN || 3200) })}
                    className="text-[9px] font-mono text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                    title="Reset to current navbar rate"
                  >
                    {language === 'fa' ? `ریست (${goldRateTOMAN?.toLocaleString()} ت)` : `Reset (${goldRateTOMAN?.toLocaleString()} T)`}
                  </button>
                ) : (
                  <span className="text-[9px] font-mono text-zinc-500 shrink-0">
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
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5', isRtl && 'font-farsi')}>
              {t('work.notes')}
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              placeholder={t('work.notesPlaceholder')}
            />
          </div>

          {/* Row 7: Proof Upload & Screenshot Paste */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className={cn('block text-[10px] font-semibold uppercase tracking-wider text-zinc-400', isRtl && 'font-farsi')}>
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
              <span className={cn('text-[10px] font-mono text-zinc-400', isRtl && 'font-farsi')}>
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
                  ? 'border-zinc-400 bg-zinc-900'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/60'
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
                <div className={cn('text-xs text-zinc-300', isRtl && 'font-farsi')}>
                  <span className="font-semibold text-zinc-100">{t('work.clickUpload')}</span>
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
                    className="group relative h-16 w-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900"
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
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/80 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors"
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

        {/* Footer with Anchored Status Selector on Left */}
        <DialogFooter className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-800/80 bg-zinc-950">
          {/* Left: Desaturated Muted Status Selector */}
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-500', isRtl && 'font-farsi')}>
              {t('work.status')}:
            </span>
            <div className="w-28 sm:w-32">
              <Select
                dropUp={true}
                value={formData.status}
                onChange={(val) => updateFormData({ status: val })}
                options={STATUS_OPTIONS}
                className="h-7 text-xs bg-zinc-900/60 border-zinc-800/80 text-zinc-400 focus:text-zinc-200 opacity-80 hover:opacity-100"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} type="button" className={cn(isRtl && 'font-farsi')}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" type="submit" className={cn(isRtl && 'font-farsi')}>
              <Check className="w-3.5 h-3.5" />
              <span>{editingEntry ? t('work.updateRecord') : t('work.saveRecord')}</span>
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default WorkModal;
