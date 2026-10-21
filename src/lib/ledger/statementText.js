/**
 * statementText.js - the message a seller sends a booster: what is still owed, for which works, and what was paid.
 * Pure. The caller passes formatters so English/Farsi digits, calendars and currencies are handled in one place.
 */
import { statementSummaryLines } from './selectors.js';

const LABELS = {
  en: {
    title: (name) => `**Statement for ${name}**`,
    dueNow: 'Due now',
    inProgress: 'On work in progress',
    credit: 'Paid in advance',
    unpaid: 'Unpaid work',
    recent: 'Recent payments',
    settled: 'You are fully paid up. Nothing is due.',
    approx: 'Amounts in mixed currencies are converted at today\'s rates.',
  },
  fa: {
    title: (name) => `**صورت‌حساب ${name}**`,
    dueNow: 'قابل پرداخت',
    inProgress: 'کارهای در حال انجام',
    credit: 'پیش‌پرداخت',
    unpaid: 'کارهای تسویه‌نشده',
    recent: 'آخرین پرداخت‌ها',
    settled: 'حساب شما کاملاً تسویه است.',
    approx: 'مبالغ با ارزهای مختلف به نرخ امروز تبدیل شده‌اند.',
  },
};

/**
 * @param {{ party, statement, displayCurrency, language, formatMinor(minor, currency), formatDate(iso) }} p
 */
export function buildStatementText({ party, statement, displayCurrency, language = 'en', formatMinor, formatDate }) {
  const L = LABELS[language] || LABELS.en;
  const d = statement.display;
  const { unpaid, payments } = statementSummaryLines(statement);
  const lines = [L.title(party.name), ''];

  if (d.owedNowMinor <= 0 && d.committedMinor <= 0 && unpaid.length === 0) {
    lines.push(L.settled);
  } else {
    lines.push(`${L.dueNow}: **${formatMinor(d.owedNowMinor, displayCurrency)}**`);
    if (d.committedMinor > 0) lines.push(`${L.inProgress}: ${formatMinor(d.committedMinor, displayCurrency)}`);
    if (d.advanceMinor > 0) lines.push(`${L.credit}: ${formatMinor(d.advanceMinor, displayCurrency)}`);
  }

  if (unpaid.length) {
    lines.push('', `__${L.unpaid}__`);
    for (const e of unpaid) {
      const left = e.amountMinor - e.appliedMinor;
      lines.push(`• ${e.order.title || e.order.orderRef || '-'} (${formatDate(e.order.dateTime)}): ${formatMinor(left, e.currency)}`);
    }
  }
  if (payments.length) {
    lines.push('', `__${L.recent}__`);
    for (const e of payments) lines.push(`✓ ${formatDate(e.payment.dateTime)}: ${formatMinor(e.amountMinor, e.currency)}`);
  }
  if (statement.isApproximate) lines.push('', `_${L.approx}_`);
  return lines.join('\n');
}

/** CSV for accountants and boosters: one row per share or payment, with the running balance. */
export function buildStatementCsv({ statement, displayCurrency, formatMajor }) {
  const q = (v) => {
    if (typeof v === 'number') return `"${v}"`; // numbers can't be formulas, and a negative balance must stay negative
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // keep spreadsheet apps from evaluating text as a formula
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [['Date', 'Type', 'Description', 'Currency', 'Amount', 'Applied', `Running (${displayCurrency})`].map(q).join(',')];
  for (const e of statement.events) {
    const date = new Date(e.at).toISOString().slice(0, 10);
    if (e.type === 'share') {
      rows.push([date, 'work', e.order.title || e.order.orderRef || '', e.currency, formatMajor(e.amountMinor, e.currency), formatMajor(e.appliedMinor, e.currency), formatMajor(e.runningMinor, displayCurrency)].map(q).join(','));
    } else {
      rows.push([date, e.voided ? 'payment (void)' : 'payment', e.payment.note || '', e.currency, formatMajor(e.amountMinor, e.currency), '', formatMajor(e.runningMinor, displayCurrency)].map(q).join(','));
    }
  }
  return rows.join('\n');
}

// --- Booster side: the message and CSV a booster sends a client about what is still unpaid ---------------------

const CLIENT_LABELS = {
  en: {
    title: (name) => `**Unpaid jobs for ${name}**`,
    due: 'Total due',
    unpaid: 'Jobs',
    recent: 'Recent payments',
    settled: 'Everything is paid up. Nothing is due.',
    approx: 'Amounts in mixed currencies are converted at today\'s rates.',
  },
  fa: {
    title: (name) => `**کارهای تسویه‌نشده ${name}**`,
    due: 'جمع بدهی',
    unpaid: 'کارها',
    recent: 'آخرین پرداخت‌ها',
    settled: 'حساب کاملاً تسویه است.',
    approx: 'مبالغ با ارزهای مختلف به نرخ امروز تبدیل شده‌اند.',
  },
};

/** @param statement the result of payerStatement() */
export function buildClientStatementText({ party, statement, displayCurrency, language = 'en', formatMinor, formatDate }) {
  const L = CLIENT_LABELS[language] || CLIENT_LABELS.en;
  const unpaid = statement.events.filter((e) => e.type === 'job' && e.done && e.appliedMinor < e.amountMinor);
  const payments = statement.events.filter((e) => e.type === 'payment' && !e.voided).slice(-5);
  const lines = [L.title(party.name), ''];
  if (statement.owedMinor <= 0 && unpaid.length === 0) {
    lines.push(L.settled);
  } else {
    lines.push(`${L.due}: **${formatMinor(statement.owedMinor, displayCurrency)}**`);
    lines.push('', `__${L.unpaid}__`);
    for (const e of unpaid) lines.push(`• ${e.order.title || e.order.orderRef || '-'} (${formatDate(e.order.dateTime)}): ${formatMinor(e.amountMinor - e.appliedMinor, e.currency)}`);
  }
  if (payments.length) {
    lines.push('', `__${L.recent}__`);
    for (const e of payments) lines.push(`✓ ${formatDate(e.payment.dateTime)}: ${formatMinor(e.amountMinor, e.currency)}`);
  }
  if (statement.isApproximate) lines.push('', `_${L.approx}_`);
  return lines.join('\n');
}

export function buildClientStatementCsv({ statement, displayCurrency, formatMajor }) {
  const q = (v) => {
    if (typeof v === 'number') return `"${v}"`;
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [['Date', 'Type', 'Description', 'Status', 'Currency', 'Amount', 'Paid', `Balance (${displayCurrency})`].map(q).join(',')];
  for (const e of statement.events) {
    const date = new Date(e.at).toISOString().slice(0, 10);
    if (e.type === 'job') {
      rows.push([date, 'job', e.order.title || e.order.orderRef || '', e.order.lifecycle, e.currency, formatMajor(e.amountMinor, e.currency), formatMajor(e.appliedMinor, e.currency), formatMajor(e.runningMinor, displayCurrency)].map(q).join(','));
    } else {
      rows.push([date, e.voided ? 'payment (void)' : 'payment', e.payment.note || '', '', e.currency, formatMajor(e.amountMinor, e.currency), '', formatMajor(e.runningMinor, displayCurrency)].map(q).join(','));
    }
  }
  return rows.join('\n');
}
