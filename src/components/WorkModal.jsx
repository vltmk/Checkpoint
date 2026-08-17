import React, { useState, useEffect, useRef } from 'react';
import { CATEGORIES, STATUSES, CURRENCIES, GAMING_PRESETS } from '../lib/currencies';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Input';
import { Kbd } from './ui/Tooltip';
import {
  UploadCloud,
  X,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

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
    game: '',
    category: 'Game Dev / Code',
    platform: '',
    currency: 'DEFAULT',
    income: '',
    status: 'Paid',
    hours: '',
    deliverableUrl: '',
    tags: '',
    notes: '',
  });

  const [proofs, setProofs] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const titleInputRef = useRef(null);

  // Initialize form when opening or changing editingEntry
  useEffect(() => {
    if (isOpen) {
      if (editingEntry) {
        setFormData({
          title: editingEntry.title || '',
          dateTime: editingEntry.dateTime || '',
          game: editingEntry.game || '',
          category: editingEntry.category || 'Game Dev / Code',
          platform: editingEntry.platform || '',
          currency: editingEntry.currency || 'DEFAULT',
          income: editingEntry.income !== undefined ? editingEntry.income : '',
          status: editingEntry.status || 'Paid',
          hours: editingEntry.hours !== undefined && editingEntry.hours !== null ? editingEntry.hours : '',
          deliverableUrl: editingEntry.deliverableUrl || '',
          tags: Array.isArray(editingEntry.tags)
            ? editingEntry.tags.join(', ')
            : editingEntry.tags || '',
          notes: editingEntry.notes || '',
        });
        setProofs(editingEntry.proofs ? [...editingEntry.proofs] : []);
      } else {
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);

        setFormData({
          title: '',
          dateTime: localIso,
          game: '',
          category: 'Game Dev / Code',
          platform: '',
          currency: 'DEFAULT',
          income: '',
          status: 'Paid',
          hours: '',
          deliverableUrl: '',
          tags: '',
          notes: '',
        });
        setProofs([]);
      }

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, editingEntry]);

  // Clipboard Paste Handler (Ctrl+V) while modal is active
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
            readImageBlob(blob, `Clipboard Screenshot (${new Date().toLocaleTimeString()})`);
          }
        }
      }

      if (hasImage) {
        e.preventDefault();
        onToast?.('⚡ Screenshot captured and attached as proof!');
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
        dataUrl: e.target.result,
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
      } else {
        onToast?.(`Attached: ${file.name}`);
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

  const handleApplyPreset = (preset) => {
    const d = preset.data;
    setFormData((prev) => ({
      ...prev,
      title: d.title,
      game: d.game,
      category: d.category,
      platform: d.platform,
      currency: d.currency,
      income: d.income,
      hours: d.hours,
      tags: d.tags.join(', '),
      notes: d.notes,
    }));
    onToast?.(`⚡ Applied preset: ${preset.name}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.game.trim() || !formData.dateTime) {
      onToast?.('Please fill required fields (Title, Game, Date)');
      return;
    }

    const tags = formData.tags
      ? formData.tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean)
      : [];

    const entryToSave = {
      id:
        editingEntry?.id ||
        'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: formData.title.trim(),
      dateTime: formData.dateTime,
      game: formData.game.trim(),
      category: formData.category,
      platform: formData.platform.trim(),
      currency: formData.currency,
      income: parseFloat(formData.income) || 0,
      status: formData.status,
      hours: formData.hours ? parseFloat(formData.hours) : null,
      deliverableUrl: formData.deliverableUrl.trim(),
      tags,
      notes: formData.notes.trim(),
      proofs,
      updatedAt: new Date().toISOString(),
    };

    onSave(entryToSave);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <DialogTitle>
            {editingEntry ? 'Edit Work Entry' : 'Log Gaming Work'}
          </DialogTitle>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white/[0.08] text-zinc-300 border border-white/[0.1]">
            {editingEntry ? 'EDITING' : 'NEW ENTRY'}
          </span>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <DialogContent className="space-y-4">
          {/* Quick Presets Bar */}
          {!editingEntry && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Quick Gaming Presets
                </span>
                <span className="text-[10px] text-zinc-400">1-click autofill</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {GAMING_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.09] text-[11px] font-medium text-zinc-300 hover:text-white border border-white/[0.08] shrink-0 transition-all active:scale-95"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 1: Title & Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Work Title / Task Description *
              </label>
              <Input
                ref={titleInputRef}
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Boss AI Behavior Trees, Radiant Coaching, 3D Pet Models"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Date & Time *
              </label>
              <Input
                type="datetime-local"
                required
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Game, Category, Platform */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Game / Client / Studio *
              </label>
              <Input
                required
                value={formData.game}
                onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                placeholder="e.g. Valorant, Pet Royale, Indie Client"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Category *
              </label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#0c0c0e]">
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Platform / Engine
              </label>
              <Input
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                placeholder="e.g. Unreal 5.4, Roblox Studio, Discord"
              />
            </div>
          </div>

          {/* Row 3: Income, Currency, Status, Hours */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Income Amount & Currency *
              </label>
              <div className="flex gap-1.5">
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-xs text-zinc-200 rounded-lg px-2 py-2 focus:outline-none cursor-pointer max-w-[100px]"
                >
                  <option value="DEFAULT" className="bg-[#0c0c0e]">Default</option>
                  <optgroup label="Fiat & Crypto" className="bg-[#0c0c0e]">
                    <option value="USD">USD ($)</option>
                    <option value="TOMAN">Toman (تومان)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="USDT">USDT (₮)</option>
                  </optgroup>
                  <optgroup label="In-Game" className="bg-[#0c0c0e]">
                    <option value="ROBUX">Robux</option>
                    <option value="VP">VP</option>
                    <option value="VBUCKS">V-Bucks</option>
                    <option value="WOW_GOLD">WoW Gold</option>
                    <option value="OSRS_GP">OSRS GP</option>
                    <option value="TF2_KEYS">TF2 Keys</option>
                    <option value="MINECOINS">Minecoins</option>
                  </optgroup>
                </select>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={formData.income}
                  onChange={(e) => setFormData({ ...formData, income: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Status
              </label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st} className="bg-[#0c0c0e]">
                    {st}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Time Spent (Hours)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                placeholder="e.g. 4.5"
              />
            </div>
          </div>

          {/* Row 4: Deliverable URL & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Deliverable / Repository Link
              </label>
              <Input
                type="url"
                value={formData.deliverableUrl}
                onChange={(e) => setFormData({ ...formData, deliverableUrl: e.target.value })}
                placeholder="https://github.com/..., https://artstation.com/..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Tags (Comma Separated)
              </label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g. shader, boss-fight, urgent, milestone-1"
              />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Work Notes / Changelog / Scope Specs
            </label>
            <Textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Document client feedback, bugs fixed, match IDs, or delivery specs..."
            />
          </div>

          {/* Proof of Completion: Instant Clipboard & Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Proof of Completion (Screenshots / Files)
              </label>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ⚡ Press Ctrl+V anytime to paste screenshot
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
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-150 ${
                isDragOver
                  ? 'border-emerald-500/60 bg-emerald-500/[0.05]'
                  : 'border-white/[0.1] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.04]'
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
                accept="image/*,.pdf,.zip"
                multiple
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud className="w-5 h-5 text-zinc-400" />
                <div className="text-xs text-zinc-300">
                  <span className="font-semibold text-white">Click to browse</span> or drag images here
                </div>
                <div className="text-[10px] text-zinc-400">
                  Or press <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> directly from Snipping Tool / Lightshot
                </div>
              </div>
            </div>

            {/* Proof Thumbnails Grid */}
            {proofs.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {proofs.map((proof, idx) => (
                  <div
                    key={proof.id || idx}
                    className="group relative h-16 w-20 rounded-lg overflow-hidden border border-white/20 bg-zinc-900 shadow-md"
                  >
                    <img
                      src={proof.dataUrl}
                      alt={proof.name || 'Proof'}
                      onClick={() =>
                        onOpenLightbox?.(proof.dataUrl, proof.name || 'Attached Proof')
                      }
                      className="h-full w-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveProof(idx);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/80 hover:bg-rose-500 text-zinc-300 hover:text-white transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[8px] text-zinc-300 truncate font-mono">
                      {proof.name || 'Screenshot'}
                    </div>
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
            <span>{editingEntry ? 'Update Work Entry' : 'Save Work Entry'}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
