import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { trackerDB } from './db';

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
 * Translations Dictionary (EN & FA)
 */
export const TRANSLATIONS = {
  en: {
    // App & Brand
    appName: 'CHECKPOINT',
    tagline: 'High-density desktop ledger for digital workers & gamers',

    // Navigation & Tabs
    'nav.ledger': 'Ledger',
    'nav.analytics': 'Analytics',
    'nav.addWork': 'Add work',
    'nav.quickAdd': 'Quick add',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    'nav.shortcuts': 'Shortcuts',
    'nav.rates': 'Rates & Exchange',
    'nav.displayInToman': 'Display in Toman',
    'nav.displayInGold': 'Display in Gold',

    // Statuses
    'status.Paid': 'Paid',
    'status.Pending': 'Pending',
    'status.Working': 'Working',
    'status.On Hold': 'On Hold',
    'status.Cancelled': 'Cancelled',
    'status.all': 'All',

    // Ledger Summary & KPIs
    'ledger.totalEarned': 'Total Earned',
    'ledger.jobsDone': 'Jobs Done',
    'ledger.pendingPayout': 'Pending Payout',
    'ledger.averageRate': 'Average Rate',
    'ledger.paidSummary': 'Paid',
    'ledger.pendingSummary': 'Pending',
    'ledger.filtered': 'Filtered',
    'ledger.clearFilters': 'Clear active filters',
    'ledger.clearFilter': 'Clear active filters',
    'ledger.today': 'Today',
    'ledger.yesterday': 'Yesterday',
    'ledger.earlier': 'Earlier',
    'ledger.daySubtotal': 'Day Subtotal',
    'ledger.dayTotal': 'Day Total',
    'ledger.selectedDays': 'Selected Days',
    'ledger.pot': 'Pot',
    'ledger.shares': 'shares',
    'ledger.team': 'Team',
    'ledger.yourShare': 'Your Share',
    'ledger.proof': 'Proof',
    'ledger.gold': 'Gold',
    'ledger.toman': 'Toman',
    'ledger.searchAndFilters': 'Search & Filters',
    'ledger.searchPlaceholder': 'Search jobs, notes, teammates, dates...',
    'ledger.sortBy': 'Sort by',
    'ledger.sortDateDesc': 'Newest First',
    'ledger.sortDateAsc': 'Oldest First',
    'ledger.sortIncomeDesc': 'Highest Income',
    'ledger.sortIncomeAsc': 'Lowest Income',
    'ledger.filterGame': 'Filter by Game',
    'ledger.allGames': 'All Games',
    'ledger.emptyTitle': 'No work records found',
    'ledger.emptyDesc': 'Add your first work record or adjust your active search filters.',
    'ledger.noJobsMatch': 'No work records match your search or active filters.',
    'ledger.addFirstRecord': 'Add Work Record',
    'ledger.records': 'records',
    'ledger.record': 'record',
    'ledger.job': 'job',
    'ledger.jobs': 'jobs',
    'ledger.day': 'Day',
    'ledger.days': 'Days',
    'ledger.previous': 'Previous',
    'ledger.next': 'Next',
    'ledger.select': 'Select Mode',
    'ledger.selected': 'Selected',
    'ledger.sum': 'Sum',
    'ledger.bulkStatus': 'Status',
    'ledger.bulkCsv': 'CSV',
    'ledger.bulkCsvTooltip': 'Export selected records to CSV',
    'ledger.bulkDelete': 'Delete',
    'ledger.bulkClear': 'Deselect',
    'ledger.deleteConfirmTitle': 'Delete record?',
    'ledger.deleteConfirmDesc': 'This action cannot be undone.',
    'ledger.delete': 'Delete',
    'ledger.cancel': 'Cancel',
    'ledger.edit': 'Edit Record',
    'ledger.duplicate': 'Duplicate',
    'ledger.clientReceipt': 'Client Receipt',
    'ledger.attachProofPrompt': 'Marked as Paid! Would you like to attach screenshot proof?',
    'ledger.attachProof': 'Attach Proof',
    'ledger.dismiss': 'Dismiss',
    'ledger.copied': 'Copied!',
    'ledger.copy': 'Copy',
    'ledger.copySum': 'Copy Sum',
    'ledger.copyTooltip': 'Copy sum to clipboard',
    'ledger.clearSelection': 'Clear day selection',
    'ledger.deselectDayTitle': 'Click to deselect earnings',
    'ledger.selectDayTitle': 'Click to select and sum earnings',

    // Analytics View
    'analytics.title': 'Analytics & Velocity',
    'analytics.daily': 'Daily',
    'analytics.weekly': 'Weekly',
    'analytics.monthly': 'Monthly',
    'analytics.allTime': 'All-Time',
    'analytics.timeframe.daily': 'Daily',
    'analytics.timeframe.weekly': 'Weekly',
    'analytics.timeframe.monthly': 'Monthly',
    'analytics.timeframe.all': 'All-Time',
    'analytics.last14Days': 'Last 14 Days',
    'analytics.last8Weeks': 'Last 8 Weeks',
    'analytics.last6Months': 'Last 6 Months',
    'analytics.allRecordedData': 'All Recorded Data',
    'analytics.window.daily': 'Last 14 Days',
    'analytics.window.weekly': 'Last 8 Weeks',
    'analytics.window.monthly': 'Last 6 Months',
    'analytics.window.all': 'All Recorded Data',
    'analytics.totalEarned': 'Total Earned',
    'analytics.averageJob': 'Average Job',
    'analytics.jobsDone': 'Jobs Done',
    'analytics.completionRate': 'Completion Rate',
    'analytics.kpi.totalEarned': 'Total Earned',
    'analytics.kpi.averageJob': 'Average Job',
    'analytics.kpi.paidJobs': 'Jobs Done',
    'analytics.kpi.completionRate': 'Completion Rate',
    'analytics.velocity.daily': 'Daily Earnings Velocity (14-Day)',
    'analytics.velocity.weekly': 'Weekly Earnings Velocity (8-Week)',
    'analytics.velocity.monthly': 'Monthly Earnings Velocity (6-Month)',
    'analytics.velocity.all': 'All-Time Earnings Velocity',
    'analytics.revenueByGame': 'Revenue by Game',
    'analytics.topGames': 'Top Games Breakdown',
    'analytics.topGamesBreakdown': 'Top Games Breakdown',
    'analytics.periodShare': 'Period Share',
    'analytics.noData': 'No recorded jobs in this period',
    'analytics.noDataPeriod': 'No recorded jobs in this period',
    'analytics.gamesCount': 'games',
    'analytics.gameCount': 'game',

    // Work Modal
    'work.addTitle': 'Add Work Record',
    'work.editTitle': 'Edit Work Record',
    'work.newBadge': 'NEW',
    'work.editBadge': 'EDIT',
    'work.draftRestored': 'Draft Restored',
    'work.gamePlatform': 'Game / Platform',
    'work.customGameOption': 'Custom Game / Realm',
    'work.customGamePlaceholder': 'Custom game or realm name...',
    'work.sellerSource': 'Job Source / Seller',
    'work.workTitle': 'Work Title',
    'work.titlePlaceholder': 'e.g. Mythic +10 Boost, Raid Carry, Addon Commission...',
    'work.dateTime': 'Date & Time',
    'workModal.dateTime': 'Date & Time',
    'work.teamMode': 'Team Split Mode',
    'work.teammatesCrew': 'Teammates Crew',
    'work.incomeCurrency': 'Price / Income',
    'work.exchangeRate': 'Conversion Rate',
    'work.notes': 'Client / Boost Notes',
    'work.notesPlaceholder': 'Client discord, character name, specific instructions...',
    'work.link': 'Reference Link / URL',
    'work.linkPlaceholder': 'https://discord.com/channels/... or sheet link',
    'work.proof': 'Attached Proofs',
    'work.clickUpload': 'Click to upload screenshot proof',
    'work.status': 'Status',
    'work.saveRecord': 'Save Record',
    'work.updateRecord': 'Save Changes',
    'ledger.filters': 'Filters',
    'ledger.gameCategories': 'Game Categories',
    'ledger.openLink': 'Open Link',
    'ledger.withProof': 'With proof only',
    'ledger.allCurrencies': 'All Currencies',
    'ledger.allProofs': 'All Proof Statuses',
    'ledger.addScreenshot': 'Add Screenshot',
    'ledger.viewScreenshotProof': 'View screenshot proof',
    'ledger.deleteRecordPrompt': 'Delete "{title}"?',
    'ledger.deleteRecordWarning': 'This work record and any attached screenshot proof will be permanently removed.',
    'ledger.deleteRecordBtn': 'Delete Record',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',

    // Quick Add Modal
    'quickAdd.title': 'Quick Add Work Record',
    'quickAdd.badge': 'QUICK',
    'quickAdd.boostTitle': 'Boost Title',
    'quickAdd.jobTitle': 'Job Title',
    'quickAdd.jobTitlePlaceholder': 'What did you complete?',
    'quickAdd.price': 'Price / Income',
    'quickAdd.priceIncome': 'Price / Income',
    'quickAdd.currency': 'Currency',
    'quickAdd.liveEquivalent': 'Live Equivalent',
    'quickAdd.swap': 'Swap',
    'quickAdd.statusHint': 'Status: Pending · Time: Now',
    'quickAdd.statusNote': 'Status: Pending · Time: Now',
    'quickAdd.submitWith': 'Submit with',
    'quickAdd.submitWithEnter': 'Submit with',
    'quickAdd.cancel': 'Cancel',
    'quickAdd.addRecord': 'Add Record',
    'quickAdd.addNow': 'Quick Add (Enter)',

    // Settings Modal
    'settings.title': 'Settings & Data',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose interface language and number formatting',
    'settings.langFa': 'فارسی (پیش‌فرض)',
    'settings.langEn': 'English',
    'settings.currency': 'Default Display Currency',
    'settings.currencyDesc': 'Primary currency for dashboard metrics and charts',
    'settings.defaultCurrency': 'Default Display Currency',
    'settings.defaultCurrencyDesc': 'Primary currency for dashboard metrics and charts',
    'settings.desktopTray': 'Desktop Window & System Tray',
    'settings.systemTray': 'System Tray',
    'settings.closeToTray': 'Close to System Tray',
    'settings.closeToTrayDesc': 'Keep application running in background when closed',
    'settings.minimizeToTray': 'Minimize to System Tray',
    'settings.minimizeToTrayDesc': 'Hide window to tray when minimized instead of taskbar',
    'settings.autoBackups': 'Scheduled Auto-Backups',
    'settings.autoBackupsDesc': 'Automatically create timestamped JSON backups at intervals',
    'settings.backupFolder': 'Backup Folder',
    'settings.browse': 'Browse',
    'settings.backupNow': 'Backup Now',
    'settings.frequency': 'Backup Frequency',
    'settings.retention': 'Retention Limit',
    'settings.snapshots': 'Automatic Recovery Snapshots',
    'settings.snapshotsDesc': 'Pre-modification emergency restore points (Survives accidents)',
    'settings.restore': 'Restore',
    'settings.restoreSnapshotConfirm': 'Restore database from this snapshot? Current unsaved modifications will be replaced.',
    'settings.updates': 'Updates & Announcements',
    'settings.updateAvailable': 'Update available',
    'settings.upToDate': 'Checkpoint is up to date',
    'settings.checking': 'Checking...',
    'settings.checkNow': 'Check for Updates',
    'settings.checkUpdate': 'Check for Updates',
    'settings.community': 'Community & Contact',
    'settings.privacy': 'Privacy Diagnostics',
    'settings.privacyDesc': 'Anonymous usage diagnostics are local and privacy-first',
    'settings.dataPortability': 'Data Portability',
    'settings.fullJsonBackup': 'Export Full Backup (JSON)',
    'settings.restoreJson': 'Restore Database (JSON)',
    'settings.exportCsv': 'Export Ledger (CSV)',
    'settings.exportCsvDesc': 'Export all jobs with conversions to CSV spreadsheet',
    'settings.exportJson': 'Backup Database (JSON)',
    'settings.exportJsonDesc': 'Create a full portable snapshot of your records',
    'settings.importJson': 'Restore Database (JSON)',
    'settings.importJsonDesc': 'Import and merge/restore records from a JSON file',
    'settings.dangerZone': 'Danger Zone',
    'settings.clearAll': 'Clear All Records',
    'settings.clearAllDesc': 'Permanently delete all ledger entries from local storage',
    'settings.clearAllData': 'Clear All Ledger Data',
    'settings.clearAllDataDesc': 'Permanently erase all work records, teammates, and settings',
    'settings.eraseAllData': 'Erase All Data',
    'settings.eraseWarning': 'This will permanently delete all work records and reset settings. Type DELETE ALL or CLEAR to confirm.',
    'settings.appInfo': 'Application Information',
    'settings.version': 'Version',
    'settings.shortcuts': 'Keyboard Shortcuts Cheat Sheet',
    'settings.done': 'Done',

    // Receipt Modal
    'receipt.title': 'Proof of Work Receipt',
    'receipt.langPersian': 'فارسی (شمسی)',
    'receipt.langEnglish': 'English (Discord)',
    'receipt.receiptId': 'Receipt ID',
    'receipt.date': 'Date & Time',
    'receipt.game': 'Game / Platform',
    'receipt.jobSource': 'Job Source / Seller',
    'receipt.status': 'Status',
    'receipt.amountEarned': 'Amount Earned',
    'receipt.conversionRate': 'Conversion Rate',
    'receipt.copyText': 'Copy Plain Text',
    'receipt.copyDiscord': 'Discord MD',
    'receipt.screenshotTitle': 'Copy receipt screenshot to clipboard (Press C or S)',
    'receipt.print': 'Print Receipt',
    'receipt.close': 'Close',

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

    // Common Buttons & Tooltips
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
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
  },

  fa: {
    // App & Brand
    appName: 'CHECKPOINT',
    tagline: 'دفتر کل و مدیریت مالی متراکم برای فریلنسرها و گیمرها',

    // Navigation & Tabs
    'nav.ledger': 'دفتر کل',
    'nav.analytics': 'تحلیل و آمار',
    'nav.addWork': 'ثبت کار',
    'nav.quickAdd': 'ثبت سریع',
    'nav.settings': 'تنظیمات',
    'nav.notifications': 'اعلان‌ها',
    'nav.shortcuts': 'کلیدهای میانبر',
    'nav.rates': 'نرخ تبدیل و ارزها',
    'nav.displayInToman': 'نمایش به تومان',
    'nav.displayInGold': 'نمایش به گلد',

    // Statuses
    'status.Paid': 'پرداخت شده',
    'status.Pending': 'درحال انتظار',
    'status.Working': 'درحال انجام',
    'status.On Hold': 'توقف موقت',
    'status.Cancelled': 'لغو شده',
    'status.all': 'همه',

    // Ledger Summary & KPIs
    'ledger.totalEarned': 'درآمد کل',
    'ledger.jobsDone': 'تکمیل شده',
    'ledger.pendingPayout': 'در‌انتظار پرداخت',
    'ledger.averageRate': 'نرخ درآمد',
    'ledger.paidSummary': 'پرداخت شده',
    'ledger.pendingSummary': 'درحال انتظار',
    'ledger.filtered': 'فیلتر شده',
    'ledger.clearFilters': 'پاک کردن فیلترهای فعال',
    'ledger.clearFilter': 'پاک کردن فیلترهای فعال',
    'ledger.today': 'امروز',
    'ledger.yesterday': 'دیروز',
    'ledger.earlier': 'قبلی',
    'ledger.daySubtotal': 'درآمد روز',
    'ledger.dayTotal': 'درآمد روز',
    'ledger.selectedDays': 'روزهای انتخاب شده',
    'ledger.pot': 'مجموع کل',
    'ledger.shares': 'سهم',
    'ledger.team': 'تیم',
    'ledger.yourShare': 'سهم شما',
    'ledger.proof': 'مدرک',
    'ledger.gold': 'گلد',
    'ledger.toman': 'تومان',
    'ledger.searchAndFilters': 'جستجو و فیلترها',
    'ledger.searchPlaceholder': 'جستجو در عنوان، یادداشت، هم‌تیمی‌ها، تاریخ...',
    'ledger.sortBy': 'مرتب‌سازی',
    'ledger.sortDateDesc': 'جدیدترین',
    'ledger.sortDateAsc': 'قدیمی‌ترین',
    'ledger.sortIncomeDesc': 'بیشترین درآمد',
    'ledger.sortIncomeAsc': 'کمترین درآمد',
    'ledger.filterGame': 'فیلتر بر اساس بازی',
    'ledger.allGames': 'همه بازی‌ها',
    'ledger.emptyTitle': 'هیچ رکوردی یافت نشد',
    'ledger.emptyDesc': 'اولین کار خود را ثبت کنید یا فیلترهای جستجو را بازنشانی کنید.',
    'ledger.noJobsMatch': 'هیچ کاری مطابق با جستجو یا فیلترهای فعال یافت نشد.',
    'ledger.addFirstRecord': 'ثبت کار جدید',
    'ledger.records': 'مورد',
    'ledger.record': 'مورد',
    'ledger.job': 'کار',
    'ledger.jobs': 'کار',
    'ledger.day': 'روز',
    'ledger.days': 'روز',
    'ledger.previous': 'قبلی',
    'ledger.next': 'بعدی',
    'ledger.select': 'حالت انتخاب',
    'ledger.selected': 'انتخاب شده',
    'ledger.sum': 'مجموع',
    'ledger.bulkStatus': 'وضعیت',
    'ledger.bulkCsv': 'CSV',
    'ledger.bulkCsvTooltip': 'خروجی اکسل (CSV)',
    'ledger.bulkDelete': 'حذف',
    'ledger.bulkClear': 'لغو انتخاب',
    'ledger.deleteConfirmTitle': 'آیا از حذف مطمئن هستید؟',
    'ledger.deleteConfirmDesc': 'این عملیات قابل بازگشت نخواهد بود.',
    'ledger.delete': 'حذف',
    'ledger.cancel': 'انصراف',
    'ledger.edit': 'ویرایش رکورد',
    'ledger.duplicate': 'تکرار رکورد',
    'ledger.clientReceipt': 'رسید مشتری',
    'ledger.attachProofPrompt': 'پرداخت شد! مایل به پیوست مدرک یا اسکرین‌شات هستید؟',
    'ledger.attachProof': 'پیوست مدرک',
    'ledger.dismiss': 'انصراف',
    'ledger.copied': 'کپی شد!',
    'ledger.copy': 'کپی',
    'ledger.copySum': 'کپی مجموع',
    'ledger.copyTooltip': 'کپی مجموع درآمد در کلیپ‌بورد',
    'ledger.clearSelection': 'لغو انتخاب روزها',
    'ledger.deselectDayTitle': 'برای لغو انتخاب درآمد کلیک کنید',
    'ledger.selectDayTitle': 'برای انتخاب و محاسبه مجموع درآمد کلیک کنید',

    // Analytics View
    'analytics.title': 'تحلیل و نمودار درآمد',
    'analytics.daily': 'روزانه',
    'analytics.weekly': 'هفتگی',
    'analytics.monthly': 'ماهانه',
    'analytics.allTime': 'کل دوره',
    'analytics.timeframe.daily': 'روزانه',
    'analytics.timeframe.weekly': 'هفتگی',
    'analytics.timeframe.monthly': 'ماهانه',
    'analytics.timeframe.all': 'کل دوره',
    'analytics.last14Days': '۱۴ روز اخیر',
    'analytics.last8Weeks': '۸ هفته اخیر',
    'analytics.last6Months': '۶ ماه اخیر',
    'analytics.allRecordedData': 'تمام داده‌های ثبت شده',
    'analytics.window.daily': '۱۴ روز اخیر',
    'analytics.window.weekly': '۸ هفته اخیر',
    'analytics.window.monthly': '۶ ماه اخیر',
    'analytics.window.all': 'تمام داده‌های ثبت شده',
    'analytics.totalEarned': 'درآمد کل',
    'analytics.averageJob': 'میانگین درآمد',
    'analytics.jobsDone': 'تکمیل شده',
    'analytics.completionRate': 'نرخ تکمیل',
    'analytics.kpi.totalEarned': 'درآمد کل',
    'analytics.kpi.averageJob': 'میانگین درآمد',
    'analytics.kpi.paidJobs': 'تکمیل شده',
    'analytics.kpi.completionRate': 'نرخ تکمیل',
    'analytics.velocity.daily': 'نمودار سرعت درآمد روزانه (۱۴ روزه)',
    'analytics.velocity.weekly': 'نمودار سرعت درآمد هفتگی (۸ هفته)',
    'analytics.velocity.monthly': 'نمودار سرعت درآمد ماهانه (۶ ماه)',
    'analytics.velocity.all': 'نمودار درآمد کل دوره',
    'analytics.revenueByGame': 'درآمد به تفکیک بازی',
    'analytics.topGames': 'تفکیک برترین بازی‌ها',
    'analytics.topGamesBreakdown': 'تفکیک برترین بازی‌ها',
    'analytics.periodShare': 'سهم در دوره',
    'analytics.noData': 'در این بازه زمانی داده‌ای ثبت نشده است',
    'analytics.noDataPeriod': 'در این بازه زمانی داده‌ای ثبت نشده است',
    'analytics.gamesCount': 'بازی',
    'analytics.gameCount': 'بازی',

    // Work Modal
    'work.addTitle': 'ثبت رکورد کار جدید',
    'work.editTitle': 'ویرایش رکورد کار',
    'work.newBadge': 'جدید',
    'work.editBadge': 'ویرایش',
    'work.draftRestored': 'پیش‌نویس بازیابی شد',
    'work.gamePlatform': 'بازی / پلتفرم',
    'work.customGameOption': 'بازی یا ریلم سفارشی',
    'work.customGamePlaceholder': 'نام بازی یا ریلم سفارشی...',
    'work.sellerSource': 'سورس کار / سفارش‌دهنده',
    'work.workTitle': 'عنوان کار',
    'work.titlePlaceholder': 'مثلاً بوست Mythic +10، رید کریر، طراحی افزونه...',
    'work.dateTime': 'تاریخ و زمان',
    'workModal.dateTime': 'تاریخ و زمان',
    'work.teamMode': 'تیم مود',
    'work.teammatesCrew': 'اعضای تیم',
    'work.incomeCurrency': 'مبلغ / درآمد',
    'work.exchangeRate': 'نرخ تبدیل گلد به تومان',
    'work.notes': 'یادداشت مشتری / بوست',
    'work.notesPlaceholder': 'دیسکورد مشتری، نام کاراکتر، دستورالعمل‌های خاص...',
    'work.link': 'لینک مرجع / پیوند',
    'work.linkPlaceholder': 'https://discord.com/... یا لینک شیت',
    'work.proof': 'مدارک پیوست شده',
    'work.clickUpload': 'برای آپلود اسکرین‌شات کلیک کنید',
    'work.status': 'وضعیت',
    'work.saveRecord': 'ثبت کار',
    'work.updateRecord': 'ذخیره تغییرات',
    'ledger.filters': 'فیلترها',
    'ledger.gameCategories': 'دسته‌بندی بازی‌ها',
    'ledger.openLink': 'باز کردن پیوند',
    'ledger.withProof': 'فقط دارای مدرک',
    'ledger.allCurrencies': 'همه ارزها',
    'ledger.allProofs': 'همه وضعیت‌های مدرک',
    'ledger.addScreenshot': 'افزودن اسکرین‌شات',
    'ledger.viewScreenshotProof': 'مشاهده مدرک اسکرین‌شات',
    'ledger.deleteRecordPrompt': 'حذف «{title}»؟',
    'ledger.deleteRecordWarning': 'این رکورد کار و هرگونه مدرک اسکرین‌شات پیوست‌شده برای همیشه حذف خواهد شد.',
    'ledger.deleteRecordBtn': 'حذف رکورد',
    'settings.theme': 'پوسته',
    'settings.themeDark': 'تیره',
    'settings.themeLight': 'روشن',

    // Quick Add Modal
    'quickAdd.title': 'ثبت سریع کار',
    'quickAdd.badge': 'سریع',
    'quickAdd.boostTitle': 'عنوان بوست / کار',
    'quickAdd.jobTitle': 'عنوان کار',
    'quickAdd.jobTitlePlaceholder': 'چه کاری انجام داده‌اید؟',
    'quickAdd.price': 'مبلغ دریافتی',
    'quickAdd.priceIncome': 'مبلغ / درآمد',
    'quickAdd.currency': 'واحد پول',
    'quickAdd.liveEquivalent': 'معادل تقریبی',
    'quickAdd.swap': 'تبدیل',
    'quickAdd.statusHint': 'وضعیت: درحال انتظار · زمان: اکنون',
    'quickAdd.statusNote': 'وضعیت: درحال انتظار · زمان: اکنون',
    'quickAdd.submitWith': 'ثبت با کلید',
    'quickAdd.submitWithEnter': 'ثبت با کلید',
    'quickAdd.cancel': 'انصراف',
    'quickAdd.addRecord': 'افزودن کار',
    'quickAdd.addNow': 'ثبت سریع (Enter)',

    // Settings Modal
    'settings.title': 'تنظیمات و مدیریت داده‌ها',
    'settings.language': 'زبان برنامه',
    'settings.languageDesc': 'انتخاب زبان رابط کاربری و تقویم (فارسی / انگلیسی)',
    'settings.langFa': 'فارسی (پیش‌فرض)',
    'settings.langEn': 'English',
    'settings.currency': 'ارز پیش‌فرض نمایش',
    'settings.currencyDesc': 'ارز اصلی برای داشبورد، کارت‌ها و نمودارها',
    'settings.defaultCurrency': 'ارز پیش‌فرض نمایش',
    'settings.defaultCurrencyDesc': 'ارز اصلی برای داشبورد، کارت‌ها و نمودارها',
    'settings.desktopTray': 'رفتار پنجره و سیستم تری',
    'settings.systemTray': 'سیستم تری (Tray)',
    'settings.closeToTray': 'بستن به سیستم تری',
    'settings.closeToTrayDesc': 'با بستن برنامه، پردازش در پس‌زمینه ویندوز فعال می‌ماند',
    'settings.minimizeToTray': 'مینیمایز به سیستم تری',
    'settings.minimizeToTrayDesc': 'با مینیمایز کردن، آیکون به سیستم تری منتقل می‌شود',
    'settings.autoBackups': 'پشتیبان‌گیری خودکار زمان‌بندی‌شده',
    'settings.autoBackupsDesc': 'ایجاد خودکار نسخه‌های پشتیبان JSON در فواصل منظم',
    'settings.backupFolder': 'پوشه ذخیره پشتیبان',
    'settings.browse': 'انتخاب مسیر',
    'settings.backupNow': 'پشتیبان‌گیری دستی',
    'settings.frequency': 'دوره تکرار پشتیبان‌گیری',
    'settings.retention': 'حداکثر تعداد فایل‌های نگهداری‌شده',
    'settings.snapshots': 'اسنپ‌شات‌های بازیابی خودکار',
    'settings.snapshotsDesc': 'نقاط بازگشت اضطراری قبل از هر تغییر (بازیابی سریع)',
    'settings.restore': 'بازیابی',
    'settings.restoreSnapshotConfirm': 'آیا مایل به بازیابی پایگاه‌داده از این اسنپ‌شات هستید؟ تغییرات ذخیره‌نشده فعلی جایگزین خواهند شد.',
    'settings.updates': 'به‌روزرسانی‌ها و اطلاعیه‌ها',
    'settings.updateAvailable': 'به‌روزرسانی جدید موجود است',
    'settings.upToDate': 'شما از آخرین نسخه چک‌پوینت استفاده می‌کنید',
    'settings.checking': 'در حال بررسی...',
    'settings.checkNow': 'بررسی به‌روزرسانی',
    'settings.checkUpdate': 'بررسی به‌روزرسانی',
    'settings.community': 'انجمن و پشتیبانی',
    'settings.privacy': 'تشخیص و حریم خصوصی',
    'settings.privacyDesc': 'اطلاعات آماری ناشناس جهت پایداری، کاملاً محلی و امن',
    'settings.dataPortability': 'انتقال و خروجی داده‌ها',
    'settings.fullJsonBackup': 'خروجی پشتیبان کامل (JSON)',
    'settings.restoreJson': 'بازیابی از فایل پشتیبان (JSON)',
    'settings.exportCsv': 'خروجی اکسل (CSV)',
    'settings.exportCsvDesc': 'دریافت فایل اکسل از تمام رکوردها با سازگاری کامل زبان فارسی',
    'settings.exportJson': 'پشتیبان‌گیری کامل (JSON)',
    'settings.exportJsonDesc': 'ایجاد نسخه پشتیبان قابل حمل از پایگاه‌داده',
    'settings.importJson': 'بازیابی داده‌ها (JSON)',
    'settings.importJsonDesc': 'وارد کردن و بازیابی اطلاعات از فایل پشتیبان JSON',
    'settings.dangerZone': 'بخش حساس و پاکسازی',
    'settings.clearAll': 'پاکسازی کامل تمام اطلاعات',
    'settings.clearAllDesc': 'حذف دائمی تمام رکوردهای مالی ذخیره شده روی دستگاه',
    'settings.clearAllData': 'پاکسازی کامل تمام اطلاعات',
    'settings.clearAllDataDesc': 'حذف دائمی تمام رکوردهای مالی ذخیره شده روی دستگاه',
    'settings.eraseAllData': 'حذف کامل داده‌ها',
    'settings.eraseWarning': 'این عملیات تمام رکوردهای کاری و تنظیمات را برای همیشه حذف می‌کند. برای تایید عبارت DELETE ALL یا CLEAR را وارد کنید.',
    'settings.appInfo': 'اطلاعات نرم‌افزار',
    'settings.version': 'نسخه برنامه',
    'settings.shortcuts': 'مشاهده کلیدهای میانبر کیبورد',
    'settings.done': 'بستن',

    // Receipt Modal
    'receipt.title': 'رسید اثبات کار',
    'receipt.langPersian': 'فارسی (شمسی)',
    'receipt.langEnglish': 'انگلیسی (دیسکورد)',
    'receipt.receiptId': 'شناسه رسید',
    'receipt.date': 'تاریخ و ساعت',
    'receipt.game': 'بازی / پلتفرم',
    'receipt.jobSource': 'مرجع سفارش / مشتری',
    'receipt.status': 'وضعیت',
    'receipt.amountEarned': 'مبلغ دریافتی',
    'receipt.conversionRate': 'نرخ تبدیل',
    'receipt.copyText': 'کپی متن رسید',
    'receipt.copyDiscord': 'کپی متن دیسکورد',
    'receipt.screenshotTitle': 'کپی اسکرین‌شات رسید در کلیپ‌بورد (کلید C یا S)',
    'receipt.print': 'چاپ رسید',
    'receipt.close': 'بستن',

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

    // Common Buttons & Tooltips
    'common.save': 'ذخیره',
    'common.cancel': 'انصراف',
    'common.confirm': 'تایید',
    'common.delete': 'حذف',
    'common.edit': 'ویرایش',
    'common.close': 'بستن',
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
  },
};

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
