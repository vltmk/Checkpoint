import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Sparkles,
  Gamepad2,
  Check,
  Palette,
  Coins,
} from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { ImageCropperModal } from './ImageCropperModal';
import {
  PRESET_ACCENT_COLORS,
  DEFAULT_WOW_COLOR,
  addOrUpdateCategory,
} from '../../lib/categories';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { Dialog, DialogHeader, DialogTitle } from './Dialog';
import wowIcon from '../../assets/world-of-warcraft-retail.svg';

export function CategoryModal({
  isOpen,
  onClose,
  category = null, // if editing existing category: { id, name, color, icon, isDefault, supportsGold }
  onSave, // (updatedCategory) => void
  onSaved,
}) {
  const { t, language, isRtl } = useLanguage();
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_WOW_COLOR);
  const [icon, setIcon] = useState(null); // base64 data URL
  const [suggestedColor, setSuggestedColor] = useState(null);
  const [supportsGold, setSupportsGold] = useState(false);
  const [goldUnit, setGoldUnit] = useState('1k'); // how this game's gold is priced: per 1 or per 1,000
  const [nameError, setNameError] = useState('');
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperInputImage, setCropperInputImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name || '');
        setColor(category.color || DEFAULT_WOW_COLOR);
        setIcon(category.icon || null);
        setSuggestedColor(null);
        setGoldUnit(category.goldUnit === '1' ? '1' : /classic/i.test(category.name || '') && !category.goldUnit ? '1' : '1k');
        setSupportsGold(
          category.supportsGold !== undefined
            ? Boolean(category.supportsGold)
            : Boolean(category.name?.toLowerCase().includes('world of warcraft'))
        );
      } else {
        setName('');
        setColor(DEFAULT_WOW_COLOR);
        setIcon(null);
        setSuggestedColor(null);
        setSupportsGold(false);
        setGoldUnit('1k');
      }
      setNameError('');
      setIsCropperOpen(false);
      setCropperInputImage(null);
    }
  }, [isOpen, category]);

  // Listen for clipboard paste anywhere in modal to launch cropper
  useEffect(() => {
    if (!isOpen || isCropperOpen) return;

    const handlePaste = (e) => {
      // If user is focused on an input element, allow normal text paste
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setCropperInputImage(file);
            setIsCropperOpen(true);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, isCropperOpen]);

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropperInputImage(file);
      setIsCropperOpen(true);
    }
    // reset input value so re-selecting same file triggers onChange
    if (e.target) e.target.value = '';
  };

  const handleCropperApply = ({ dataUrl, dominantColor }) => {
    setIcon(dataUrl);
    if (dominantColor) {
      setSuggestedColor(dominantColor);
      // Auto-set the color to the extracted dominant color for instant harmony
      setColor(dominantColor);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNameError(t('categories.nameRequired', 'Category name is required'));
      return;
    }

    setIsSaving(true);
    try {
      const catObj = {
        id: category?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: cleanName,
        color: color || DEFAULT_WOW_COLOR,
        icon: icon || null,
        isDefault: category?.isDefault || false,
        supportsGold: Boolean(supportsGold),
        goldUnit: goldUnit === '1' ? '1' : '1k',
      };

      const updatedList = await addOrUpdateCategory(catObj, category?.name || null);
      const callback = onSave || onSaved;
      callback?.(catObj, updatedList);
      onClose?.();
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isWoW =
    name.trim().toLowerCase().includes('warcraft') ||
    category?.name?.toLowerCase().includes('warcraft');

  return (
    <>
      {/* the shared dialog: a solid panel over a plain scrim, one layer above the form that opened it */}
      <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-[440px]" level={1}>
          <DialogHeader onClose={onClose}>
            <DialogTitle>
              <Gamepad2 className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              {category
                ? t('categories.editCategory', 'Edit Category')
                : t('categories.newCategory', 'Add Category / Game')}
            </DialogTitle>
          </DialogHeader>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            {/* Row 1: Name & Icon Picker */}
            <div className="flex items-start gap-4">
              {/* Icon Uploader / Squircle Tile */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  onClick={() => {
                    if (icon) {
                      setCropperInputImage(icon);
                      setIsCropperOpen(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="group relative w-16 h-16 rounded-[22.5%] border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 cursor-pointer overflow-hidden flex items-center justify-center transition-colors bg-zinc-50 dark:bg-zinc-900/50 active:scale-[0.96]"
                  title="Click to upload or edit icon"
                >
                  {icon ? (
                    <img
                      src={icon}
                      alt="Category Icon"
                      className="w-full h-full object-cover rounded-[22.5%]"
                    />
                  ) : isWoW && !icon ? (
                    <img
                      src={wowIcon}
                      alt="World of Warcraft"
                      className="w-9 h-9 object-contain opacity-90 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Gamepad2 className="w-7 h-7 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors" />
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[22.5%]">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {icon ? t('categories.changeIcon', 'Change') : t('categories.uploadIcon', 'Upload')}
                  </button>
                  {icon && (
                    <>
                      <span className="text-[10px] text-zinc-400">•</span>
                      <button
                        type="button"
                        onClick={() => setIcon(null)}
                        className="text-[10px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
                        title="Remove custom icon"
                      >
                        {t('common.remove', 'Remove')}
                      </button>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelectFile}
                />
              </div>

              {/* Name Field */}
              <div className="flex-1 space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {t('categories.categoryName', 'Category / Game Name')} *
                </label>
                <Input
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                  placeholder="e.g. Valorant, Elden Ring, Destiny 2..."
                  className={cn(
                    'h-10 text-sm font-medium',
                    nameError && 'border-rose-500 ring-1 ring-rose-500/50'
                  )}
                />
                {nameError && (
                  <p className="text-[10px] text-rose-500 font-medium">{nameError}</p>
                )}
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {t('categories.pasteHint', 'Tip: You can press Ctrl+V to paste an icon from clipboard.')}
                </p>
              </div>
            </div>

            {/* Row 2: Accent Color Picker */}
            <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-zinc-400" />
                  <span>{t('categories.accentColor', 'Accent Color')}</span>
                </label>
                {suggestedColor && (
                  <button
                    type="button"
                    onClick={() => setColor(suggestedColor)}
                    className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full transition-colors border border-zinc-200 dark:border-zinc-700"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                    <span>{t('categories.extractedFromIcon', 'From Icon')}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/20"
                      style={{ backgroundColor: suggestedColor }}
                    />
                  </button>
                )}
              </div>

              {/* Preset Swatches & Custom Hex */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_ACCENT_COLORS.map((preset) => {
                  const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setColor(preset.hex)}
                      title={preset.name}
                      className={cn(
                        'relative w-6 h-6 rounded-full transition-transform flex items-center justify-center active:scale-95 border border-black/15 dark:border-white/15 cursor-pointer',
                        isSelected && 'ring-2 ring-zinc-900 dark:ring-zinc-100 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 scale-105'
                      )}
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white drop-shadow-sm stroke-[3]" />
                      )}
                    </button>
                  );
                })}

                {/* Custom Hex Input */}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs font-medium text-zinc-400">#</span>
                  <input
                    type="text"
                    value={color.replace(/^#/, '').toUpperCase()}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                      setColor('#' + clean);
                    }}
                    placeholder="HEX"
                    maxLength={6}
                    className="w-16 h-7 text-[11px] font-medium tracking-wider uppercase bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1 text-center text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-zinc-400"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Gold Currency & Conversion Toggle */}
            <div className="pt-2.5 pb-0.5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer select-none">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('categories.supportsGold', 'Enable in-game Gold & conversion rate')}</span>
                </label>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-normal">
                  {t('categories.supportsGoldDesc', 'Allow recording in Gold with live conversion rates for this category')}
                </p>
              </div>
              <button aria-label={t('categories.supportsGold', 'Enable in-game Gold & conversion rate')}
                type="button"
                role="switch"
                aria-checked={supportsGold}
                onClick={() => setSupportsGold((prev) => !prev)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100',
                  supportsGold ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-800'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                    supportsGold ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
            {/* how this game's gold is priced: new gold jobs start from this unit */}
            {supportsGold && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">{t('categories.goldUnit', 'Gold is priced')}</span>
                <div role="radiogroup" aria-label={t('categories.goldUnit', 'Gold is priced')} className="inline-flex h-8 items-center rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5">
                  {[['1', t('categories.goldPer1', 'Per 1 gold')], ['1k', t('categories.goldPer1k', 'Per 1,000 gold')]].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={goldUnit === v}
                      onClick={() => setGoldUnit(v)}
                      className={cn('h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150', goldUnit === v ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
              >
                {t('common.save', 'Save Category')}
              </Button>
            </div>
          </form>
      </Dialog>

      {/* Cropper Modal */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        initialImage={cropperInputImage}
        onClose={() => {
          setIsCropperOpen(false);
          setCropperInputImage(null);
        }}
        onApply={handleCropperApply}
      />
    </>
  );
}

export default CategoryModal;
