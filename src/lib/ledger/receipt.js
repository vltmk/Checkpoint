/**
 * receipt.js - what a receipt or payout slip says, built straight from the ledger.
 *
 * `buildReceipt` is pure: it reads one order, its shares and the payments that covered them, and returns plain
 * numbers (integer minor units) and names. The receipt card and the copy / Discord exports all render from that same
 * object, so they can never disagree. Formatting (digits, calendar, currency words) is injected as `fmt`, because a
 * receipt has its own language: a Farsi receipt can be sent from an English app.
 */
import { buildContext, orderMoneyState, orderMarginMinor, paymentsAppliedTo, shareAppliedMinor, isShareActive, isPaidByPayer, DEAD_LIFECYCLES } from './engine.js';
import { convertMinor, normalizeCurrency } from './money.js';

/** Short code printed on a receipt: the tail of the order id, upper case. */
export function receiptCode(orderId) {
  return String(orderId || 'JOB').replace(/^ord_/i, '').slice(-8).toUpperCase();
}

const latest = (applied) => {
  let best = null;
  for (const a of applied || []) {
    const t = Date.parse(a.payment?.dateTime);
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
};

/**
 * The receipt of one order, or null when it does not exist. `proofs` are the screenshots attached to it.
 * Dates are ISO strings. Amounts are in the order's own currency unless the name says otherwise.
 */
export function buildReceipt(data, orderId, { proofs = [] } = {}) {
  const ctx = buildContext(data);
  const order = ctx.orderById.get(orderId);
  if (!order) return null;
  const parties = new Map((data.parties || []).map((p) => [p.id, p]));
  const money = orderMoneyState(ctx, order);
  const dead = DEAD_LIFECYCLES.has(order.lifecycle);
  const currency = normalizeCurrency(order.currency);

  const shares = ctx.shares
    .filter((s) => s.orderId === orderId && s.state !== 'cancelled')
    .map((s) => {
      const applied = paymentsAppliedTo(ctx, 'share', s.id);
      // a teammate the client pays directly is settled as far as this receipt goes: nothing is owed to them by me
      const byPayer = isPaidByPayer(s);
      const paidMinor = byPayer ? s.amountMinor : shareAppliedMinor(ctx, s.id);
      return {
        id: s.id,
        partyId: s.partyId,
        name: parties.get(s.partyId)?.name || '',
        amountMinor: s.amountMinor,
        byPayer,
        paid: s.amountMinor > 0 && paidMinor >= s.amountMinor,
        paidAt: latest(applied),
        note: s.note || '',
        active: isShareActive(s, order),
        paidMinor,
      };
    });
  const activeShares = shares.filter((s) => s.active);
  const sharesTotalMinor = activeShares.reduce((sum, s) => sum + s.amountMinor, 0);
  const marginMinor = dead ? 0 : orderMarginMinor(ctx, order);

  const rates = order.rates || (Number(order.exchangeRate) > 0 ? { goldRateTOMAN: Number(order.exchangeRate) } : null);
  const perOne = order.rateUnit === '1' || rates?.isPerOneGold === true;
  const opts = { customRate: Number(order.exchangeRate) > 0 ? Number(order.exchangeRate) : Number(rates?.goldRateTOMAN) || null, isPerOneGold: perOne, rates: rates ? { usdRateTOMAN: rates.usdRateTOMAN, eurRateUSD: rates.eurRateUSD } : undefined };

  return {
    id: order.id,
    code: receiptCode(order.id),
    orderRef: order.orderRef || '',
    title: order.title || '',
    game: order.game || '',
    dateTime: order.dateTime,
    lifecycle: order.lifecycle,
    dead,
    currency,
    payer: parties.get(order.payerId)?.name || order.source || '',
    note: order.note || '',
    link: order.link || '',
    grossMinor: order.grossMinor,
    feeMinor: order.platformFeeMinor || 0,
    feePct: order.grossMinor > 0 && order.platformFeeMinor > 0 ? Math.round((order.platformFeeMinor / order.grossMinor) * 1000) / 10 : 0,
    shares: activeShares,
    sharesTotalMinor,
    marginMinor,
    collected: money.collected,
    partlyCollected: money.partlyCollected,
    receivedMinor: money.receivedMinor,
    collectedAt: latest(paymentsAppliedTo(ctx, 'order', orderId)),
    // the rates this order was priced at, shown only when they matter (anything not already in Toman)
    rates: currency !== 'TOMAN' && rates
      ? { goldRateTOMAN: Number(rates.goldRateTOMAN) || null, usdRateTOMAN: Number(rates.usdRateTOMAN) || null, eurRateUSD: Number(rates.eurRateUSD) || null, perOneGold: perOne }
      : null,
    // the same money in Toman at those rates, so a Dollar or Gold receipt says what it came to locally
    tomanMinor: (minor) => (currency === 'TOMAN' ? null : convertMinor(minor, currency, 'TOMAN', {}, opts)),
    proofs: proofs.map((p) => ({ id: p.id, name: p.name, data: p.data })),
  };
}

// --- words -------------------------------------------------------------------------------------------------------

export const RECEIPT_WORDS = {
  en: {
    clientTitle: 'Client receipt', slipTitle: 'Booster payout slip', workTitle: 'Proof of work receipt',
    clientSub: 'Official client order receipt', slipSub: 'Booster payout and settlement slip', workSub: 'Freelance and gaming ledger',
    total: 'Order total', payout: 'Total payout', earned: 'You earned', yourShare: 'Your share', pot: 'Team pot',
    from: 'From', payer: 'Platform / client', game: 'Game', date: 'Date', orderNo: 'Order', receiptNo: 'Receipt',
    boosters: 'Boosters', team: 'Team', fee: 'Platform fee', notes: 'Notes', proofs: 'Attached proofs', rates: 'Rates saved with this job',
    gold1k: '1,000 Gold', gold1: '1 Gold', toman: 'Toman', inToman: 'In Toman at these rates',
    paid: 'Paid', paidOn: 'Paid {date}', unpaid: 'Not paid yet', partly: 'Partly paid', progress: 'In progress', pending: 'Pending', onHold: 'On hold', failed: 'Failed', disputed: 'Disputed', refunded: 'Refunded', done: 'Done',
    status: 'Status', title: 'Title', untitled: 'Untitled work', direct: 'Direct',
    footClient: 'CHECKPOINT CLIENT ORDER', footSlip: 'CHECKPOINT BOOSTER PAYOUT', footWork: 'CHECKPOINT PROOF OF WORK',
    slipFor: 'Booster', copySlip: 'Copy this slip for {name}',
  },
  fa: {
    clientTitle: 'رسید مشتری', slipTitle: 'فیش تسویه بوستر', workTitle: 'رسید ثبت کار',
    clientSub: 'رسید رسمی سفارش مشتری', slipSub: 'فیش تسویه‌حساب و پرداخت بوستر', workSub: 'دفتر ثبت درآمد دیجیتال و گیمینگ',
    total: 'مبلغ سفارش', payout: 'مجموع تسویه', earned: 'درآمد شما', yourShare: 'سهم شما', pot: 'پات تیمی',
    from: 'از', payer: 'پلتفرم / مشتری', game: 'بازی', date: 'تاریخ', orderNo: 'سفارش', receiptNo: 'رسید',
    boosters: 'بوسترها', team: 'تیم', fee: 'کارمزد پلتفرم', notes: 'توضیحات', proofs: 'مدارک پیوست', rates: 'نرخ‌های ذخیره‌شده برای این کار',
    gold1k: '۱٬۰۰۰ گلد', gold1: '۱ گلد', toman: 'تومان', inToman: 'به تومان با این نرخ‌ها',
    paid: 'پرداخت شد', paidOn: 'پرداخت شد {date}', unpaid: 'هنوز پرداخت نشده', partly: 'پرداخت ناقص', progress: 'در حال انجام', pending: 'در انتظار', onHold: 'متوقف', failed: 'ناموفق', disputed: 'اختلاف', refunded: 'بازپرداخت', done: 'انجام شد',
    status: 'وضعیت', title: 'عنوان', untitled: 'کار بدون عنوان', direct: 'مستقیم',
    footClient: 'سفارش مشتری CHECKPOINT', footSlip: 'تسویه بوستر CHECKPOINT', footWork: 'گواهی انجام کار CHECKPOINT',
    slipFor: 'بوستر', copySlip: 'کپی فیش برای {name}',
  },
};

const fill = (template, vars = {}) => String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));

/** Status words for a receipt, in its language. `shareOrOrder` is the vm or one of its shares. */
export function statusText(vm, lang, fmt, { share = null } = {}) {
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  const paid = share ? share.paid : vm.collected;
  const paidAt = share ? share.paidAt : vm.collectedAt;
  if (!share && vm.dead) return w[{ failed: 'failed', disputed: 'disputed', refunded: 'refunded' }[vm.lifecycle]] || w.failed;
  if (paid) return paidAt ? fill(w.paidOn, { date: fmt.date(paidAt) }) : w.paid;
  if (share ? share.paidMinor > 0 : vm.partlyCollected) return w.partly;
  if (vm.lifecycle === 'done') return w.unpaid;
  return { pending: w.pending, working: w.progress, on_hold: w.onHold }[vm.lifecycle] || w.progress;
}

/** One of: 'paid' | 'unpaid' | 'progress' | 'dead', for colouring a status. */
export function statusTone(vm, { share = null } = {}) {
  if (!share && vm.dead) return 'dead';
  if (share ? share.paid : vm.collected) return 'paid';
  return vm.lifecycle === 'done' ? 'unpaid' : 'progress';
}

/** The headline number of a receipt for the chosen document. */
export function heroMinor(vm, mode) {
  if (mode === 'client') return vm.grossMinor;
  if (mode === 'slip') return vm.sharesTotalMinor;
  // the booster's own receipt: what they earned (their margin on a job split with a team, else the whole amount)
  return vm.marginMinor;
}

export function heroLabel(vm, mode, lang) {
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  if (mode === 'client') return w.total;
  if (mode === 'slip') return w.payout;
  return vm.shares.length > 0 ? w.yourShare : w.earned;
}

export function receiptTitle(mode, lang) {
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  return mode === 'client' ? w.clientTitle : mode === 'slip' ? w.slipTitle : w.workTitle;
}

export function receiptSubtitle(mode, lang) {
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  return mode === 'client' ? w.clientSub : mode === 'slip' ? w.slipSub : w.workSub;
}

/**
 * Whether a receipt shows your notes. The boosters' payout slip is handed to the boosters, and your notes on an order
 * (what the client agreed, what to watch for) are not theirs to read, so it leaves them out.
 */
export const showsNotes = (mode) => mode !== 'slip';

// --- copyable text -----------------------------------------------------------------------------------------------

/**
 * The facts of a receipt as [label, value] pairs, in order. Text and Discord exports are two renderings of these,
 * the card shows the same facts, so a copied receipt and a screenshot say the same thing.
 */
export function receiptLines(vm, mode, lang, fmt, { onlyShare = null } = {}) {
  const w = RECEIPT_WORDS[lang] || RECEIPT_WORDS.en;
  const lines = [];
  lines.push([w.receiptNo, vm.code]);
  if (vm.orderRef) lines.push([w.orderNo, `#${vm.orderRef}`]);
  lines.push([w.date, `${fmt.date(vm.dateTime)} ${fmt.time(vm.dateTime)}`.trim()]);
  if (vm.game) lines.push([w.game, vm.game]);
  lines.push([w.title, vm.title || w.untitled]);
  if (vm.payer) lines.push([mode === 'slip' ? w.from : w.payer, vm.payer]);

  if (mode === 'client') {
    lines.push([w.total, fmt.money(vm.grossMinor, vm.currency)]);
  } else if (mode === 'slip') {
    const rows = onlyShare ? [onlyShare] : vm.shares;
    for (const s of rows) {
      lines.push([onlyShare ? w.slipFor : w.boosters, `${s.name}: ${fmt.money(s.amountMinor, vm.currency)} (${statusText(vm, lang, fmt, { share: s })})`]);
      if (s.note && showsNotes(mode)) lines.push([w.notes, s.note]);
    }
    if (!onlyShare) lines.push([w.payout, fmt.money(vm.sharesTotalMinor, vm.currency)]);
  } else {
    if (vm.shares.length > 0) {
      lines.push([w.pot, fmt.money(vm.grossMinor - vm.feeMinor, vm.currency)]);
      lines.push([w.yourShare, fmt.money(vm.marginMinor, vm.currency)]);
      lines.push([w.team, vm.shares.map((s) => `${s.name}: ${fmt.money(s.amountMinor, vm.currency)}`).join(' | ')]);
    } else {
      lines.push([vm.dead ? w.total : w.earned, fmt.money(vm.dead ? vm.grossMinor : vm.marginMinor, vm.currency)]);
    }
    if (vm.feeMinor > 0) lines.push([w.fee, `${fmt.num(vm.feePct)}% (${fmt.money(vm.feeMinor, vm.currency)})`]);
  }
  if (vm.rates && mode !== 'client') {
    const r = vm.rates;
    const parts = [];
    if (vm.currency === 'GOLD' && r.goldRateTOMAN) parts.push(`${fmt.money(r.goldRateTOMAN, 'TOMAN')} / ${r.perOneGold ? w.gold1 : w.gold1k}`);
    if ((vm.currency === 'USD' || vm.currency === 'EUR') && r.usdRateTOMAN) parts.push(`$1 = ${fmt.money(r.usdRateTOMAN, 'TOMAN')}`);
    if (vm.currency === 'EUR' && r.eurRateUSD) parts.push(`€1 = $${fmt.num(r.eurRateUSD)}`);
    if (parts.length) lines.push([w.rates, parts.join(' · ')]);
  }
  lines.push([w.status, statusText(vm, lang, fmt)]);
  if (vm.note && showsNotes(mode)) lines.push([w.notes, vm.note]);
  return lines;
}

/** Plain text, one "Label: value" per line, framed. */
export function receiptPlainText(vm, mode, lang, fmt, opts) {
  const frame = '='.repeat(30);
  const head = `=== ${receiptTitle(mode, lang).toUpperCase()} · CHECKPOINT ===`;
  return [head, ...receiptLines(vm, mode, lang, fmt, opts).map(([k, v]) => `${k}: ${v}`), frame].join('\n');
}

/** A Discord `ini` code block, keys padded to line up. */
export function receiptDiscord(vm, mode, lang, fmt, opts) {
  const lines = receiptLines(vm, mode, lang, fmt, opts);
  const width = Math.min(14, Math.max(...lines.map(([k]) => Array.from(k).length)));
  const pad = (k) => k + ' '.repeat(Math.max(0, width - Array.from(k).length));
  return ['```ini', `[ CHECKPOINT - ${receiptTitle(mode, lang)} ]`, ...lines.map(([k, v]) => `${pad(k)} = ${v}`), '```'].join('\n');
}
