import { fromMinor } from '../../lib/ledger/money';
import { toCsv } from '../../lib/ledger/selectors';

/**
 * Marks each live, unpaid row collected, one at a time (each write reloads the ledger, so they cannot run in parallel).
 * Returns how many were marked and the last error, if any, so one bad row does not hide the others.
 */
export async function markRowsCollected(rows, markOne) {
  let marked = 0;
  let lastError = null;
  for (const r of rows) {
    if (r.dead || r.money.collected) continue;
    try {
      await markOne(r.order.id);
      marked += 1;
    } catch (e) {
      lastError = e;
    }
  }
  return { marked, lastError };
}

/**
 * The selected rows as CSV, in list order. Amounts are plain numbers in each order's own currency, so the sheet
 * can total them itself. Failed or refunded rows keep their figures but show nothing still to collect.
 */
export function selectionCsv(rows, { headers, payerName, date }) {
  const body = rows.map((r) => {
    const o = r.order;
    const c = o.currency;
    const live = !r.dead;
    return [
      date(o.dateTime),
      o.title || '',
      o.orderRef || '',
      o.game || '',
      payerName(r),
      c,
      fromMinor(o.grossMinor, c),
      fromMinor(o.platformFeeMinor || 0, c),
      fromMinor(r.marginMinor, c),
      fromMinor(live ? Math.max(0, r.money.receivableMinor - r.money.receivedMinor) : 0, c),
      fromMinor(r.money.receivedMinor, c),
    ];
  });
  return toCsv([headers, ...body]);
}
