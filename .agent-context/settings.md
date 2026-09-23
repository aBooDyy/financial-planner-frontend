# Settings — frontend

The Settings page (Means `SettingsApp` design) reached from the **avatar menu**
(`components/chrome/AccountMenu.tsx` → `<Link to="/settings">`), not the nav. Route
`routes/settings.tsx` → `features/settings/components/SettingsPage`. The page reuses the
shared shell (`TopNav` / `MobileTabBar`, whose `active` prop is now optional so no nav item
highlights) and lists its panes in `SettingsRail` (desktop left rail / mobile chips): Account,
Preferences, Currencies & rates, Categories, Merchants, Email sync
([email-sync.md](email-sync.md)), Integrations ([integrations.md](integrations.md)),
Notifications, Data & privacy. Each pane is its own route — see
[routing.md](routing.md#settings-settings).

## Where each control's state lives

- **Account** (`AccountSection`): initials-only avatar (no photo upload — product decision),
  real name/email form. `useProfile` saves via `authApi.updateProfile` (`PATCH /auth/me`) — a
  direct online call (identity isn't local-first), refreshing the session store on success.
- **Preferences**: Appearance → `useThemeStore`; Base currency → `setBaseCurrency` (synced
  balance settings). Number format, **date format**, week start, default account,
  hide-empty-wallets → `stores/preferences.ts` (`usePreferencesStore`, persisted to
  localStorage). `dateFormat` is consumed app-wide: every specific calendar date renders via
  `formatDate(date, fmt)` from `lib/date.ts` (default `dmy` → `16/06/2026`; also `mdy`, `ymd`).
  The transactions selectors (`buildActivityList`/`buildCashflow`/`buildBreakdown`/
  `buildCalendar`) and `buildGoalsView` take `dateFormat` as a trailing param (default `dmy`),
  threaded reactively from the page/hook. Month-year, week-range, and weekday navigation labels
  stay textual (`fmtMonth`/`fmtShort`); provider email-alert dates are echoed raw, not reformatted.
  Date _inputs_ use `components/DateField` (goal due/target date, tx/recurring date): a native
  `<input type="date">` can't honor a custom format (it renders in the OS locale), so DateField
  overlays the transparent native picker on a styled box that shows `formatDate(value)` — the box
  follows the preference, the picker stays native. Pass `invalid` to flag it (e.g. a past due date).
- **Currencies & rates** (`CurrenciesSection` + `RateRow`): a searchable base-currency picker
  plus editable rates, **synced**. Rows cover the currencies the user actually holds, not the
  whole ISO table; each shows an "Edited" badge + the shipped default + **Reset to default**
  once it differs. The UI edits "1 X = n base"; persisted as the absolute reference rate
  (`display × baseRate`) via `setExchangeRate`, which is **copy-on-write** — the first edit of
  a currency creates its row and sends no `version`. Defaults live in `GET /config`
  ([app-config.md](app-config.md)). Auto-update toggle is a preference.
- **Categories** (`CategoriesSection`): full CRUD over the **synced**, copy-on-write,
  **two-level** category tree — the entity, the resolver and the list/editor components all
  belong to `features/categories/`, and this section only composes them, the same way
  `MerchantRow` composes `features/merchants/`. A type `Segmented` filters the list;
  `useCategoryTree` supplies a live per-row transaction count. Everything about the model,
  the resolved catalog and the subtree delete is in [categories.md](categories.md).
- **Notifications**: five toggles → `usePreferencesStore`.
- **Data & privacy**: Import a file (→ `/import`), real **CSV/JSON export** from the local DB
  (`data/exportData.ts`), **Import templates** (`ImportTemplatesCard` + `ImportTemplateRow`:
  rename / delete / see what a saved mapping recognises, and the "needs rebuilding" and
  "rename to finish syncing" states — see
  [data-layer-and-sync.md](data-layer-and-sync.md#exception-import-templates-importtemplatename_taken)),
  auto-backup preference, Sign out (real), Delete account (disabled — no backend endpoint).

## Data layer (Dexie + sync)

- `categories` is a table here (indexed `'id, slug, parentId, dirty, deleted'` — the `parentId`
  index carries the two-level tree, [categories.md](categories.md)); `exchangeRates` carries a
  `dirty` index (rates are per-user editable, so a background pull must not clobber a local
  edit — `pullRates` respects `dirty`, like `pullNodes`). `clearLocalDb` clears both.
- `features/settings/` keeps the **rate** half: the rate update lives on `balancesApi`,
  profile on `authApi`, and `data/mutations.ts` owns `setExchangeRate`. The **category**
  half — `api/`, `data/mappers.ts`, `data/mutations.ts`, `data/sync.ts` and the pure
  `data/slug.ts` — belongs to `features/categories/`. Both plug into the shared engine
  (`db/sync.ts`), which routes the `rate` and `customCurrency` outbox entities through
  `pushSettingsEntry` and `category` through `pushCategoryEntry`, with the same
  409-rebase / 404-drop / network-retry contract as every other feature.
