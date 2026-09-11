# Spending feature (the "Spending" page — `src/features/transactions/`)

Third synced slice, local-first like Balances/Goals. One page, three views (Activity /
Budgets / Recurring) recreating the Means `TransactionsApp` design. Route `/transactions`
(the nav's 3rd "Spending" slot, `active="budget"`). Dexie schema **v3** adds `transactions`,
`budgets`, `recurrings`; `OutboxEntity` gains `transaction|budget|recurring`.

## Data layer (`data/`)

- **mappers / mutations / sync** mirror goals exactly: optimistic local write → outbox →
  `schedulePush()`; 409 rebase-retry, 404 drop, network keep. `pushSpendingEntry` /
  `pullSpendingAll` are wired into `db/sync.ts`. Money is minor units; `version` is the
  server sha256 string (empty until first sync); enums map at the boundary (`api/types.ts`).
- **categories.ts** — the built-in **two-level catalog** (parent → subcategories, lucide
  icon + color). Transactions store the parent `category` + optional `subcategory` **slug**;
  every device shares the catalog code. `savings` is the goal-contribution category.
- **ledger.ts** — the cross-feature derivation. `walletLiveBalances(nodes, txns, rates)` =
  opening `amount` + Σ signed deltas (in the wallet's currency); `contributionsByGoal(...)` =
  Σ goal-linked txns per goal (in the goal's currency). **Threaded into the other features:**
  `useBalances` passes wallet deltas to `buildBalancesView` (4th arg) so balances reflect
  spending; `useGoals` passes contributions to `buildGoalsView` (6th arg) so a goal's saved =
  baseline + contributions. Both params default empty, so existing callers/tests are unaffected.
- **selectors.ts** — pure view builders ported from the design's `renderVals`: `buildCashflow`
  (income / spent / **saved** / net — net = income − spent − saved, contributions are the
  saved bucket), `buildCalendar` (week strip that unfolds to a month heat-grid), `buildActivityList`
  (day groups), `buildBreakdown` (donut), `buildBudgetsView` (burn vs cap, health rail; goal
  contributions excluded from budget spend), `buildRecurringView` (monthly-normalized total +
  upcoming timeline). `Scope` = all | wallet | group (group matches descendant wallets).
- **planning.ts** — date math (`windowOf`, `budgetWindow`, calendar grid, `advanceDue`,
  `relFuture`), parameterized by `today` for testability.
- **autopost.ts** — on page enter, posts due `autopost` recurrings as real transactions
  (idempotent via a `recurring:<id>:<date>` `source` marker) and advances `next_due`.
  Cross-device double-post on the same unsynced occurrence is an accepted trade-off.

## UI

`hooks/useTransactions` bundles all inputs into `SpendingData`; `hooks/useTxEditor` is the
tx/budget/recurring editor state machine. Components are dumb (`components/`): page composition

- `CashflowHeroCard`, `DaysCard`, `TransactionList`, `QuickAddCard` (single-line desktop;
  mobile uses a FAB), `BreakdownCard`, `BudgetsCard`/`BudgetHealthCard`, `RecurringCard`/
  `UpcomingCard`, `TxEditor`, `CategoryPickerDialog`. The editor offers a "Toward a goal" select
  (spend only) that earmarks the entry as a contribution. `fp-` tokens + logical RTL utilities.

## Tests

`data/{planning,ledger,selectors}.test.ts` (vitest) cover the window/cadence math, the
opening+txns balance and goal roll-up, and cashflow/budget/recurring numbers.

## Deferred

User-editable categories. (Email auto-import "pending review" shipped — the Review button and
`PendingReviewModal` belong to the Email sync feature; `TxEditor` shows the source email of an
auto-logged entry. See [email-sync.md](email-sync.md).)
