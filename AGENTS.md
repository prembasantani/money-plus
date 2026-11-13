# Money+ Engineering & Agent Guidelines (`AGENTS.md`)

This repository is **Money+**, a 100% offline-first, privacy-respecting personal finance and double-entry ledger mobile application built with React Native and Expo. Prioritize mobile-first patterns, responsive styling, battery/memory efficiency, and strict ledger integrity.

---

## 1. System Architecture & Core Principles

1. **Zero Cloud / 100% Offline-First**:
   - All transactions, accounts, preferences, and ignore blacklists reside strictly on the user's local device (`AsyncStorage` / SQLite).
   - Never introduce cloud tracking, third-party analytics, remote databases, or unauthorized network calls.
2. **Authoritative Git Release Pipeline (Zero EAS Cloud Dependency)**:
   - Builds are packaged, aligned, keystore-signed, and published directly via **GitHub Actions** (`.github/workflows/build-apk.yml`).
   - **Never run EAS Cloud builds (`eas build`)** or consume user quota/free plans. The Git build is 100% self-sufficient.
   - Keystore: Official release keystore `android-release.keystore` with package `com.moneyplus.wallet`.
3. **Continuous Native Generation (CNG)**:
   - `android/` and `ios/` directories are generated automatically during prebuild (`npx expo prebuild --platform android`).
   - Never edit files in `android/` directly. Configure native behaviors via `app.json` and config plugins.

---

## 2. Mobile-First CSS, Styling & Responsive UI Standards

Every UI component must follow these strict styling rules to prevent visual regressions, awkward text wrapping, or clustered controls:

1. **No Crammed Rows**:
   - Never place variable-length text (merchant names, account names, dates) and interactive buttons into a single horizontal row without wrapping constraints.
   - For complex cards (e.g., SMS sync items), use a structured vertical flow:
     - **Header**: Merchant Name (`flexShrink: 1`), Category, and Amount.
     - **Mode Switcher**: Unified segmented control (`[ - Debit ]` | `[ + Credit ]` | `[ 🔔 Reminder ]`).
     - **Content Box**: Details, expandable notes, or alert notices.
     - **Two-Tier Footer**:
       - *Tier 1 (Badges)*: Account category chip and status pills.
       - *Tier 2 (Actions)*: Left-aligned date/time; right-aligned action buttons (`Undo`, `Import`, `Restore`, `Trash`).
2. **Accessibility & Touch Targets**:
   - Interactive elements must maintain a minimum touch target of **40×40dp** (via `padding`, `minHeight`, or `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`).
   - Maintain high-contrast ratios:
     - Red (`#DC2626`) for Debits / Expenses.
     - Green (`#10B981`) for Credits / Incomes.
     - Amber (`#F59E0B` / `#D97706`) for Reminders / Notices.
3. **Multi-Device & Landscape Adaptability**:
   - Support both portrait and landscape orientations (`"orientation": "default"` in `app.json`).
   - Always wrap scrollable views in `<ScrollView keyboardShouldPersistTaps="handled">` with bottom padding (`contentContainerStyle={{ paddingBottom: 100 }}`).
   - Avoid fixed pixel widths that break on narrow (360dp) screens; use flexbox (`flex: 1`, `flexShrink: 1`, `flexWrap: 'wrap'`).
4. **Theme Consistency**:
   - Default theme is **Clean Light** (`#F8FAFC` background) with full support for Dark Slate mode via `useFinance().theme`.
   - Never hardcode background colors as raw black/white; always bind to `theme.card`, `theme.background`, `theme.text`, and `theme.border`.

---

## 3. Financial Ledger Integrity & SMS Parsing Contract

1. **Transaction vs. Reminder Separation**:
   - Prospective notifications containing future-tense verbs (*"will be debited"*, *"is due on"*, *"maintain sufficient balance"*, AutoPay mandates) MUST be parsed as **Reminders** (`isReminder: true`, `itemKind: 'reminder'`).
   - **Zero Balance Impact**: Reminders must NEVER deduct from or add to account balances, monthly inflow/outflow, or net worth totals.
   - Give the user instant 1-tap control to switch between **Debit**, **Credit**, and **Reminder** via the segmented control.
2. **False Account Prevention**:
   - Non-bank entities (e.g. `PNB MetLife`, `HDFC Life`, `SBI Life`, `Policybazaar`) must never trigger auto-detection of bank accounts or credit cards.
3. **Strict Descending Chronological Sorting**:
   - Every transaction feed (SMS Sync, Dashboard, Reports) must strictly sort items latest-first (`new Date(b.date) - new Date(a.date)`).
4. **Idempotency & Deduplication**:
   - 2-minute deduplication window for repeated carrier alerts.
   - Deleting a transaction permanently saves its fingerprint to `ignoredTransactions` so subsequent syncs route it to `Ignored / Previously Deleted` instead of polluting active ledger balances.

---

## 4. Verification Protocol (Run Before Committing)

Always run the following commands locally before committing or pushing changes:

```bash
# 1. Run all engine, parser, reminder, and sorting unit tests
npm test

# 2. Run local Metro bundler validation (verifies JSX syntax, imports, and bundling)
npx expo export --platform android

# 3. Clean up export directory
rm -rf dist
```

Never push code without running the verification protocol above.
