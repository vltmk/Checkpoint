# Vault // Nodra Freelance & Gaming Ledger

A monochromatic, high-density Shadcn mini-app ledger crafted for **freelancers, gaming boosters, raid runners, addon creators, and digital devs**.

![UI - Monochromatic Shadcn](https://img.shields.io/badge/UI-Monochromatic%20Shadcn-black?style=flat-square)
![Animation - Motion](https://img.shields.io/badge/Animation-Motion%20%28React%29-10b981?style=flat-square)
![Framework - Vite React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-3b82f6?style=flat-square)
![Currencies](https://img.shields.io/badge/Currencies-USD%20%7C%20TOMAN%20%7C%20GOLD-fafafa?style=flat-square)

---

## What's New in Vault 3.0

- 📱 **Tablet-Width Desktop Shell & Mobile Bottom Dock**: Centered `max-w-5xl` tablet shell with a sleek left sidebar navigation on desktop and a floating mobile navigation dock.
- 🪙 **Mathematical Bi-Directional Currency Engine**: Full bi-directional conversion between **USD ($)**, **IRANIAN TOMAN (تومان)**, and **GOLD (🪙)** with configurable live rates.
- 🔄 **Dedicated Gold Exchange View**: Live 2-way Gold to Fiat calculator, realm token presets, and portfolio gold valuation.
- 📋 **Direct `Ctrl+V` Screenshot Paste**: Instant clipboard screenshot pasting (`Win+Shift+S`) into the work modal.
- 🧾 **Proof-of-Work Receipts & Discord MD**: Printable work receipt slips and 1-click Discord Markdown copy for instant client sharing.
- 📊 **Monochromatic Analytics & Overview**: High-contrast, clean Chart.js velocity and game share donut visualizations shown by default.
- 💾 **Zero Quota Limit Storage**: Built on **IndexedDB** (`src/lib/db.js`) with full JSON backup/restore and CSV export.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>?</kbd> | Open Keyboard Shortcuts Guide |
| <kbd>N</kbd> | Log New Work Entry |
| <kbd>1</kbd> | Overview View |
| <kbd>2</kbd> | Ledger View |
| <kbd>3</kbd> | Analytics View |
| <kbd>4</kbd> | Exchange View |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>Alt</kbd>+<kbd>E</kbd> | Export Ledger to CSV |
| <kbd>Alt</kbd>+<kbd>B</kbd> | Full JSON Backup with Screenshots |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Paste Screenshot Proof (in modal) |
| <kbd>Esc</kbd> | Close any open modal or clear search |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build for production
npm run build
```

---

## Developer Guide

For code conventions, component hierarchy, and git manual workflow, see [`AGENTS.md`](./AGENTS.md).
