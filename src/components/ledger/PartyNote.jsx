import React, { useEffect, useState } from 'react';
import { Input } from '../ui/Input';
import { useLedgerFormat } from './format';

const CONTACT_MAX = 120;
const NOTE_MAX = 2000;

/**
 * The panel that opens under a selected Boosters / Clients card: how to reach them, and anything worth remembering
 * about them. Saved on blur, into the person's own settings, so it lives with the ledger and survives restarts.
 */
export function PartyNote({ party, onSave }) {
  const f = useLedgerFormat();
  const saved = party.settings || {};
  const [contact, setContact] = useState(saved.contact || '');
  const [note, setNote] = useState(saved.note || '');

  // another person selected, or the record changed elsewhere: show what is stored
  useEffect(() => {
    setContact(saved.contact || '');
    setNote(saved.note || '');
  }, [party.id, saved.contact, saved.note]);

  const commit = () => {
    const next = { contact: contact.trim().slice(0, CONTACT_MAX), note: note.trim().slice(0, NOTE_MAX) };
    if (next.contact === (saved.contact || '') && next.note === (saved.note || '')) return;
    onSave(next);
  };

  return (
    <div
      className="space-y-2 px-3 pb-3"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="block">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.party.contact', 'Contact (Discord, Telegram...)')}</span>
        <Input
          dir="ltr"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onBlur={commit}
          maxLength={CONTACT_MAX}
          placeholder={f.t('lg.party.contactPh', 'username, link or phone')}
          aria-label={f.t('lg.party.contact', 'Contact (Discord, Telegram...)')}
          className="mt-0.5 text-xs"
        />
      </label>
      <label className="block">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.t('lg.party.note', 'Notes')}</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commit}
          maxLength={NOTE_MAX}
          placeholder={f.t('lg.party.notePh', 'Rates they agreed, how they like to be paid, what to watch for...')}
          aria-label={f.t('lg.party.note', 'Notes')}
          className="mt-0.5 w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-500"
        />
      </label>
    </div>
  );
}
