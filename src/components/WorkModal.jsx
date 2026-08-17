import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';
import { Select } from './ui/Select';
import { DateTimePicker, toLocalISOString } from './ui/DateTimePicker';
import { Kbd } from './ui/Tooltip';
import { UploadCloud, X, Check } from 'lucide-react';

const GAME_OPTIONS = [
  { value: 'World of Warcraft', label: 'World of Warcraft' },
  { value: 'World of Warcraft Classic', label: 'World of Warcraft Classic' },
  { value: '__custom__', label: '+ Custom Game / Realm' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)', flag: '🇺🇸' },
  { value: 'TOMAN', label: 'Toman (تومان)', flag: '🇮🇷' },
  { value: 'GOLD', label: 'GOLD (🪙)', icon: '🟡' },
];

const STATUS_OPTIONS = [
  { value: 'Paid', label: 'Paid' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Working', label: 'Working' },
  { value: 'On Hold', label: 'On Hold' },
];

export function WorkModal({
  isOpen,
  onClose,
  onSave,
  editingEntry = null,
  globalCurrency = 'USD',
  onOpenLightbox,
  onToast,
}) {
  const [formData, setFormData] = useState({
    title: '',
    dateTime: '',
    game: 'World of Warcraft',
    isCustomGame: false,
    customGameText: '',
    currency: 'USD',
    income: '',
    status: 'Paid',
    hours: '',
    notes: '',
  });

  const [proofs, setProofs] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const titleInputRef = useRef(null);

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (editingEntry) {
        const isStandardGame =
          editingEntry.game === 'World of Warcraft' ||
          editingEntry.game === 'World of Warcraft Classic';

        let entryCur = editingEntry.currency;
        if (entryCur === 'WOW_GOLD') entryCur = 'GOLD';
        if (!['USD', 'TOMAN', 'GOLD'].includes(entryCur)) entryCur = 'USD';

        setFormData({
          title: editingEntry.title || '',
          dateTime: editingEntry.dateTime || toLocalISOString(new Date()),
          game: isStandardGame ? editingEntry.game : '__custom__',
          isCustomGame: !isStandardGame && Boolean(editingEntry.game),
          customGameText: isStandardGame ? '' : editingEntry.game || '',
          currency: entryCur,
          income: editingEntry.income !== undefined && editingEntry.income !== null ? editingEntry.income : '',
          status: editingEntry.status || 'Paid',
          hours: editingEntry.hours !== undefined && editingEntry.hours !== null ? editingEntry.hours : '',
          notes: editingEntry.notes || '',
        });
        setProofs(editingEntry.proofs ? [...editingEntry.proofs] : []);
      } else {
        setFormData({
          title: '',
          dateTime: toLocalISOString(new Date()),
          game: 'World of Warcraft',
          isCustomGame: false,
          customGameText: '',
          currency: globalCurrency || 'USD',
          income: '',
          status: 'Paid',
          hours: '',
          notes: '',
        });
        setProofs([]);
      }

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, editingEntry, globalCurrency]);

  // Clipboard Paste Handler (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            hasImage = true;
            readImageBlob(blob, `Screenshot (${new Date().toLocaleTimeString()})`);
          }
        }
      }

      if (hasImage) {
        e.preventDefault();
        onToast?.('⚡ Screenshot attached from clipboard!');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onToast]);

  const readImageBlob = (blob, name = 'Proof Image') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newProof = {
        id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        data: e.target.result,
        name: name,
        timestamp: new Date().toISOString(),
      };
      setProofs((prev) => [...prev, newProof]);
    };
    reader.readAsDataURL(blob);
  };

  const handleFiles = (fileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('image/')) {
        readImageBlob(file, file.name);
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

  const handleGameSelect = (val) => {
    if (val === '__custom__') {
      setFormData((prev) => ({
        ...prev,
        game: '__custom__',
        isCustomGame: true,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        game: val,
        isCustomGame: false,
        customGameText: '',
      }));
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

    const entryToSave = {
      id:
        editingEntry?.id ||
        'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: formData.title.trim(),
      dateTime: formData.dateTime,
      game: selectedGame,
      currency: formData.currency,
      income: parseFloat(formData.income) || 0,
      status: formData.status,
      hours: formData.hours ? parseFloat(formData.hours) : null,
      notes: formData.notes.trim(),
      proofs,
      updatedAt: new Date().toISOString(),
    };

    onSave(entryToSave);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>
            {editingEntry ? 'Edit Work Record' : 'Log New Work'}
          </DialogTitle>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            {editingEntry ? 'EDIT' : 'NEW'}
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {/* Row 1: Game & Work Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Game / Platform *
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
                    onChange={(e) =>
                      setFormData({ ...formData, customGameText: e.target.value })
                    }
                    placeholder="Custom game name..."
                  />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Work Title *
              </label>
              <Input
                ref={titleInputRef}
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Keystone +20, GDKP Raid, UI Addon"
              />
            </div>
          </div>

          {/* Row 2: Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Date & Time *
              </label>
              <DateTimePicker
                value={formData.dateTime}
                onChange={(val) => setFormData({ ...formData, dateTime: val })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Status *
              </label>
              <Select
                value={formData.status}
                onChange={(val) => setFormData({ ...formData, status: val })}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Row 3: Income Amount & Currency + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Income & Currency *
              </label>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <Select
                    value={formData.currency}
                    onChange={(val) => setFormData({ ...formData, currency: val })}
                    options={CURRENCY_OPTIONS}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formData.income}
                    onChange={(e) => setFormData({ ...formData, income: e.target.value })}
                    placeholder="0.00"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Time (Hours)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                placeholder="e.g. 2.5"
                className="font-mono"
              />
            </div>
          </div>

          {/* Row 4: Notes */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Notes / Client Details
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add client username, realm name, or transaction notes..."
            />
          </div>

          {/* Proof Screenshot Attachment */}
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
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
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
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud className="w-5 h-5 text-zinc-500" />
                <div className="text-xs text-zinc-300">
                  <span className="font-semibold text-zinc-100">Click to upload</span> or drag image here
                </div>
                <div className="text-[10px] text-zinc-500">
                  Or press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> anywhere from Snipping Tool
                </div>
              </div>
            </div>

            {/* Proof Thumbnails Grid */}
            {proofs.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
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

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit">
            <Check className="w-3.5 h-3.5" />
            <span>Save Record</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export default WorkModal;
