# Search (`features/search/`)

App-level search over the local DB, from the Means design "Transactions Tabs Options" option
**3c** (global search in the top bar). Fully on-device: no backend endpoint, works offline.

## Surfaces

- **Trigger** — `SearchTrigger` in `TopNav`: a "Search everything" field-button on desktop
  (with the `⌘K` / `Ctrl K` hint), a 34px icon button on mobile. `useSearchShortcut` opens it
  on ⌘K / Ctrl+K, or `/` when focus isn't in an editable field, and stays quiet while any
  dialog is open.
- **Sheet** — `SearchSheet`, mounted once in `SessionGate` (next to `QuickAddSheet`), so every
  signed-in page has it. A Radix Dialog styled as a command-palette sheet: a 640px panel under
  the top bar on desktop, full screen on mobile. Deliberately not `ResponsiveDialog`, since a
  bottom drawer is the wrong shape for a search.
- **State** — `stores/search.ts` (zustand): `open`, `query`, `wide`, `filters`,
  `filtersOpen`, `subcategoriesOpen`, and `context`. `closeSearch()` resets everything except
  `context`.

## Scope: Everywhere vs. the current tab

- It opens on **Everywhere**. The Spending page publishes `{ view, scope, scopeLabel }` as the
  `context` (`usePublishSearchContext`) and clears it on unmount. With a context, a chip
  "<Tab> · <accounts>" narrows the results to that tab's group and to the page's account scope
  (the same `walletMatcher` the selectors use). Off Spending there is no context and no chip.
- Narrowed, a link offers "N more matches in other tabs and accounts", where N is the wide
  total minus the narrow total.

## Engine (`data/`)

- **Nothing is read on open.** The idle view (`idleSearchView`) needs no data. The first
  query or filter (`isSearchActive`) starts the reads, `SearchResultsSkeleton` stands in until
  they land, and the data then stays loaded until the sheet closes.
- `indexSearch(sources, dateFormat)` builds a `SearchItem` per row once per change to the
  source tables. Each item holds a lower-cased match text and the facts the filters test
  (flow, date, leaf + root category, wallets, base-currency major amount).
- Its display row is a thunk (`row()`), drawn only for the rows a group shows. Formatting
  money and dates for every row was the bulk of the index cost.
- `searchIndex(index, query)` filters the index on every keystroke. `useSearchView` reads the
  **whole** ledger, not Spending's date window, and defers the query with
  `useDeferredValue`. Scaling this is tracked in `working.local/optimization-and-scale/`.
- Accounts are valued from the stored ledger totals (`readWalletDeltas` → `SearchSources.deltas`
  → `liveBalancesFrom`), not by summing the ledger rows the index already holds.
- Groups, in order: Accounts, Transactions, Planned (open only), Budgets. (The Recurring group
  went with recurring schedules; bills are not searchable yet — their keys will be `bill:<id>`.) Each
  shows up to `SEARCH_ROW_CAP` rows, but its count covers every match.
- Transfers collapse to one row per `transferId`. Adjustments get their own target.
- Planned occurrences of one origin share a `series` (a bill and role, an income stream, or a
  goal + role). Only the soonest occurrence that passes the filters is listed, so one monthly
  bill doesn't fill the group with a year of copies.
- Amounts match as typed fragments of both the stored amount and its base-currency value.
- Budget names and period labels come from `budgetIdentity` / `budgetPeriodLabel` in the
  transactions selectors, the same ones the Budgets tab uses.

## Filters

`SearchFilters` covers type, date (this month / last 30 / last 90 / custom), categories, wallets
and a min–max amount in base-currency major units. Filters work without a query, and while
the panel is closed, active ones show as removable chips.

- **Categories**: `categoryIds` are roots picked whole; `subcategoryIds` are children picked
  alone. A root and its own children are never both picked. Picking every child collapses
  them to the root. The toggles in `filters.ts` hold these rules.
- Some result kinds drop out once a filter they can't satisfy is set:
  - Accounts drop out for any filter other than wallets.
  - Budgets drop out for a date filter or the Income type.

## Opening a result

`useOpenSearchTarget` closes the sheet, then:
- an **account** sets Spending's scope to that wallet and goes to Activity;
- anything else navigates to its tab with `?open=<kind>:<id>` (see [routing.md](routing.md)).
  On the Spending page, `useOpenFromSearch` consumes the param once the page has loaded, opens
  the matching editor (tx, adjustment, transfer or budget), and strips the param with
  `replace`. A planned result goes to `/planning/upcoming?open=planned:<id>` instead (its
  confirm dialog).
