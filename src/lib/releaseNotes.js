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
  '5.2.0': {
    date: '2026-10-24',
    title: {
      en: "What's New in Checkpoint v5.2.0",
      fa: 'تغییرات نسخه ۵.۲.۰',
    },
    summary: {
      en: 'Clearer payouts with fee layers and a summary, select mode for orders and jobs, and notes, aging and periods on every person.',
      fa: 'واریزی‌های واضح‌تر با کارمزدهای چندلایه و خلاصه، حالت انتخاب برای سفارش‌ها و کارها، و یادداشت، مدت انتظار و بازه برای هر نفر.',
    },
    items: {
      en: [
        { tag: 'new', text: 'Select mode on Orders and Jobs: tick rows to see a recap, mark them collected, record a payout for them, or copy them as CSV.' },
        { tag: 'new', text: 'Settle up fills the amount from the orders you tick, each converted at its own rate.' },
        { tag: 'new', text: 'Payouts: Fill exact covers the ticked orders to the unit, fees included.' },
        { tag: 'new', text: 'Payouts: add several fees on the way to you (platform, bank...), each booked on its own and remembered per platform.' },
        { tag: 'new', text: 'After a payout, a summary shows what it covered, what is left, and what reached your account, with Undo.' },
        { tag: 'new', text: 'Close short: clear what a payer underpaid, with a reason. It is not counted as cash.' },
        { tag: 'new', text: 'Money shows what each payment covered and what was left over.' },
        { tag: 'new', text: 'Boosters and Clients: a contact and notes for each person, shown on their card.' },
        { tag: 'new', text: 'Boosters and Clients: how long money has been waiting, in four bands.' },
        { tag: 'new', text: 'Statements: filter the history by 30 days, 90 days or this year, with opening and closing balances.' },
        { tag: 'new', text: 'Clients: what they owe, split by currency. Booster overview: your net after your team.' },
        { tag: 'improved', text: 'Game icons on the rows are larger, and the status is shown once, by the status control.' },
        { tag: 'fixed', text: 'Voiding a payout also voids the fees booked on it.' },
      ],
      fa: [
        { tag: 'new', text: 'حالت انتخاب در سفارش‌ها و کارها: ردیف‌ها را تیک بزنید تا خلاصه ببینید، همه را دریافت‌شده علامت بزنید، واریزی ثبت کنید یا به‌صورت CSV کپی کنید.' },
        { tag: 'new', text: 'تسویه حساب مبلغ را از سفارش‌های تیک‌خورده پر می‌کند، هرکدام با نرخ خودش.' },
        { tag: 'new', text: 'واریزی: «پرکردن دقیق» سفارش‌های تیک‌خورده را تا واحد پوشش می‌دهد، با احتساب کارمزد.' },
        { tag: 'new', text: 'واریزی: چند کارمزد در مسیر (پلتفرم، بانک...) اضافه کنید؛ هرکدام جدا ثبت می‌شود و برای هر پلتفرم به خاطر سپرده می‌شود.' },
        { tag: 'new', text: 'پس از واریزی، خلاصه‌ای نشان داده می‌شود: چه چیزی را پوشش داده، چه چیزی مانده و چه مبلغی به حساب رسیده، با گزینه بازگردانی.' },
        { tag: 'new', text: 'بستن با کسری: آنچه پرداخت‌کننده کمتر پرداخته را با دلیل ببندید. این مبلغ جزو وجه نقد حساب نمی‌شود.' },
        { tag: 'new', text: 'در «پول» نشان داده می‌شود که هر پرداخت چه چیزی را پوشش داده و چه مقدار مانده است.' },
        { tag: 'new', text: 'بوسترها و کلاینت‌ها: راه ارتباطی و یادداشت برای هر نفر، زیر کارتشان.' },
        { tag: 'new', text: 'بوسترها و کلاینت‌ها: مدت انتظار پول در چهار بازه.' },
        { tag: 'new', text: 'صورت‌حساب‌ها: فیلتر تاریخچه بر اساس ۳۰ روز، ۹۰ روز یا امسال، با مانده اول و پایان.' },
        { tag: 'new', text: 'کلاینت‌ها: بدهی به تفکیک ارز. خلاصه بوستر: خالص شما پس از تیم.' },
        { tag: 'improved', text: 'آیکون بازی‌ها در ردیف‌ها بزرگ‌تر شد و وضعیت فقط یک بار، در کنترل وضعیت نشان داده می‌شود.' },
        { tag: 'fixed', text: 'بازگرداندن یک واریزی، کارمزدهای ثبت‌شده روی آن را هم بازمی‌گرداند.' },
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
