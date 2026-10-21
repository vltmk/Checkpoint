import { useEffect, useState } from 'react';
import { trackerDB } from '../../lib/db';
import { useLedger } from './LedgerProvider';

/**
 * The ids of the orders that have at least one screenshot: proofs saved on the order itself, plus the ones an
 * order brought with it from the old ledger (kept on the legacy entry). Rows use this to show the screenshots
 * button only when there is something to open. Empty until it has loaded, so a button never flashes in and out.
 */
export function useOrderProofs() {
  const ledger = useLedger();
  const { ctx } = ledger;
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (!ctx) return undefined;
    let live = true;
    (async () => {
      const found = new Set();
      try {
        const counts = await ledger.store()?.countProofsByOwner();
        for (const [key, n] of Object.entries(counts || {})) if (n > 0 && key.startsWith('order:')) found.add(key.slice(6));
      } catch { /* no proofs is a fine answer */ }
      try {
        const legacy = ctx.orders.filter((o) => o.legacyId);
        if (legacy.length) {
          const withProofs = new Set((await trackerDB.getAllEntries()).filter((e) => e.proofs?.length > 0).map((e) => e.id));
          for (const o of legacy) if (withProofs.has(o.legacyId)) found.add(o.id);
        }
      } catch { /* old proofs are optional */ }
      if (live) setIds(found);
    })();
    return () => { live = false; };
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  return ids;
}
