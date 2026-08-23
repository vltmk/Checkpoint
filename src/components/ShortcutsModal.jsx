import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Kbd } from './ui/Tooltip';
import { Keyboard } from 'lucide-react';

export function ShortcutsModal({ isOpen, onClose }) {
  const shortcutGroups = [
    {
      group: 'Actions & Entry',
      items: [
        { keys: ['N'], desc: 'Add work record (Full)' },
        { keys: ['Q'], desc: 'Quick add work record' },
        { keys: ['Ctrl', 'V'], desc: 'Paste screenshot proof into modal' },
        { keys: ['Esc'], desc: 'Close dialogs or clear search' },
      ],
    },
    {
      group: 'Navigation & Views',
      items: [
        { keys: ['1'], desc: 'Jump to Ledger tab' },
        { keys: ['2'], desc: 'Jump to Analytics tab' },
        { keys: ['/'], desc: 'Focus search bar' },
        { keys: ['?'], desc: 'Open shortcuts cheat sheet' },
      ],
    },
    {
      group: 'Data & Portability',
      items: [
        { keys: ['Alt', 'E'], desc: 'Export ledger to CSV' },
        { keys: ['Alt', 'B'], desc: 'Backup database to JSON' },
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-zinc-400" />
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4">
        {shortcutGroups.map((grp) => (
          <div key={grp.group} className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {grp.group}
            </h4>
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg divide-y divide-zinc-800/60 overflow-hidden">
              {grp.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span className="text-zinc-300 font-medium">{item.desc}</span>
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, kIdx) => (
                      <React.Fragment key={k}>
                        <Kbd>{k}</Kbd>
                        {kIdx < item.keys.length - 1 && (
                          <span className="text-zinc-500 text-[10px]">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DialogContent>

      <DialogFooter>
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export default ShortcutsModal;
