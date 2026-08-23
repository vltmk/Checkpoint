# AGENTS.md - Checkpoint Collaboration & Architecture Guide

Welcome to the **Checkpoint** project! This guide is written for AI agents and human developers to keep context, conventions, and implementation workflows smooth for future extensions.

---

## 1. Project Mission & Overview

**Checkpoint** is a monochromatic, high-density Shadcn-styled freelance ledger application specifically tailored for **freelancers, gaming boosters, raid runners, addon devs, and digital creators**.

### Key Value Propositions
- **Tablet-Width Mini-App Frame**: Centered desktop layout (`max-w-4xl`) with unified top segmented navigation and mobile bottom tab dock.
- **Monochromatic Shadcn Aesthetic**: Dark zinc palette (`#09090b`), spacing-driven section hierarchy, zero decorative clutter or gradients, and clean logical status indicators.
- **Mathematical Bi-Directional Currency Engine**: Full bi-directional conversion between **USD ($)**, **IRANIAN TOMAN (تومان)**, and **GOLD (🪙)** with configurable rates.
- **Instant Proof Attachment**: `Ctrl+V` clipboard pasting directly from the screen capture tool (`Win+Shift+S`) or drag-and-drop into the work modal.
- **Proof-of-Work Receipts**: Printable client receipt slips and 1-click Discord markdown export.
- **Zero Quota Limit Storage**: Built on **IndexedDB** (`src/lib/db.js`) to allow saving large screenshot proofs without hitting `localStorage` quota restrictions.

---

## 2. Tech Stack & Architecture

- **Framework & Toolchain**: Vite + React 18
- **Styling**: Tailwind CSS + Shadcn Dark Zinc Design System (`src/index.css`, `tailwind.config.js`)
- **Animation**: `motion` (`motion/react`)
- **Icons**: Lucide React (`lucide-react`)
- **Visuals & Charts**: Chart.js (`react-chartjs-2`) with monochromatic theme
- **Storage**: IndexedDB (`src/lib/db.js`) with JSON and CSV export/import
- **Typography**: `Inter` (sans), `IRANYekanRd` (farsi/toman), `IoskeleyMono` (mono)

---

## 3. File Map

```
jolly-pasteur/
├── fonts/
│   ├── Ioskeley-mono/          # Monospace font files (.woff2)
│   └── IranYekanRd/            # Persian / Arabic font files (.ttf)
├── nodra-vault.svg             # Main geometric white logo
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Badge.jsx       # Logical color status badges
│   │   │   ├── Button.jsx      # Monochromatic Shadcn button
│   │   │   ├── DateTimePicker.jsx # Shadcn date/time picker with 1-click Now
│   │   │   ├── Dialog.jsx      # Adaptive Shadcn dialog / bottom sheet
│   │   │   ├── Input.jsx       # Shadcn input & textarea
│   │   │   ├── Select.jsx      # Shadcn custom dropdown select
│   │   │   └── Tooltip.jsx     # Kbd keycap and tooltip utilities
│   │   ├── views/
│   │   │   ├── LedgerView.jsx  # Unified high-density ledger with hero stats
│   │   │   └── AnalyticsView.jsx # Monochromatic monthly & game share charts
│   │   ├── Navbar.jsx          # Unified top segmented navigation & window controls
│   │   ├── MobileNavigation.jsx # Mobile top header and bottom dock
│   │   ├── WorkModal.jsx       # Work modal with Ctrl+V screenshot paste
│   │   ├── ReceiptModal.jsx    # Proof-of-work receipt with Discord MD copy
│   │   ├── SettingsModal.jsx   # Data backup/restore and currency settings
│   │   ├── ShortcutsModal.jsx  # Keyboard shortcuts cheat-sheet modal (? key)
│   │   └── Lightbox.jsx        # Full-res screenshot viewer with download
│   ├── lib/
│   │   ├── currencies.js       # Bi-directional conversion engine & currencies
│   │   ├── db.js               # IndexedDB zero-quota storage wrapper
│   │   └── utils.js            # Tailwind clsx + twMerge utility
│   ├── App.jsx                 # Central reactive state engine & keyboard shortcuts
│   ├── main.jsx                # React root
│   └── index.css               # Monochromatic Shadcn tokens & safe-area insets
├── index.html                  # HTML entry point
├── package.json                # Dependencies
├── tailwind.config.js          # Zinc scale & typography config
├── vite.config.js              # Vite configuration
├── README.md                   # Documentation
└── AGENTS.md                   # Collaboration & git workflow guide
```

---

## 4. Coding Conventions & Best Practices

1. **Monochromatic Shadcn Aesthetic**:
   - Keep UI minimal, dark zinc (`#09090b`), spacing-driven, and devoid of unneeded decorative borders, glassmorphic glows, or rainbow gradients.
2. **Motion Library Import**:
   - Always import Motion components from `"motion/react"` (e.g. `import { motion, AnimatePresence } from "motion/react"`).
3. **Currency & Gold Engine**:
   - Use `convertCurrency(amount, from, to, rates)` in `src/lib/currencies.js` for all conversions.
   - Use `formatMoney(amount, currencyCode)` for number and currency formatting.
4. **IndexedDB Operations**:
   - All persistence calls go through `trackerDB` in `src/lib/db.js`.

---

## 5. Git Workflow & Manual Push Protocol

To ensure full control over commits and pushes, all git operations are performed manually by the user.

### Staging & Push Commands
```bash
git status
git add .
git commit -m "feat: rename project to Nodra Vault with Vault primary title and updated branding"

# Push to remote
git push
```
