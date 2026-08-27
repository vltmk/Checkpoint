/**
 * Compare two semver strings (e.g. "2.1.4" vs "2.1.5", ignores leading 'v').
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = String(v1).replace(/^v/i, '').trim();
  const clean2 = String(v2).replace(/^v/i, '').trim();

  const p1 = clean1.split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = clean2.split('.').map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Bundled changelog registry keyed by semantic version.
 */
export const RELEASE_NOTES_REGISTRY = {
  '2.4.0': {
    date: '2026-08-27',
    title: {
      en: "What's New in Checkpoint v2.4.0",
      fa: 'امکانات و تغییرات نسخه ۲.۴.۰',
    },
    summary: {
      en: 'Full Persian & RTL support, Solar Hijri (Shamsi) calendar, automated local backups, and Notification Center release notes.',
      fa: 'پشتیبانی کامل از زبان فارسی و راست‌چین، تقویم خورشیدی شمسی، پشتیبان‌گیری خودکار و سیستم گزارش تغییرات در مرکز اعلان‌ها.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Full Persian (Farsi) & RTL layout support with native IRANYekan typography and instant language switcher in Settings.',
        },
        {
          tag: 'new',
          text: 'Interactive Solar Hijri (Shamsi / Jalali) calendar picker with quick presets (Now, Today, Yesterday) and localized formatting.',
        },
        {
          tag: 'new',
          text: 'Automated local folder backups with custom directory selector, retention rotation (keep 5 to 20), and smart change detection.',
        },
        {
          tag: 'new',
          text: "Version-specific 'What's New' release notes with categorized badges (NEW, IMPROVED, FIX) directly in the Notification Center.",
        },
        {
          tag: 'improved',
          text: 'Pre-update download dialog now parses and displays structured changelogs before downloading new releases.',
        },
        {
          tag: 'improved',
          text: 'Optimized 4K screenshot proof compression for instant proof attachments and lighter SQLite storage.',
        },
        {
          tag: 'improved',
          text: 'High-density UI polish, smoother dialog transitions, and enhanced keyboard shortcut responsiveness (N, Q, C, S).',
        },
        {
          tag: 'fix',
          text: 'Preserved unread/read notification flags and dismissed states across desktop application restarts.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی کامل از زبان فارسی و چینش راست‌چین (RTL) با فونت رسمی ایران‌یکان و سوییچر سریع در تنظیمات.',
        },
        {
          tag: 'new',
          text: 'تقویم و انتخاب‌گر اختصاصی تاریخ شمسی (خورشیدی) به همراه میانبرهای زمانی (اکنون، امروز، دیروز).',
        },
        {
          tag: 'new',
          text: 'پشتیبان‌گیری خودکار زمان‌بندی‌شده در پوشه دلخواه با مدیریت چرخش نسخه‌ها (۵ تا ۲۰ نسخه) و فینگرپرینت هوشمند تغییرات.',
        },
        {
          tag: 'new',
          text: 'سیستم نمایش تغییرات هر نسخه با برچسب‌های تفکیک‌شده (جدید، بهبود، رفع باگ) در مرکز اعلان‌ها.',
        },
        {
          tag: 'improved',
          text: 'فرمت‌بندی و نمایش ساختاریافته یادداشت‌های انتشار قبل از تایید دانلود در پنجره به‌روزرسانی.',
        },
        {
          tag: 'improved',
          text: 'فشرده‌سازی خودکار و بهینه‌سازی تصاویر فاکتور و اسکرین‌شات‌های 4K جهت افزایش چشمگیر سرعت برنامه و سبکی دیتابیس.',
        },
        {
          tag: 'improved',
          text: 'بهبود تراکم و ظاهر رابط کاربری، انیمیشن‌های مینیمال پنجره‌ها و عملکرد سریع‌تر کلیدهای میانبر (N, Q, C, S).',
        },
        {
          tag: 'fix',
          text: 'حفظ دقیق وضعیت پیام‌های خوانده‌شده و ردشده در مرکز اعلان‌ها پس از راه‌اندازی مجدد برنامه.',
        },
      ],
    },
  },
  '2.3.3': {
    date: '2026-08-27',
    title: {
      en: "What's New in Checkpoint v2.3.3",
      fa: 'امکانات و تغییرات نسخه ۲.۳.۳',
    },
    summary: {
      en: 'Categorized release notes, enhanced notification center, and UI optimizations.',
      fa: 'لیست تغییرات دسته‌بندی‌شده، ارتقای مرکز اعلان‌ها و بهبودهای رابط کاربری.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: "Rich 'What's New' release notes with categorized badges directly in the Notification Center.",
        },
        {
          tag: 'improved',
          text: 'Pre-update download dialog now parses and displays structured changelogs before updating.',
        },
        {
          tag: 'improved',
          text: 'Cumulative update aggregation when skipping intermediate versions.',
        },
        {
          tag: 'fix',
          text: 'Preserved read states and dismissal across desktop app relaunches.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'نمایش لیست تغییرات و ویژگی‌های جدید هر نسخه با برچسب‌های تفکیک‌شده در مرکز اعلان‌ها.',
        },
        {
          tag: 'improved',
          text: 'فرمت‌بندی و نمایش ساختاریافته یادداشت‌های انتشار پیش از شروع دانلود به‌روزرسانی.',
        },
        {
          tag: 'improved',
          text: 'جمع‌آوری هوشمند تمام تغییرات نسخه‌های میانی در صورت ارتقای چند نسخه به‌صورت یکجا.',
        },
        {
          tag: 'fix',
          text: 'حفظ دقیق وضعیت پیام‌های خوانده‌شده و بسته‌شده پس از راه‌اندازی مجدد برنامه.',
        },
      ],
    },
  },
  '2.3.0': {
    date: '2026-08-25',
    title: {
      en: "What's New in Checkpoint v2.3.0",
      fa: 'امکانات و تغییرات نسخه ۲.۳.۰',
    },
    summary: {
      en: 'Automated folder backups, persistent Notification Center, and screenshot optimizations.',
      fa: 'پشتیبان‌گیری خودکار زمان‌بندی‌شده، مرکز اعلان‌های محلی و بهینه‌سازی ذخیره تصاویر.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Scheduled folder backups with custom directory selection and retention limits (5 to 20 backups).',
        },
        {
          tag: 'new',
          text: 'Persistent local Notification Center with filtered tabs for Releases and Announcements.',
        },
        {
          tag: 'improved',
          text: 'Optimized 4K screenshot compression for instant proof attachments and smaller SQLite size.',
        },
        {
          tag: 'improved',
          text: 'Added quick gold ratio preset chips and interactive guide in the top bar.',
        },
        {
          tag: 'fix',
          text: 'Fixed window drag handling and click-through issues on custom titlebar controls.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبان‌گیری خودکار در پوشه دلخواه با قابلیت مدیریت تعداد نسخه‌ها (۵ تا ۲۰ نسخه اخیر).',
        },
        {
          tag: 'new',
          text: 'مرکز اعلان‌های اختصاصی و پایدار با فیلترهای رویدادها، نسخه‌ها و اطلاعیه‌ها.',
        },
        {
          tag: 'improved',
          text: 'فشرده‌سازی هوشمند اسکرین‌شات‌های 4K جهت سبک‌سازی دیتابیس و افزایش سرعت برنامه.',
        },
        {
          tag: 'improved',
          text: 'دکمه‌های انتخاب سریع نرخ گلد روزانه به همراه راهنمای تعاملی در نوار بالا.',
        },
        {
          tag: 'fix',
          text: 'اصلاح عملکرد درگ پنجره و رفع تداخل کلیک در نوار ابزار سفارشی.',
        },
      ],
    },
  },
  '2.2.0': {
    date: '2026-08-20',
    title: {
      en: "What's New in Checkpoint v2.2.0",
      fa: 'امکانات و تغییرات نسخه ۲.۲.۰',
    },
    summary: {
      en: 'System tray integration, background minimizing, and fast shortcuts.',
      fa: 'پشتیبانی از System Tray، مینیمایز در پس‌زمینه و کلیدهای میانبر سریع.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'System Tray support with background minimization and Quick Add context menu.',
        },
        {
          tag: 'new',
          text: 'Added Quick Add modal with global keyboard shortcut (Q).',
        },
        {
          tag: 'improved',
          text: 'High-density ledger view with instant inline teammate and source auto-complete.',
        },
        {
          tag: 'fix',
          text: 'Resolved date filter boundary issues in Analytics earnings chart.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی از System Tray با قابلیت مینیمایز در پس‌زمینه و منوی راست‌کلیک ثبت سریع.',
        },
        {
          tag: 'new',
          text: 'پنجره ثبت سریع کارها با کلید میانبر سراسری (Q).',
        },
        {
          tag: 'improved',
          text: 'نمایش فوق‌العاده فشرده دفتر کل با تکمیل خودکار هوشمند نام هم‌تیمی‌ها و منابع.',
        },
        {
          tag: 'fix',
          text: 'اصلاح بازه زمانی فیلترها در نمودار درآمدهای بخش آمار و تحلیل.',
        },
      ],
    },
  },
};

/**
 * Smart markdown changelog parser for remote GitHub release bodies.
 * Parses lines like:
 *   - [NEW] Added feature ...
 *   - * [Improved] Faster loading ...
 *   - - Fix: Bug in date filter ...
 *   - Regular bullet text
 */
export function parseMarkdownChangelog(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return [];

  const lines = markdownText.split('\n');
  const items = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Match bullet point formats: -, *, +, •, or 1.
    const bulletMatch = line.match(/^[-*+•\d.]+\s+(.*)$/);
    if (!bulletMatch) continue;

    let content = bulletMatch[1].trim();
    if (!content) continue;

    // Strip any nested bullet markers like '* ' or '- '
    content = content.replace(/^[-*+•]+\s+/, '').trim();

    // Detect tag prefix e.g. [NEW], [IMPROVED], [FIX], New:, Fix:, etc.
    let tag = null;
    let cleanText = content;

    const tagMatch = content.match(/^\[?(NEW|FEATURE|ADDED|IMPROVED|OPTIMIZED|UPDATE|FIX|FIXED|BUGFIX)\]?[:\s-]+(.*)$/i);
    if (tagMatch) {
      const rawTag = tagMatch[1].toUpperCase();
      cleanText = tagMatch[2].trim();

      if (['NEW', 'FEATURE', 'ADDED'].includes(rawTag)) {
        tag = 'new';
      } else if (['IMPROVED', 'OPTIMIZED', 'UPDATE'].includes(rawTag)) {
        tag = 'improved';
      } else if (['FIX', 'FIXED', 'BUGFIX'].includes(rawTag)) {
        tag = 'fix';
      }
    }

    if (cleanText) {
      items.push({ tag, text: cleanText });
    }
  }

  return items;
}

/**
 * Retrieve release notes for a specific version.
 * If rawBody is provided (e.g. from GitHub Release check), parses markdown if not in registry.
 */
export function getReleaseNotesForVersion(version, language = 'en', rawBody = '') {
  const cleanVer = String(version || '').replace(/^v/i, '').trim();
  const lang = language === 'fa' ? 'fa' : 'en';

  const entry = RELEASE_NOTES_REGISTRY[cleanVer];
  if (entry) {
    return {
      version: cleanVer,
      date: entry.date,
      title: entry.title[lang] || entry.title.en,
      summary: entry.summary[lang] || entry.summary.en,
      items: entry.items[lang] || entry.items.en || [],
    };
  }

  // Fallback: parse rawBody if provided
  if (rawBody && typeof rawBody === 'string') {
    const parsedItems = parseMarkdownChangelog(rawBody);
    if (parsedItems.length > 0) {
      return {
        version: cleanVer,
        date: new Date().toISOString().slice(0, 10),
        title: lang === 'fa' ? `تغییرات نسخه ${cleanVer}` : `What's New in Checkpoint v${cleanVer}`,
        summary: lang === 'fa' ? `به‌روزرسانی و ارتقای امکانات به نسخه ${cleanVer}` : `Updates and improvements in version ${cleanVer}.`,
        items: parsedItems,
      };
    }
  }

  // Generic fallback
  return {
    version: cleanVer,
    date: new Date().toISOString().slice(0, 10),
    title: lang === 'fa' ? `به‌روزرسانی به نسخه ${cleanVer}` : `Updated to Checkpoint v${cleanVer}`,
    summary: lang === 'fa' ? 'بهبود عملکرد، پایداری و رفع خطاهای گزارش‌شده.' : 'Performance enhancements, optimizations, and stability improvements.',
    items: [
      {
        tag: 'improved',
        text: lang === 'fa' ? 'بهینه‌سازی عملکرد و پایداری سیستم' : 'General performance and stability improvements',
      },
    ],
  };
}

/**
 * Aggregate release notes across a range of versions (e.g. when jumping from 2.1.0 to 2.3.3).
 * Returns array of release note objects sorted newest first.
 */
export function getAggregatedReleaseNotes(fromVersion, toVersion, language = 'en') {
  const lang = language === 'fa' ? 'fa' : 'en';
  const cleanTo = String(toVersion || '').replace(/^v/i, '').trim();
  const cleanFrom = fromVersion ? String(fromVersion).replace(/^v/i, '').trim() : null;

  const versions = Object.keys(RELEASE_NOTES_REGISTRY).sort((a, b) => compareSemver(b, a));
  const aggregated = [];

  for (const ver of versions) {
    // Only include versions <= toVersion
    if (compareSemver(ver, cleanTo) > 0) continue;

    // Stop if we reached or fell below fromVersion
    if (cleanFrom && compareSemver(ver, cleanFrom) <= 0) break;

    const notes = getReleaseNotesForVersion(ver, lang);
    if (notes) {
      aggregated.push(notes);
    }
  }

  // If no intermediate registry entries matched, return at least the target version notes
  if (aggregated.length === 0) {
    aggregated.push(getReleaseNotesForVersion(cleanTo, lang));
  }

  return aggregated;
}
