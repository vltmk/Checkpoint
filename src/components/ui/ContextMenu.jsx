import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Zap,
  CheckSquare,
  Check,
  RotateCw,
  Download,
  Coins,
  Banknote,
  Sun,
  Moon,
  Globe,
  Keyboard,
  Edit3,
  Copy,
  Receipt,
  Trash2,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  CheckCircle2,
  FileImage,
  ExternalLink,
  XSquare,
} from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { FrostedGlass } from './FrostedGlass';
import {
  DiscordIcon,
  TelegramIcon,
  SteamIcon,
  GoogleSheetsIcon,
  GithubIcon,
} from './Icons';
import { detectAppLink } from '../../lib/appLinks';
import { openAppAwareUrl } from '../../lib/desktop';

/**
 * Apple-grade Context Menu Component
 * Features:
 * - Fluid critically damped spring physics (motion/react)
 * - Screen boundary clamping (never overflows edges)
 * - Multi-selection context awareness
 * - Bi-directional submenu flipping (horizontal & vertical)
 * - 100ms triangle hover intent buffer for diagonal mouse paths
 * - Tactile active press response (active:scale-[0.98])
 * - Keyboard navigation (Arrows, Enter, Escape)
 */
export function ContextMenu({
  isOpen,
  position = { x: 0, y: 0 },
  onClose,
  targetEntry = null,
  selectedCount = 0,
  isTargetInSelection = false,
  isSelectMode = false,
  globalCurrency = 'TOMAN',
  activeProfileId = 'booster',
  theme = 'dark',
  onAddWork,
  onToggleSelectMode,
  onToggleCurrency,
  onExport,
  onReload,
  onOpenShortcuts,
  onThemeChange,
  onLanguageChange,
  // Single entry actions
  onEditEntry,
  onDuplicateEntry,
  onViewReceipt,
  onCopyDiscordReceipt,
  onAddScreenshot,
  onOpenLink,
  onDeleteEntry,
  // Bulk selection actions
  onBulkMarkPaid,
  onBulkExportCsv,
  onDeselectAll,
  onBulkDelete,
}) {
  const { language, t, isRtl } = useLanguage();
  const menuRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y });
  const [transformOrigin, setTransformOrigin] = useState('top left');
  const [flipSubmenuLeft, setFlipSubmenuLeft] = useState(false);
  const [flipSubmenuUp, setFlipSubmenuUp] = useState(false);
  const [isConstrained, setIsConstrained] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); // null | 'theme' | 'language'
  const submenuTimeoutRef = useRef(null);
  const themeTriggerRef = useRef(null);
  const languageTriggerRef = useRef(null);
  const [submenuAnchor, setSubmenuAnchor] = useState({ top: 0, height: 28 });
  const [measuredMenuWidth, setMeasuredMenuWidth] = useState(224);

  // Clear hover timeouts on unmount
  useEffect(() => {
    return () => {
      if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current);
    };
  }, []);

  // Compute boundary clamping and transform origin on open
  useLayoutEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
      return;
    }

    const el = menuRef.current;
    const menuEl = el?.querySelector('.checkpoint-frosted-menu');
    // Measure actual DOM dimensions if available, with realistic fallback
    const menuWidth = menuEl?.offsetWidth || el?.offsetWidth || 224;
    const menuHeight = el?.offsetHeight || (targetEntry ? 280 : 340);
    setMeasuredMenuWidth(menuWidth);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;
    const rect = position.rect;

    let posX = position.x;
    let posY = position.y;
    let originX = 'left';
    let originY = 'top';
    let flipLeft = false;
    let flipUp = false;

    if (rect) {
      // Anchored to a trigger element (e.g. 3-dot row button)
      const spaceRight = viewportWidth - (isRtl ? rect.left : rect.right) - padding;
      const spaceLeft = (isRtl ? rect.left : rect.right) - padding;

      if (isRtl) {
        if (menuWidth <= spaceRight) {
          posX = rect.left;
          originX = 'left';
          flipLeft = false;
        } else {
          posX = Math.max(padding, rect.right - menuWidth);
          originX = 'right';
          flipLeft = true;
        }
      } else {
        if (menuWidth <= spaceLeft) {
          posX = rect.right - menuWidth;
          originX = 'right';
          flipLeft = true;
        } else {
          posX = Math.min(rect.left, viewportWidth - menuWidth - padding);
          originX = 'left';
          flipLeft = false;
        }
      }

      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;

      if (menuHeight <= spaceBelow) {
        posY = rect.bottom + 4;
        originY = 'top';
        flipUp = false;
      } else if (menuHeight <= spaceAbove) {
        posY = rect.top - menuHeight - 4;
        originY = 'bottom';
        flipUp = true;
      } else {
        if (spaceAbove > spaceBelow) {
          posY = Math.max(padding, rect.top - menuHeight - 4);
          originY = 'bottom';
          flipUp = true;
        } else {
          posY = Math.max(padding, Math.min(rect.bottom + 4, viewportHeight - menuHeight - padding));
          originY = 'top';
          flipUp = false;
        }
      }
    } else {
      // Standard Cursor Position (Right-Click)
      const spaceRight = viewportWidth - position.x - padding;
      const spaceLeft = position.x - padding;

      if (isRtl) {
        // In RTL, prefer opening to the left of the cursor
        if (menuWidth <= spaceLeft) {
          posX = position.x - menuWidth;
          originX = 'right';
        } else if (menuWidth <= spaceRight) {
          posX = position.x;
          originX = 'left';
        } else {
          if (spaceLeft >= spaceRight) {
            posX = Math.max(padding, position.x - menuWidth);
            originX = 'right';
          } else {
            posX = Math.max(padding, viewportWidth - menuWidth - padding);
            originX = 'left';
          }
        }
      } else {
        if (menuWidth <= spaceRight) {
          posX = position.x;
          originX = 'left';
        } else if (menuWidth <= spaceLeft) {
          posX = position.x - menuWidth;
          originX = 'right';
        } else {
          // Pick direction with more room
          if (spaceLeft > spaceRight) {
            posX = Math.max(padding, position.x - menuWidth);
            originX = 'right';
          } else {
            posX = Math.max(padding, viewportWidth - menuWidth - padding);
            originX = 'left';
          }
        }
      }

      // Vertical Calculation
      const spaceBelow = viewportHeight - position.y - padding;
      const spaceAbove = position.y - padding;

      if (menuHeight <= spaceBelow) {
        posY = position.y;
        originY = 'top';
        flipUp = false;
      } else if (menuHeight <= spaceAbove) {
        posY = position.y - menuHeight;
        originY = 'bottom';
        flipUp = true;
      } else {
        if (spaceAbove > spaceBelow) {
          posY = Math.max(padding, position.y - menuHeight);
          originY = 'bottom';
          flipUp = true;
        } else {
          posY = Math.max(padding, Math.min(position.y, viewportHeight - menuHeight - padding));
          originY = 'top';
          flipUp = false;
        }
      }
    }

    // Clamp final coordinates strictly within viewport bounds
    const maxPosX = Math.max(padding, viewportWidth - menuWidth - padding);
    const maxPosY = Math.max(padding, viewportHeight - menuHeight - padding);
    posX = Math.min(Math.max(padding, posX), maxPosX);
    posY = Math.min(Math.max(padding, posY), maxPosY);

    // Calculate dedicated submenu clearance based on the clamped main menu position
    const submenuWidth = 164; // 160px width + 4px gap
    let shouldFlipSubmenuLeft = false;

    if (isRtl) {
      // In RTL, natural reading direction is to open to the left of the main menu
      if (posX - submenuWidth >= padding) {
        shouldFlipSubmenuLeft = true;
      } else if (posX + menuWidth + submenuWidth <= viewportWidth - padding) {
        shouldFlipSubmenuLeft = false;
      } else {
        // Pick whichever side has more room
        shouldFlipSubmenuLeft = (posX - padding) >= (viewportWidth - (posX + menuWidth) - padding);
      }
    } else {
      // In LTR, natural reading direction is to open to the right of the main menu
      if (posX + menuWidth + submenuWidth <= viewportWidth - padding) {
        shouldFlipSubmenuLeft = false;
      } else if (posX - submenuWidth >= padding) {
        shouldFlipSubmenuLeft = true;
      } else {
        // Pick whichever side has more room
        shouldFlipSubmenuLeft = (posX - padding) > (viewportWidth - (posX + menuWidth) - padding);
      }
    }

    // Check if submenus near the bottom need to flip upwards
    const shouldFlipSubmenuUp = flipUp || (posY + menuHeight + 10 > viewportHeight - padding);

    const constrained = menuHeight > viewportHeight - 2 * padding;
    setIsConstrained(constrained);
    setAdjustedPos({ x: posX, y: posY });
    setTransformOrigin(`${originY} ${originX}`);
    setFlipSubmenuLeft(shouldFlipSubmenuLeft);
    setFlipSubmenuUp(shouldFlipSubmenuUp);
  }, [isOpen, position.x, position.y, position.rect, targetEntry, selectedCount, isSelectMode, isRtl]);

  // Click outside and escape listeners
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [isOpen, onClose]);

  // Submenu Hover Intent Handlers with 100ms Triangle Safe Zone
  const updateSubmenuAnchor = useCallback((name) => {
    const triggerEl = name === 'theme' ? themeTriggerRef.current : name === 'language' ? languageTriggerRef.current : null;
    if (triggerEl && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();
      setSubmenuAnchor({
        top: triggerRect.top - menuRect.top,
        height: triggerRect.height,
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (activeSubmenu) {
      updateSubmenuAnchor(activeSubmenu);
    }
  }, [activeSubmenu, updateSubmenuAnchor]);

  const handleSubmenuTriggerMouseEnter = (name) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
    updateSubmenuAnchor(name);
    setActiveSubmenu(name);
  };

  const handleSubmenuTriggerMouseLeave = () => {
    if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current);
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 120);
  };

  const handleSubmenuMouseEnter = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current);
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 120);
  };

  const executeAction = useCallback(
    (actionFn) => {
      onClose?.();
      requestAnimationFrame(() => {
        actionFn?.();
      });
    },
    [onClose]
  );

  if (!isOpen) return null;

  const showBulkActions = selectedCount > 1 && isTargetInSelection;

  const linkInfo = targetEntry?.link ? detectAppLink(targetEntry.link) : null;
  const isApp = linkInfo?.appLaunchable;
  const linkLabel = linkInfo
    ? (isApp
        ? (language === 'fa' && linkInfo.labelFa ? `باز کردن در ${linkInfo.labelFa}` : `Open in ${linkInfo.label} App`)
        : (language === 'fa' && linkInfo.labelFa ? `باز کردن ${linkInfo.labelFa}` : `Open ${linkInfo.label}`))
    : t('ledger.openLink', 'Open Link');

  let LinkIcon = ExternalLink;
  if (linkInfo?.platform === 'discord') LinkIcon = DiscordIcon;
  else if (linkInfo?.platform === 'telegram') LinkIcon = TelegramIcon;
  else if (linkInfo?.platform === 'steam') LinkIcon = SteamIcon;
  else if (linkInfo?.platform === 'sheets') LinkIcon = GoogleSheetsIcon;
  else if (linkInfo?.platform === 'github') LinkIcon = GithubIcon;

  return (
    <div
      ref={menuRef}
      role="menu"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed z-[9999] select-none focus:outline-none"
      style={{
        left: `${adjustedPos.x}px`,
        top: `${adjustedPos.y}px`,
      }}
    >
      <FrostedGlass
        as="motion.div"
        variant="menu"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.16 }}
        style={{
          transformOrigin,
          maxHeight: isConstrained ? 'calc(100vh - 20px)' : undefined,
        }}
        className={cn(
          'w-56 p-1 text-zinc-800 dark:text-zinc-200 text-xs font-medium space-y-0.5',
          isConstrained
            ? 'overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(161,161,170,0.5)_transparent] dark:[scrollbar-color:rgba(113,113,122,0.5)_transparent]'
            : 'overflow-visible'
        )}
      >
        {/* ==================================================================== */}
        {/* 1. DEDICATED BULK MULTI-SELECTION CONTEXT MENU                        */}
        {/* ==================================================================== */}
        {showBulkActions ? (
          <>
            <div className={cn(
              "px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/50 mb-0.5",
              isRtl && 'font-farsi'
            )}>
              <span>{t('contextMenu.selectMode')}</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {selectedCount} {language === 'fa' ? 'مورد' : 'selected'}
              </span>
            </div>

            <ContextMenuItem
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              label={`${t('contextMenu.markSelectedPaid')} (${selectedCount})`}
              onClick={() => executeAction(onBulkMarkPaid)}
            />

            <ContextMenuItem
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={`${t('contextMenu.exportSelectedCsv')} (${selectedCount})`}
              onClick={() => executeAction(onBulkExportCsv)}
            />

            <ContextMenuItem
              icon={<XSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.deselectAll', 'Deselect All')}
              onClick={() => executeAction(onDeselectAll)}
            />

            <MenuDivider />

            <ContextMenuItem
              icon={<Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
              label={`${t('contextMenu.deleteSelected')} (${selectedCount})`}
              isDestructive
              onClick={() => executeAction(onBulkDelete)}
            />
          </>
        ) : targetEntry ? (
          /* ==================================================================== */
          /* 2. DEDICATED WORK ROW CONTEXT MENU                                    */
          /* ==================================================================== */
          <>
            {/* Section 1: Receipts, Discord MD & External Links */}
            <ContextMenuItem
              icon={<Receipt className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={activeProfileId === 'advertiser' ? (language === 'fa' ? 'مشاهده فاکتور / رسید' : 'View Order Receipt') : t('ledger.clientReceipt', 'Client Receipt')}
              onClick={() => executeAction(() => onViewReceipt?.(targetEntry))}
            />

            {activeProfileId === 'advertiser' ? (
              <>
                <ContextMenuItem
                  icon={<DiscordIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  label={language === 'fa' ? 'رسید مشتری (دیسکورد)' : 'Client Receipt (Discord)'}
                  onClick={() => executeAction(() => onCopyDiscordReceipt?.(targetEntry, 'client'))}
                />
                {targetEntry.teammates && targetEntry.teammates.length > 0 && (
                  <ContextMenuItem
                    icon={<DiscordIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                    label={language === 'fa' ? 'فیش تسویه بوستر (دیسکورد)' : 'Booster Payout Slip (Discord)'}
                    onClick={() => executeAction(() => onCopyDiscordReceipt?.(targetEntry, 'booster'))}
                  />
                )}
              </>
            ) : (
              <ContextMenuItem
                icon={<DiscordIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                label={t('contextMenu.copyDiscord')}
                onClick={() => executeAction(() => onCopyDiscordReceipt?.(targetEntry))}
              />
            )}

            {targetEntry.link && (
              <ContextMenuItem
                icon={<LinkIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
                label={linkLabel}
                onClick={() => executeAction(() => (onOpenLink ? onOpenLink(targetEntry) : openAppAwareUrl(targetEntry.link)))}
              />
            )}

            <MenuDivider />

            {/* Section 2: Editing, Screenshots & Duplication */}
            <ContextMenuItem
              icon={<Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.editWork')}
              onClick={() => executeAction(() => onEditEntry?.(targetEntry))}
            />

            <ContextMenuItem
              icon={<FileImage className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('ledger.addScreenshot', 'Add Screenshot')}
              onClick={() => executeAction(() => (onAddScreenshot ? onAddScreenshot(targetEntry) : onEditEntry?.(targetEntry)))}
            />

            <ContextMenuItem
              icon={<Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.duplicateWork')}
              onClick={() => executeAction(() => onDuplicateEntry?.(targetEntry))}
            />

            <MenuDivider />

            {/* Section 3: Destructive Delete */}
            <ContextMenuItem
              icon={<Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
              label={t('contextMenu.deleteWork')}
              isDestructive
              onClick={() => executeAction(() => onDeleteEntry?.(targetEntry))}
            />
          </>
        ) : (
          /* ==================================================================== */
          /* 3. DEDICATED GENERAL / CANVAS ACTIONS MENU                            */
          /* ==================================================================== */
          <>
            <ContextMenuItem
              icon={<Plus className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />}
              label={t('contextMenu.addWork')}
              shortcut="N"
              onClick={() => executeAction(onAddWork)}
            />

            <ContextMenuItem
              icon={<CheckSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.selectMode')}
              shortcut="S"
              isChecked={isSelectMode}
              onClick={() => executeAction(onToggleSelectMode)}
            />

            <MenuDivider />

            <ContextMenuItem
              icon={
                globalCurrency === 'GOLD' ? (
                  <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                )
              }
              label={t('contextMenu.toggleCurrency')}
              shortcut="T"
              suffix={
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                  {globalCurrency === 'GOLD' ? 'GOLD' : 'TOMAN'}
                </span>
              }
              onClick={() => executeAction(onToggleCurrency)}
            />

            <ContextMenuItem
              icon={<Download className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.exportBackups')}
              shortcut="Alt+E"
              onClick={() => executeAction(onExport)}
            />

            <ContextMenuItem
              icon={<RotateCw className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.reload')}
              shortcut="Ctrl+R"
              onClick={() => executeAction(onReload)}
            />

            <MenuDivider />

            {/* Theme Submenu Trigger */}
            <div
              ref={themeTriggerRef}
              className="relative"
              onMouseEnter={() => handleSubmenuTriggerMouseEnter('theme')}
              onMouseLeave={handleSubmenuTriggerMouseLeave}
            >
              <ContextMenuItem
                icon={
                  theme === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  )
                }
                label={t('contextMenu.theme')}
                hasSubmenu
                isSubmenuOpen={activeSubmenu === 'theme'}
                isRtl={isRtl}
                flipSubmenuLeft={flipSubmenuLeft}
              />
            </div>

            {/* Language Submenu Trigger */}
            <div
              ref={languageTriggerRef}
              className="relative"
              onMouseEnter={() => handleSubmenuTriggerMouseEnter('language')}
              onMouseLeave={handleSubmenuTriggerMouseLeave}
            >
              <ContextMenuItem
                icon={<Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
                label={t('contextMenu.language')}
                hasSubmenu
                isSubmenuOpen={activeSubmenu === 'language'}
                isRtl={isRtl}
                flipSubmenuLeft={flipSubmenuLeft}
              />
            </div>

            <MenuDivider />

            {/* Shortcuts */}
            <ContextMenuItem
              icon={<Keyboard className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              label={t('contextMenu.shortcuts')}
              shortcut="?"
              onClick={() => executeAction(onOpenShortcuts)}
            />
          </>
        )}
      </FrostedGlass>

      {/* Flyout Submenu rendered as sibling to ensure independent Backdrop Root */}
      <AnimatePresence>
        {activeSubmenu && (
          <SubmenuFlyout
            isRtl={isRtl}
            flipLeft={flipSubmenuLeft}
            flipUp={flipSubmenuUp}
            anchorTop={submenuAnchor.top}
            anchorHeight={submenuAnchor.height}
            mainMenuWidth={measuredMenuWidth}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
          >
            {activeSubmenu === 'theme' && (
              <>
                <ContextMenuItem
                  icon={<Moon className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />}
                  label={t('contextMenu.themeDark')}
                  isChecked={theme === 'dark'}
                  onClick={() => executeAction(() => onThemeChange?.('dark'))}
                />
                <ContextMenuItem
                  icon={<Sun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                  label={t('contextMenu.themeLight')}
                  isChecked={theme === 'light'}
                  onClick={() => executeAction(() => onThemeChange?.('light'))}
                />
              </>
            )}
            {activeSubmenu === 'language' && (
              <>
                <ContextMenuItem
                  icon={<span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">EN</span>}
                  label={t('contextMenu.langEn')}
                  isChecked={language === 'en'}
                  onClick={() => executeAction(() => onLanguageChange?.('en'))}
                />
                <ContextMenuItem
                  icon={<span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 font-farsi">فا</span>}
                  label={t('contextMenu.langFa')}
                  isChecked={language === 'fa'}
                  onClick={() => executeAction(() => onLanguageChange?.('fa'))}
                />
              </>
            )}
          </SubmenuFlyout>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual Context Menu Item
 */
function ContextMenuItem({
  icon,
  label,
  shortcut,
  suffix,
  isChecked = false,
  isDestructive = false,
  hasSubmenu = false,
  isSubmenuOpen = false,
  isRtl: isRtlProp,
  flipSubmenuLeft = false,
  onClick,
}) {
  const { isRtl: isRtlContext } = useLanguage();
  const isRtl = isRtlProp !== undefined ? isRtlProp : isRtlContext;

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors duration-100 cursor-pointer active:scale-[0.98]',
        isRtl ? 'text-right font-farsi' : 'text-left',
        isDestructive
          ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/40 focus:bg-rose-50 dark:focus:bg-rose-950/40'
          : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80 focus:bg-zinc-100 dark:focus:bg-zinc-800/80',
        isSubmenuOpen && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-white'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Left icon / checkmark gutter */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isChecked ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : icon}
        </div>
        <span className={cn('truncate text-xs font-medium leading-normal', isRtl && 'font-farsi')}>{label}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {suffix}
        {shortcut && (
          <kbd
            dir="ltr"
            className="isolate px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wider select-none"
          >
            {shortcut}
          </kbd>
        )}
        {hasSubmenu &&
          (flipSubmenuLeft ? (
            <ChevronLeft className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          ))}
      </div>
    </button>
  );
}

/**
 * Flyout Submenu Container with Spring Physics
 */
function SubmenuFlyout({
  children,
  isRtl,
  flipLeft,
  flipUp = false,
  anchorTop = 0,
  anchorHeight = 28,
  mainMenuWidth = 224,
  onMouseEnter,
  onMouseLeave,
}) {
  const originY = flipUp ? 'bottom' : 'top';
  const originX = flipLeft ? 'right' : 'left';
  // Safe bridge to cover the 4px gap between parent item and flyout
  const bridgeClass = flipLeft
    ? "before:content-[''] before:absolute before:top-0 before:bottom-0 before:w-3 before:-right-3 before:pointer-events-auto"
    : "before:content-[''] before:absolute before:top-0 before:bottom-0 before:w-3 before:-left-3 before:pointer-events-auto";

  const submenuWidth = 160;
  const leftPos = flipLeft ? -(submenuWidth + 4) : mainMenuWidth + 4;
  const submenuHeight = 68;
  const topPos = flipUp ? Math.max(0, anchorTop + anchorHeight - submenuHeight) : anchorTop;

  return (
    <FrostedGlass
      as="motion.div"
      variant="menu"
      dir={isRtl ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.14 }}
      style={{
        transformOrigin: `${originY} ${originX}`,
        left: `${leftPos}px`,
        top: `${topPos}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'absolute z-[10000] w-40 p-1 space-y-0.5 text-zinc-800 dark:text-zinc-200 text-xs font-medium',
        bridgeClass
      )}
    >
      {children}
    </FrostedGlass>
  );
}

/**
 * Menu Divider
 */
function MenuDivider() {
  return <div className="my-1 h-px bg-zinc-200/80 dark:bg-zinc-800/70" />;
}

export default ContextMenu;
