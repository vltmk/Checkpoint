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
      fa: 'تغییرات نسخه ۵.۰.۰',
    },
    summary: {
      en: 'A new ledger with a running balance for every booster, client and platform.',
      fa: 'دفتر کل جدید با مانده جاری برای هر بوستر، مشتری و پلتفرم.',
    },
    items: {
      en: [
        { tag: 'new', text: 'Advertiser overview: what you owe, what you are owed, what you keep.' },
        { tag: 'new', text: 'Settle up in any currency, with advances and undo.' },
        { tag: 'new', text: 'Platform withdrawal fees, remembered per platform.' },
        { tag: 'new', text: 'Every job keeps its own exchange rates.' },
        { tag: 'new', text: 'Simpler Booster profile: Overview, Jobs, Clients, Reports.' },
        { tag: 'new', text: 'Redesigned lists with game icons, times and daily groups.' },
        { tag: 'new', text: 'New receipts and payout slips.' },
        { tag: 'improved', text: 'Your data is upgraded in place, with a backup first.' },
      ],
      fa: [
        { tag: 'new', text: 'خلاصه ادورتایزر: چقدر بدهکارید، چقدر طلب دارید و چقدر برایتان می‌ماند.' },
        { tag: 'new', text: 'تسویه با هر ارز، همراه با پیش‌پرداخت و بازگردانی.' },
        { tag: 'new', text: 'کارمزد برداشت پلتفرم‌ها، به‌ازای هر پلتفرم ذخیره می‌شود.' },
        { tag: 'new', text: 'هر کار نرخ‌های تبدیل خودش را نگه می‌دارد.' },
        { tag: 'new', text: 'پروفایل بوستر ساده‌تر: خلاصه، کارها، مشتری‌ها، گزارش‌ها.' },
        { tag: 'new', text: 'لیست‌های بازطراحی‌شده با آیکن بازی، ساعت و گروه‌بندی روزانه.' },
        { tag: 'new', text: 'رسید و فیش تسویه جدید.' },
        { tag: 'improved', text: 'داده‌های شما با پشتیبان‌گیری قبلی، درجا ارتقا می‌یابند.' },
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
