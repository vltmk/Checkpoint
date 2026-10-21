import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { trackerDB } from '../../lib/db';
import { buildReceipt } from '../../lib/ledger/receipt';
import { Lightbox } from '../Lightbox';
import { UNKNOWN_PAYER_ID } from '../../lib/ledger/legacyMapper';
import { Button } from '../ui/Button';
import { useLedger } from './LedgerProvider';
import { useLedgerFormat } from './format';
import { CockpitView } from './CockpitView';
import { BoosterOverview } from './BoosterOverview';
import { JobsView } from './JobsView';
import { ClientsView } from './ClientsView';
import { JobModal } from './JobModal';
import { ExpenseDialog } from './ExpenseDialog';
import { Segmented } from './parts';
import { OrdersView } from './OrdersView';
import { PeopleView } from './PeopleView';
import { MoneyView } from './MoneyView';
import { ReportsView } from './ReportsView';
import { PaymentDialog } from './PaymentDialog';
import { OrderModal } from './OrderModal';
import { ProofGallery } from './ProofGallery';
import { SheetImportDialog } from './SheetImportDialog';

// The receipt modal is large; it loads the first time someone opens a receipt
const LedgerReceipt = lazy(() => import('./LedgerReceipt').then((m) => ({ default: m.LedgerReceipt })));

/** The Advertiser profile's screens and the dialogs they open. App.jsx only decides which tab is active. */
const CURRENCY_CHOICES = ['TOMAN', 'USD', 'EUR', 'GOLD'];

export function LedgerShell({ activeTab, onTabChange, onCurrencyChange, categories, onRefreshCategories, newOrderSignal, quote }) {
  const ledger = useLedger();
  const f = useLedgerFormat();
  const { ctx, status, error } = ledger;

  const [payment, setPayment] = useState({ open: false, mode: 'pay', partyId: null, advance: false });
  const [order, setOrder] = useState({ open: false, existing: null, initial: null });
  const [proofs, setProofs] = useState({ open: false, ownerType: 'order', ownerId: null, title: '', legacyProofs: [] });
  const [receipt, setReceipt] = useState({ open: false, data: null });
  const [importOpen, setImportOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const isBooster = ledger.profileId === 'booster';
  const [lightbox, setLightbox] = useState({ open: false, src: '', caption: '' });

  const openPay = useCallback((partyId = null, opts = {}) => setPayment({ open: true, mode: 'pay', partyId, advance: Boolean(opts.advance) }), []);
  const openReceive = useCallback((partyId = null) => setPayment({ open: true, mode: 'receive', partyId, advance: false }), []);
  const openNewOrder = useCallback((initial = null) => setOrder({ open: true, existing: null, initial }), []);

  const openOrder = useCallback((orderId) => {
    if (!ctx) return;
    const o = ctx.orderById.get(orderId);
    if (!o) return;
    setOrder({ open: true, existing: { order: o, shares: ctx.shares.filter((s) => s.orderId === orderId && s.state !== 'cancelled') }, initial: null });
  }, [ctx]);

  const openProofs = useCallback(async (ownerType, ownerId, title, legacyId = null) => {
    let legacyProofs = [];
    if (legacyId) {
      try { legacyProofs = (await trackerDB.getEntry(legacyId))?.proofs || []; } catch { /* old proofs are optional */ }
    }
    setProofs({ open: true, ownerType, ownerId, title, legacyProofs });
  }, []);

  // Receipts, payout slips and Discord exports are built from the order and the payments that covered it
  const openReceipt = useCallback(async (orderId) => {
    const o = ledger.ctx?.orderById.get(orderId);
    if (!o) return;
    let proofList = await ledger.listProofs('order', orderId);
    if (o.legacyId) {
      try { proofList = [...((await trackerDB.getEntry(o.legacyId))?.proofs || []), ...proofList]; } catch { /* old proofs are optional */ }
    }
    setReceipt({ open: true, data: buildReceipt(ledger.data, orderId, { proofs: proofList }) });
  }, [ledger]);

  const openPerson = useCallback((partyId) => { ledger.setSelectedPartyId(partyId); onTabChange('people'); }, [ledger, onTabChange]);
  // a client is a payer: the upgrade's "Direct / unknown" placeholder and a job with no payer are the same entry
  const openClient = useCallback((id) => { ledger.setSelectedClientKey(id === UNKNOWN_PAYER_ID || !id ? '' : id); onTabChange('people'); }, [ledger, onTabChange]);

  // "Add work" in the top bar, the N shortcut and the calculator all arrive as a signal from App
  const lastSignal = useRef(newOrderSignal);
  useEffect(() => {
    if (newOrderSignal !== lastSignal.current) {
      lastSignal.current = newOrderSignal;
      openNewOrder(quote || null);
    }
  }, [newOrderSignal, quote, openNewOrder]);

  if (status === 'error') {
    return (
      <div role="alert" className="py-12 text-center">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{f.t('lg.loadError', 'Your orders could not be loaded.')}</p>
        <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">{String(error?.message || '')}</p>
        <p className="mt-1 text-xs text-zinc-500">{f.t('lg.loadErrorHelp', 'Your data is untouched. Restart Checkpoint, or restore a backup from Settings.')}</p>
        <Button className="mt-4" variant="outline" onClick={() => ledger.reload().catch(() => {})}>{f.t('lg.retry', 'Try again')}</Button>
      </div>
    );
  }
  if (!ctx) {
    return (
      <div className="space-y-2 py-4" aria-busy="true">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/50 animate-pulse" />)}
      </div>
    );
  }

  const tab = ['cockpit', 'orders', 'people', 'money', 'analytics'].includes(activeTab) ? activeTab : 'cockpit';
  const newItem = () => openNewOrder();

  return (
    <>
      {/* amounts can be shown in any currency; this changes every total on every screen at once */}
      {onCurrencyChange && (
        <div className="flex items-center justify-end gap-2 mb-5">
          <span className="text-[11px] text-zinc-400">{f.t('lg.cur.show', 'Show amounts in')}</span>
          <Segmented
            ariaLabel={f.t('lg.cur.show', 'Show amounts in')}
            value={ledger.displayCurrency}
            onChange={onCurrencyChange}
            options={CURRENCY_CHOICES.map((c) => ({ value: c, label: f.t(`lg.cur.${c}`, c) }))}
          />
        </div>
      )}

      {isBooster ? (
        <>
          {tab === 'cockpit' && <BoosterOverview onNavigate={onTabChange} onReceive={openReceive} onNewJob={newItem} onExpense={() => setExpenseOpen(true)} onOpenJob={openOrder} onImport={() => setImportOpen(true)} />}
          {tab === 'orders' && <JobsView categories={categories} onNewJob={newItem} onEdit={openOrder} onReceipt={openReceipt} onOpenProofs={openProofs} onOpenClient={openClient} />}
          {tab === 'people' && <ClientsView onReceive={openReceive} onPay={openPay} onOpenJob={openOrder} onOpenProofs={openProofs} onNewJob={newItem} />}
          {tab === 'money' && <MoneyView onPay={openPay} onReceive={openReceive} onOpenProofs={openProofs} />}
          {tab === 'analytics' && <ReportsView />}
        </>
      ) : (
        <>
          {tab === 'cockpit' && <CockpitView onNavigate={onTabChange} onPay={openPay} onReceive={openReceive} onNewOrder={newItem} onOpenOrder={openOrder} onImport={() => setImportOpen(true)} />}
          {tab === 'orders' && <OrdersView categories={categories} onNewOrder={newItem} onEdit={openOrder} onReceipt={openReceipt} onOpenProofs={openProofs} onOpenPerson={openPerson} />}
          {tab === 'people' && <PeopleView onPay={openPay} onOpenOrder={openOrder} onOpenProofs={openProofs} onNewOrder={newItem} />}
          {tab === 'money' && <MoneyView onPay={openPay} onReceive={openReceive} onOpenProofs={openProofs} />}
          {tab === 'analytics' && <ReportsView />}
        </>
      )}

      <PaymentDialog open={payment.open} mode={payment.mode} partyId={payment.partyId} advance={payment.advance} onClose={() => setPayment((p) => ({ ...p, open: false }))} />
      {isBooster
        ? <JobModal open={order.open} existing={order.existing} categories={categories} onRefreshCategories={onRefreshCategories} onClose={() => setOrder((o) => ({ ...o, open: false }))} />
        : <OrderModal open={order.open} existing={order.existing} initial={order.initial} categories={categories} onRefreshCategories={onRefreshCategories} onClose={() => setOrder((o) => ({ ...o, open: false }))} />}
      <ExpenseDialog open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <Suspense fallback={null}>
        <LedgerReceipt
          open={receipt.open}
          onClose={() => setReceipt({ open: false, data: null })}
          onEdit={(id) => { setReceipt({ open: false, data: null }); openOrder(id); }}
          receipt={receipt.data}
          profileId={ledger.profileId}
          onOpenLightbox={(src, caption) => setLightbox({ open: true, src, caption })}
        />
      </Suspense>
      <Lightbox isOpen={lightbox.open} imgSrc={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox({ open: false, src: '', caption: '' })} />
      <SheetImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ProofGallery open={proofs.open} ownerType={proofs.ownerType} ownerId={proofs.ownerId} title={proofs.title} legacyProofs={proofs.legacyProofs} onClose={() => setProofs((p) => ({ ...p, open: false }))} />
    </>
  );
}
