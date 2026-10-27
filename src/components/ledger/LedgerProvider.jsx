import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { trackerDB } from '../../lib/db';
import { buildContext } from '../../lib/ledger/engine';
import * as actions from '../../lib/ledger/actions';
import { isDemoId } from '../../lib/ledger/sampleData';

const LedgerContext = createContext(null);

/**
 * Loads the v2 ledger for the active profile, runs the one-time upgrade from legacy entries, and exposes the
 * derived context plus the money actions. Every action reloads afterwards, so screens never hold stale math.
 */
export function LedgerProvider({ profileId, dataVersion = 0, rates, displayCurrency, children }) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [interrupted, setInterrupted] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  // Booster side: which client is open ('' is "no payer", null is none)
  const [selectedClientKey, setSelectedClientKey] = useState(null);
  // Booster side: the Clients screen shows clients or the team I pay ('clients' | 'team')
  const [clientsView, setClientsView] = useState('clients');
  const storeRef = useRef(null);
  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  const reload = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    let loaded = await store.loadAll();
    // orders from before rates were saved per job are frozen at today's rates, once, so rate changes stop moving them
    if (loaded.orders.some((o) => !o.rates && o.kind !== 'expense') && Number(ratesRef.current?.usdRateTOMAN) > 0) {
      try {
        if (await store.lockOrderRates(ratesRef.current)) loaded = await store.loadAll();
      } catch (e) {
        console.warn('Could not save rates on older orders', e);
      }
    }
    setData(loaded);
    setStatus('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    (async () => {
      try {
        const store = await trackerDB.getLedgerStore(profileId);
        storeRef.current = store;
        const migration = await trackerDB.ensureLedgerMigrated(profileId);
        if (cancelled) return;
        const left = await store.takeInterrupted();
        await reload();
        if (cancelled) return;
        if (left) setInterrupted(left);
        if (migration?.migrated && migration.counts?.orders > 0) setNotice({ ...migration.counts, snapshot: migration.snapshot !== false });
      } catch (e) {
        console.error('Ledger failed to load', e);
        if (!cancelled) {
          setError(e);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, reload]);

  // Something outside the ledger changed data (import, restore). A restore wipes the ledger first, so the upgrade
  // from legacy entries has to run again before reloading, or a legacy-only backup would leave it empty.
  useEffect(() => {
    if (dataVersion > 0 && storeRef.current) {
      trackerDB.ensureLedgerMigrated(profileId).catch((e) => console.warn('Ledger upgrade after import failed', e)).then(() => reload()).catch(() => {});
    }
  }, [dataVersion, reload, profileId]);

  const ctx = useMemo(() => (data ? buildContext(data) : null), [data]);
  const partyById = useMemo(() => new Map((data?.parties || []).map((p) => [p.id, p])), [data]);
  const hasDemo = useMemo(() => Boolean(data?.orders.some((o) => isDemoId(o.id))), [data]);
  const unresolvedFlags = useMemo(() => (data?.flags || []).filter((f) => !f.resolved && f.code !== 'approximate_rate'), [data]);

  // Run a write, then reload. The caller catches errors to show them inline.
  const run = useCallback(
    async (fn) => {
      const result = await fn(storeRef.current);
      await reload();
      return result;
    },
    [reload]
  );

  const api = useMemo(
    () => ({
      profileId,
      status,
      error,
      ctx,
      data,
      partyById,
      unresolvedFlags,
      hasDemo,
      removeSample: () => run((s) => s.removeDemo()),
      notice,
      dismissNotice: () => setNotice(null),
      interrupted,
      dismissInterrupted: async () => { await storeRef.current?.dismissInterrupted(); setInterrupted(null); },
      importRecords: (records) => run((s) => s.mergeAll(records)),
      selectedPartyId,
      setSelectedPartyId,
      selectedClientKey,
      setSelectedClientKey,
      clientsView,
      setClientsView,
      rates,
      displayCurrency,
      reload,
      store: () => storeRef.current,
      // people
      addPerson: (kind, name) => run((s) => s.ensureParty(kind, name)),
      // the currency this person is usually paid in: payments to them start in it
      setPartySettings: (partyId, patch) => run((s) => s.savePartySettings(partyId, patch)),
      renamePerson: (party, name) => run((s) => s.saveParty({ ...party, name })),
      archivePerson: (party, archived) => run((s) => s.saveParty({ ...party, archived: archived ? 1 : 0 })),
      // orders
      saveOrder: (payload) => run((s) => s.saveOrder(payload)),
      setLifecycle: (orderId, lifecycle) => run((s) => s.setLifecycle(orderId, lifecycle)),
      // a deleted record takes its unsaved edit drafts with it
      deleteOrder: async (orderId) => {
        await run((s) => s.deleteOrder(orderId));
        for (const k of ['job', 'order']) trackerDB.setSetting(`checkpoint_draft_${profileId}_${k}_${orderId}`, null).catch(() => {});
      },
      // money
      settleUp: (p) => run((s) => actions.settleUp(s, { rates: ratesRef.current, ...p })),
      addAdvance: (p) => run((s) => actions.addAdvance(s, { rates: ratesRef.current, ...p })),
      receivePayout: (p) => run((s) => actions.receivePayout(s, { rates: ratesRef.current, ...p })),
      markSharePaid: (shareId) => run((s) => actions.markSharePaid(s, shareId, { rates: ratesRef.current })),
      undoPaid: (targetType, targetId) => run((s) => actions.undoPaid(s, targetType, targetId)),
      markOrderCollected: (orderId) => run((s) => actions.markOrderCollected(s, orderId, { rates: ratesRef.current })),
      writeOff: (orderId, note) => run((s) => actions.writeOffOrder(s, orderId, { rates: ratesRef.current, note })),
      voidPayment: (paymentId, note) => run((s) => s.voidPayment(paymentId, note)),
      // an expense that is not tied to any person or order (repairs, consumables...)
      addExpense: ({ amountMinor, currency, dateTime, note }) => run((s) => s.recordPayment({ payment: { direction: 'out', partyId: null, amountMinor, currency, rates: ratesRef.current, kind: 'expense', dateTime, note } })),
      resolveFlag: (id) => run((s) => s.resolveFlag(id)),
      // proofs
      addProof: (p) => run((s) => s.addProof(p)),
      removeProof: (id) => run((s) => s.removeProof(id)),
      listProofs: (type, id) => storeRef.current.listProofs(type, id),
    }),
    [profileId, status, error, ctx, data, partyById, unresolvedFlags, hasDemo, notice, interrupted, selectedPartyId, selectedClientKey, clientsView, rates, displayCurrency, reload, run]
  );

  return <LedgerContext.Provider value={api}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const v = useContext(LedgerContext);
  if (!v) throw new Error('useLedger must be used inside <LedgerProvider>');
  return v;
}
