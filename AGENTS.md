# AGENTS.md — Checkpoint Collaboration, Architecture & Release Guide

This document is the authoritative collaboration guide for AI agents and human developers working on **Checkpoint**.

Agents must read and follow this file before making changes.

---

## 1. Project Mission & Overview

**Checkpoint** is a monochromatic, high-density desktop ledger application built for freelancers and gaming-related digital workers, including:

* freelancers
* gaming boosters
* raid runners
* addon developers
* digital creators

Checkpoint is also a lightweight product used to demonstrate engineering quality and provide marketing leverage for **Nodra**, the broader freelancing marketplace for gamers.

### Core Product Characteristics

* **Tablet-width mini-app frame:** Centered desktop layout with compact navigation and responsive mobile navigation.
* **Monochromatic Shadcn aesthetic:** Dark zinc palette, dense spacing, minimal decoration, no unnecessary gradients or visual noise.
* **Bi-directional currency engine:** USD, Iranian Toman, and Gold with configurable conversion rates.
* **Instant proof attachment:** Clipboard screenshot pasting and drag-and-drop proof attachments.
* **Proof-of-work receipts:** Printable receipts and Discord Markdown export.
* **Local-first storage:** User data is stored locally and the application must remain fully functional without network connectivity.

Checkpoint must remain useful when completely offline.

Network-dependent functionality must therefore always be **optional and non-blocking**.

---

# 2. Tech Stack & Architecture

## Frontend

* React
* Vite
* Tailwind CSS
* Shadcn-style UI
* `motion/react`
* Lucide React
* Chart.js / `react-chartjs-2`

## Desktop Runtime

* Tauri 2

Tauri is responsible for:

* desktop packaging
* native window behavior
* filesystem/native functionality where required
* application updates

## Storage

The application has local persistent storage for user data and settings.

All persistence must use the repository's established persistence layer.

Do **not** introduce an additional storage system simply because it is convenient for a new feature.

### Rule

Before adding persistence:

1. Inspect the existing database/storage implementation.
2. Reuse the existing abstraction where practical.
3. Keep product data, settings, notification state, and announcement state local.
4. Never require a backend account or server for ordinary Checkpoint operation.

---

# 3. Repository Structure

The repository currently follows this general structure:

```text
Checkpoint/
├── fonts/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   └── views/
│   ├── lib/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── src-tauri/
│   ├── src/
│   ├── capabilities/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── scripts/
├── .github/
│   └── workflows/
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── README.md
├── announcements.json
└── AGENTS.md
```

Do not assume every file listed above exists in every branch. Inspect the repository before modifying it.

---

# 4. General Agent Behavior

## Inspect before modifying

Before making architectural or release-related changes:

* inspect the relevant repository files
* understand the existing implementation
* reuse existing abstractions
* avoid creating duplicate systems

Do not assume an implementation exists merely because this document describes the intended architecture.

## Minimize unrelated changes

When implementing a feature:

* modify only what is necessary
* do not perform unrelated refactors
* do not rename large portions of the project without explicit justification
* do not replace existing libraries merely because another library is preferred

## Preserve working behavior

Existing functionality must continue working unless the task explicitly changes it.

For UI changes:

* preserve existing spacing and density
* preserve keyboard shortcuts
* preserve responsive behavior
* preserve accessibility
* preserve existing data behavior

## Validate changes

After meaningful changes, run the smallest relevant validation set.

At minimum for application code:

```bash
npm run version:check
```

and the repository's appropriate lint/typecheck/build/test commands.

Do not claim that functionality passed if it could not actually be tested.

---

# 5. UI & Design System Rules

Checkpoint uses a dark, compact, monochromatic visual system.

## Visual principles

Prefer:

* dark zinc surfaces
* subtle borders
* compact spacing
* strong hierarchy
* restrained motion
* logical status indicators
* dense information presentation

Avoid:

* rainbow gradients
* excessive shadows
* glassmorphism
* decorative glowing effects
* unnecessary rounded containers
* excessive whitespace
* visually noisy animations

The UI should feel like a polished professional utility rather than a marketing landing page.

## Motion

Always use:

```js
import { motion, AnimatePresence } from "motion/react";
```

Do not import Motion APIs from obsolete package paths.

---

# 6. Currency & Ledger Rules

All currency conversion logic must use the existing currency abstraction.

Use:

```js
convertCurrency(amount, from, to, rates)
```

for conversions.

Use:

```js
formatMoney(amount, currencyCode)
```

for display formatting.

Do not duplicate conversion formulas inside components.

---

# 7. Persistence Rules

All normal application persistence must use the repository's established persistence abstraction.

Do not write directly to browser storage when an established application abstraction already exists.

For new local data such as:

* notification state
* announcement state
* update state
* preferences

reuse the existing settings/database architecture whenever possible.

Network failures must never erase or invalidate local data.

---

# 8. Versioning Policy

Checkpoint uses **Semantic Versioning**:

```text
MAJOR.MINOR.PATCH
```

Example:

```text
2.3.0
```

## Canonical version

The canonical application version is:

```text
src-tauri/tauri.conf.json
```

Other package metadata that requires a version must remain synchronized with it.

At minimum, inspect and keep consistent:

```text
src-tauri/tauri.conf.json
package.json
src-tauri/Cargo.toml
```

Do not allow these values to silently drift.

## Version commands

Version changes must be performed through the repository's version-management script.

Use:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

For an explicit version:

```bash
npm run version -- 2.3.0
```

Do **not** manually edit version numbers when the version-management script can perform the change.

## Validation

Before completing release-related work:

```bash
npm run version:check
```

must pass.

If version metadata is inconsistent, the agent must fix the inconsistency before considering the task complete.

## Do not auto-bump every change

Normal code changes do **not** automatically require a version bump.

Version bumps happen when preparing a release.

Do not turn every commit into a new application version.

---

# 9. Release & Git Tag Policy

Production releases use Git tags in this format:

```text
vMAJOR.MINOR.PATCH
```

Example:

```text
v2.3.0
```

The tag version must exactly match the canonical application version.

Example:

```text
tauri.conf.json = 2.3.0
Git tag           = v2.3.0
```

is valid.

```text
tauri.conf.json = 2.3.0
Git tag           = v2.2.0
```

is invalid.

GitHub Actions must reject mismatched release tags.

## Release workflow

The intended release flow is:

```text
Implement changes
        ↓
Run validation
        ↓
Choose release bump
        ↓
npm run version:patch/minor/major
        ↓
Run npm run version:check
        ↓
Commit
        ↓
Create vMAJOR.MINOR.PATCH tag
        ↓
Push tag
        ↓
GitHub Actions builds and publishes release
```

Normal pushes to branches must **not** automatically publish production releases.

---

# 10. GitHub Releases & Tauri Updater

Checkpoint uses the **official Tauri 2 updater**.

Do not implement a custom executable downloader or replacement mechanism.

## Update source

Production updates are distributed through:

**GitHub Releases**

Repository:

```text
vltmk/Checkpoint
```

The Tauri updater uses GitHub's static updater metadata (`latest.json`) generated by the release process.

Expected endpoint:

```text
https://github.com/vltmk/Checkpoint/releases/latest/download/latest.json
```

Do not change the update mechanism to a custom server unless explicitly requested.

## Update behavior

Checkpoint should:

1. Start normally.
2. Check for an update without blocking application startup.
3. Continue working normally if GitHub is unavailable.
4. Detect whether a newer signed update exists.
5. Expose the available update in the application top bar.
6. Allow the user to download/install the update from inside Checkpoint.
7. Allow the user to view the associated GitHub Release.
8. Expose update information to the notification center.

Users should **not** be required to manually download an installer from GitHub.

## Update UI

When no update exists:

* do not display an update control.

When an update exists:

* show a compact update/download control in the top bar
* make the action obvious
* avoid disruptive startup modals
* show download/install progress when available
* prevent duplicate simultaneous update operations

The application should remain usable while checking for updates.

---

# 11. Tauri Updater Signing

Updater artifacts must be cryptographically signed.

## Private signing key

The Tauri updater private key is a secret.

It must:

* never be committed to Git
* never be stored in source code
* never be stored in public repository files
* never be printed in logs
* never be included in build artifacts

GitHub Actions receives it through repository secrets:

```text
TAURI_SIGNING_PRIVATE_KEY
```

If the private key is password protected, also use:

```text
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

## Public key

The updater public key is not secret.

It is embedded in the application through the Tauri updater configuration.

## Key preservation

The private signing key must be backed up securely.

Losing the private signing key can prevent existing installed versions from accepting future signed updates.

Do not generate a new production updater key simply because the existing key is inconvenient to access.

If the production key is lost, stop and evaluate the migration/recovery consequences before replacing it.

## Scope

Tauri updater signing is separate from Windows Authenticode code signing.

Do not introduce Windows certificate signing unless explicitly requested.

---

# 12. GitHub Actions Rules

The production release pipeline must be implemented through GitHub Actions.

The release workflow must:

* be tag-driven
* validate tag/application version consistency
* build the Tauri application
* generate updater artifacts
* sign updater artifacts using GitHub Secrets
* create a GitHub Release
* upload release artifacts
* publish `latest.json`

The workflow must use the current official Tauri GitHub Action compatible with the project's installed Tauri version.

Do not hard-code private signing keys into workflow files.

Use the minimum required GitHub token permissions.

A workflow failure must not result in a partially trusted release being treated as successful.

---

# 13. Announcements System

Announcements are separate from application releases.

They are not GitHub Release notes and are not updater metadata.

The source of announcements is:

```text
announcements.json
```

This file is hosted in the Checkpoint repository and fetched directly by the application.

No backend/server/database is required.

## Announcement responsibilities

Announcements may be used for:

* product news
* Nodra promotions
* maintenance notices
* service announcements
* feature announcements
* general informational messages

Examples:

```text
Nodra announcement
Checkpoint news
Maintenance notice
Important warning
```

## Announcement IDs

Every announcement must have a stable unique ID.

Example:

```text
2026-08-24-nodra-launch
```

IDs are opaque identifiers.

Clients use them to determine whether the announcement has already been seen.

## Local state

Announcement state is stored locally.

At minimum support:

```text
unseen
seen
dismissed
```

The system must survive application restarts.

Do not implement server-side user tracking.

Do not require user accounts.

## Expiration

Announcements may contain an expiration timestamp.

Expired announcements must not be presented as active announcements.

## Content safety

Announcement content is untrusted remote data.

Therefore:

* treat content as plain data
* do not execute scripts
* do not inject arbitrary HTML
* do not render unsanitized HTML
* validate fields before using them
* validate action URLs before opening them

Prefer HTTPS URLs.

Do not allow dangerous URI schemes.

## Network behavior

Announcement fetching must be best-effort.

If GitHub is unavailable:

```text
Checkpoint still starts
Checkpoint still works
Existing local announcements remain available
```

A failed announcement request must never prevent the application from opening.

---

# 14. Notification Center

Checkpoint will have a persistent local notification center.

The notification center must keep **release notifications** and **announcements** conceptually separate even if they share UI.

## Release notifications

A release notification should contain, when available:

* version
* title
* release notes summary
* release date
* update action
* GitHub Release action

## Announcement notifications

An announcement notification may contain:

* type
* title
* message
* publication date
* optional action
* read state
* dismissed state

## Persistence

Notification history must survive restarts.

Reading a notification must not delete it.

Announcements must not generate duplicate notification records simply because the application restarted.

---

# 15. Startup Lifecycle

Network operations must not block startup.

Preferred lifecycle:

```text
Application starts
        ↓
Load local application state
        ↓
Render usable UI
        ↓
Start background update check
        ↓
Start background announcement check
        ↓
Update top-bar/notification state
```

The user must be able to use Checkpoint even when:

* GitHub is unavailable
* DNS fails
* internet is disconnected
* GitHub responds slowly
* announcement data is malformed
* update metadata is unavailable

Never make GitHub availability a prerequisite for opening Checkpoint.

---

# 16. Network & Remote Data Rules

Checkpoint is fundamentally an offline application.

Remote services are auxiliary.

Therefore:

* network calls should be asynchronous
* network calls should have failure handling
* network calls should not block critical UI
* remote data must be validated
* remote data must never overwrite important local user data without explicit logic
* GitHub failures must degrade gracefully

Do not introduce a backend or paid service solely to support updater/announcement functionality.

GitHub is the intended infrastructure for these features.

---

# 17. Security Rules

Never:

* commit secrets
* commit updater private keys
* expose GitHub Actions secrets
* trust remote JSON blindly
* execute remote content
* download arbitrary executables outside the Tauri updater
* bypass Tauri update signature verification

For externally supplied URLs:

* validate scheme
* prefer HTTPS
* reject dangerous schemes
* do not allow remote data to determine arbitrary native commands

---

# 18. Dependency Policy

Before adding a dependency:

1. Check whether the existing stack already provides the capability.
2. Prefer official Tauri plugins for Tauri-specific functionality.
3. Prefer small, well-maintained dependencies.
4. Avoid adding a package for functionality that can reasonably be implemented with existing APIs.
5. Do not replace an existing library without a concrete benefit.

---

# 19. Testing Expectations

For application changes:

* run relevant lint/typecheck/build/test commands
* run `npm run version:check` for release/version-related work
* test offline behavior for network-dependent features
* test persistence across application restarts

For updater work:

* test update detection
* test no-update behavior
* test GitHub/network failure
* test update download
* test installation/relaunch
* test invalid/mismatched signatures
* test release links

For announcements:

* test valid data
* test malformed data
* test expired announcements
* test duplicate IDs
* test seen state
* test dismissed state
* test persistence
* test offline behavior
* test invalid URLs

For GitHub Actions:

* validate workflow configuration
* verify secrets are referenced correctly
* verify version/tag matching
* inspect actual workflow output before claiming release success

Do not fabricate test results.

---

# 20. Git Workflow & Push Policy

All Git operations that publish changes are performed manually by the user unless explicitly requested otherwise.

Agents may inspect Git state and make code changes.

Agents should not automatically:

* push branches
* push tags
* publish releases
* delete branches
* rewrite remote history

Typical manual workflow:

```bash
git status
git diff
git add .
git commit -m "type: description"
git push
```

For releases:

```bash
git status
npm run version:check
git tag vX.Y.Z
git push origin vX.Y.Z
```

---

# 21. Agent Completion Standard

An implementation task is not complete merely because code was written.

Before reporting completion, the agent should:

1. inspect its own changes
2. run relevant validation
3. verify no unnecessary files were changed
4. verify version consistency where applicable
5. verify that secrets were not introduced
6. report anything that could not be tested
7. distinguish verified behavior from expected behavior

Never claim a production release/update pipeline works until an actual release has successfully gone through the GitHub Actions pipeline.

---

# 22. Priority Order

When requirements conflict, use this order:

1. Correctness
2. Security
3. Data integrity
4. Offline functionality
5. Existing architecture
6. Consistency with this document
7. UX quality
8. Convenience

Do not sacrifice correctness or security for a faster implementation.

---

# 23. Important Design Principle

Checkpoint is a local-first desktop utility with optional remote capabilities.

The application should feel like:

```text
Local application
      +
GitHub-backed updates
      +
GitHub-backed announcements
```

not:

```text
Web application that happens to run on a desktop
```

Keep the product resilient, compact, maintainable, and independent of paid infrastructure.