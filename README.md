# Nodra Pay // Gaming Freelance Work & Income Ledger

A minimal, high-density pure-black glassmorphic freelance ledger crafted for **World of Warcraft & World of Warcraft Classic freelancers, boosters, GDKP runners, addon creators, and game devs**.

![UI - Pure Black Glassmorphism](https://img.shields.io/badge/UI-Pure%20Black%20Glass-black?style=flat-square)
![Animation - Motion](https://img.shields.io/badge/Animation-Motion%20%28React%29-10b981?style=flat-square)
![Framework - Vite React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-3b82f6?style=flat-square)
![Currencies](https://img.shields.io/badge/Currencies-WoW%20Gold%20%7C%20USD%20%7C%20Toman-8b5cf6?style=flat-square)

---

## What's New in Nodra Pay 2.1

- 🪙 **Live WoW Gold to Fiat Rate Converter**: Plain-sight exchange rate bar (e.g. 1,000 WoW Gold = $0.035 USD or 2,500 Toman) that automatically converts in-game gold to real-world fiat across all metric cards, analytics charts, and table rows.
- 🌐 **Simplified Universal Language**: Removed confusing financial jargon and replaced with clear, accessible terms (`Paid`, `Pending`, `Working`, `On Hold`, `Total Earned`, `Average Rate`).
- 🎨 **Shadcn-Style Glass Dropdowns & Date/Time Picker**: Custom translucent glass dropdown menus (`Select.jsx`) and date/time picker (`DateTimePicker.jsx`) with a 1-click **⚡ Now** button.
- 🎛️ **Customizable Views & Elements**: Popover controls to show/hide KPI cards and charts without breaking layout responsiveness.
- ⚓ **Floating Bottom-Left Dock**: Centralized **Data Menu** (Export CSV, Backup JSON, Restore JSON) and **Shortcuts Guide (`?`)** at the bottom-left of the viewport.
- 📋 **Direct `Ctrl+V` Screenshot Paste**: Instant clipboard screenshot pasting (`Win+Shift+S`) into the work modal.
- 🔤 **Custom Typography**: Embedded `IRANYekanRd` for Persian/Arabic/Toman text, `IoskeleyMono` for numeric/code styling, and `Inter` for primary UI.
- 🔄 **1-Click Inline Status Flip**: Click status badges directly on table rows to cycle statuses with spring feedback.
- 🧾 **1-Click Proof-of-Work Receipt Slip**: Clean printable work receipt slip ready for client sharing or PDF export.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>?</kbd> or <kbd>Shift</kbd>+<kbd>/</kbd> | Open Keyboard Shortcuts Guide |
| <kbd>N</kbd> or <kbd>Ctrl</kbd>+<kbd>N</kbd> | Log New Work Entry |
| <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> | Focus Search Bar |
| <kbd>V</kbd> | Toggle View (Table ⇄ Cards) |
| <kbd>A</kbd> | Toggle Analytics Drawer |
| <kbd>Alt</kbd>+<kbd>E</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> | Export Ledger to CSV (Mistake-Proof) |
| <kbd>Alt</kbd>+<kbd>B</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> | Full JSON Backup with Screenshots |
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
