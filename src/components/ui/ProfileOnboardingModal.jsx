import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Megaphone, Check, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from './Dialog';
import { Button } from './Button';
import { CheckpointLogo } from './Icons';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { PROFILES, setActiveProfileId } from '../../lib/profiles';

export function ProfileOnboardingModal({ isOpen, onComplete, onSelectRole }) {
  const { language, isRtl } = useLanguage();
  const [selectedRole, setSelectedRole] = useState('booster');

  const isFa = language === 'fa';

  const handleConfirm = () => {
    setActiveProfileId(selectedRole);
    if (onSelectRole) {
      onSelectRole(selectedRole);
    } else if (onComplete) {
      onComplete(selectedRole);
    }
  };

  const ROLES = [
    {
      id: 'booster',
      title: isFa ? 'بوستر' : 'Booster',
      badge: isFa ? '⚡ بوستر' : '⚡ Booster',
      icon: Zap,
      tagline: isFa
        ? 'ثبت سفارش‌های بازی، تقسیم پات با هم‌تیمی‌ها و اسکرین‌شات اثبات کار'
        : 'Track gaming orders, split runs with teammates, and log proof of work.',
      features: isFa
        ? ['محاسبه سهم تیمی و سهم شخصی', 'پشتیبانی از پات و ورودی دلخواه', 'افزودن سریع (Quick Add)']
        : ['Solo & Team Run splits', 'Flexible Pot & Cut calculations', 'Quick Add (Q) shortcut'],
    },
    {
      id: 'advertiser',
      title: isFa ? 'ادورتایزر' : 'Advertiser',
      badge: isFa ? '📢 ادورتایزر' : '📢 Advertiser',
      icon: Megaphone,
      tagline: isFa
        ? 'مدیریت سفارش مشتریان، اختصاص کار به بوسترها و ردیابی کمیسیون'
        : 'Manage client orders, assign jobs to boosters, track commissions & payouts.',
      features: isFa
        ? ['شناسه سفارش (Order ID) از سایت‌ها', 'محاسبه دوطرفه کمیسیون و سهم بوستر', 'تسوّیه وضعیت دریافت از سورس و پرداخت بوستر']
        : ['Marketplace Order IDs', 'Bidirectional fee & payout calculator', 'Dual source receipt & booster settlement'],
    },
  ];

  return (
    <Dialog open={isOpen} onClose={() => {}} maxWidth="max-w-xl">
      <DialogContent className="p-6 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm mb-1">
            <CheckpointLogo className="w-7 h-7 text-zinc-900 dark:text-zinc-100" />
          </div>
          <h2 className={cn('text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight', isRtl && 'font-farsi')}>
            {isFa ? 'به چک‌پوینت خوش آمدید' : 'Welcome to CHECKPOINT'}
          </h2>
          <p className={cn('text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed', isRtl && 'font-farsi')}>
            {isFa
              ? 'برای شروع، نقش اولیه خود را انتخاب کنید. همیشه می‌توانید بین پروفایل‌ها جابه‌جا شوید یا از هر دو استفاده کنید.'
              : 'Choose your primary role to customize your workspace and financial tools. You can switch or use both anytime.'}
          </p>
        </div>

        {/* Interactive Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.id;
            const Icon = role.icon;
            return (
              <motion.button
                key={role.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  'relative text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none',
                  isRtl && 'text-right',
                  isSelected
                    ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border-zinc-800 dark:border-zinc-200 shadow-md ring-1 ring-zinc-700/50 dark:ring-zinc-300/50'
                    : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
                )}
              >
                {/* Checkmark indicator */}
                <div className="flex items-center justify-between mb-3 w-full">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center border shrink-0',
                      isSelected
                        ? 'bg-zinc-800 text-zinc-100 border-zinc-700 dark:bg-white dark:text-zinc-900 dark:border-zinc-300'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center border transition-colors',
                      isSelected
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'border-zinc-300 dark:border-zinc-700 opacity-40'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* Title & Tagline */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-sm font-bold tracking-tight', isRtl && 'font-farsi')}>{role.title}</span>
                  </div>
                  <p
                    className={cn(
                      'text-[11px] leading-relaxed',
                      isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400',
                      isRtl && 'font-farsi'
                    )}
                  >
                    {role.tagline}
                  </p>
                </div>

                {/* Feature checklist */}
                <ul className="mt-3 pt-3 border-t border-zinc-200/20 dark:border-zinc-700/30 space-y-1 text-[10px]">
                  {role.features.map((feat, idx) => (
                    <li
                      key={idx}
                      className={cn(
                        'flex items-center gap-1.5',
                        isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400',
                        isRtl && 'font-farsi'
                      )}
                    >
                      <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </motion.button>
            );
          })}
        </div>

        {/* Footer & Continue Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800">
          <p className={cn('text-[11px] text-zinc-400 dark:text-zinc-500 text-center sm:text-left', isRtl && 'font-farsi sm:text-right')}>
            {isFa
              ? 'تغییر پروفایل در هر زمان با کلیک روی نام چک‌پوینت یا با میانبر Ctrl+Shift+P امکان‌پذیر است.'
              : 'Switch profiles anytime from the top bar or via Ctrl+Shift+P.'}
          </p>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            className={cn('w-full sm:w-auto px-6 h-9 gap-1.5 font-medium shadow-sm', isRtl && 'font-farsi')}
          >
            <span>{isFa ? 'شروع کار' : 'Get Started'}</span>
            <ArrowRight className={cn('w-3.5 h-3.5', isRtl && 'rotate-180')} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
