/**
 * reportReceipt.js - a receipt-style summary of a Reports period, to keep for yourself or to share
 * (a client, a guild, an accountant). Pure: the caller passes already formatted text, so the same lines feed the
 * on-screen card, the plain text copy and the Discord copy.
 */
import { reportSummary } from './selectors.js';

const TOP_ROWS = 5;

/**
 * report: the result of marginReport. fmt: { money(minor), num(n), label(key) }. words: the labels in the user's language.
 * Returns { title, period, lines: [[label, value]], top: [[label, value]], keep, keepLabel }.
 * Lines that would only say "0" (no fees, no team, no expenses) are left out, as they are in the table.
 */
export function buildReportReceipt(report, { fmt, words, period, profile = 'advertiser', generatedAt = '' }) {
  const t = report.totals;
  const summary = report.rows.length ? reportSummary(report) : { keepMinor: 0, avgPerOrderMinor: 0, top: null };
  const lines = [[words.count, fmt.num(t.orders)]];
  if (t.feeMinor > 0 || t.boostersMinor > 0 || profile !== 'booster') lines.push([words.volume, fmt.money(t.volumeMinor)]);
  if (t.feeMinor > 0) lines.push([words.fee, `−${fmt.money(t.feeMinor)}`]);
  if (t.boostersMinor > 0) lines.push([words.team, `−${fmt.money(t.boostersMinor)}`]);
  if (t.expensesMinor > 0) {
    lines.push([words.margin, fmt.money(t.marginMinor)]);
    lines.push([words.expenses, `−${fmt.money(t.expensesMinor)}`]);
  }
  if (t.orders > 0) lines.push([words.average, fmt.money(summary.avgPerOrderMinor)]);
  const top = [...report.rows]
    .filter((r) => r.keepMinor !== 0)
    .sort((a, b) => b.keepMinor - a.keepMinor)
    .slice(0, TOP_ROWS)
    .map((r) => [fmt.label(r.key), fmt.money(r.keepMinor)]);
  return {
    title: words.title,
    period,
    generatedAt,
    lines,
    top,
    topTitle: words.topTitle,
    keepLabel: words.keep,
    keep: fmt.money(t.keepMinor),
    approximate: Boolean(report.isApproximate),
    approxNote: words.approx,
  };
}

/** Plain text: a framed list, one "Label: value" per line. */
export function reportReceiptText(rr) {
  const frame = '='.repeat(30);
  const out = [`=== ${rr.title.toUpperCase()} · CHECKPOINT ===`, rr.period];
  if (rr.generatedAt) out.push(rr.generatedAt);
  out.push('', ...rr.lines.map(([k, v]) => `${k}: ${v}`), `${rr.keepLabel}: ${rr.keep}`);
  if (rr.top.length) out.push('', `${rr.topTitle}:`, ...rr.top.map(([k, v]) => `- ${k}: ${v}`));
  if (rr.approximate) out.push('', rr.approxNote);
  out.push(frame);
  return out.join('\n');
}

/** A Discord `ini` code block with the keys padded to line up, like the order receipts. */
export function reportReceiptDiscord(rr) {
  const all = [...rr.lines, [rr.keepLabel, rr.keep]];
  const width = Math.min(16, Math.max(...all.map(([k]) => Array.from(k).length)));
  const pad = (k) => k + ' '.repeat(Math.max(0, width - Array.from(k).length));
  const out = ['```ini', `[ CHECKPOINT - ${rr.title} ]`, `; ${rr.period}`, ...all.map(([k, v]) => `${pad(k)} = ${v}`)];
  if (rr.top.length) out.push(`; ${rr.topTitle}`, ...rr.top.map(([k, v]) => `${pad(k)} = ${v}`));
  out.push('```');
  return out.join('\n');
}
