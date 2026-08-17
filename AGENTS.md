# AGENTS.md - Nodra Pay Collaboration & Architecture Guide

Welcome to the **Nodra Pay** project! This guide is written for AI agents and human developers to keep context, conventions, and implementation workflows smooth for future extensions.

---

## 1. Project Mission & Overview

**Nodra Pay** is a high-density, minimal, pure-black glassmorphic freelance ledger application specifically tailored for **gaming freelancers, game devs, 3D/2D artists, QA testers, modders, and esports coaches**.

### Key Value Propositions
- **Instant Proof Attachment**: `Ctrl+V` clipboard pasting directly from the screen capture tool (`Win+Shift+S`) or drag-and-drop into the work modal.
- **Gaming & In-Game Currency Support**: Native support for **USD, Iranian Toman (تومان), EUR, GBP, USDT**, as well as in-game currencies (**Robux, Valorant Points, V-Bucks, WoW Gold, OSRS GP, TF2 Keys, Minecoins**).
- **Pure Black Glassmorphism & Motion**: Pure black foundation (`#000000`) with translucent radial gradients, `backdrop-blur-2xl`, borderless shaded depths, Inter typography, and fluid spring micro-interactions powered by `motion/react`.
- **Keyboard Shortcuts & Power-User Controls**: Press <kbd>?</kbd> for cheat-sheet, <kbd>N</kbd> for new entry, <kbd>/</kbd> to search, <kbd>V</kbd> to toggle views, <kbd>A</kbd> to toggle analytics, <kbd>E</kbd> to export CSV, <kbd>B</kbd> for JSON backup.
- **1-Click Inline Status Flip & Proof Receipts**: Instant status cycling and 1-click client proof-of-work receipt slips.
- **Zero Quota Limit Storage**: Built on **IndexedDB** (`src/lib/db.js`) to allow saving large screenshot proofs without hitting `localStorage` quota restrictions.

---

## 2. Tech Stack & Architecture

- **Framework & Toolchain**: Vite + React 18
- **Styling**: Tailwind CSS + Pure Black Glassmorphic Design System (`src/index.css`, `tailwind.config.js`)
- **Animation**: `motion` (`motion/react`)
- **Icons**: Lucide React (`lucide-react`)
- **Visuals & Charts**: Chart.js (`react-chartjs-2`)
- **Storage**: IndexedDB (`src/lib/db.js`) with JSON and CSV export/import
- **Typography**: Google Fonts (`Inter` primary font, `JetBrains Mono` for code/keys)

---

## 3. File Map

```
jolly-pasteur/
├── src/
│   ├── components/
│   │   ├── ui/                 # Shadcn-style glass primitives (Button, Badge, Input, Select, Dialog, Tooltip)
│   │   ├── Header.jsx          # Glass top nav with brand badge, shortcuts button & currency switch
│   │   ├── MetricStrip.jsx     # High-density KPI strip with animated number rollups
│   │   ├── AnalyticsDrawer.jsx # Smooth collapsible charts (Monthly velocity & Game breakdown)
│   │   ├── Toolbar.jsx         # Floating glass pill toolbar with live search & multi-select filters
│   │   ├── LedgerTable.jsx     # High-density table with 1-click inline status flip & Motion transitions
│   │   ├── LedgerCards.jsx     # Compact card view with proof thumbnails
│   │   ├── WorkModal.jsx       # Glass modal with quick presets, drag-and-drop & Ctrl+V screenshot paste
│   │   ├── ReceiptModal.jsx    # Sleek Proof-of-Work receipt generator ready for client sharing/PDF
│   │   ├── ShortcutsModal.jsx  # Interactive keyboard shortcuts cheat-sheet modal (? key)
│   │   └── Lightbox.jsx        # Full-res screenshot viewer with download
│   ├── lib/
│   │   ├── db.js               # IndexedDB zero-quota storage wrapper
│   │   ├── currencies.js       # Formatter for Toman (تومان), Robux, VP, WoW Gold, USD, EUR, etc.
│   │   └── utils.js            # Tailwind clsx + twMerge utility
│   ├── App.jsx                 # Central reactive state engine & global keyboard shortcuts listener
│   ├── main.jsx                # React root
│   └── index.css               # Tailwind tokens & pure black glassmorphism utilities
├── index.html                  # HTML entry point (Inter font)
├── package.json                # Dependencies: react, motion, lucide-react, tailwindcss, vite
├── tailwind.config.js          # Pure black glassmorphism config
├── vite.config.js              # Vite configuration
├── README.md                   # Updated documentation
└── AGENTS.md                   # Collaboration & manual git workflow guide
```

---

## 4. Coding Conventions & Best Practices

1. **Keep UI Dense and Pure Black Glassmorphic**:
   - Use `#000000` base, subtle ambient gradient meshes, `bg-white/[0.035]` to `bg-white/[0.08]` shades, and `ring-1 ring-white/10` specular lines.
   - Use `Inter` font tokens (`--font-sans`). Monospace is used strictly for keyboard caps or short IDs.
2. **Motion Library Import**:
   - Always import Motion components from `"motion/react"` (e.g. `import { motion, AnimatePresence } from "motion/react"`).
3. **Currency Consistency**:
   - In `src/lib/currencies.js`, currency formatting is handled via `formatMoney(amount, currencyCode)`.
   - Iranian Toman (`TOMAN`) and in-game currencies format as integer numbers with appropriate suffixes (e.g. `1,250,000 تومان`, `45,000 R$`).
4. **IndexedDB Operations**:
   - All persistence calls must go through `trackerDB` in `src/lib/db.js`.
   - Work entries have unique string IDs (e.g. `job_<timestamp>_<rand>`) and store proofs as base64 data URLs in `entry.proofs`.

---

## 5. Git Workflow & Manual Push Protocol

To ensure full control over commits and pushes, all git operations are performed manually by the user. Agents should prepare and update project files, update `AGENTS.md` / `README.md`, and then provide the exact staging and push commands for the user to run.

### Staging & Push Commands
```bash
# 1. Review status & modified files
git status

# 2. Stage all files
git add .

# 3. Create descriptive commit
git commit -m "feat: complete React + Tailwind + Motion migration with pure black glassmorphism, shortcuts guide, proof receipts and gaming presets"

# 4. Push to remote
git push -u origin main
```

### Subsequent Updates Protocol
```bash
git add .
git commit -m "feat/fix: <clear concise description of change>"
git push
```

### Commit Message Conventions
- `feat:` for new features (e.g. `feat: add kanban board view`)
- `fix:` for bug fixes (e.g. `fix: resolve chart resizing issue on mobile`)
- `refactor:` for code or style cleanups (e.g. `refactor: optimize IndexedDB queries`)
- `docs:` for documentation updates (e.g. `docs: update AGENTS.md`)
