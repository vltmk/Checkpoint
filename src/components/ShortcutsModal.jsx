import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Kbd } from './ui/Tooltip';
import { Keyboard, Sparkles } from 'lucide-react';

export function ShortcutsModal({ isOpen, onClose }) {
  const shortcutGroups = [
    {
      group: 'Workflow & Creation',
      items: [
        { keys: ['N'], desc: 'Open Log Work modal' },
        { keys: ['Ctrl', 'V'], desc: 'Paste screenshot from clipboard into modal' },
        { keys: ['Esc'], desc: 'Close open modal, lightbox or clear search' },
      ],
    },
    {
      group: 'Navigation & Views',
      items: [
        { keys: ['/'], desc: 'Focus global search input' },
        { keys: ['V'], desc: 'Toggle Table view vs Compact Cards' },
        { keys: ['A'], desc: 'Toggle Analytics charts drawer' },
        { keys: ['?'], desc: 'Show this keyboard shortcuts modal' },
      ],
    },
    {
      group: 'Data & Backup',
      items: [
        { keys: ['E'], desc: 'Export ledger to CSV' },
        { keys: ['B'], desc: 'Backup full ledger with screenshots as JSON' },
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
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {grp.group}
            </h4>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
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
                          <span className="text-zinc-400 text-[10px]">+</span>
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
        <Button variant="primary" size="sm" onClick={onClose} className="w-full sm:w-auto">
          Got It
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
