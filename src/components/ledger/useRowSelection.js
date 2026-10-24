import { useCallback, useEffect, useMemo, useState } from 'react';
import { pruneSelection, rangeSelect, toggleId } from '../../lib/ledger/selection';
import { hasOpenDialog } from '../ui/Dialog';

const isTyping = (el) => Boolean(el && (el.matches?.('input, textarea, select, [contenteditable="true"]') || el.isContentEditable));
const isControl = (el) => Boolean(el?.closest?.('button, a, input, select, textarea, label, [role="button"]'));

/**
 * Select mode for a list. Checkboxes stay hidden until it is on; "Select" in the toolbar turns it on, and so does
 * Ctrl/Cmd or Shift-clicking a row, Ctrl/Cmd+A, or ticking a checkbox. In select mode a click on a row ticks it
 * instead of opening the receipt.
 *
 * `orderedIds` is every row the filters allow, in list order, not just the page on screen, so "select all" and
 * shift-range cover what the user can see once they scroll or load more.
 *
 *   Shift-click        tick the rows between the anchor and this one
 *   Ctrl/Cmd+A         select every filtered row (not while typing or a dialog is open)
 *   Escape             leave select mode and clear the selection (not while a dialog is open)
 *
 * Selected ids that drop out of the list (filtered away, deleted) are ignored.
 */
export function useRowSelection(orderedIds) {
  const [selected, setSelected] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [active, setActive] = useState(false);

  // a new array every render, so key the memos on the ids themselves
  const idKey = orderedIds.join('\u0001');
  const live = useMemo(() => pruneSelection(selected, orderedIds), [selected, idKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((id, event) => {
    setActive(true);
    if (event?.shiftKey && anchor !== null) {
      const span = rangeSelect(orderedIds, anchor, id);
      setSelected((s) => new Set([...s, ...span]));
      return;
    }
    setSelected((s) => toggleId(s, id));
    setAnchor(id);
  }, [anchor, idKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectAll = useCallback(() => {
    setActive(true);
    setSelected(new Set(orderedIds));
  }, [idKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => { setSelected(new Set()); setAnchor(null); }, []);
  const enter = useCallback(() => setActive(true), []);
  const exit = useCallback(() => { setActive(false); setSelected(new Set()); setAnchor(null); }, []);

  // the click handler for a row: outside select mode a plain click opens it (via `open`); a modifier click or any
  // click in select mode ticks it; clicks on the row's own buttons, links and fields are left alone
  const rowClick = useCallback((id, open) => (e) => {
    if (isControl(e.target)) return;
    if (active || e.ctrlKey || e.metaKey || e.shiftKey) {
      pick(id, e);
      return;
    }
    if (String(window.getSelection?.() || '').length > 0) return;
    open();
  }, [active, pick]);

  useEffect(() => {
    const onKey = (e) => {
      if (hasOpenDialog() || isTyping(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape' && (active || live.size > 0)) {
        exit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectAll, exit, active, live.size]);

  return { selected: live, active, pick, rowClick, selectAll, clear, enter, exit, has: (id) => live.has(id) };
}
