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
React — plus merchant names, plus **`goalSetAsides`** — the live (`isLiveSetAside`) goal set-asides
dated in any of the spans, for the Needs / Wants / Savings caption. The answer is tagged with `ledgerKey(spans)`; `useReport` only
builds a view from an answer whose key matches, and keeps showing the last built view while a
new period loads (state, not a ref), so switching presets never flashes skeletons or stale sums.

## The builders (`data/`, all pure)

- `flowRowsOf` — live **spend/income with a category**, in scope, converted to base. Transfer legs
  and balance adjustments never count (the product's reports rule).
- **A spend filed under a Savings category is not spending** (`isSavingSpend`: `classOf` says
  `saving`, e.g. investing). `buildReport` drops those rows before the summary, trend, breakdown
  and largest builders, so every "Spending" figure and Net skip them; only the Needs / Wants /
  Savings card reads them (as part of Savings). The balance strip's change then differs from
  Net by them, and says so: "Net less what went into savings categories".
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
- `needsWants.ts` — **Needs / Wants / Savings** (06, D12). `bucketOf` = `classOf` or
  `'unsorted'`; `needsWantsTotals(flowRows, catalog)` → `{income, need, want, unsorted,
  savedSpends, savings}` with **savings = income − need − want − unsorted** (so savings-class
  spends sit inside it, and it goes negative when overspent); `sharesOf` → whole % of income
  (largest-remainder rounded to exactly 100 unless overspent; null without income);
  `sharesLine`, `pctText` (true minus sign). **`needsWantsSummary({rows, from, to, catalog,
  base, rates})`** → `{totals, shares, line}` is the pure, all-accounts summary any surface can
  read (Planning Overview's "Last month: Needs 48% · Wants 31% · Savings 21%"). Its hook,
  `hooks/useLastMonthNeedsWants()` → `{loading, summary, reportSearch: {range: 'last_month'}}`,
  reads last calendar month's rows by the `date` index plus the catalog, base and rates; link
  to `/reports` with `reportSearch` to show the same month in full.
- `needsWantsCard.ts` — `buildNeedsWants({cur, prev, goalSetAside, range, today, catalog,
  base})` (fed the rows **with** savings spends): `segments` (needs, wants, not sorted,
  savings as widths of income; overspent → the spends squeezed into income's share and a red
  `overspent` tail; no income → the spends' own split), `ticks` at 50/80 % of income (moved
  with the squeeze), three `rows` (amount, %, guideline `≤ 50%` / `≤ 30%` / `≥ 20%`,
  `verdictOf`: ✓ / "a little over|under" within 5 points / "over|under", tone good|warn — a
  benchmark, never danger), `wasStr` from the comparison, Savings' `note` ("SR 9,000 set aside
  for goals · SR 1,000 into savings categories", or "Overspent by …"), the roots behind each
  bucket for the drill-down, `unsorted` (amount, %, the roots to tag, "Sort N categories"), and
  `months` — a 100%-stacked split per calendar month (`monthBuckets`, future months dropped)
  once the range spans ≥ 3 of them. `goalSetAside` comes from `buildReport`: wallet set-asides
  in scope, outside ones only for all accounts (Spending's rule).
- `categoryTxns.ts` — the transactions behind one breakdown row. A `CategoryPick` is
  `{ type, rootId, subId, bucket? }` — `bucket` narrows a spend pick to one Needs / Wants /
  Savings / unsorted bucket (the card's drill-down; titled "Transport · Wants"), and without it
  a spend pick leaves the Savings bucket out, matching the breakdown: `subId: null` is the whole root (rolled up via `rootOf`), the
  root's own id is its "General" rows. `categoryTxnsOf` applies the breakdown's own filters
  (live, the pick's type, in scope, `start..dataEnd`), so the list always matches the figure the
  user clicked; `buildCategoryTxns` feeds those rows to Spending's `buildActivityList` (no
  set-asides) for the day-grouped view, plus title / count / exact total.

## UI (`components/`)

`ReportsPage` (TopNav + MobileTabBar shell) → `ReportsHeader` (title; account filter on desktop)
→ `RangeControls` (period `MenuSelect` prominent, caption or custom-span button, account filter on
mobile, comparison `MenuSelect`) → `SummaryCards` (net leads full-width on mobile) →
`NeedsWantsCard` (the `SegmentedBar` with `fillClassName` per bucket from
`components/needsWantsFills.ts` over `categories/spendClass.ts`, the 50/80 tick strip, one
`NeedsWantsRow` per bucket — a toggle opening the bucket's roots, each a button that opens
`CategoryTransactionsDialog` with `bucket` set — the Not sorted row with its **Sort N
categories** button, which opens `SortCategoriesDialog` (the roots captured when it opened, each
with a `SpendClassChip`), and `NeedsWantsTrend` for ≥ 3 months) → `TrendCard`
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
