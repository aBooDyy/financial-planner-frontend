# Reports (the "Reports" page — `src/features/reports/`)

Income and spending over any period, recreating the Claude Design `Reports.dc.html` handoff
(its chosen variants: **its own page**, the **preset dropdown** period, **paired income/spending
bars**, **ranked categories** with a subcategory drill-down). Route `/reports`, the nav's 4th
section (`active="reports"`, Lucide `ChartColumn` on the mobile tab bar). Read-only: it writes
nothing and adds no Dexie table.

## Controls live in the URL (`data/search.ts`, `hooks/useReportControls.ts`)

`/reports?range=&from=&to=&compare=&accounts=` — linkable, survives a reload, written with
`replace`. A value at its default is left out (`last_6`, `prev`, all accounts), so the bare path
is the default report. `parseReportsSearch` drops an unknown preset or comparison, and drops
`range=custom` unless both `from`/`to` are full ISO dates. `accounts` is `scopeToValue` of the
Spending account filter's `Scope`, so the report reuses `ScopeSelect` (multi-pick wallets and
groups) unchanged; `useReport` passes the chosen scope through `offeredScope`, like Spending.

## The period (`data/range.ts`)

- Presets: this month, last month, last 3 / 6 / 12 months (whole calendar months ending with
  this one), year to date, last year, custom. `reportRange(preset, custom, comparison, today)`
  returns `start`, `end` (where the period ends) and **`dataEnd`** — `end`, or today while the
  period still runs (`partial`, captioned "· so far"). Everything totals `start..dataEnd`.
- Comparison: `prev` steps back by the preset's own length (whole months via `shiftMonths`,
  which keeps a month's last day on the last day; a custom span by its day count), `yoy` by 12
  months, `none` → `compare: null` and every delta is null. A running period is compared only
  **up to the same point** (the same day of the month; a custom span's same day count), never
  against a whole period. A custom span that hasn't begun reads just its first day (`dataEnd =
start`), so no window ever runs backwards.
- "Custom range…" in the menu opens the shared `CustomRangeDialog` (Spending's); the span then
  shows as a button that re-opens it. `MenuSelect` fires on every pick (`onSelect`, not the radio
  group's change), which is what lets re-picking "Custom range" re-open the dialog.

## Reads (`data/reads.ts`, `hooks/useReport.ts`)

`readReportLedger(spans, periodStart, rates)` is one live query: the rows in the period's and the
comparison's spans (`inAnyRange` over `mergeRanges`), plus **`before`** — `walletDeltas` over
every row dated before the period, reduced inside the query so only a per-wallet map reaches
React — plus merchant names. The answer is tagged with `ledgerKey(spans)`; `useReport` only
builds a view from an answer whose key matches, and keeps showing the last built view while a
new period loads (state, not a ref), so switching presets never flashes skeletons or stale sums.

## The builders (`data/`, all pure)

- `flowRowsOf` — live **spend/income with a category**, in scope, converted to base. Transfer legs
  and balance adjustments never count (the product's reports rule).
- `summary.ts` — income, spending, net; `pctDelta` ("▲ 12%", "No change" under 1%, or `NO_BASE` — a chevrons-up-down glyph and "–%", with a hint — when the comparison period had nothing) toned
  by whether the change is welcome (more income good, more spending bad); net's delta is money.
- `balances.ts` — `balanceAt(throughIso)` = each in-scope, non-archived wallet's opening amount
  - `before` + the period's rows (of **any** type — transfers and adjustments move balances) up to
    that day, converted to base per wallet. The strip: starting balance (end of the day before the
    period), "Balance today"/"Ending balance", change. The note says "Equals net for the period"
    when the change matches net in whole units; otherwise all accounts → "Net plus balance
    adjustments", a scoped report → "Includes transfers in and out".
- `buckets.ts` — ≤ 8 days by day, ≤ 100 by week (7-day steps from `start`), else by month
  (`'YY` on January and the first month when the span crosses a year). Buckets after today are
  drawn empty and not hoverable.
- `trend.ts` — per-bucket sums, `niceMax` axis top, three grid lines labelled with `fmtK`; each
  column's readout adds its balance going in and coming out ("Balance SR 10,624 → SR 15,055");
  the whole-period readout leaves it to the strip. A positive net reads green, a negative red.
- `breakdown.ts` — roots largest first (rows roll up via `catalog.rootOf`), share, bar vs the
  largest, delta; expanding shows "N transactions · avg · last period" and the leaves the rows
  were filed under — a row filed on the root itself is listed as **"General"**.
- `largest.ts` — the six biggest spends, titled merchant → note → leaf category name.
- `categoryTxns.ts` — the transactions behind one breakdown row. A `CategoryPick` is
  `{ type, rootId, subId }`: `subId: null` is the whole root (rolled up via `rootOf`), the
  root's own id is its "General" rows. `categoryTxnsOf` applies the breakdown's own filters
  (live, the pick's type, in scope, `start..dataEnd`), so the list always matches the figure the
  user clicked; `buildCategoryTxns` feeds those rows to Spending's `buildActivityList` (no
  set-asides) for the day-grouped view, plus title / count / exact total.

## UI (`components/`)

`ReportsPage` (TopNav + MobileTabBar shell) → `ReportsHeader` (title; account filter on desktop)
→ `RangeControls` (period `MenuSelect` prominent, caption or custom-span button, account filter on
mobile, comparison `MenuSelect`) → `SummaryCards` (net leads full-width on mobile) → `TrendCard`
(`BalanceSummary`, `TrendReadout`, `TrendChart`) → `CategoryBreakdownCard` (`CategoryRow`) beside
`LargestExpensesCard` (360px rail on desktop). An expanded category's panel has a **View all** button and
each subcategory row is a button (chevron at the end); either opens
`CategoryTransactionsDialog` — a `ResponsiveDialog` holding Spending's `ActivityGroups` (exported
from `TransactionList`), so rows look and badge exactly as on Spending. It mounts per opening and
reads `useTransactions` itself (the `QuickAddSheet` pattern); `useReport` hands it the ledger
`rows`. A row opens the transaction editor (`useTxEditor` + `ConnectedTxEditor`) stacked over the
dialog, and the list follows the edit live. Bars use the app's `fp-chart-in` / `fp-chart-out`
pair (as the Wallets money in & out chart does), not the design's raw green / near-black.
Loading follows the house rule: chrome renders at once, figures skeleton via `ValueOrSkeleton`,
lists via `SkeletonRows`, the chart as placeholder bars. Amounts carry `fp-sensitive`.
