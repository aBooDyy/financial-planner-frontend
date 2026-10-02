# Spending feature (the "Spending" page — `src/features/transactions/`)

Third synced slice, local-first like Wallets/Goals. One page, two views (Activity ·
Budgets) recreating the Means `TransactionsApp` design. The Planned tab moved to Planning ›
Upcoming (D8; `/transactions/planned` redirects there); Activity leads with `PlannedNudge`
("N waiting for you to confirm · Review →" → `/planning/upcoming`) while something is due. Route `/transactions`
(the nav's 3rd "Spending" slot, `active="budget"`). Dexie declares `transactions`,
`budgets`; `OutboxEntity` carries `transaction|transfer|budget`. The Recurring tab, its editor
and `recurrings` went with the planning rebuild: a repeating payment is a **bill**
([bills.md](bills.md)).

## Data layer (`data/`)

- **mappers / mutations / sync** mirror goals exactly: optimistic local write → outbox →
  `schedulePush()`; 409 rebase-retry, 404 drop, anything else kept and flagged
  ([Sync failures on ledger rows](#sync-failures-on-ledger-rows)), including a bulk `INVALID`. `pushSpendingEntry` /
  `pullSpendingAll` are wired into `db/sync.ts`. Money is minor units; `version` is the
  server sha256 string (empty until first sync); enums map at the boundary (`api/types.ts`).
  **The ledger is the one table here that does not pull in full**: `pullSpendingAll` runs
  `pullTransactionsDelta` (a watermarked `GET /transactions/changes`) beside the ordinary
  `pullBudgets` list, because budgets are bounded and a ledger
  is not — see [data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams).
  Rows also leave in bulk in both directions: `POST /transactions/bulk` for a run of queued
  creates, `POST /transactions/bulk-delete` for a run of queued deletes.
- **The catalog is not here.** A transaction stores one leaf
  **`categoryId`** (the subcategory's id when one was picked, else the root's), and everything
  it means — name, colour, icon, its root — is resolved from the user's own synced two-level
  category tree in `features/categories/` ([categories.md](categories.md)). Nothing in this
  slice may import the built-in defaults; an ESLint rule enforces it. No slug literal reaches a
  row either: a default goes through `catalog.fallbackFor(type)` / `bySlug(...)` (e.g. a new
  schedule starts on Housing only when `bySlug('housing')` finds the user's own). (`SAVINGS_CATEGORY_ID` is gone: linking
  an entry to a goal no longer re-files it under Savings — ADR-7.)
- **ledger.ts** — the cross-feature derivation. `walletLiveBalances(nodes, txns, rates)` =
  opening `amount` + Σ signed deltas (in the wallet's currency); `contributionsByGoal(...)` =
  Σ goal-linked txns per goal (in the goal's currency). **Threaded into the other features:**
  `useWallets` passes wallet deltas to `buildWalletsView` (4th arg) so balances reflect
  spending. A goal-linked spend is money **used** from the goal: goal progress = live set-asides
  + used ([goals.md](goals.md#derivations)).
- **Planning links.** A ledger row may carry `goalId` (money used from a goal) **or** `billId`
  (a payment for a bill; wire `bill_id`, never both, never on a transfer leg or adjustment).
  Both are always sent on create and PATCH (PATCH replaces). Rows stored before bills lack
  `billId`; it reads as null. A deleted goal or bill clears the link locally and in queued
  payloads (`unlinkLedgerFrom`), as the server does.
- **Settlement links.** A transaction may carry `plannedId` — the planned item it settles
  ([planned.md](planned.md)); always sent on PATCH, never set on a transfer leg. Every write
  path here (`addTransactionWithId`/`createTransaction`, `updateTransaction`,
  `deleteTransaction`, `bulkDeleteTransactions`) calls the planned slice's `closeCovered` /
  `reopenUnderSettled` afterwards, so saving an entry against a planned item closes it and
  deleting it re-opens the item. `TxEditorDraft.plannedId` carries the link through the editor
  (reset when the goal or bill changes); choosing a goal or bill keeps the user's category (ADR-7).
- **Bill payments go through Pay now's path** (`data/billPayments.ts`, 03 §5). The dialog
  (`useTxEditor.save` / `remove`) and QuickAdd save through `saveNewTransaction` /
  `saveTransactionEdit` / `removeTransaction`, never `createTransaction` directly. A spend with a
  `billId` settles a payment row — the matched one while it is that bill's and open, else the
  first open occurrence's, made on the spot (`planning/actions/payBill#billPaymentTarget`) — then
  `settleBillPayment` releases that occurrence's set-asides **in the paying wallet**, moves
  `nextDue` on and returns the leftover report. Money a **settled** occurrence still holds (none
  is asked about after a part payment) comes back as
  a `LeftoverPrompt` the caller hands to `stores/leftoverPrompt`; `LeftoverPromptHost` (mounted
  in `__root.tsx`, since the dialog and QuickAdd close as they save) shows Planning's
  `LeftoverSheet` on any page. An edit pays only when it **newly** links a bill (an unchanged link
  just re-syncs `nextDue`); unlinking, cutting or deleting a payment that reopens its occurrence
  steps `nextDue` back to it (`syncBillNextDue` only moves forward). A bill that is closed or
  gone saves the row as it is, unpaid. What an unlinked or deleted payment released stays
  released (no un-release exists).
- **selectors.ts** — pure view builders ported from the design's `renderVals`. Every builder
  that names a category takes **`catalog: CategoryCatalog` as its required second
  parameter** — `buildCashflow(data, catalog, …)`, and likewise `buildBreakdown`,
  `buildActivityList`, `buildBudgetsView`. Deliberately **not**
  optional with a default, unlike `dateFormat`: a wrong date format is cosmetic, a wrong
  catalog is a donut saying "Dining" while the editor two inches away says "Eating out", and
  making it required means the compiler enumerates every call site. `buildCalendar` takes no
  catalog — it counts money per period and never names a category. The builders:
  `buildCashflow` (income / spent / net — **net = income − spent**; set-asides are never an
  outflow, because the money stays in its wallet (F3: subtracting them double counted a goal
  paid later, and disagreed with Wallets' Money in & out). Σ wallet-held set-asides dated in
  the period and scope is only a caption under the figures, `setAsideNote` — "SR 600 set aside
  — still in your wallets" — hidden when 0; no bar segment),
  `buildCalendar` (see below), `buildActivityList` (day groups), `buildBreakdown` (donut),
  `buildBudgetsView` (burn vs cap, health rail). `Scope` = all | wallet | group (group matches
  descendant wallets).
  **Everything rolls up to the root:** the hero's segments and the donut group by
  `catalog.rootOf(t.categoryId).id`, and a category budget (its `categoryId` is a root) counts a
  spend when `rootOf(t.categoryId).id === b.categoryId` — a row filed under Dining › Cafés burns
  the Dining cap; a wallet budget matches `t.walletId === b.walletId`. Rows hand ids to the icon:
  `TxRow.categoryId` is the leaf (so `CategoryIcon` draws the
  child's glyph) while their colour and name come from the root; `BudgetRow.categoryId` is the
  capped root (null for wallet/overall caps). An id the catalog no longer holds resolves to the
  shared "Deleted category" entry ([categories.md](categories.md#the-resolver--datacatalogts)).
  **A goal-linked spend is a payment, not saving** (setting aside labels money in place;
  ADR-7: a payment keeps its own category). It counts as Spent in the hero, day totals, donut
  and calendar, and burns budgets like any spend — the old `isContribution` rule (spend with a
  `goalId` → Saved, skipped by budgets) is gone. Its only special treatment left is the "Goal"
  pill.
- **Budget periods and "Leave out planned bills".** `BudgetPeriod` is `weekly | monthly |
  custom | paycheck` (wire `PAYCHECK`). A per-paycheck budget resets on each main payday:
  `budgetWindow(period, customDays, today, payCalendar?)` takes the engine's `PayCalendar` and
  answers the pay period today falls in (`planning/data/payPeriods#periodOf`); without a main
  paycheck (no income, or income varies) that calendar is calendar months, so it resets
  monthly. **The calendar travels with the budgets**: `readLedgerWindow` reads it inside its
  live query (`data/payCalendar.ts#readPayCalendar` — income streams, the settings row, rates
  → `payCalendarOf`), widens the ledger ranges with it, and hands it back on `LedgerWindow`;
  `useSpendingViews` puts it on `SpendingData.payCalendar`, so the budgets view and the rows
  read for it can never disagree (an income edit re-runs the read). Each `BudgetRow` carries
  `periodLabel` — the window it is measured over now ("This paycheck", "This week", "Last 14
  days", from `budgetWindowLabel`) — and `windowStr` ("Oct 25 – Nov 24"), drawn as the pill and
  after the scope line; the health rail's `periodStr` names the overall cap's window (or the
  one all caps share; "across their periods" when they differ). A budget's burn is in the
  budget's own currency; the rail converts each to base before adding them up (it once summed
  the raw minor units and printed them in base). `budgetPeriodLabel` stays the
  cadence name ("Per paycheck") and search shows "/paycheck". **`excludesBills`** is applied in
  `budgetSpentMinor` — the one place a budget's burn is summed, so the Budgets rows, the health
  rail's totals and on-track/over counts all follow it: a budget with it on skips every spend
  carrying a `billId` (a bill's payment, however it was recorded). `excludesBills` (wire `excludes_bills`, default off) marks a
  budget that skips payments for a bill (rows with a `billId`); it is stored and synced, and
  `BudgetDraft.excludesBills` left undefined keeps the stored choice. It is optional on
  `LocalBudget` because rows stored before it existed lack it (read as off).
- **planning.ts** — date math (`windowOf`, `budgetWindow`, the calendar grid), parameterized
  by `today` for testability. A bill's due dates step in `planning/data/occurrences.ts`
  (`stepOccurrence`). **`fmtK` takes minor units and a currency code** — every caller holds
  minor units, so the major conversion lives there.

### The calendar — one cell shape, two grids

**The period.** Every period-reading builder takes one `Period` (`data/planning.ts`):
`{ mode: PeriodMode, start, end }`, where `PeriodMode` is a `RangeMode` (`year | month | week |
day`) or `custom`. A range mode's period is `periodOf(anchor, mode)` — `windowOf`'s span, so
**`start` is the anchor**; a custom one is any inclusive span the user picked. State, live-query
deps and the `LedgerWindow` tag hold it as wire ISO (`IsoPeriod`, `toIsoPeriod`/`fromIsoPeriod`).
`periodCaption(period)` heads the header, hero and donut; a custom span reads "Jun 3 – Jul 14,
2026" (both years when it crosses one; a single day as a date).

`buildCalendar` returns a **discriminated union** on `grid`, because a year is not a grid of
days (`calendarGridOf(period)` picks it):

Both variants carry the same `FoldingRows` shape — `pivotRow` (always visible) plus
`rowsBefore`/`rowsAfter` (folded away until the toggle opens) — so `FoldingGrid` renders and
animates both, and the toggle means the same thing in all four views.

- `grid: 'days'` (month/week/day, and a custom span of up to `CUSTOM_DAY_GRID_MAX_DAYS` = 62)
  — rows of 7. The month around the pivot week is built in **all three** range modes, so the
  unfold works everywhere, not just in month mode. A custom span lays out the whole weeks it
  touches instead, folded on today's week when it holds today, else its first week.
- `grid: 'months'` (year, and a longer custom span) — rows of four, one cell per month the period
  touches (labelled `Nov ’25` once the span crosses a year). Folded shut it shows the row
  holding the running month (the first row when the period misses it); open it shows them all.
  A month cell totals only the period's days, so a custom span's partial end months still sum
  to the hero.

Both emit the same `PeriodCell`, so `CalendarCell` styles a day and a month identically, and
the year grid always shows the income/spend split (days show it only when a day has both).
Cell colouring lives only in `CalendarCell` and is **net-driven, with no accent fill**:

- **Outside the selected period** (`outside` = not in the period — so in day view every other
  day, in week view the rest of the unfolded month, for a custom span the days either side of
  it in its first and last weeks) → a diagonal hatch, muted figures. Never true in a month grid.
- **Even** (`tone: 'zero'` — no activity, or income = spend) → flat `surface-2`.
- **Net positive / negative** → a green / red wash (`color-mix` of the accent / `RED` into
  `surface`), 12–38% by `intensity`. Figures use the ink tokens (`--fp-accent-ink`,
  `--fp-danger`) so they stay legible on the wash in both themes.
- **The picked day** (`isActive`) → a heavy `--fp-text` border only; **today** (`isCurrent`)
  → an inverted date chip. Deliberately colourless, so neither fights the day's red/green.

**Anchoring.** The anchor for a mode is always `windowOf(date, mode).start`. Switching mode
re-anchors on today when the period being left covers it; the **Today** pill in `DaysCard`
(shown only while today is outside the period, arrow pointing toward it) re-anchors on today
in the current mode — a custom span keeps its length and ends today (`periodHoldingToday`).
Prev/next (and the swipe) step a custom span by its own length (`steppedPeriod`). Tapping a
day or month in a custom grid focuses it in day / month mode, like the other views.

**Custom range.** `PeriodModeSwitch` is the Year / Month / Week / Day / **Custom** segment row;
Custom always opens `CustomRangeDialog` (From / To `DateField`s plus Last 7 / 30 / 90 days and
Year to date chips, `data/customRange.ts`), prefilled with the span on screen, so it both picks
a new span and edits the current one. It is page state only — not remembered across visits.

`intensity` is `sqrt(|net| / peak)`, where the peak is the biggest net **of the same sign** in
the scaling period — the anchor month for a day grid (in every range mode, so a day keeps its
shade as you switch views), the span itself for a custom day grid, the grid's months for a month
grid. Per-sign peaks stop one big payday from
flattening every red day; the square root keeps small days distinguishable from mid ones.

`deltas` — each wallet's delta over the whole ledger, read from the stored running totals
([Running totals](#running-totals-ledgertotals)). The page reads its rows for the
period on screen ([How the page reads the ledger](#how-the-page-reads-the-ledger)).
`TransactionsPage` threads both into every builder. `hooks/useTxEditor` is the
tx/budget editor state machine. Components are dumb (`components/`): page composition

- `CashflowHeroCard` — its stacked bar is the shared `SegmentedBar`, so every category chunk
  reveals its name, its base-currency amount and its share of outflow on hover/focus/tap
  ([styling-and-theming.md](styling-and-theming.md#shadcnui-integration)). That is why a
  `CashflowSegment` carries `label`/`valueStr`/`pctStr` and not just a colour and a width:
  the builder holds the catalog and the base currency, the bar holds neither.
- `DaysCard` (period header + toggle; a sideways swipe anywhere on it steps the period like the
  arrows) with `DayGrid`/`MonthGrid` and the
  shared `CalendarCell`, `TransactionList`, `QuickAddCard` (single-line desktop;
  mobile uses the tab bar's add button — see _App-wide add_ below), `BreakdownCard`,
  `BudgetsCard`/`BudgetHealthCard`, `TransactionDialog`, `BudgetEditor` (below). `fp-` tokens +
  logical RTL utilities.
- **App-wide add.** Every signed-in page can add a transaction: `QuickAddFab` floats bottom-end
  on desktop, and `MobileTabBar` carries a raised add button dead centre (sections split evenly
  either side). Both only call `useQuickAddStore.show` (`stores/quickAdd`); `QuickAddSheet`
  (mounted by `SessionGate`) then mounts its own `useTransactions` + `useTxEditor`, waits for the
  local reads so the blank draft gets a real default wallet, calls `openAddTx`, and hides the
  store once the editor closes. `ConnectedTxEditor` is the one place a `useTxEditor` instance is
  wired to an editor — `TransactionDialog` for a transaction or transfer, `BudgetEditor` for a
  budget (routed by `editing.kind`) — and the Spending page and the sheet both render through it. It
  takes the page's `SpendingInputs` and its whole-ledger `deltas` to hand the dialog its
  accounts with live balances (`transferWallets` and `scopeSections` over those deltas); both
  callers render it only once `deltas` has landed.
- **Session memory** (`stores/entrySession.ts`, `useEntrySession`): the wallet (and a
  transfer's destination) and day of the last **new** entry, and the Spending account filter.
  Zustand persisted to **sessionStorage** (`fp-entry-session`), so it survives route changes and
  reloads but not a closed home-screen app; it is also dropped when the app comes back after more
  than `SESSION_IDLE_MS` (1 h) hidden — the clock only runs while `visibilitychange` says hidden.
  A day equal to today is stored as null, so the default keeps following the calendar. A new
  entry starts on `useEntryDefaults`: the session's wallet, else Settings' **Default account**
  (`preferences.defaultAccountId`), else the first live wallet (`data/entryDefaults.ts`; archived
  or deleted picks fall through). The desktop Quick add card files to the same wallet.
- **Note completion**: both dialog notes are `TxNoteField` over the shared
  `components/CompletionInput` — one inline suggestion drawn dimmed after the caret (an
  `aria-hidden` overlay with the input's own classes, scroll-synced), shown only while the caret
  is at the end. Taken with Tab, the arrow toward the line end, or a swipe toward it (`swipeStep`
  = -1, direction-aware). Suggestions: `rankNotes` over the last `NOTE_LOOKBACK_DAYS` of the
  same kind (spend / income / transfer legs), most used then most recent, case merged;
  `noteCompletion` needs 2+ typed characters and a case-insensitive prefix.
- **The transaction dialog** (`TransactionDialog`, from the "New Transaction Redesign" handoff).
  One `ResponsiveDialog` for Spend / Income / Transfer, titled "New transaction" or "Edit
  <type>". Top to bottom: `TxTypeSwitch` (pill segmented; the chosen type wears its tint —
  `fp-spend`, the accent, `fp-transfer` — set on the body as `--tx-ink` / `--tx-soft`),
  `TxAmountHero` (the question, currency code and a large centred amount on the tint; for
  spend/income the `TxAccountPill` "Paid from / Paid into" sits under it and sets the currency; it opens the Spending filter's account tree — `AccountTreeGroups` (its row content, `AccountOptionContent`, is shared with the filter's `ScopeMenuTree`), with groups as headings rather than picks (`entryAccountSections`: no "All accounts", no empty groups, plus an in-use archived wallet)),
  then `TxCashflowFields` — "What for?" `TxCategoryChips` (`useQuickChips(type, 5)`, the chosen
  one always among them, "All categories ›"), "Where?" `TxMerchantField` (+ the "Usually X · Use
  it" suggestion), "When?" `TxDateChips` (Today / Yesterday / a `DateField` pill), the
  `CountsTowardRow`, the `PlannedLinkBanner`, the saving-goal / no-payday hint, and the note — or
  `TxTransferFields` (the balances slice's `TransferFxBox` + `rateLine` for a cross-currency
  "Received", `TransferSideCard` FROM / TO cards with the round swap on their seam, a locked card
  for a deleted side, "When?", a note with a 0/200 counter, the footnote). `SourceSection` closes
  an edited auto-logged entry. **Pickers open inside the dialog**: category, merchant and counts
  toward swap the body for a pane (`CategoryOptions`, `MerchantOptions`, `CountsTowardOptions`)
  with a back button (`ResponsiveDialog`'s `onBack`); closing the dialog from a pane goes back
  instead. The footer is the shared `DialogActions`: an optional Delete (danger-soft), Cancel, and the wide submit. The
  wording and readiness rules are pure in `data/txDialog.ts`: while not ready the submit looks
  muted and a hint above it says what is missing ("Add an amount to continue", "Pick a wallet
  first", …); pressing it on a spend/income marks the hero red with "Enter an amount above 0." /
  "No wallets yet. Add a wallet…" (the link calls `onAddWallet`, which closes and routes to
  Wallets). A transfer's button is truly disabled while `resolveTransfer` returns null.
  **Gotcha:** `CategoryOptions` resets its highlight whenever its `categories` array changes
  identity, so the array passed in must be memoised — a fresh `catalog.byType()` per render is a
  render loop that freezes the tab.
- **Budget / adjustment editors** (the "Dialogs & side panes" design, S1–S3). Each
  sits in `EditorDialog` — `ResponsiveDialog` + `DialogActions` + a P3 `ConfirmDialog` for Delete
  (copy in the pure `data/scheduleEditor.ts`: `budgetDeleteCopy`, `adjustmentDeleteCopy`) and an optional picker `pane`. Saving follows the transaction dialog's
  pattern: a hint above the buttons while not ready (`budgetBlock` / `cashflowBlock`), the submit
  muted but pressable, pressing it reveals field errors. `BudgetEditor`: "What does it cover?"
  `OptionTiles` (Category / Account / Overall, Overall hides the picker). The draft has no
  `target`: a category budget reads `draft.categoryId` (kept on a spend **root** —
  `setScopeType` and save normalise it with `rootOf`) and a wallet budget reads
  `draft.walletId`; save sends `BudgetDraft { categoryId, walletId }` with the other one null, `AmountWell` on the spend tint with `CurrencyPill` (the `CurrencyPicker` flattened into a
  "Currency SAR ▾" pill), "Which category/account?" `BudgetTargetSelect`, `BudgetPeriodFields`
  (**Weekly · Monthly · Per paycheck · Custom** chips + "Period length __ days", at least 1;
  under Per paycheck the pure `paycheckHint(cal, today)` reads "Resets every payday · Oct 25 –
  Nov 24", or with no main paycheck "Add your income to budget per paycheck — until then this
  resets monthly."), then a `ToggleCard` **Leave out planned bills** ("Only count spending you
  didn't plan for.", `draft.excludesBills`, off on a new budget, saved on every create/update)
  with the bills it is about listed under it — `billsInBudget` (open bills under the budget's
  root, from its account, or all for Overall) and `billLines` ("Rent (SR 3,000) is planned as a
  bill in Housing.", the first three then "And N more bills."). The calendar and bills come from
  `hooks/useBudgetPlanContext(today)` (live `readPayCalendar` + `db.bills`).
- **Ledger row title** is the note, else the **leaf** category's own name ("Cafés", not
  "Dining"); the line under it reads "Dining · Cafés | Everyday · Main". Whenever the scope spans
  more than one wallet (All accounts, a group) every activity row names a wallet with its
  immediate group ("Everyday · Main") so same-named wallets in different groups stay apart; a
  single-wallet scope shows the bare name. `AdjustmentEditor`: see _Balance adjustments_ below.
- **Counts toward (1e).** The dialog shows one `CountsTowardRow` ("Counts toward · Nothing ·
  Regular spending ›"); it opens `CountsTowardOptions`: "Nothing", **Suggested** — the top five
  of `data/countsToward.ts#rankSpendOptions` — open **bills** ("Bill · SR 3,500 due Oct 1",
  `billOption`) and goals, in tiers: an open planned **payment** within ±30 days of the entry's
  date, nearest first → anything with a set-aside within ±30 days, nearest first → the rest,
  bills before goals; ties by kind then position. A spend only settles payments, so a near
  set-aside must not bury a payment. Closed or deleted bills are left out; the chosen one
  always shows. A pick is filed as `useTxEditor.setSpendTarget({kind: 'goal' | 'bill', id})` —
  the draft holds `goalId` **or** `billId` — and
  "More…" for the rest; typing searches **names only** across all of them (`commandFilter`; a
  sub-line's figures would match everything). Income lists **income streams** instead
  (`rankIncomeOptions`); a stream is only a way to find its planned payday (a transaction has no
  stream column). Hidden for transfers. `hooks/useCountsToward` resolves what to save:
  - **Auto-match.** A _new_, untouched entry links itself to the open planned item its amount
    and date match — `findAmountMatch` with `DIALOG_MATCH` (±7 days, amount within **10%** of
    the open remainder, same settle rules as QuickAdd). The banner reads "Matches planned Rent
    (Sep 30)" / "Expected SR 4,500.00 · marks it as paid", **Link on by default**; switched off
    it strikes through and reads "Saves as regular spending. Rent stays planned." — per item. A
    spend's auto link also carries the payment's bill (`billIdForMatch`) or goal
    (`goalIdForMatch`); an income auto-match hides the row and offers "Choose another stream".
  - **Picked.** Once the user picks (even "Nothing"), auto-matching stops for that type. A
    picked bill / goal / stream goes through `usePlannedMatch` (the origin's oldest open item in
    `MATCH_WINDOW`): "Settles the planned Oct 1 payment (Rent)." with the same Link switch. A
    picked bill with no payment in the window still saves with its `billId` (the save pays its
    first open occurrence); switching a found one off saves regular spending, no bill.
  - An entry **already linked** keeps its link (it is not re-matched, since its item is now
    done) and shows it the same way.
  - `link` = `{ plannedId, goalId, billId }` goes to `useTxEditor.save(link)` (`SaveLink`;
    `goalId` overrides the draft's for a spend, `billId` is written as given). A **spend only
    matches planned payments**: a goal's set-aside labels money in place, so a picked goal with
    no payment near shows "Counts as spending this goal's money. To put money aside, use Add
    contribution on the goal." and saves unlinked. An income stream with no payday near shows "No
    planned payday near this date — it saves as regular income." Changing the type drops the
    link.
- **QuickAdd match hint (1e).** `QuickAddCard` has no picker, but when the typed amount and
  type are unmistakably an open planned item it says so under the input — "Matches planned
  Salary (Sep 27)" with a **Link it** switch, on by default (`QuickAddMatchHint`). The pure
  rule is `data/quickAddMatch.ts#findQuickAddMatch` (`findAmountMatch` with no tolerance): income settles `income`-role items
  (paydays); spend settles `payment`-role items of `bill` origin — never set-asides or MANUAL
  items; the
  typed amount, converted to the item's currency, must **equal its open remainder**; the item's
  date is within **±3 days of today**; several matches → the oldest. `hooks/useQuickAddMatch`
  feeds it from `usePlannedData`; turning the link off holds for that item only. Saving goes
  through the same `saveNewTransaction` as the dialog (a bill payment releases, moves `nextDue`
  and may raise the leftover prompt). A linked entry is written to the **item's planned wallet** when it names a live one
  (`plannedWalletOf`; the hint says "→ Main Checking"), even over the account QuickAdd is
  scoped to, with the typed amount converted into that wallet's currency (`quickAddTarget`);
  no planned wallet, or unlinked → QuickAdd's own account. It also carries the payment's bill
  (`billIdForMatch`) or goal (`goalIdForMatch`) and uses
  the item's name as the note when none was typed. The category stays the user's pick.
  Desktop only — the app-wide add opens the transaction dialog, which has "Counts toward".

### Picking a category — the shared `CategoryPicker`

The transaction dialog offers the frequent categories as chips and opens the full two-level
list (`features/categories/components/CategoryOptions`, the body of `CategoryPicker`) as a pane
inside itself. `CategoryPicker`
(documented in [categories.md](categories.md#the-picker--categorypicker)) is the popover form: one
full-width trigger showing the chosen icon and "Parent › Sub".

`QuickAddCard` keeps **one-tap chips** (`QuickCategoryChips`) and opens the same picker from a
**More** chip (`CategoryPicker`'s `trigger` prop). The chips are
`data/quickChips.ts#quickChips` over the last `QUICK_CHIP_LOOKBACK_DAYS` (90) of the type's
ledger rows (`hooks/useQuickChips`, one `date`-index live query): the `QUICK_CHIP_COUNT` (4)
most-used categories, keyed by the leaf `categoryId` (`QuickChip = { categoryId }`), ties to
the latest use, topped up with the catalog's first roots so a new user still sees a full row.
An id the catalog no longer holds, or one of the other type, is never offered. Until the user picks, the entry files
under the first chip; a type switch drops the pick. A pick from More that isn't a chip takes
More's place, in its own colour, and reopens the list. Subcategories are saved.

- **Amount prediction.** `QuickAddCard` passes the typed amount (`useQuickChips(type, count,
  { minor, currency })`, debounced 350 ms so "120" doesn't flash "1" and "12"). Every
  category the same type was filed under for **that exact minor amount in that
  currency** within `AMOUNT_MATCH_LOOKBACK_DAYS` (30) leads the row — all of them, even past
  `count` — ranked like the frequent ones; the frequent/catalog chips follow. Since the entry
  files under the first chip until the user picks, the best match becomes the default.
- **No load flicker.** Both the catalog (`useCategoryCatalogState` keeps the last built
  catalog at module level; `loaded` says it reflects the table) and the chips (`lastRanked`,
  the amount-free ranking per type+count, keyed with `localDbGeneration()` too) seed a
  remount's first render from the last result — never across a sign-out — and `useQuickChips` never ranks until *both* the ledger rows and the catalog have
  loaded — so the row no longer steps built-ins → user catalog → favourites. A cold start
  shows only More until the first real ranking, which then fades in.
- **Motion.** `QuickCategoryChips` animates re-ranks with `src/hooks/useFlipLayout` — a
  dependency-free FLIP over `[data-flip-key]` children (Web Animations API: moved chips
  slide, new ones fade/scale in, reduced motion respected, a no-op in jsdom). The container
  must be the chips' offset parent (`relative`). Reuse this hook for other reorders before
  reaching for `motion`. Removed chips vanish (no exit animation).
- **Calendar paging.** `PeriodSlide` (`motion`) pages the grid: the weekday labels stay put and
  the new period slides in from the side it lies on (mirrored in RTL); a switch between the day
  and month grids fades. `useCalendarSlide` decides the page: a new page only when the *same*
  mode moves to another period (ordered by the first in-period cell's ISO key) — changing mode
  within the day grid or folding keeps the page, so `FoldingGrid`'s own fold still animates.
  A touch `pointerdown` anywhere on `DaysCard` starts the page's drag through `useDragControls`
  (mouse never drags; desktop uses the arrows); it rubber-bands against zero constraints and
  `swipeStep` (`src/lib/swipe.ts`, distance plus a flick bonus) decides the step on release.
  The card keeps `touch-pan-y` so vertical scroll still works; a drag swallows the click it ends
  on. Reduced motion is respected via `MotionConfig`.

`CategoryIcon({ categoryId })` resolves a row's glyph live from the leaf id — a child's own icon
(which the resolver already falls back to the parent's).

**The editor draft** (`useTxEditor`) holds one `categoryId`; `setCategory(id)` sets it, a
merchant's learned `CategoryPrediction { categoryId, apply }` applies (or is offered) only when
the id is live and of the row's type, and a spend ↔ income switch keeps the pick only when
`rootOf(id).type` matches, else takes the type's first root. The surfaces that already hold a `ResolvedCategory` (the picker)
render `<Icon>`/`IconChip` directly rather than round-tripping a slug
through a component that opens its own live query.

### How the page reads the ledger

The Spending page never loads the whole `transactions` table into its views — a ledger grows
without bound, and every builder only ever looks at a few dates. **What each consumer needs:**

| Consumer                                               | Dates it reads                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCashflow`, `buildBreakdown`, `buildActivityList` | the period — a transfer's partner leg only counts when it is in that window too                                                                                |
| `buildCalendar`                                        | `calendarSpan(period)`: the anchor month's whole-week grid, which spills into the neighbouring months; a custom day grid's whole weeks; a month grid's period  |
| `buildBudgetsView`                                     | each live budget's `budgetWindow(period, customDays, today, payCalendar)` — **relative to today, not the anchor**, so browsing an old month still reads this month's budget span |
| `scopeSections`, the `ConnectedTxEditor` accounts      | none — a balance is opening + the whole ledger, read from the running totals (`readWalletDeltas`)                                                              |
| opening a transfer row                                 | both legs by the `transferId` index (`readTransferLegs`) — a leg can sit on another date                                                                      |

- **`data/ledgerRange.ts` — `ledgerRanges(period, today, budgets)`** is the union of the
  first three rows as merged, sorted, inclusive ISO spans (`mergeRanges`). Pure, tested alone.
- **`data/ledgerReads.ts` — `readLedgerWindow(isoPeriod, today)`** reads the budgets, computes
  the ranges and queries `transactions.where('date').inAnyRange(ranges, { includeUppers: true })`.
  Reading the budgets **inside** the live query makes a budget edit that widens its span re-run
  it. The answer (`LedgerWindow`) is tagged with the period it was read for **and carries the
  budgets it computed the ranges from**; the budgets view is built from those, never from
  `useTransactions`' faster budget list — otherwise a newly added or widened budget is summed
  for one render over rows read for the old ranges. **Rows are sorted by id** before they leave:
  a full-table read returns primary-key order, the date index returns date order, and the
  builders' stable sorts (`buildCashflow`, `buildBreakdown`) break equal totals by arrival —
  so date order could swap the "Top: …" category. It relies on dates being wire ISO
  `YYYY-MM-DD`, where string order is date order.
- **Balances read the running totals, not the ledger.** `readWalletDeltas(rates)` reads the
  `wallet` rows of `ledgerTotals` and converts each currency's sum into the wallet's currency
  (`walletDeltasFromTotals`); `readLedgerSummary` adds the `currency` rows and the goal-linked
  rows by the `goalId` index. It waits for the rates to load, and only the account filter's
  balances and the editors wait for it — the filter lists its accounts at once (`scopeSections`
  over empty deltas) with skeleton balances until then.

### Running totals (`ledgerTotals`)

Every screen that needs a figure over the **whole** ledger — wallet balances, rows per category,
rows per merchant, currencies in use — reads a small derived table instead of the ledger.

- **Rows** (`LocalLedgerTotal`, `id, kind` indexed): `wallet:<id>:<currency>` holds the signed
  minor-unit `sum` and `count` of a wallet's live rows **in that row currency**;
  `category:<id>` / `merchant:<id>` count live rows; `currency:<code>` counts every row,
  deleted ones included. A total whose count reaches 0 is removed. What a row contributes,
  and how a write moves the totals, is pure: `data/ledgerTotals.ts` (`contributionsOf`,
  `totalsDiff`, `applyTotalsDiff`).
- **Sums stay per row currency; conversion happens on read**, so a rate edit moves balances
  with no rewrite. Converting a currency's **sum** once rounds once, where converting each row
  rounded every row: the old per-row figure drifted by up to half a minor unit per
  foreign-currency row (measured: 79 minor units on a wallet with ~2,900 USD rows). The summed
  figure is the more accurate one. Same-currency wallets are exact either way.
- **Maintained by `db/ledgerTotalsMiddleware.ts`**, never by feature code — see
  [data-layer-and-sync.md](data-layer-and-sync.md#running-totals-maintained-in-the-database).
- **Self-check.** `db/ledgerTotalsCheck.ts` recounts the ledger in pages once per page load,
  when idle after the first pull (`scheduleLedgerTotalsCheck` in `startSync`). A write landing
  between pages makes the paged recount disagree with totals that are right, so a
  disagreement is only confirmed by `rebuildLedgerTotals`, which recounts in one transaction
  with the ledger and rewrites (and reports drift) only when the totals really differ.
- **Readers**: `readWalletDeltas` / `readLedgerSummary` (Spending, Wallets, Settings › Archived,
  search's account balances) and `hooks/useLedgerCounts(kind)` (Settings › Categories and
  › Merchants).

- **Stepping periods never flashes.** `useLedgerWindow` wraps `useLiveQuery`, which
  (dexie-react-hooks 4) keeps the previous answer across a deps change, and `useSpendingViews`
  builds the ledger views for the period **the rows were read for**, not the one in state — so the
  old period stays whole on screen until the new one lands (`hooks/useLedgerWindow.test.ts` pins
  the hook side). `useSpendingViews` returns `period` (`mode`, caption, `todayIs`) for the period
  on screen — the loaded one, else the one asked for — and `DaysCard`, the hero and the donut
  take it from there rather than from `useSpendingPeriod`, so a header always matches its grid.
- **Views are memoized and built per tab** (`hooks/useSpendingViews`): one `useMemo` per builder,
  keyed on its real inputs (`scopeToValue(scope)` rather than the scope object, ISO strings
  rather than `Date`s), each `null` unless its tab is showing — Activity builds
  cashflow/calendar/list/breakdown, Budgets one view. Unfolding the calendar
  rebuilds only the calendar. `useMergedRates` returns a new object every render, so
  `useTransactions` memoizes `mergeRates` on the config store's slices instead, keeping `rates`
  stable.
- **Loading skeletons only the figures, never zeros, never whole cards.** Every card renders
  for real from the first frame — frame, headings, static labels ("Income", "Spent", "Net",
  "on track"…), the mode switcher, prev/next/Today, the period caption (it derives from the
  anchor, not data), Add buttons and the quick-add form. Only data-driven parts wait:
  - a card takes a **nullable view** (`null` = loading) and draws each figure through the shared
    `ValueOrSkeleton` (`src/components/`) — the value, or a skeleton sized like it; bars and the
    donut get a skeleton of their own shape; list cards draw `SkeletonRows` inside the real list
    body. Empty states only show once a view has loaded.
  - the calendar lays out its real days before any figure lands (`buildCalendar` over no rows),
    and `loading` puts a skeleton where each cell's net would be.
  - `ScopeSelect` keeps its trigger and accounts; `balancesLoading` skeletons the balances.
    `QuickAddCard` takes `symbol: null` while the wallets load.
  - The page marks the grid `aria-busy` and announces through one `sr-only` `role="status"`;
    skeletons are `aria-hidden`. The shadcn `Skeleton` (`components/ui/skeleton.tsx`) sits on
    `bg-accent` (= `fp-surface-2`), so it follows light/dark; placeholders use logical sizing only.
  - `useTransactions().loading` covers every input — settings resolve to `null`, not
    `undefined`, when there is no row, so "none" is not "still loading".
  - `components/loadingCards.test.tsx` pins it: with a `null` view each card shows its chrome,
    skeletons in place of figures, and no digit (bar the calendar's day numbers).
- `hooks/useSpendingPeriod` owns the period as an `IsoPeriod` (step, re-anchor on a mode
  change, pick a custom span, pick a month/day); `hooks/useActivityRowClick` opens a row's editor.
- **The equivalence test.** `data/ledgerReads.test.ts` seeds fake-indexeddb with 2½ years of
  spends, incomes, split-date and one-legged transfers, adjustments, deleted rows and
  weekly/monthly/custom budgets, and asserts every builder gives **identical** output from the
  window and from the full ledger (in primary-key order, with random ids so that is not date
  order) — 18 period/today combinations (year mode, week and year edges, past months while
  budgets stay relative to today, a month of equal category totals whose date order is the
  reverse of their id order, and custom spans drawn as days and as months across a year edge)
  × 4 scopes.
  `hooks/useSpendingViews.test.ts` counts builder calls per tab and per re-render.

## Transfers between wallets

A transfer is **two ledger rows sharing a `transferId`**: a `transfer_out` leg on the source
wallet and a `transfer_in` leg on the destination, each in its own wallet's currency, with
`categoryId`/`goalId`/`merchantId` all null, and `source` null unless an import
wrote it (then both legs carry `csv:<batchId>`). There is no transfer table:
the legs live in `transactions` and come back through the ordinary ledger delta.

- **Types.** `TxType` stays `spend | income`. It is what categories,
  merchants' learned type, imports and integrations mean by a type, and the server refuses
  transfer types in all of them. Only ledger rows use the wider `TransactionType`
  (`TxType | TransferLegType | AdjustmentType`), and `Transaction.categoryId` is
  `string | null` (null on a leg and on a [balance adjustment](#balance-adjustments)).
  `isTransferLeg`, `isAdjustment` and `isCashflow` (spend or income) are the guards — test
  for cash flow with `isCashflow`, never with "not a transfer". The editor has its own `EditorTxType`
  (`TxType | 'transfer'`): one transfer is one entry there, two rows on disk.
- **Writes** (`data/transfers.ts`). `createTransfer` puts both legs and **one** outbox entry
  (`entity: 'transfer'`, id = the transfer id) in one Dexie transaction. `updateTransfer`
  rewrites whichever legs are held and folds into a queued create/update. `deleteTransfer`
  removes every leg by the `transferId` index and queues a delete only if the server ever saw
  it. The ledger's own `create/update/deleteTransaction` are never called on a leg; the
  server refuses them (`spending.transaction.transfer_leg`).
- **Push** (`data/transferSync.ts`, dispatched from `db/sync.ts`) against
  `POST/PATCH/DELETE /transfers`. Create stores the returned legs. `409
spending.transfer.id_taken` is a uniqueness answer, not a conflict: the legs are marked
  clean and a full pull settles them. On update, `409 common.conflict` rebases once on the leg
  versions from a fresh list and re-sends (then accepts the server's legs), and `404` drops the
  legs. Delete treats `404` as done. A run of transfer creates or deletes is bulk-batched
  (`pushTransferCreates` / `pushTransferDeletes` against `POST /transfers/bulk` /
  `POST /transfers/bulk-delete`, results handled exactly like the ledger's bulk endpoints: a taken
  id stores the returned legs, or — not ours — marks ours clean and pulls); updates never are.
- **Bulk writes** (`bulkAddTransfers(entries, source)`, `bulkDeleteTransfers(ids)`): many
  transfers in one Dexie transaction, one outbox entry each, legs marked with `source`, no
  `schedulePush()` — the CSV import's path. `updateTransfer` keeps a leg's `source`.
- **A lone leg.** Deleting a wallet cascades only its own leg server-side, so a transfer can
  arrive with one leg. It still edits: the surviving leg keeps its side, and the PATCH sends
  `null` for the missing side's wallet id and version (`transferToUpdateWire` builds that from
  `HeldLegs`). The editor shows the missing side as "Deleted account", disabled, with swap off.
- **Ledger.** `transfer_out` debits and `transfer_in` credits its wallet in `walletDeltas`, so
  Wallets reflects transfers. Goal contributions ignore legs (no `goalId`).
- **Totals exclude transfers by construction.** Every total in `selectors.ts` reads
  `flowTxns` / `isFlow` (`isCashflow` with a category — so adjustments are out too): the cashflow hero (and its
  `txCount`), the breakdown donut, the calendar shading, the activity day totals. Budgets already
  count only `spend`.
- **Activity rows.** `buildActivityList` returns `ActivityRow = TxRow | TransferRow |
SetAsideRow | AdjustmentRow` (discriminated on `kind`; set-asides and adjustments below). A window row is kept when its own wallet is in scope, and a leg
  also pulls in its partner so the scope rules can see both sides. `dayRows` then collapses
  the legs by `transferId` into one `TransferRow`:
  - both wallets in scope (all accounts, or a group holding both): `direction: 'neutral'`,
    no sign, titled by the note or "Transfer";
  - only the source in scope: "Transfer to <To>", `−amount`; only the destination: "Transfer
    from <From>", `+amount`;
  - a missing leg is never in scope and is named "Deleted account";
  - neither side in scope: no row. `countStr` counts collapsed rows.
  - a day whose rows are all transfers totals to `—` (nothing to total), and a scoped
    (wallet/group) list with no rows reads "Nothing for this account." (`emptyText`).

  `TransferActivityRow` draws it: a 36px dashed neutral chip holding `TransferGlyph`
  (`components/icons/`, the design's half-headed ⇄, 17px / 1.9 stroke), `● From → ● To` with
  each wallet's `color`, a 14px grey amount and a 10.5px "not in totals" caption. Clicking it opens the editor on the
  transfer (`useTxEditor.openEditTransfer`).

- **UI.** `QuickAddCard` gains a Transfer tab (`QuickTransferForm` + `useQuickTransfer`):
  one wrapping row of amount box, `TransferAccountsRow` (From · swap · To: 44px selects and a
  round 30px swap), add, and the hint line from `transferHint`. The transaction dialog's
  Transfer type renders `TxTransferFields` (see _The transaction dialog_ above) and hides
  category, account pill, counts toward and merchant. Its button reads "Save transfer ·
  <amount>" and is disabled while `resolveTransfer` (`data/transferForm.ts`, also what `save`
  uses) returns null: amount ≤ 0, same account, or cross-currency with no received amount;
  "reset" on an edited Received calls `useTxEditor.resetReceived`. A saved
  entry cannot cross the transfer boundary (the other segments are disabled). The mobile FAB
  opens the same editor, so it has the Transfer type too.
- **Cross-currency.** When the wallets' currencies differ a "Received" amount appears, prefilled
  by `suggestReceived` (the merged FX rates via `convertMinor`) and tracking the amount until
  the user edits it. It is sent as `to_amount`; within one currency `to_amount` is null.
- **Wallets writes transfers too.** The Wallets "Transfer money" dialog
  ([wallets.md](wallets.md#transfer-money-dialog)) calls the same `createTransfer` /
  `deleteTransfer`; there is one write path.

## Balance adjustments

The user types a wallet's **real** balance and the app records the gap as one ledger row of
type `adjustment_in` / `adjustment_out` (wire `ADJUSTMENT_IN` / `ADJUSTMENT_OUT`). The amount
is positive; the sign comes from the type, as for transfer legs. It moves the wallet's derived
balance and nothing else — **never** income, Spent, the donut, the calendar, a budget, a goal
or a report. `categoryId`, `goalId`, `merchantId`, `plannedId` and `transferId`
are all null; `currency` is the wallet's own; `source` and `note` are allowed. The server
refuses the links (`spending.transaction.adjustment_refs`), another currency
(`…adjustment_currency`) and a PATCH across cash flow ↔ adjustment (`…type_change`).

- **Types** (`api/types.ts`): `AdjustmentType`, `AdjustmentTypeWire`, `isAdjustment`,
  `isCashflow`; both wire maps carry the new members.
- **Ledger**: `signOf` credits `adjustment_in` and debits `adjustment_out`, so Wallets and
  every live balance follow.
- **Writes** (`data/mutations.ts`) — ordinary `transaction` outbox rows through `/transactions`.
  `AdjustmentDraft` (type, amount, currency, wallet, date, note, source) sits beside
  `TransactionDraft`; `LedgerDraft` is either, and `buildTransaction` nulls every link for an
  adjustment. `createAdjustment(draft)` → id, `updateAdjustment(id, draft)` (only rewrites a
  row that already is an adjustment; folds into a queued create/update), delete through
  `deleteTransaction`. `addTransactionWithId` and `bulkAddTransactions` take `LedgerDraft`, so
  an import can bulk-write adjustments on the ordinary path.
- **Activity**: `dayRows` turns each adjustment into an `AdjustmentRow` (note or "Balance
  adjustment", wallet name + colour, `direction`, signed base-currency amount). It shows while
  its wallet is in scope; a day holding only adjustments totals `—`. `AdjustmentActivityRow`
  draws it like a transfer — dashed neutral chip with Lucide `Scale`, "Balance adjustment · ●
  wallet", grey amount, "not in totals".
- **Editing**: clicking the row opens `AdjustmentEditor` (`hooks/useAdjustmentEditor`), not the
  transaction dialog (`openEditTx` ignores anything that is not cash flow): direction `PillSwitch`
  ("Added to" / "Taken from balance"), a neutral `AmountWell` in the row's currency, date (with its
  relative hint), note, the "Corrects X's balance" caption, and Delete behind a confirmation. The
  wallet is fixed.
- **Creating** happens on Wallets — [wallets.md](wallets.md#adjust-balance-dialog).
- **Export**: the CSV names it "balance adjustment" and signs its amount (`adjustment_out`
  negative); every other row keeps its raw type and unsigned amount.

## Confirmed planned items in Activity

Activity never lists planned rows — only what settled them. `useTransactions` adds the
`setAsides`, `goals` and `bills` to `SpendingInputs` (all optional, so the pure tests need not
pass them).

- **Tag pill.** `TxRow.tag` (`txTagOf`): a planned income reads "Income"; a spend with a
  `billId` reads "Bill"; a spend with a `goalId` reads "Goal". Drawn with the shared
  `components/TagPill` before the category in the meta line.
- **Set-asides.** Every set-aside dated in the window becomes a `SetAsideRow` (`ownerId`, the
  bill's or goal's name, "Set aside · <wallet or outside label>", base-currency amount) —
  released ones too: the row records that money was set aside that day. A wallet's shows when
  its wallet is in scope; one held outside only unscoped. `SetAsideActivityRow` draws it
  like a transfer (dashed neutral chip, grey amount, "not in totals"). They are **never** in a
  day total, Spent, the donut, the calendar or a budget — those read `txns` only — and a day
  holding only set-asides totals `—`. Wallet-held ones feed only the hero's set-aside caption. Tapping one opens `/goals` (the route has no goal selector yet).
- **Nudge.** When `usePlanned().dueCount > 0` the Activity tab leads with `PlannedNudge`
  ("● N planned waiting for you to confirm · Review →"), which switches to the Planned tab; the
  tab's label carries the same count as an amber pill.

## Sync failures on ledger rows

A ledger row whose queued change the server could not take shows a **badge** instead of silently
diverging ([data-layer-and-sync.md](data-layer-and-sync.md#failed-pushes-flag-hold-retry--never-drop)).

- **One live query per list.** `TransactionList` calls `useFailedSyncIds(LEDGER_SYNC_ENTITIES)`
  (`transaction` + `transfer`) once and hands each row `failures.get(row.id)` — a transfer row's
  id is its `transferId`, which is also its outbox key. Never one query per row.
- **`RowSyncBadge`** (feature wiring: `describeSyncFailure` with the names the row shows —
  `syncContextOf` in `data/syncFailures.ts`, "Deleted account" never used as a name — plus
  `useSyncRetry`) renders the shared `components/sync/SyncFailureBadge` next to the amount on
  spend/income rows, transfers and adjustments. Set-aside rows carry none yet (their entity is
  `setAside`).
- **`SyncFailureBadge`**: amber `CloudOff` (`fp-warn`) while unavailable, red `TriangleAlert`
  (`fp-danger`) once rejected; `aria-label` "Not synced: <title>". Hover or focus shows a
  tooltip (title, detail, hint); a press — the only path on touch — opens a popover with the same
  text plus **Retry now** and, when `canFixByEditing`, **Edit** (the row's own click). The badge
  is wrapped in a span that stops click propagation: Radix portals the popover, but React still
  bubbles its events through the row, so without it every press in the popover would open the
  editor. The tooltip is forced shut while the popover is open.
- **Dialog banner.** `TransactionDialog` reads `useRowSyncFailure(isTransfer ? 'transfer' :
  'transaction', id)` and leads the form with `SyncFailureBanner` (a compact `Alert`: title,
  hint, Retry now). `useFlaggedField` maps a rejected failure's `field` onto the draft
  (`wallet_id` → the account pill, `amount`/`to_amount` → the amount hero, `category_id` /
  `merchant_id` / `date` → their `TxSection`, `goal_id`/`planned_id` → Counts toward,
  `from_/to_wallet_id` → the transfer side cards) and marks it **until the user changes that
  value**. Saving coalesces into the queued entry and clears the flag, so it retries at once. The
  adjustment editor shows the same banner (`RowSyncBanner`) without field marks.

## Tests

`data/{planning,ledger,selectors}.test.ts` (vitest) cover the window/cadence math, the
opening+txns balance and goal roll-up, and cashflow/budget numbers, plus transfer
legs in the ledger, transfers excluded from every total, and the activity collapsing/scope
rules, set-aside rows and tags, plus adjustments (credited/debited, in activity, out of every
total). `data/adjustments.test.ts` drives `createAdjustment` / `updateAdjustment` / bulk writes
against fake-indexeddb. `data/countsToward.test.ts` covers the 1e ranking;
`data/quickAddMatch.test.ts` the exact and the 10% / ±7-day amount match, `data/txDialog.test.ts`
the dialog's wording and readiness; `components/TransactionDialog.test.tsx` the auto-match and
its switch (a bill's payment), picking a goal, the in-dialog panes, the saving-goal hint, income paydays, the
blocked-save hints, the same-account transfer and edit mode against fake-indexeddb. `data/transfers.test.ts` drives the transfer mutations and push handlers against
fake-indexeddb (both legs + one entry, coalescing, lone-leg PATCH, id-taken, 404, rebase).

## Written from outside this slice

Transactions arrive from three places besides the editor, each marked by its `source`. Only the
CSV import produces transfer legs and balance adjustments (a file's own transfer and adjustment
rows — [import.md](import.md#transfers-and-balance-adjustments-in-a-file)):
`email:<connection_id>` / `webhook:<key_id>` (a
confirmed or auto-confirmed inbound import — [inbound-imports.md](inbound-imports.md)) and
`csv:<batchId>` (a file import —
[import.md](import.md)). The import path calls `bulkAddTransactions` /
`bulkDeleteTransactions` / `bulkAddTransfers` / `bulkDeleteTransfers` here, which deliberately do
**not** `schedulePush()`: the caller
pushes once for the whole batch. A queued bulk delete carries `baseVersion: null` — the endpoint
takes ids and no versions, because a row the user asked to remove has no content left to lose to
a conflict. The transaction dialog also carries a Merchant field
([merchants.md](merchants.md)) and the queue slice's `SourceSection` — the email or payload
an auto-logged entry came from.
