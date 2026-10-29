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
  '5.4.0': {
    date: '2026-10-29',
    title: {
      en: "What's New in Checkpoint v5.4.0",
      fa: 'تغییرات نسخه ۵.۴.۰',
    },
    summary: {
      en: 'Filter Orders and Jobs by date, export CSV per profile, and big ledgers open much faster.',
      fa: 'سفارش‌ها و کارها را بر اساس تاریخ فیلتر کنید، خروجی CSV را برای هر پروفایل بگیرید و دفترهای بزرگ بسیار سریع‌تر باز می‌شوند.',
    },
    items: {
      en: [
        { tag: 'new', text: 'Date filter on Orders and Jobs: today, last 7 or 30 days, this or last month, or a custom range.' },
        { tag: 'new', text: 'Export CSV from a dialog: pick Booster, Advertiser or both, one file per profile (Alt+E).' },
        { tag: 'new', text: 'Drop a screenshot onto the add form to attach it, or paste with Ctrl+V.' },
        { tag: 'improved', text: 'Orders and Jobs toolbar is now two rows with filter chips, and the display currency picker moved to the top bar.' },
        { tag: 'improved', text: 'Orders and Jobs open far faster on ledgers with thousands of orders.' },
      ],
      fa: [
        { tag: 'new', text: 'فیلتر تاریخ در سفارش‌ها و کارها: امروز، ۷ یا ۳۰ روز اخیر، این ماه یا ماه قبل، یا بازه دلخواه.' },
        { tag: 'new', text: 'خروجی CSV از یک پنجره: بوستر، تبلیغ‌دهنده یا هر دو را انتخاب کنید؛ یک فایل برای هر پروفایل (Alt+E).' },
        { tag: 'new', text: 'اسکرین‌شات را روی فرم افزودن رها کنید تا پیوست شود، یا با Ctrl+V جای‌گذاری کنید.' },
        { tag: 'improved', text: 'نوار ابزار سفارش‌ها و کارها دو ردیفه شد، با چیپ‌های فیلتر، و انتخاب ارز نمایش به نوار بالا منتقل شد.' },
        { tag: 'improved', text: 'سفارش‌ها و کارها در دفترهای دارای هزاران سفارش بسیار سریع‌تر باز می‌شوند.' },
      ],
    },
  },
};

/** The newest release in the registry: the one the app was built as. */
export function latestReleaseVersion() {
  return Object.keys(RELEASE_NOTES_REGISTRY).sort((a, b) => compareSemver(b, a))[0] || null;
}

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
