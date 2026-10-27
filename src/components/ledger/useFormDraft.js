import { useCallback, useEffect, useRef, useState } from 'react';
import { trackerDB } from '../../lib/db';
import { useLedger } from './LedgerProvider';

/** Every draft lives under this prefix, in the active profile's settings (db.js keeps it per profile). */
export const DRAFT_PREFIX = 'checkpoint_draft_';
const SAVE_DELAY_MS = 350;
const VERSION = 1;
const EMPTY = '\u0000empty';

/**
 * Keeps what was typed in a dialog, so closing it by accident (Esc, a click outside, a crash) loses nothing.
 *
 *  - while the dialog is open, the form is written to the profile's settings shortly after each change, and once
 *    more the moment it closes
 *  - opening the same dialog again (the same new entry, or the same record being edited) puts the draft back
 *  - a form that is back to how it opened stores nothing; saving the record or pressing Clear drops the draft
 *
 * key:     one per form and record, e.g. "job_new" or "order_ord_123". null turns drafts off.
 * value:   the form fields, plain JSON (screenshots are not kept: they can be large and are pasted again easily)
 * restore: (savedValue) => void, sets the fields back
 * stamp:   optional. The version of the record being edited (its updatedAt). A draft is only put back while the
 *          record is still that version: if it changed elsewhere since, the draft is stale and is dropped.
 * hasContent: (value) => boolean, optional. Whether anything was actually typed. A form without content is never
 *          kept, whatever else differs from how it opened (the date moving to the next minute, say).
 * Returns { restored, dirty, clear(reset), discard() }.
 */
export function useFormDraft({ open, key, value, restore, hasContent, stamp = null }) {
  // drafts live in the app-wide settings with the profile in the key, so a draft written while the app is switching
  // profiles can never end up in the other profile's database
  const { profileId } = useLedger();
  const storageKey = key ? `${DRAFT_PREFIX}${profileId}_${key}` : null;
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0); // bumped by Clear, so the fresh form is captured as "unchanged" again
  const baselineRef = useRef(null); // the form as it opened; null until captured
  const latestRef = useRef(null);
  const timerRef = useRef(null);
  const stoppedRef = useRef(null); // the form as it was when the record was saved, so the closing flush does not write it back; typing more lifts it
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const stampRef = useRef(stamp);
  stampRef.current = stamp;
  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;

  // an empty form is the same as "unchanged": nothing to keep
  const empty = hasContent ? !hasContent(value) : false;
  const json = empty ? EMPTY : JSON.stringify(value ?? null);
  latestRef.current = json;

  const write = useCallback((text) => {
    if (!storageKey || text === stoppedRef.current) return;
    if (text === EMPTY || (text === baselineRef.current && baselineRef.current !== null)) {
      trackerDB.setSetting(storageKey, null).catch(() => {});
    } else {
      trackerDB.setSetting(storageKey, { v: VERSION, at: new Date().toISOString(), stamp: stampRef.current ?? null, data: JSON.parse(text) }).catch(() => {});
    }
  }, [storageKey]);

  // opening: look for a draft, put it back, then start watching for changes
  useEffect(() => {
    if (!open || !storageKey) return undefined;
    let live = true;
    stoppedRef.current = null;
    baselineRef.current = null;
    setRestored(false);
    setReady(false);
    trackerDB.getSetting(storageKey, null)
      .then((saved) => {
        if (!live) return;
        if (saved && saved.v === VERSION && (saved.stamp ?? null) === (stampRef.current ?? null) && saved.data && typeof saved.data === 'object' && !(hasContentRef.current && !hasContentRef.current(saved.data))) {
          restoreRef.current?.(saved.data);
          setRestored(true);
        }
      })
      .catch(() => {})
      .finally(() => { if (live) setReady(true); });
    return () => {
      live = false;
      // closing (or switching records): write what is there right away, nothing waits for the timer
      clearTimeout(timerRef.current);
      if (baselineRef.current !== null && latestRef.current !== null) write(latestRef.current);
    };
  }, [open, storageKey, write]);

  // the first render after loading is the form as it opened: what "unchanged" means
  useEffect(() => {
    if (!ready || !open || baselineRef.current !== null) return;
    // a restored draft is kept even if it is never touched again
    baselineRef.current = restored ? '\u0000restored' : json;
  }, [ready, open, restored, json, epoch]);

  // changes: write shortly after typing stops
  useEffect(() => {
    if (!ready || !open || baselineRef.current === null) return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => write(json), SAVE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [json, ready, open, write]);

  /** The record was saved: forget the draft. */
  const discard = useCallback(async () => {
    stoppedRef.current = latestRef.current;
    clearTimeout(timerRef.current);
    if (storageKey) await trackerDB.setSetting(storageKey, null).catch(() => {});
  }, [storageKey]);

  /** "Clear": empty the form (`reset` puts the fields back to how a fresh dialog opens) and forget the draft. */
  const clear = useCallback((reset) => {
    clearTimeout(timerRef.current);
    if (storageKey) trackerDB.setSetting(storageKey, null).catch(() => {});
    reset?.();
    setRestored(false);
    baselineRef.current = null; // the next render, with the fresh fields, becomes the new "unchanged"
    setEpoch((n) => n + 1);
  }, [storageKey]);

  const dirty = ready && !empty && baselineRef.current !== null && (restored || json !== baselineRef.current);
  return { restored, dirty, clear, discard };
}
