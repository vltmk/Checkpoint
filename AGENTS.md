# AGENTS.md - Nodra Pay Collaboration & Architecture Guide

Welcome to the **Nodra Pay** project! This guide is written for AI agents and human developers to keep context, conventions, and implementation workflows smooth for future extensions.

---

## 1. Project Mission & Overview

**Nodra Pay** is a high-density, minimal, dark-mode freelance ledger application specifically tailored for **gaming freelancers, game devs, 3D/2D artists, QA testers, modders, and esports coaches**.

### Key Value Propositions
- **Instant Proof Attachment**: `Ctrl+V` clipboard pasting directly from the screen capture tool (`Win+Shift+S`) or drag-and-drop into the work modal.
- **Gaming & In-Game Currency Support**: Native support for **USD, Iranian Toman (تومان), EUR, GBP, USDT**, as well as in-game currencies (**Robux, Valorant Points, V-Bucks, WoW Gold, OSRS GP, TF2 Keys, Minecoins**).
- **Dense, Minimal Dark UI**: High information density per screen, Inter typography, compact table and card views.
- **Zero Quota Limit Storage**: Built on **IndexedDB** (`db.js`) to allow saving large screenshot proofs without hitting `localStorage` quota restrictions.

---

## 2. Tech Stack & Architecture

- **Core**: Vanilla HTML5, Vanilla JavaScript (ES6+), Vanilla CSS.
- **Visuals & Charts**: [Chart.js](https://www.chartjs.org/) (via CDN).
- **Storage**: IndexedDB (`db.js`) with fallback and JSON/CSV export/import.
- **Typography**: Google Fonts (`Inter` primary font, `JetBrains Mono` for select code tokens).
- **Design Philosophy**: Functional, high density, dark-mode first (`#0a0c10` / `#11141a`), accessible contrast, minimal decoration.

---

## 3. File Map

```
jolly-pasteur/
├── index.html       # Single-page UI shell, KPI metric strip, search toolbar, work modal, lightbox
├── style.css        # CSS design system (Inter-first typography, dark tokens, dense tables, responsive layout)
├── app.js           # Core state machine, CRUD logic, clipboard paste listener, analytics charts, export/import
├── db.js            # StorageDB wrapper over browser IndexedDB (objectStore: 'work_entries')
├── .gitignore       # Git ignore rules for logs, editor artifacts, and OS temp files
├── README.md        # User-facing overview and setup instructions
└── AGENTS.md        # This agent instruction and architecture guide
```

---

## 4. Coding Conventions & Best Practices

1. **Keep UI Dense and Dark**:
   - Do not use bright/white backgrounds or low-density, overly padded cards.
   - Use `Inter` font tokens (`--font-sans`). Do not overuse monospace fonts.
2. **Currency Consistency**:
   - In `app.js`, currency formatting is handled via `formatMoney(amount, currencyCode)`.
   - Iranian Toman (`TOMAN`) and in-game currencies format as integer numbers with appropriate suffixes (e.g. `1,250,000 تومان`, `45,000 R$`).
3. **IndexedDB Operations**:
   - All persistence calls must go through `window.trackerDB` in `db.js`.
   - Work entries have unique string IDs (e.g. `job_<timestamp>_<rand>`) and store proofs as base64 data URLs in `entry.proofs`.
## 4. Git Workflow & Manual Push Protocol

To ensure full control over commits and pushes, all git operations are performed manually by the user. Agents should prepare and update project files, update `AGENTS.md` / `README.md`, and then provide the exact staging and push commands for the user to run.

### Initial Setup & Push Commands
```bash
# 1. Review status & modified files
git status

# 2. Stage all files
git add .

# 3. Create descriptive commit
git commit -m "feat: initial commit for Nodra Pay with dark dense UI, in-game currencies, Toman, screenshot paste and AGENTS.md"

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

---

## 5. Potential Future Extensions

- **Cloud / Supabase Sync**: Optional sync layer for multi-device access.
- **Invoice & PDF Generator**: Printable PDF generation with attached screenshot proof previews.
- **Exchange Rate Converter**: Live/custom conversion between In-game currencies, Toman, and USD.
- **Kanban Pipeline View**: Drag-and-drop milestone board (In Progress → Escrow → Paid).
