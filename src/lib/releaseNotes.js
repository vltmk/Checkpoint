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
 * Bundled changelog registry keyed by semantic version. Only the notes people still need are kept: the current
 * release (and the next one, when it is being prepared). Every entry must have Farsi AND English text with the same
 * number of items: `test/releaseNotes.test.mjs` enforces this, and the release workflow refuses to publish a version
 * that has no entry, so a release can never go out without Farsi notes.
 */
export const RELEASE_NOTES_REGISTRY = {
  '5.0.0': {
    date: '2026-10-21',
    title: {
      en: "What's New in Checkpoint v5.0.0",
      fa: 'تغییرات و امکانات نسخه ۵.۰.۰',
    },
    summary: {
      en: 'A new ledger: every booster, client and platform has a running balance, and every job keeps its own exchange rates. A redesigned Advertiser and Booster experience.',
      fa: 'دفتر کل جدید: برای هر بوستر، مشتری و پلتفرم یک مانده جاری ثبت می‌شود و هر کار نرخ‌های تبدیل خودش را نگه می‌دارد. طراحی تازه برای پروفایل ادورتایزر و بوستر.',
    },
    items: {
      en: [
        { tag: 'new', text: 'Advertiser Overview: what you owe your boosters, what platforms owe you, and what you keep. Each booster has a statement with a running balance.' },
        { tag: 'new', text: 'Settle up: one payment can cover several works, in any currency, with the exchange rate saved. Advances and partial payments are supported, and a payment can be voided.' },
        { tag: 'new', text: 'Platform payouts with withdrawal fees (G2G, BlazingBoost and others): the fee rule is remembered per platform, booked as an expense, and spread over the orders it paid in reports.' },
        { tag: 'new', text: 'Every job saves its own exchange rates (gold, USD and EUR). Changing a rate later never changes what an earlier job earned, in any currency. Correct the rates of an older job under More details.' },
        { tag: 'new', text: 'Booster profile redesigned to be simple: Overview, Jobs, Clients and Reports. Add a job in three fields, see who owes you, and add expenses.' },
        { tag: 'new', text: 'Orders and Jobs lists redesigned: game icons with a status badge, the time on every row, and days grouped with a daily total.' },
        { tag: 'new', text: 'New receipts and payout slips built from real payments: paid state and dates, each booster on the slip, the rates saved with the job, in Farsi or English.' },
        { tag: 'new', text: 'Show every amount in Toman, USD, EUR or Gold with one switch, or press T to cycle. Each person can have a preferred payment currency.' },
        { tag: 'new', text: 'Import your spreadsheet from Google Sheets or CSV, and try the app with sample data.' },
        { tag: 'improved', text: 'Mark a job paid by mistake? Hover the row and press Undo.' },
        { tag: 'improved', text: 'Search now sits on each list that needs it, and Boosters and Clients open on the first person.' },
        { tag: 'improved', text: 'Your existing data is upgraded in place with a backup first; nothing is deleted. Backups, exports and auto-backup now include the new ledger.' },
        { tag: 'improved', text: 'Patch notes in the app are always shown in Farsi.' },
        { tag: 'improved', text: 'Minimum window size raised to 960 x 640. Checkpoint is a desktop app, so the mobile layout was removed.' },
        { tag: 'fix', text: 'The date picker no longer stretches or clips dialogs in small windows.' },
      ],
      fa: [
        { tag: 'new', text: 'خلاصه ادورتایزر: به بوسترها چقدر بدهکارید، پلتفرم‌ها چقدر به شما بدهکارند و چقدر برای شما می‌ماند. هر بوستر صورت‌حساب و مانده جاری دارد.' },
        { tag: 'new', text: 'تسویه حساب: یک پرداخت می‌تواند چند کار را با هر ارزی پوشش دهد و نرخ تبدیل ذخیره می‌شود. پیش‌پرداخت و پرداخت ناقص پشتیبانی می‌شود و هر پرداخت قابل ابطال است.' },
        { tag: 'new', text: 'دریافت از پلتفرم‌ها همراه با کارمزد برداشت (G2G، BlazingBoost و دیگران): قانون کارمزد برای هر پلتفرم به خاطر سپرده می‌شود، به‌عنوان هزینه ثبت می‌شود و در گزارش‌ها بین سفارش‌های همان دریافت تقسیم می‌شود.' },
        { tag: 'new', text: 'هر کار نرخ‌های تبدیل خودش (گلد، دلار و یورو) را ذخیره می‌کند. تغییر نرخ در آینده هرگز درآمد کارهای قبلی را در هیچ ارزی تغییر نمی‌دهد. نرخ‌های یک کار قدیمی را در «جزئیات بیشتر» می‌توانید اصلاح کنید.' },
        { tag: 'new', text: 'پروفایل بوستر ساده‌تر شد: خلاصه، کارها، مشتری‌ها و گزارش‌ها. کار را در سه فیلد ثبت کنید، ببینید چه کسی به شما بدهکار است و هزینه‌ها را اضافه کنید.' },
        { tag: 'new', text: 'لیست سفارش‌ها و کارها بازطراحی شد: آیکن بازی با نشان وضعیت، ساعت ثبت روی هر ردیف و گروه‌بندی بر اساس روز همراه با جمع روزانه.' },
        { tag: 'new', text: 'رسید و فیش تسویه جدید بر پایه پرداخت‌های واقعی: وضعیت و تاریخ پرداخت، سهم هر بوستر روی فیش، نرخ‌های ذخیره‌شده برای کار، به فارسی یا انگلیسی.' },
        { tag: 'new', text: 'نمایش همه مبلغ‌ها به تومان، دلار، یورو یا گلد با یک کلید، یا با فشردن T به‌صورت چرخشی. برای هر نفر می‌توان ارز پرداخت دلخواه تعیین کرد.' },
        { tag: 'new', text: 'جدول خود را از گوگل شیت یا CSV وارد کنید و برنامه را با داده نمونه امتحان کنید.' },
        { tag: 'improved', text: 'کاری را اشتباهی پرداخت‌شده زدید؟ نشانگر را روی ردیف ببرید و روی «بازگردانی» بزنید.' },
        { tag: 'improved', text: 'جستجو حالا در هر لیستی که لازم است قرار دارد و صفحه بوسترها و مشتری‌ها روی اولین نفر باز می‌شود.' },
        { tag: 'improved', text: 'داده‌های فعلی شما ابتدا پشتیبان‌گیری می‌شوند و سپس درجا ارتقا می‌یابند؛ چیزی حذف نمی‌شود. پشتیبان‌ها، خروجی‌ها و پشتیبان خودکار حالا دفتر کل جدید را هم شامل می‌شوند.' },
        { tag: 'improved', text: 'یادداشت‌های نسخه در برنامه همیشه به فارسی نمایش داده می‌شود.' },
        { tag: 'improved', text: 'حداقل اندازه پنجره به ۹۶۰ در ۶۴۰ افزایش یافت. Checkpoint یک برنامه دسکتاپ است و چیدمان موبایل حذف شد.' },
        { tag: 'fix', text: 'انتخابگر تاریخ دیگر در پنجره‌های کوچک دیالوگ‌ها را کش نمی‌دهد یا بریده نمی‌کند.' },
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
 * Patch notes inside the app are always Farsi, whatever the interface language is. English notes stay in the registry
 * and in the GitHub Release page, which is where the release workflow publishes them.
 */
const NOTES_LANGUAGE = 'fa';
const ARABIC_SCRIPT = /[؀-ۿ]/;

/** A release body holds the Farsi and English notes split by a `---` line; return the Farsi part (or all of it). */
function pickFarsiSection(body) {
  const sections = body.split(/\n\s*-{3,}\s*\n/);
  return sections.find((sec) => ARABIC_SCRIPT.test(sec)) || body;
}

/** The first plain sentence of a markdown body, skipping headings and bullets. */
function firstProseLine(body) {
  const line = body.split('\n').map((l) => l.trim()).find((l) => l && !/^(#|[-*+•]|\d+\.)/.test(l));
  return line || '';
}

/**
 * Retrieve release notes for a specific version.
 * If rawBody is provided (e.g. from GitHub Release check), parses markdown if not in registry.
 */
export function getReleaseNotesForVersion(version, _language = 'en', rawBody = '') {
  const cleanVer = String(version || '').replace(/^v/i, '').trim();
  const lang = NOTES_LANGUAGE;

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

  // Fallback: parse rawBody if provided. The release body is Farsi first, English second: keep the Farsi part.
  if (rawBody && typeof rawBody === 'string') {
    const farsiBody = pickFarsiSection(rawBody);
    const parsedItems = parseMarkdownChangelog(farsiBody);
    if (parsedItems.length > 0) {
      return {
        version: cleanVer,
        date: new Date().toISOString().slice(0, 10),
        title: `تغییرات نسخه ${cleanVer}`,
        summary: firstProseLine(farsiBody) || `به‌روزرسانی و ارتقای امکانات به نسخه ${cleanVer}`,
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
export function getAggregatedReleaseNotes(fromVersion, toVersion, _language = 'en') {
  const lang = NOTES_LANGUAGE;
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
