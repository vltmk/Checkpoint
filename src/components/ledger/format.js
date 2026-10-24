import { useCallback } from 'react';
import { formatMoney } from '../../lib/currencies';
import { fromMinor } from '../../lib/ledger/money';
import { useLanguage, formatLedgerGroupDate } from '../../lib/i18n';
import { SHAMSI_MONTHS, dateToJalali, toPersianDigits } from '../../lib/persianCalendar';
import { UNASSIGNED_PARTY_ID, UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';

/** "Paid {name} {amount}" -> fills {tokens}. Missing tokens are left visible so mistakes are noticed in review. */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

/** Text formatting for integer minor-unit money, following the app language (Persian digits in Farsi). */
export function useLedgerFormat() {
  const { language, t, formatNumber, formatDate, isRtl } = useLanguage();
  const isFa = language === 'fa';
  // Always exact (see Money in parts.jsx): a shortened amount in a sentence or CSV hides what is owed.
  const money = useCallback(
    (minor, currency) => {
      const text = formatMoney(fromMinor(minor, currency), currency, false, isFa);
      // English sentences should not carry the Farsi unit word
      return isFa ? text : text.replace('تومان', 'Toman');
    },
    [isFa]
  );
  const date = useCallback(
    (iso) => (iso ? formatDate(iso, { year: 'numeric', month: 'short', day: 'numeric' }) : ''),
    [formatDate]
  );
  // The time of day on a row: 10:45 AM in English, 24-hour in Persian digits in Farsi
  const time = useCallback((iso) => {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    return isFa
      ? new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
      : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [isFa]);
  // "Today", "Yesterday", else "Mon, Oct 19" (Shamsi in Farsi): the heading of a day group
  const dayLabel = useCallback((iso) => formatLedgerGroupDate(iso, 'relative', language, t), [language, t]);
  const tt = useCallback((key, fallback, vars) => fill(t(key, fallback), vars), [t]);
  // The upgrade creates two placeholder people. Their stored names are English, so show them in the user's language.
  const name = useCallback((party) => {
    if (!party) return '—';
    if (party.id === UNASSIGNED_PARTY_ID) return t('lg.party.unassigned', 'Unassigned');
    if (party.id === UNKNOWN_PAYER_ID || party.id === '') return t('lg.party.unknownPayer', 'Direct / unknown');
    return party.name;
  }, [t]);
  // Reports group by calendar month in the user's own calendar: Shamsi in Farsi, Gregorian in English.
  const monthKey = useCallback((iso) => {
    if (!iso) return '';
    if (isFa) {
      const { jy, jm } = dateToJalali(iso);
      return `${jy}-${String(jm).padStart(2, '0')}`;
    }
    return String(iso).slice(0, 7);
  }, [isFa]);
  const monthLabel = useCallback((key) => {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return '';
    if (isFa) return `${SHAMSI_MONTHS[m - 1]} ${toPersianDigits(y)}`;
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }, [isFa]);
  return { money, date, time, dayLabel, name, t: tt, language, isFa, isRtl, formatNumber, monthKey, monthLabel };
}

/** Days between an ISO date and now, whole days. */
export function daysSince(iso, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : 0;
}
