# Settings — frontend

The Settings page (Means `SettingsApp` design) reached from the **avatar menu**
(`components/chrome/AccountMenu.tsx` → `<Link to="/settings">`), not the nav. Route
`routes/settings.tsx` → `features/settings/components/SettingsPage`. The page reuses the
shared shell (`TopNav` / `MobileTabBar`, whose `active` prop is now optional so no nav item
highlights) and switches six sections via `SettingsRail` (desktop left rail / mobile chips):
Account, Preferences, Currencies & rates, Categories, Notifications, Data & privacy.

> The design's seventh "Email sync" section is a separate, unbuilt feature and is intentionally
> omitted from the rail.

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
- **Currencies & rates** (`CurrenciesSection` + `RateRow`): editable rates, **synced**. The UI
  edits "1 X = n base"; persisted as the absolute reference rate (`display × baseRate`) via
  `setExchangeRate`. Auto-update toggle is a preference.
- **Categories** (`CategoriesSection` + `CategoryRow`): full CRUD over the **synced**,
  copy-on-write category entity; `useCategories` reads them live with a per-category tx count.
- **Notifications**: five toggles → `usePreferencesStore`.
- **Data & privacy**: real **CSV/JSON export** from the local DB (`data/exportData.ts`),
  auto-backup preference, Sign out (real), Delete account (disabled — no backend endpoint).

## Data layer (Dexie v4 + sync)

- New table `categories: 'id, slug, dirty, deleted'`; `exchangeRates` gained a `dirty` index
  (rates are now per-user editable, so a background pull must not clobber a local edit —
  `pullRates` now respects `dirty`, like `pullNodes`). `clearLocalDb` clears categories.
- `features/settings/`: `api/` (categories + types; profile lives on `authApi`, rate update on
  `balancesApi`), `data/mappers.ts`, `data/mutations.ts` (createCategory/updateCategory/
  deleteCategory + setExchangeRate; slug via pure `data/slug.ts`), `data/sync.ts`
  (`pushSettingsEntry` for outbox entities `category`+`rate`, `pullCategories`). Wired into the
  shared engine (`db/sync.ts`): new entities route through `pushSettingsEntry`, `pullAll` adds
  `pullCategories`. Same 409-rebase / 404-drop / network-retry contract as the other features.

## Not yet done

The transactions category picker / chart selectors still resolve presentation (icons,
subcategories, name/color) from the static `features/transactions/categories.ts` catalog. The
editable entity is seeded to mirror it (matching slugs), but unifying the picker/selectors to
read the synced categories is a follow-up.
