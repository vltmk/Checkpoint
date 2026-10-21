import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { trackerDB } from './db';
import { LEDGER_STRINGS } from './ledger/strings';

/**
 * Digit Conversion Helpers
 */
export function toPersianDigits(input) {
  if (input === null || input === undefined || input === '') return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
}

export function normalizeDigits(input) {
  if (!input) return '';
  const str = String(input);
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Solar Hijri (Shamsi) Date & Time Formatters
 */
export function formatShamsiDate(dateInput, options = {}) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d?.getTime())) return String(dateInput);

  const defaultOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
}

export function formatShamsiDateTime(dateInput, options = {}) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d?.getTime())) return String(dateInput);

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

/**
 * Visual Date Format Presets for Ledger Grouping
 */
export const LEDGER_DATE_FORMAT_OPTIONS = [
  { id: 'relative', labelKey: 'settings.dateFormat.relative', labelEn: 'Relative (Today, Yesterday)', labelFa: 'نسبی (امروز، دیروز)' },
  { id: 'yyyy-mm-dd', labelKey: 'settings.dateFormat.yyyyMmDd', labelEn: 'YYYY-MM-DD', labelFa: 'سال-ماه-روز' },
  { id: 'dd-mm-yyyy', labelKey: 'settings.dateFormat.ddMmYyyy', labelEn: 'DD/MM/YYYY', labelFa: 'روز/ماه/سال' },
  { id: 'mm-dd-yyyy', labelKey: 'settings.dateFormat.mmDdYyyy', labelEn: 'MM/DD/YYYY', labelFa: 'ماه/روز/سال' },
  { id: 'month-d-yyyy', labelKey: 'settings.dateFormat.monthDYyyy', labelEn: 'Month D, YYYY', labelFa: 'نام ماه و روز، سال' },
];

export function formatLedgerGroupDate(dateInput, formatId = 'relative', language = 'en', t) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d?.getTime())) return String(dateInput);

  if (!formatId || formatId === 'relative') {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toDateString();
    const dStr = d.toDateString();

    if (dStr === todayStr) {
      return t ? t('ledger.today', language === 'fa' ? 'امروز' : 'Today') : (language === 'fa' ? 'امروز' : 'Today');
    }
    if (dStr === yesterdayStr) {
      return t ? t('ledger.yesterday', language === 'fa' ? 'دیروز' : 'Yesterday') : (language === 'fa' ? 'دیروز' : 'Yesterday');
    }
    if (language === 'fa') {
      return formatShamsiDate(d, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const isFa = language === 'fa';

  if (isFa) {
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);

      const year = parts.find((p) => p.type === 'year')?.value || '';
      const month = parts.find((p) => p.type === 'month')?.value || '';
      const day = parts.find((p) => p.type === 'day')?.value || '';

      switch (formatId) {
        case 'yyyy-mm-dd':
          return `${year}/${month}/${day}`;
        case 'dd-mm-yyyy':
          return `${day}/${month}/${year}`;
        case 'mm-dd-yyyy':
          return `${month}/${day}/${year}`;
        case 'month-d-yyyy':
          return formatShamsiDate(d, { year: 'numeric', month: 'long', day: 'numeric' });
        default:
          return `${year}/${month}/${day}`;
      }
    } catch (e) {
      return formatShamsiDate(d);
    }
  } else {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    switch (formatId) {
      case 'yyyy-mm-dd':
        return `${year}-${month}-${day}`;
      case 'dd-mm-yyyy':
        return `${day}/${month}/${year}`;
      case 'mm-dd-yyyy':
        return `${month}/${day}/${year}`;
      case 'month-d-yyyy':
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      default:
        return `${year}-${month}-${day}`;
    }
  }
}

export function getDatePatternPreview(formatId, language = 'en', t) {
  const now = new Date();
  if (formatId === 'relative') {
    const rel = t ? t('ledger.today', language === 'fa' ? 'امروز' : 'Today') : (language === 'fa' ? 'امروز' : 'Today');
    const sub = language === 'fa' 
      ? formatShamsiDate(now, { month: 'short', day: 'numeric' })
      : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${rel} (${sub})`;
  }
  return formatLedgerGroupDate(now, formatId, language, t);
}

/**
 * Translations Dictionary (EN & FA)
 */
export const TRANSLATIONS = {
  en: {
    // App & Brand
    appName: 'CHECKPOINT',
    tagline: 'High-density desktop ledger for digital workers & gamers',

    // Navigation & Tabs

    // Statuses
    'status.Paid': 'Paid',
    'status.Pending': 'Complete',
    'status.Working': 'Working',
    'status.On Hold': 'On Hold',
    'status.Failed': 'Failed',
    'status.Cancelled': 'Cancelled',
    'status.all': 'All',

    // Ledger Summary & KPIs
    'ledger.delete': 'Delete',
    'ledger.dismiss': 'Dismiss',

    // Analytics View
    'categories.supportsGold': 'Enable in-game Gold & conversion rate',
    'categories.supportsGoldDesc': 'Allow recording in Gold with live conversion rates for this category',

    // Work Modal
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',

    // Quick Add Modal

    // Settings Modal
    'settings.title': 'Settings & Data',
    'settings.tabGeneral': 'General',
    'settings.tabAppearance': 'Appearance',
    'settings.tabSystem': 'System',
    'settings.tabBackups': 'Backups & Data',
    'settings.tabAbout': 'About & Updates',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose interface language and number formatting',
    'settings.currency': 'Default Display Currency',
    'settings.currencyDesc': 'Primary currency for dashboard metrics and charts',
    'settings.ledgerDateFormat': 'Ledger Date Format',
    'settings.ledgerDateFormatDesc': 'Visual format for daily grouping headers in the ledger',
    'settings.dateFormat.relative': 'Relative (Today, Yesterday)',
    'settings.dateFormat.yyyyMmDd': 'YYYY-MM-DD',
    'settings.dateFormat.ddMmYyyy': 'DD/MM/YYYY',
    'settings.dateFormat.mmDdYyyy': 'MM/DD/YYYY',
    'settings.dateFormat.monthDYyyy': 'Month D, YYYY',
    'settings.closeToTray': 'Close to System Tray',
    'settings.closeToTrayDesc': 'Keep application running in background when closed',
    'settings.minimizeToTray': 'Minimize to System Tray',
    'settings.minimizeToTrayDesc': 'Hide window to tray when minimized instead of taskbar',
    'settings.autoBackups': 'Scheduled Auto-Backups',
    'settings.autoBackupsDesc': 'Automatically create timestamped JSON backups at intervals',
    'settings.browse': 'Browse',
    'settings.backupNow': 'Backup Now',
    'settings.frequency': 'Backup Frequency',
    'settings.retention': 'Retention Limit',
    'settings.snapshots': 'Automatic Recovery Snapshots',
    'settings.snapshotsDesc': 'Pre-modification emergency restore points (Survives accidents)',
    'settings.restore': 'Restore',
    'settings.restoreSnapshotConfirm': 'Restore database from this snapshot? Current unsaved modifications will be replaced.',
    'settings.updateAvailable': 'Update available',
    'settings.upToDate': 'Checkpoint is up to date',
    'settings.checking': 'Checking...',
    'settings.checkNow': 'Check for Updates',
    'settings.telemetry': 'Anonymous Usage Analytics',
    'settings.telemetryLabel': 'Share Anonymous Metrics',
    'settings.telemetryDesc': 'Transmits zero financial, client, or ledger data. Only anonymous daily usage counts and app launch events are reported to improve Checkpoint.',
    'settings.dataPortability': 'Data Portability',
    'settings.fullJsonBackup': 'Export Full Backup (JSON)',
    'settings.restoreJson': 'Restore Database (JSON)',
    'settings.exportCsv': 'Export Ledger (CSV)',
    'settings.dangerZone': 'Danger Zone',
    'settings.clearAll': 'Clear All Records',
    'settings.clearAllData': 'Clear All Ledger Data',
    'settings.clearAllDataDesc': 'Permanently erase all work records, teammates, and settings',
    'settings.shortcuts': 'Keyboard Shortcuts Cheat Sheet',

    // Receipt Modal

    // Notification Center
    'notifications.title': 'Notifications & Feed',
    'notifications.readAll': 'Read all',
    'notifications.all': 'All',
    'notifications.unread': 'Unread',
    'notifications.releases': 'Releases',
    'notifications.announcements': 'Feed',
    'notifications.tabAll': 'All',
    'notifications.tabUpdates': 'Updates',
    'notifications.tabAnnouncements': 'Feed',
    'notifications.markAllRead': 'Mark all as read',
    'notifications.empty': 'No notifications',
    'notifications.emptyDesc': 'No active announcements or updates at this time.',
    'notifications.noUnread': 'No unread notifications',
    'notifications.noUnreadDesc': 'All announcements and release notes have been read.',
    'notifications.whatsNew': "What's New",
    'notifications.viewChangelog': 'View Changelog',
    'notifications.tagNew': 'NEW',
    'notifications.tagImproved': 'IMPROVED',
    'notifications.tagFix': 'FIX',

    // Update Modal
    'update.title': 'Software Update Available',
    'update.currentVersion': 'Current Version',
    'update.newVersion': 'New Version',
    'update.releaseNotes': "What's New",
    'update.downloading': 'Downloading update...',
    'update.readyRestart': 'Update ready to install',
    'update.installNow': 'Update Now',
    'update.retry': 'Retry',
    'update.securityBlockedTitle': 'Blocked by Windows Security',
    'update.securityBlockedDesc': 'Windows Smart App Control or system policy blocked the silent background update. You can update safely by downloading and running the standalone installer.',
    'update.settingsPreserved': 'All your data and settings will be preserved.',
    'update.downloadInstaller': 'Download Installer (.exe)',

    // Common Buttons & Tooltips
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.search': 'Search or filter...',
    'a11y.clearStatusFilter': 'Clear status filter',
    'a11y.clearSearch': 'Clear search',
    'a11y.clearGameSearch': 'Clear game search',
    'a11y.resetToActiveRate': 'Reset to active rate',
    'a11y.dismissCustomRate': 'Dismiss and use default rate',
    'common.done': 'Done',
    'common.open': 'Open',
    'common.now': 'Now',
    'common.today': 'Today',
    'common.yesterday': 'Yesterday',
    'common.hourAgo': '-1 hour ago',
    'common.quickPresets': 'Quick Presets',

    // Calendar & DateTime Picker
    'calendar.shamsi': 'Shamsi',
    'calendar.gregorian': 'Gregorian',
    'calendar.time': 'Time',
    'calendar.hour': 'Hour',
    'calendar.minute': 'Min',
    'calendar.year': 'Year',
    'calendar.month': 'Month',
    'calendar.pickDate': 'Select Date',
    'calendar.today': 'Today',

    // Categories & Custom Games
    'categories.title': 'Categories & Games',
    'categories.desc': 'Custom game icons, colors, and ledger row themes',
    'categories.addCategory': 'Add Category',
    'categories.newCategory': 'Add Category / Game',
    'categories.editCategory': 'Edit Category',
    'categories.categoryName': 'Category / Game Name',
    'categories.nameRequired': 'Category name is required',
    'categories.accentColor': 'Accent Color',
    'categories.uploadIcon': 'Upload Icon',
    'categories.changeIcon': 'Change',
    'categories.editImage': 'Edit Image',
    'categories.selectOrDrop': 'Select or drop an image',
    'categories.pasteSupported': 'PNG, JPG, WebP or Ctrl+V to paste',
    'categories.changeImage': 'Change Image',
    'categories.extractedFromIcon': 'From Icon',
    'categories.rowPreview': 'Ledger Row Preview',
    'categories.untitledCategory': 'Category Name',
    'categories.newCategoryOption': 'Add / Manage Categories...',
    'categories.deleteConfirm': 'Delete this category? Existing ledger entries will keep their game name.',
    'categories.pasteHint': 'Tip: You can press Ctrl+V to paste an icon from clipboard.',

    // Context Menu
    'contextMenu.toggleCurrency': 'Toggle Currency',
    'contextMenu.exportBackups': 'Export & Backups...',
    'contextMenu.reload': 'Reload App',
    'contextMenu.theme': 'Theme',
    'contextMenu.themeDark': 'Dark',
    'contextMenu.themeLight': 'Light',
    'contextMenu.language': 'Language',
    'contextMenu.langEn': 'English',
    'contextMenu.langFa': 'فارسی',
    'contextMenu.shortcuts': 'Shortcuts',
  },

  fa: {
    // App & Brand
    appName: 'CHECKPOINT',
    tagline: 'دفتر کل و مدیریت مالی متراکم برای فریلنسرها و گیمرها',

    // Navigation & Tabs

    // Statuses
    'status.Paid': 'پرداخت شده',
    'status.Pending': 'تکمیل شده',
    'status.Working': 'درحال انجام',
    'status.On Hold': 'توقف موقت',
    'status.Failed': 'ناموفق',
    'status.Cancelled': 'لغو شده',
    'status.all': 'همه',

    // Ledger Summary & KPIs
    'ledger.delete': 'حذف',
    'ledger.dismiss': 'انصراف',

    // Analytics View
    'categories.supportsGold': 'پشتیبانی از گلد و نرخ تبدیل',
    'categories.supportsGoldDesc': 'امکان ثبت با واحد گلد و نرخ تبدیل زنده برای این بازی',

    // Work Modal
    'settings.theme': 'پوسته',
    'settings.themeDark': 'تیره',
    'settings.themeLight': 'روشن',

    // Quick Add Modal

    // Settings Modal
    'settings.title': 'تنظیمات و مدیریت داده‌ها',
    'settings.tabGeneral': 'عمومی',
    'settings.tabAppearance': 'ظاهر و گرافیک',
    'settings.tabSystem': 'سیستم و میزکار',
    'settings.tabBackups': 'پشتیبان‌گیری و داده‌ها',
    'settings.tabAbout': 'درباره و بروزرسانی',
    'settings.language': 'زبان برنامه',
    'settings.languageDesc': 'انتخاب زبان رابط کاربری و تقویم (فارسی / انگلیسی)',
    'settings.currency': 'ارز پیش‌فرض نمایش',
    'settings.currencyDesc': 'ارز اصلی برای داشبورد، کارت‌ها و نمودارها',
    'settings.closeToTray': 'بستن به سیستم تری',
    'settings.closeToTrayDesc': 'با بستن برنامه، پردازش در پس‌زمینه ویندوز فعال می‌ماند',
    'settings.minimizeToTray': 'مینیمایز به سیستم تری',
    'settings.minimizeToTrayDesc': 'با مینیمایز کردن، آیکون به سیستم تری منتقل می‌شود',
    'settings.autoBackups': 'پشتیبان‌گیری خودکار زمان‌بندی‌شده',
    'settings.autoBackupsDesc': 'ایجاد خودکار نسخه‌های پشتیبان JSON در فواصل منظم',
    'settings.browse': 'انتخاب مسیر',
    'settings.backupNow': 'پشتیبان‌گیری دستی',
    'settings.frequency': 'دوره تکرار پشتیبان‌گیری',
    'settings.retention': 'حداکثر تعداد فایل‌های نگهداری‌شده',
    'settings.snapshots': 'اسنپ‌شات‌های بازیابی خودکار',
    'settings.snapshotsDesc': 'نقاط بازگشت اضطراری قبل از هر تغییر (بازیابی سریع)',
    'settings.restore': 'بازیابی',
    'settings.restoreSnapshotConfirm': 'آیا مایل به بازیابی پایگاه‌داده از این اسنپ‌شات هستید؟ تغییرات ذخیره‌نشده فعلی جایگزین خواهند شد.',
    'settings.updateAvailable': 'به‌روزرسانی جدید موجود است',
    'settings.upToDate': 'شما از آخرین نسخه چک‌پوینت استفاده می‌کنید',
    'settings.checking': 'در حال بررسی...',
    'settings.checkNow': 'بررسی به‌روزرسانی',
    'settings.telemetry': 'آمار و تحلیل‌های ناشناس',
    'settings.telemetryLabel': 'اشتراک‌گذاری آمار ناشناس کارکرد',
    'settings.telemetryDesc': 'هیچ‌گونه اطلاعات مالی، مشتری، دستمزد یا اسامی کارها ارسال نمی‌شود. صرفاً تعداد دفعات استفاده و وضعیت اجرای برنامه جهت بهبود ارسال می‌گردد.',
    'settings.dataPortability': 'انتقال و خروجی داده‌ها',
    'settings.fullJsonBackup': 'خروجی پشتیبان کامل (JSON)',
    'settings.restoreJson': 'بازیابی از فایل پشتیبان (JSON)',
    'settings.exportCsv': 'خروجی اکسل (CSV)',
    'settings.dangerZone': 'بخش حساس و پاکسازی',
    'settings.clearAll': 'پاکسازی کامل تمام اطلاعات',
    'settings.clearAllData': 'پاکسازی کامل تمام اطلاعات',
    'settings.clearAllDataDesc': 'حذف دائمی تمام رکوردهای مالی ذخیره شده روی دستگاه',
    'settings.shortcuts': 'مشاهده کلیدهای میانبر کیبورد',

    // Receipt Modal
    'settings.ledgerDateFormat': 'فرمت تاریخ سرستون‌های دفتر کار',
    'settings.ledgerDateFormatDesc': 'نحوه نمایش تاریخ گروه‌بندی روزانه در دفتر کار',
    'settings.dateFormat.relative': 'نسبی (امروز، دیروز)',
    'settings.dateFormat.yyyyMmDd': 'سال-ماه-روز (YYYY-MM-DD)',
    'settings.dateFormat.ddMmYyyy': 'روز/ماه/سال (DD/MM/YYYY)',
    'settings.dateFormat.mmDdYyyy': 'ماه/روز/سال (MM/DD/YYYY)',
    'settings.dateFormat.monthDYyyy': 'نام ماه و روز، سال',

    // Notification Center
    'notifications.title': 'اعلانات و رویدادها',
    'notifications.readAll': 'خواندن همه',
    'notifications.all': 'همه',
    'notifications.unread': 'خوانده‌نشده',
    'notifications.releases': 'نسخه‌ها',
    'notifications.announcements': 'اخبار',
    'notifications.tabAll': 'همه',
    'notifications.tabUpdates': 'به‌روزرسانی‌ها',
    'notifications.tabAnnouncements': 'اخبار',
    'notifications.markAllRead': 'علامت‌گذاری همه به عنوان خوانده شده',
    'notifications.empty': 'هیچ اعلانی وجود ندارد',
    'notifications.emptyDesc': 'در حال حاضر پیام یا به‌روزرسانی جدیدی نیست.',
    'notifications.noUnread': 'پیام خوانده‌نشده‌ای ندارید',
    'notifications.noUnreadDesc': 'شما تمام اخبار و اعلان‌های برنامه را مشاهده کرده‌اید.',
    'notifications.whatsNew': 'امکانات و تغییرات جدید',
    'notifications.viewChangelog': 'مشاهده لیست تغییرات',
    'notifications.tagNew': 'جدید',
    'notifications.tagImproved': 'بهبودیافته',
    'notifications.tagFix': 'رفع باگ',

    // Update Modal
    'update.title': 'به‌روزرسانی نرم‌افزار موجود است',
    'update.currentVersion': 'نسخه فعلی',
    'update.newVersion': 'نسخه جدید',
    'update.releaseNotes': 'تغییرات نسخه جدید',
    'update.downloading': 'درحال دانلود به‌روزرسانی...',
    'update.readyRestart': 'آماده نصب و راه‌اندازی مجدد',
    'update.installNow': 'دانلود و نصب',
    'update.retry': 'تلاش مجدد',
    'update.securityBlockedTitle': 'مسدود شده توسط امنیت ویندوز',
    'update.securityBlockedDesc': 'سیستم Smart App Control یا سیاست‌های امنیتی ویندوز مانع اجرای خودکار نصب‌کننده شدند. می‌توانید با دریافت فایل نصبی، به‌روزرسانی را دستی انجام دهید.',
    'update.settingsPreserved': 'تمامی داده‌ها و تنظیمات شما بدون تغییر حفظ خواهند شد.',
    'update.downloadInstaller': 'دریافت فایل نصبی (.exe)',

    // Common Buttons & Tooltips
    'common.save': 'ذخیره',
    'common.cancel': 'انصراف',
    'common.confirm': 'تایید',
    'common.delete': 'حذف',
    'common.edit': 'ویرایش',
    'common.close': 'بستن',
    'common.search': 'جستجو یا فیلتر...',
    'a11y.clearStatusFilter': 'پاک کردن فیلتر وضعیت',
    'a11y.clearSearch': 'پاک کردن جستجو',
    'a11y.clearGameSearch': 'پاک کردن جستجوی بازی',
    'a11y.resetToActiveRate': 'بازنشانی به نرخ فعال',
    'a11y.dismissCustomRate': 'بستن و استفاده از نرخ پیش‌فرض',
    'common.done': 'تایید',
    'common.open': 'باز کردن',
    'common.now': 'اکنون',
    'common.today': 'امروز',
    'common.yesterday': 'دیروز',
    'common.hourAgo': '۱ ساعت قبل',
    'common.quickPresets': 'دسترسی سریع',

    // Calendar & DateTime Picker
    'calendar.shamsi': 'شمسی',
    'calendar.gregorian': 'میلادی',
    'calendar.time': 'زمان',
    'calendar.hour': 'ساعت',
    'calendar.minute': 'دقیقه',
    'calendar.year': 'سال',
    'calendar.month': 'ماه',
    'calendar.pickDate': 'انتخاب تاریخ',
    'calendar.today': 'امروز',

    // Categories & Custom Games
    'categories.title': 'دسته‌بندی‌ها و بازی‌ها',
    'categories.desc': 'آیکون، رنگ‌های اختصاصی و قالب ردیف‌های دفتر کل',
    'categories.addCategory': 'افزودن دسته‌بندی',
    'categories.newCategory': 'افزودن دسته‌بندی / بازی جدید',
    'categories.editCategory': 'ویرایش دسته‌بندی',
    'categories.categoryName': 'نام دسته‌بندی یا بازی',
    'categories.nameRequired': 'وارد کردن نام دسته‌بندی الزامی است',
    'categories.accentColor': 'رنگ شاخص',
    'categories.uploadIcon': 'آپلود آیکون',
    'categories.changeIcon': 'تغییر',
    'categories.editImage': 'ویرایش تصویر',
    'categories.selectOrDrop': 'انتخاب یا رها کردن تصویر',
    'categories.pasteSupported': 'پشتیبانی از PNG، JPG و Ctrl+V',
    'categories.changeImage': 'تغییر تصویر',
    'categories.extractedFromIcon': 'از آیکون',
    'categories.rowPreview': 'پیش‌نمایش در دفتر کل',
    'categories.untitledCategory': 'نام دسته‌بندی',
    'categories.newCategoryOption': 'افزودن و مدیریت دسته‌بندی‌ها...',
    'categories.deleteConfirm': 'این دسته‌بندی حذف شود؟ سوابق موجود در دفتر کل نام بازی را حفظ خواهند کرد.',
    'categories.pasteHint': 'نکته: می‌توانید با فشردن Ctrl+V تصویر را از کلیپ‌بورد الصاق کنید.',

    // Context Menu
    'contextMenu.toggleCurrency': 'تغییر ارز نمایش',
    'contextMenu.exportBackups': 'پشتیبان‌گیری و خروجی...',
    'contextMenu.reload': 'تازه‌سازی نرم‌افزار',
    'contextMenu.theme': 'پوسته ظاهری',
    'contextMenu.themeDark': 'تاریک',
    'contextMenu.themeLight': 'روشن',
    'contextMenu.language': 'زبان',
    'contextMenu.langEn': 'English',
    'contextMenu.langFa': 'فارسی',
    'contextMenu.shortcuts': 'کلیدهای میانبر',
  },
};

// v2 ledger screens keep their text in one file so it can be reviewed in a single pass
Object.assign(TRANSLATIONS.en, LEDGER_STRINGS.en);
Object.assign(TRANSLATIONS.fa, LEDGER_STRINGS.fa);

/**
 * Language Context & Provider
 */
const LanguageContext = createContext({
  language: 'fa',
  setLanguage: () => {},
  t: (key) => key,
  isRtl: true,
  formatNumber: (n) => String(n),
  formatDate: (d, opts) => '',
  formatDateTime: (d, opts) => '',
  toPersianDigits: (n) => String(n),
  normalizeDigits: (s) => String(s),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('checkpoint_language');
      if (saved === 'en' || saved === 'fa') return saved;
      return 'fa';
    } catch (e) {
      return 'fa';
    }
  });

  // Hydrate language preference from SQLite trackerDB on launch
  useEffect(() => {
    trackerDB.getSetting('checkpoint_language', null).then((saved) => {
      if (saved && (saved === 'en' || saved === 'fa') && saved !== language) {
        setLanguageState(saved);
        try {
          localStorage.setItem('checkpoint_language', saved);
        } catch (e) {}
      }
    }).catch(() => {});
  }, []);

  const setLanguage = useCallback((newLang) => {
    const validLang = newLang === 'en' ? 'en' : 'fa';
    setLanguageState(validLang);
    try {
      localStorage.setItem('checkpoint_language', validLang);
      trackerDB.setSetting('checkpoint_language', validLang).catch(() => {});
    } catch (e) {}
  }, []);

  const isRtl = language === 'fa';

  // Sync document root lang and direction
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    if (isRtl) {
      document.body.classList.add('font-farsi');
    } else {
      document.body.classList.remove('font-farsi');
    }
  }, [language, isRtl]);

  const t = useCallback(
    (key, fallback = '') => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.fa;
      return dict[key] !== undefined ? dict[key] : (TRANSLATIONS.en[key] !== undefined ? TRANSLATIONS.en[key] : fallback || key);
    },
    [language]
  );

  const formatNumber = useCallback(
    (num, isGold = false) => {
      if (num === null || num === undefined || num === '') return '';
      if (language === 'fa' && !isGold) {
        return toPersianDigits(num);
      }
      return String(num);
    },
    [language]
  );

  const formatDate = useCallback(
    (dateInput, options = {}) => {
      if (!dateInput) return '';
      if (language === 'fa') {
        return formatShamsiDate(dateInput, options);
      }
      const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
      if (isNaN(d?.getTime())) return String(dateInput);
      return d.toLocaleDateString('en-US', options);
    },
    [language]
  );

  const formatDateTime = useCallback(
    (dateInput, options = {}) => {
      if (!dateInput) return '';
      if (language === 'fa') {
        return formatShamsiDateTime(dateInput, options);
      }
      const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
      if (isNaN(d?.getTime())) return String(dateInput);
      return d.toLocaleString('en-US', options);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isRtl,
      formatNumber,
      formatDate,
      formatDateTime,
      formatLedgerGroupDate: (d, fmtId) => formatLedgerGroupDate(d, fmtId, language, t),
      getDatePatternPreview: (fmtId) => getDatePatternPreview(fmtId, language, t),
      ledgerDateFormatOptions: LEDGER_DATE_FORMAT_OPTIONS,
      toPersianDigits,
      normalizeDigits,
    }),
    [language, setLanguage, t, isRtl, formatNumber, formatDate, formatDateTime]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageProvider;
