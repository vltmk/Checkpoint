import React, { useState, useEffect, useRef } from 'react';
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

const GAME_OPTIONS = [
  { value: 'World of Warcraft', label: 'World of Warcraft' },
  { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
  { value: 'Diablo IV', label: 'Diablo IV' },
  { value: 'Path of Exile', label: 'Path of Exile' },
  { value: 'League of Legends', label: 'League of Legends' },
  { value: '__custom__', label: '+ Custom Game / Realm' },
];

const CURRENCY_OPTIONS = [
  {
    value: 'TOMAN',
    label: 'تومان',
    icon: <Banknote className="w-3.5 h-3.5" />,
  },
  {
    value: 'GOLD',
    label: 'Gold',
    icon: <Coins className="w-3.5 h-3.5" />,
  },
];

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Working', label: 'Working' },
  { value: 'On Hold', label: 'On Hold' },
];

const DRAFT_KEY = 'vault_work_draft';

export function WorkModal({
  isOpen,
  onClose,
  onSave,
  editingEntry = null,
  globalCurrency = 'TOMAN',
  goldRateTOMAN = 3200,
  onOpenLightbox,
  onToast,
}) {
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    game: 'World of Warcraft',
    isCustomGame: false,
    customGameText: '',
    source: '',
    teamMode: false,
    teammates: [],
    currency: 'TOMAN',
    income: '',
    exchangeRate: String(goldRateTOMAN || 3200),
    status: 'Pending',
    notes: '',
  });

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

      setFormData({
        title: editingEntry.title || '',
        dateTime: editingEntry.dateTime || toLocalISOString(new Date()),
        game: isStandardGame ? editingEntry.game : '__custom__',
        isCustomGame: !isStandardGame && Boolean(editingEntry.game),
        customGameText: isStandardGame ? '' : editingEntry.game || '',
        source: editingEntry.source || '',
        teamMode: Boolean(editingEntry.teamMode || entryTeammates.length > 0),
        teammates: entryTeammates,
        currency: entryCur,
        income: editingEntry.income !== undefined && editingEntry.income !== null ? String(editingEntry.income) : '',
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
        const savedDraft = localStorage.getItem(DRAFT_KEY);
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
            currency: parsed.currency || globalCurrency || 'TOMAN',
            income: parsed.income || '',
            exchangeRate: String(goldRateTOMAN || 3200),
            status: parsed.status || 'Pending',
            notes: parsed.notes || '',
          });
          setIsDraftRestored(Boolean(parsed.title || parsed.income || parsed.notes || parsed.source || draftTeammates.length > 0));
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
            currency: globalCurrency || 'TOMAN',
            income: '',
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
  }, [isOpen, editingEntry, globalCurrency, goldRateTOMAN]);

  const updateFormData = (patch) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      if (!editingEntry) {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
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
      currency: globalCurrency || 'TOMAN',
      income: '',
      exchangeRate: String(goldRateTOMAN || 3200),
      status: 'Pending',
      notes: '',
    });
    setProofs([]);
    onToast?.('Draft cleared');
  };

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
        onToast?.('📸 Screenshot proof attached!');
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
  }, [isOpen, onToast, formData, proofs, editingEntry]);

  const readImageBlob = (blob, fileName) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setProofs((prev) => [
        ...prev,
        {
          id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: fileName || 'Proof Screenshot',
          data: dataUrl,
          size: blob.size,
          createdAt: new Date().toISOString(),
        },
      ]);
    };
    reader.readAsDataURL(blob);
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

    if (!formData.title.trim() || !selectedGame.trim() || !formData.dateTime) {
      onToast?.('Please fill required fields (Title, Game, Date)');
      return;
    }

    const rateNum = parseFloat(formData.exchangeRate) || (isClassic ? 7000 : goldRateTOMAN || 3200);

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
      currency: formData.currency,
      income: parseFloat(formData.income) || 0,
      exchangeRate: rateNum,
      rateUnit: isClassic ? '1' : '1k',
      status: formData.status,
      notes: formData.notes.trim(),
      proofs,
      updatedAt: new Date().toISOString(),
    };

    localStorage.removeItem(DRAFT_KEY);
    onSave(entryToSave);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>
            {editingEntry ? 'Edit Work Record' : 'Add Work'}
          </DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {editingEntry ? 'EDIT' : 'NEW'}
          </span>
        </div>

        {!editingEntry && isDraftRestored && (
          <div className="flex items-center gap-1.5 ml-auto mr-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
              Draft Restored
            </span>
            <button
              type="button"
              onClick={handleClearDraft}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              title="Discard saved draft"
            >
              Clear
            </button>
          </div>
        )}
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row 1: Game & Seller Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <GameIcon game={formData.game} className="w-3.5 h-3.5" />
                <span>Game / Platform *</span>
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
                    placeholder="Custom game / realm name..."
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Seller / Job Source</span>
                <span className="text-[9px] font-mono text-zinc-500">Saved Sources</span>
              </label>
              <SourceCombobox
                value={formData.source}
                onChange={(val) => updateFormData({ source: val })}
                onToast={onToast}
                placeholder="e.g. Enter seller, broker, or client..."
              />
            </div>
          </div>

          {/* Row 2: Work Title */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Work Title *
            </label>
            <Input
              ref={titleInputRef}
              required
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              placeholder="e.g. Keystone +20, GDKP Raid Pot, UI Addon Dev"
            />
          </div>

          {/* Row 3: Date & Time */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Date & Time *
            </label>
            <DateTimePicker
              value={formData.dateTime}
              onChange={(val) => updateFormData({ dateTime: val })}
            />
          </div>

          {/* Row 4: Team Mode Toggle & Teammates Input */}
          <div className="space-y-2 pt-1 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => updateFormData({ teamMode: !formData.teamMode })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  formData.teamMode
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700 font-semibold shadow-sm'
                    : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>Team Mode</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ml-1 ${
                    formData.teamMode ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
              </button>
              {formData.teamMode && (
                <span className="text-[10px] font-mono text-zinc-500">
                  {formData.teammates.length} {formData.teammates.length === 1 ? 'member' : 'members'}
                </span>
              )}
            </div>

            {formData.teamMode && (
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Teammates / Crew Members
                </label>
                <TeammatesCombobox
                  value={formData.teammates}
                  onChange={(val) => updateFormData({ teammates: val })}
                  onToast={onToast}
                  placeholder="Type teammate username and press Enter..."
                />
              </div>
            )}
          </div>

          {/* Row 5: Income & Currency and Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start pt-1 border-t border-zinc-800/60">
            <div className="sm:col-span-7">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Income & Currency *
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
                    value={formData.income}
                    onChange={(e) => updateFormData({ income: e.target.value })}
                    currency={formData.currency}
                    placeholder={formData.currency === 'GOLD' ? '1,000' : '100,000'}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center justify-between">
                <span className="truncate">
                  {isClassic ? 'Rate (T / 1 Gold)' : 'Rate (T / 1k Gold)'}
                </span>
                {isClassic ? (
                  Number(formData.exchangeRate) !== 7000 ? (
                    <button
                      type="button"
                      onClick={() => updateFormData({ exchangeRate: '7000' })}
                      className="text-[9px] font-mono text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                      title="Reset to classic default (7,000 T)"
                    >
                      Reset (7k T)
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-zinc-500 shrink-0">Classic (1 G)</span>
                  )
                ) : Number(formData.exchangeRate) !== Number(goldRateTOMAN) ? (
                  <button
                    type="button"
                    onClick={() => updateFormData({ exchangeRate: String(goldRateTOMAN || 3200) })}
                    className="text-[9px] font-mono text-zinc-400 hover:text-zinc-200 underline select-none shrink-0"
                    title="Reset to current navbar rate"
                  >
                    Reset ({goldRateTOMAN?.toLocaleString()} T)
                  </button>
                ) : (
                  <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                    Active ({goldRateTOMAN >= 1000 ? `${(goldRateTOMAN / 1000).toFixed(1)}k` : goldRateTOMAN} T)
                  </span>
                )}
              </label>
              <NumberStepperInput
                value={formData.exchangeRate}
                onChange={(e) => updateFormData({ exchangeRate: e.target.value })}
                step={isClassic ? 100 : 50}
                placeholder={isClassic ? '7,000' : String(goldRateTOMAN || 3200)}
              />
            </div>
          </div>

          {/* Row 6: Notes */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Notes / Client Details
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateFormData({ notes: e.target.value })}
              placeholder="Add client username, realm name, transaction ID, or completion notes..."
            />
          </div>

          {/* Row 7: Proof Upload & Screenshot Paste */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Proof of Completion
              </label>
              <span className="text-[10px] font-mono text-zinc-400">
                ⚡ Press Ctrl+V to paste screenshot
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
                <div className="text-xs text-zinc-300">
                  <span className="font-semibold text-zinc-100">Click to upload</span> or drag screenshot
                </div>
                <div className="text-[10px] text-zinc-500">
                  Or press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> anywhere from Snipping Tool
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
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Status:
            </span>
            <div className="w-28 sm:w-32">
              <Select
                value={formData.status}
                onChange={(val) => updateFormData({ status: val })}
                options={STATUS_OPTIONS}
                className="h-7 text-xs bg-zinc-900/60 border-zinc-800/80 text-zinc-400 focus:text-zinc-200 opacity-80 hover:opacity-100"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              <Check className="w-3.5 h-3.5" />
              <span>{editingEntry ? 'Update Record' : 'Save Record'}</span>
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default WorkModal;
