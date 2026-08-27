import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Kbd } from './ui/Tooltip';
import { Keyboard } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { cn } from '../lib/utils';

export function ShortcutsModal({ isOpen, onClose }) {
  const { t, language, isRtl } = useLanguage();

  const shortcutGroups = [
    {
      group: language === 'fa' ? 'عملیات و ثبت' : 'Actions & Entry',
      items: [
        { keys: ['N'], desc: language === 'fa' ? 'افزودن کار (کامل)' : 'Add work record (Full)' },
        { keys: ['Q'], desc: language === 'fa' ? 'ثبت سریع کار' : 'Quick add work record' },
        { keys: ['Ctrl', 'V'], desc: language === 'fa' ? 'چسباندن اسکرین‌شات از کلیپ‌بورد' : 'Paste screenshot proof into modal' },
        { keys: ['C'], desc: language === 'fa' ? 'کپی اسکرین‌شات رسید (در پنجره رسید)' : 'Copy receipt screenshot (in Receipt view)' },
        { keys: ['Esc'], desc: language === 'fa' ? 'بستن پنجره‌ها یا لغو انتخاب' : 'Close dialogs, cancel confirmation, or clear selection' },
      ],
    },
    {
      group: language === 'fa' ? 'انتخاب چندگانه و عملیات دسته‌ای' : 'Multi-Select & Bulk Actions',
      items: [
        { keys: ['S'], desc: language === 'fa' ? 'فعال/غیرفعال کردن حالت انتخاب چندگانه' : 'Toggle multi-selection mode' },
        { keys: ['Shift', 'Click'], desc: language === 'fa' ? 'انتخاب بازه‌ای از کارها' : 'Select range between jobs' },
        { keys: ['Ctrl', 'A'], desc: language === 'fa' ? 'انتخاب همه کارهای صفحه' : 'Select all jobs on current page (in select mode)' },
      ],
    },
    {
      group: language === 'fa' ? 'پیمایش و صفحات' : 'Navigation & Views',
      items: [
        { keys: ['1'], desc: language === 'fa' ? 'رفتن به تب دفتر (Ledger)' : 'Jump to Ledger tab' },
        { keys: ['2'], desc: language === 'fa' ? 'رفتن به تب آمار (Analytics)' : 'Jump to Analytics tab' },
        { keys: ['/'], desc: language === 'fa' ? 'فوکوس روی نوار جستجو' : 'Focus search bar' },
        { keys: ['?'], desc: language === 'fa' ? 'نمایش کلیدهای میانبر' : 'Open shortcuts cheat sheet' },
      ],
    },
    {
      group: language === 'fa' ? 'داده و بکاپ' : 'Data & Portability',
      items: [
        { keys: ['Alt', 'E'], desc: language === 'fa' ? 'خروجی اکسل / CSV' : 'Export ledger to CSV' },
        { keys: ['Alt', 'B'], desc: language === 'fa' ? 'پشتیبان‌گیری کامل JSON' : 'Backup database to JSON' },
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-zinc-400" />
          <DialogTitle className={cn(isRtl && 'font-farsi')}>{t('settings.shortcuts')}</DialogTitle>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {shortcutGroups.map((grp) => (
          <div key={grp.group} className="space-y-2">
            <h4 className={cn('text-[10px] font-semibold uppercase tracking-wider text-zinc-500', isRtl && 'font-farsi')}>
              {grp.group}
            </h4>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg divide-y divide-zinc-800/60 overflow-hidden">
              {grp.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span className={cn('text-zinc-300 font-medium', isRtl && 'font-farsi')}>{item.desc}</span>
                  <div className="flex items-center gap-1" dir="ltr">
                    {item.keys.map((k, kIdx) => (
                      <React.Fragment key={k}>
                        <Kbd>{k}</Kbd>
                        {kIdx < item.keys.length - 1 && (
                          <span className="text-zinc-500 text-[10px]">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DialogContent>

      <DialogFooter>
        <Button variant="primary" size="sm" onClick={onClose} className={cn(isRtl && 'font-farsi')}>
          {t('common.done')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default ShortcutsModal;
