# AGENTS.md - Nodra Pay Collaboration & Architecture Guide

Welcome to the **Nodra Pay** project! This guide is written for AI agents and human developers to keep context, conventions, and implementation workflows smooth for future extensions.

---

## 1. Project Mission & Overview

**Nodra Pay** is a minimal, high-density pure-black glassmorphic freelance ledger application specifically tailored for **World of Warcraft & World of Warcraft Classic freelancers, boosters, GDKP runners, addon devs, and gaming creators**.

### Key Value Propositions
- **Instant Proof Attachment**: `Ctrl+V` clipboard pasting directly from the screen capture tool (`Win+Shift+S`) or drag-and-drop into the work modal.
- **WoW In-Game Gold & Fiat Rate Converter**: Plain-sight exchange rate bar (e.g. 1,000 WoW Gold = $0.035 USD or 2,500 Toman) that automatically converts in-game gold to real-world fiat across all metric cards, analytics charts, and table rows.
- **Simplified Universal Language**: Removed confusing financial jargon and replaced with clear everyday terms (`Paid`, `Pending`, `Working`, `On Hold`, `Total Earned`, `Average Rate`).
- **Shadcn-Style Glass UI Components**: Custom translucent glass dropdown menus (`Select.jsx`) and date/time picker (`DateTimePicker.jsx`) with a 1-click **⚡ Now** button.
- **Customizable Views**: Interactive toggles for KPI cards and charts with persistent preferences and dynamic responsive grid layout.
- **Floating Bottom-Left Dock**: Centralized Data menu (CSV, JSON Backup, JSON Restore) and Shortcuts guide (`?`) anchored at bottom-left.
- **Custom Typography**: Embedded `IRANYekanRd` for Persian/Arabic/Toman text, `IoskeleyMono` for numeric/code styling, and `Inter` for primary UI.
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
- **Typography**: `Inter` (sans), `IRANYekanRd` (farsi/toman), `IoskeleyMono` (mono)

---

## 3. File Map

```
jolly-pasteur/
├── fonts/
│   ├── Ioskeley-mono/          # Monospace font files (.woff2)
│   └── IranYekanRd/            # Persian / Arabic font files (.ttf)
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Badge.jsx       # Simplified status and tag badges
│   │   │   ├── Button.jsx      # Glass button primitive
│   │   │   ├── DateTimePicker.jsx # Shadcn date/time picker with 1-click Now
│   │   │   ├── Dialog.jsx      # Pure black glass modal dialog
│   │   │   ├── Input.jsx       # Glass text input & textarea
│   │   │   ├── Select.jsx      # Shadcn-style custom glass dropdown select
│   │   │   └── Tooltip.jsx     # Kbd keycap and tooltip utilities
│   │   ├── Header.jsx          # Top bar with currency switcher & Log Work CTA
│   │   ├── GoldConversionBar.jsx # Live WoW Gold to fiat rate converter
│   │   ├── MetricStrip.jsx     # High-density KPI strip with dynamic grid
│   │   ├── AnalyticsDrawer.jsx # Collapsible charts with dynamic responsive grid
│   │   ├── Toolbar.jsx         # Search bar with custom Shadcn select filters
│   │   ├── LedgerTable.jsx     # Table view with vertically centered rows
│   │   ├── LedgerCards.jsx     # Compact card view with converted gold values
│   │   ├── WorkModal.jsx       # Streamlined work modal with Ctrl+V screenshot paste
│   │   ├── ReceiptModal.jsx    # Proof-of-work receipt generator for client sharing
│   │   ├── ShortcutsModal.jsx  # Keyboard shortcuts cheat-sheet modal (? key)
│   │   ├── FloatingControls.jsx # Bottom-left floating Data menu & Customize Views
│   │   └── Lightbox.jsx        # Full-res screenshot viewer with download
│   ├── lib/
│   │   ├── currencies.js       # Currencies, WoW presets, and gold conversion helpers
│   │   ├── db.js               # IndexedDB zero-quota storage wrapper
│   │   └── utils.js            # Tailwind clsx + twMerge utility
│   ├── App.jsx                 # Central reactive state engine & keyboard shortcuts
│   ├── main.jsx                # React root
│   └── index.css               # Tailwind tokens, font-faces & glassmorphism
├── index.html                  # HTML entry point (Inter font)
├── package.json                # Dependencies: react, motion, lucide-react, tailwindcss, vite
├── tailwind.config.js          # Pure black glassmorphism & typography config
├── vite.config.js              # Vite configuration
├── README.md                   # Updated documentation
└── AGENTS.md                   # Collaboration & manual git workflow guide
```

---

## 4. Coding Conventions & Best Practices

1. **Keep UI Dense and Pure Black Glassmorphic**:
   - Base background `#000000`, `bg-white/[0.035]` to `bg-white/[0.08]` shades, `backdrop-blur-2xl`, and `ring-1 ring-white/10` specular lines.
2. **Motion Library Import**:
   - Always import Motion components from `"motion/react"` (e.g. `import { motion, AnimatePresence } from "motion/react"`).
3. **Currency & Gold Calculations**:
   - `formatMoney(amount, currencyCode)` handles number formatting.
   - `convertToFiat(goldAmount, goldRate, targetCurrency)` handles WoW Gold conversion.
4. **IndexedDB Operations**:
   - All persistence calls go through `trackerDB` in `src/lib/db.js`.

---

## 5. Git Workflow & Manual Push Protocol

To ensure full control over commits and pushes, all git operations are performed manually by the user.

### Staging & Push Commands
```bash
# 1. Review status & modified files
git status

# 2. Stage all files
git add .

# 3. Create descriptive commit
git commit -m "feat: simplify language, add WoW gold conversion system, custom Shadcn dropdowns, 1-click Now date picker, and floating controls"

# 4. Push to remote
git push
```
