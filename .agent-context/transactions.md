# Spending feature (the "Spending" page — `src/features/transactions/`)

Third synced slice, local-first like Balances/Goals. One page, four views (Activity /
Planned / Budgets / Recurring) recreating the Means `TransactionsApp` design (the Planned tab
belongs to [planned.md](planned.md#the-planned-tab-and-the-confirm-dialog-components)). Route `/transactions`
(the nav's 3rd "Spending" slot, `active="budget"`). Dexie declares `transactions`,
`budgets`, `recurrings`; `OutboxEntity` carries `transaction|transfer|budget|recurring`.

## Data layer (`data/`)

- **mappers / mutations / sync** mirror goals exactly: optimistic local write → outbox →
  `schedulePush()`; 409 rebase-retry, 404 drop, network keep. `pushSpendingEntry` /
  `pullSpendingAll` are wired into `db/sync.ts`. Money is minor units; `version` is the
  server sha256 string (empty until first sync); enums map at the boundary (`api/types.ts`).
  **The ledger is the one table here that does not pull in full**: `pullSpendingAll` runs
  `pullTransactionsDelta` (a watermarked `GET /transactions/changes`) beside the ordinary
  `pullBudgets` / `pullRecurrings` lists, because budgets and schedules are bounded and a ledger
  is not — see [data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams).
  Rows also leave in bulk in both directions: `POST /transactions/bulk` for a run of queued
  creates, `POST /transactions/bulk-delete` for a run of queued deletes.
- **The catalog is not here.** Transactions store the parent `category` + an optional
  `subcategory` **slug**, and everything those slugs mean — name, colour, icon, the child
  list — is resolved from the user's own synced two-level category tree in
  `features/categories/` ([categories.md](categories.md)). Nothing in this slice may import
  the built-in defaults; an ESLint rule enforces it. (`SAVINGS_CATEGORY_ID` is gone: linking
  an entry to a goal no longer re-files it under Savings — ADR-7.)
- **ledger.ts** — the cross-feature derivation. `walletLiveBalances(nodes, txns, rates)` =
  opening `amount` + Σ signed deltas (in the wallet's currency); `contributionsByGoal(...)` =
  Σ goal-linked txns per goal (in the goal's currency). **Threaded into the other features:**
  `useBalances` passes wallet deltas to `buildBalancesView` (4th arg) so balances reflect
  spending. Goal progress no longer adds contributions on top of reservations: a goal-linked
  spend is a *payment* that consumes set-asides (`goals/data/progress.ts`, see
  [goals.md](goals.md#progress-set-asides-vs-payments-dataprogressts)).
- **Settlement links.** A transaction may carry `plannedId` — the planned item it settles
  ([planned.md](planned.md)); always sent on PATCH, never set on a transfer leg. Every write
  path here (`addTransactionWithId`/`createTransaction`, `updateTransaction`,
  `deleteTransaction`, `bulkDeleteTransactions`) calls the planned slice's `closeCovered` /
  `reopenUnderSettled` afterwards, so saving an entry against a planned item closes it and
  deleting it re-opens the item. `TxEditorDraft.plannedId` carries the link through the editor
  (reset when the goal changes); choosing a goal keeps the user's category (ADR-7).
- **selectors.ts** — pure view builders ported from the design's `renderVals`. Every builder
  that names a category takes **`catalog: CategoryCatalog` as its required second
  parameter** — `buildCashflow(data, catalog, …)`, and likewise `buildBreakdown`,
  `buildActivityList`, `buildBudgetsView`, `buildRecurringView`. Deliberately **not**
  optional with a default, unlike `dateFormat`: a wrong date format is cosmetic, a wrong
  catalog is a donut saying "Dining" while the editor two inches away says "Eating out", and
  making it required means the compiler enumerates every call site. `buildCalendar` takes no
  catalog — it counts money per period and never names a category. The builders:
  `buildCashflow` (income / spent / **saved** / net — net = income − spent − saved, i.e. the
  period's free cash; **saved = Σ wallet-held goal reservations dated in the period and scope**,
  hidden when 0, and drawn as a grey "Set aside" segment after the categories),
  `buildCalendar` (see below), `buildActivityList` (day groups), `buildBreakdown` (donut),
  `buildBudgetsView` (burn vs cap, health rail), `buildRecurringView` (monthly-normalized total +
  upcoming timeline). `Scope` = all | wallet | group (group matches descendant wallets).
  **A goal-linked spend is a payment, not saving** (ADR-3: setting aside is a reservation;
  ADR-7: a payment keeps its own category). It counts as Spent in the hero, day totals, donut
  and calendar, and burns budgets like any spend — the old `isContribution` rule (spend with a
  `goalId` → Saved, skipped by budgets) is gone. Its only special treatment left is the "Goal"
  pill.
- **planning.ts** — date math (`windowOf`, `budgetWindow`, calendar grid, `advanceDue`,
  `relFuture`), parameterized by `today` for testability. **`fmtK` takes minor units and a
  currency code** — every caller holds minor units, so the major conversion lives there.

### The calendar — one cell shape, two grids

`RangeMode` is `year | month | week | day`. `buildCalendar` returns a **discriminated union**
on `grid`, because a year is not a grid of days:

Both variants carry the same `FoldingRows` shape — `pivotRow` (always visible) plus
`rowsBefore`/`rowsAfter` (folded away until the toggle opens) — so `FoldingGrid` renders and
animates both, and the toggle means the same thing in all four views.

- `grid: 'days'` (month/week/day) — rows of 7. The month around the pivot week is built in
  **all three** modes, so the unfold works everywhere, not just in month mode.
- `grid: 'months'` (year) — rows of four. Folded shut it shows the row
  holding the running month (January's row for any other year); open it shows all twelve.

Both emit the same `PeriodCell`, so `CalendarCell` styles a day and a month identically, and
the year grid always shows the income/spend split (days show it only when a day has both).
Cell colouring lives only in `CalendarCell` and is **net-driven, with no accent fill**:

- **Outside the selected period** (`outside` = not in `windowOf(anchor, mode)` — so in day view
  every other day, in week view the rest of the unfolded month) → a diagonal hatch, muted
  figures. Never true in the year grid.
- **Even** (`tone: 'zero'` — no activity, or income = spend) → flat `surface-2`.
- **Net positive / negative** → a green / red wash (`color-mix` of the accent / `RED` into
  `surface`), 12–38% by `intensity`. Figures use the ink tokens (`--fp-accent-ink`,
  `--fp-danger`) so they stay legible on the wash in both themes.
- **The picked day** (`isActive`) → a heavy `--fp-text` border only; **today** (`isCurrent`)
  → an inverted date chip. Deliberately colourless, so neither fights the day's red/green.

**Anchoring.** The anchor for a mode is always `windowOf(date, mode).start`. Switching mode
re-anchors on today when the period being left covers it; the **Today** pill in `DaysCard`
(shown only while today is outside the period, arrow pointing toward it) re-anchors on today
in the current mode.

`intensity` is `sqrt(|net| / peak)`, where the peak is the biggest net **of the same sign** in
the scaling period — the anchor month for a day grid (in every mode, so a day keeps its shade
as you switch views), the anchor year for a month grid. Per-sign peaks stop one big payday from
flattening every red day; the square root keeps small days distinguishable from mid ones.

- **Auto-post moved onto planned rows** (ADR-6). `autopost.ts` and its Spending-page mount
  effect are gone: recurring schedules generate planned rows, and the app-level planner confirms
  the `autopost` ones on their date (same amount, wallet, note and `recurring:<id>:<date>`
  source marker) and advances `next_due` — once per session instead of on page enter, with
  deterministic ids instead of the per-device marker, so two devices no longer double-post. A
  pre-existing marker counts as the settlement of its occurrence. See [planned.md](planned.md).

## UI

- **Account filter** (`ScopeSelect`, in the page header; filters every tab). Built by the pure
  `scopeSections`: "All accounts", then one section per top-level group — the group itself,
  then its wallets and subgroups indented by depth, each with its `IconChip` and balance (a
  group's in base currency) — then an "Not in a group" section of loose wallets (headed
  "Wallets" when there are no groups). Archived accounts are left out; `offeredScope` falls a
  chosen scope back to `all` once its account is archived or deleted. Transactions on archived
  wallets stay in the history under "All accounts".

`hooks/useTransactions` bundles all inputs into `SpendingData` **and returns the live
`catalog` beside it** (the selectors' explicit signature won over folding it into
`SpendingData`); `TransactionsPage` threads it into every builder. `hooks/useTxEditor` is the
tx/budget/recurring editor state machine. Components are dumb (`components/`): page composition

- `CashflowHeroCard` — its stacked bar is the shared `SegmentedBar`, so every category chunk
  reveals its name, its base-currency amount and its share of outflow on hover/focus/tap
  ([styling-and-theming.md](styling-and-theming.md#shadcnui-integration)). That is why a
  `CashflowSegment` carries `label`/`valueStr`/`pctStr` and not just a colour and a width:
  the builder holds the catalog and the base currency, the bar holds neither.
  `buildRecurringView` fills the same shape per recurring item (name, monthly equivalent).
- `DaysCard` (period header + toggle) with `DayGrid`/`MonthGrid` and the
  shared `CalendarCell`, `TransactionList`, `QuickAddCard` (single-line desktop;
  mobile uses a FAB), `BreakdownCard`, `BudgetsCard`/`BudgetHealthCard`, `RecurringCard`/
  `UpcomingCard`, `TxEditor`, `CategoryPickerDialog`. `fp-` tokens + logical RTL utilities.
- **Counts toward (1e).** A transaction's editor shows `CountsTowardField` under Category
  instead of a goal select: option cards "Nothing" + up to five goals / obligations
  (`data/countsToward.ts#rankGoalOptions`, in tiers: an open planned **payment** within ±30
  days of the entry's date, nearest first → other obligations → saving goals with a set-aside
  within ±30 days, nearest first → the rest; ties by goal position. A spend only settles
  payments, so a near set-aside must not bury the rent. The chosen one always shows) + "More…"
  for the rest: `CountsTowardMore`, a searchable combobox on the app's picker primitives
  (Popover + cmdk `Command`, filtering itself with `commandFilter` like `CurrencyPicker`, so
  only hits mount). It searches **names only** (a sub-line's figures would match everything),
  shows each option's sub-line, and a pick is exactly a card tap — the chosen option is then
  promoted into the cards by `split`. Income lists **income streams** instead (`rankIncomeOptions`); a stream
  is only a way to find its planned payday (a transaction has no stream column). Hidden for
  transfers. `hooks/useCountsToward` runs `usePlannedMatch` and resolves the `plannedId` to
  save — the match, unless the "Don't link" switch is on; an entry already linked keeps its
  link (it is not re-matched, since its item is now done) — and `TxEditor` hands it to
  `useTxEditor.save({ plannedId })`. A **spend only matches planned payments**: a saving goal's
  set-aside is a reservation (ADR-3), so choosing a saving goal shows "To put money aside, use
  Add contribution on the goal" and saves unlinked (the spend still counts as spending the
  goal's money). A recurring schedule's editor keeps the old "Toward a goal" select. Changing
  the type drops the link.
- **QuickAdd match hint (1e).** `QuickAddCard` has no picker, but when the typed amount and
  type are unmistakably an open planned item it says so under the input — "Matches planned
  Salary (Sep 27)" with a **Link it** switch, on by default (`QuickAddMatchHint`). The pure
  rule is `data/quickAddMatch.ts#findQuickAddMatch`: income settles `income`-role items
  (paydays, income schedules); spend settles `payment`-role items of `recurring` or `goal`
  origin (Spending schedules, obligation payments) — never set-asides or MANUAL items; the
  typed amount, converted to the item's currency, must **equal its open remainder**; the item's
  date is within **±3 days of today**; several matches → the oldest. `hooks/useQuickAddMatch`
  feeds it from `usePlannedData`; turning the link off holds for that item only. Saving goes
  through the same `createTransaction({ plannedId })` as the TxEditor (the core closes the
  item). A linked entry is written to the **item's planned wallet** when it names a live one
  (`plannedWalletOf`; the hint says "→ Main Checking"), even over the account QuickAdd is
  scoped to, with the typed amount converted into that wallet's currency (`quickAddTarget`);
  no planned wallet, or unlinked → QuickAdd's own account. It also carries the payment's goal (`goalIdForMatch`, directly or via its schedule) and uses
  the item's name as the note when none was typed. The category stays the user's pick.
  Desktop only — the mobile FAB opens the TxEditor, which has "Counts toward".

### Picking a category is two steps in one sheet

`CategoryPickerDialog` reads `useCategoryCatalog()` and opens on the grid of the type's
categories. **A category with no children selects immediately and closes**, so the common
path stays one tap; a category with children opens step 2 — a list whose _first_ option is
the parent itself ("Just the category"), because filing under "Dining" without choosing a
room is a legitimate answer that must not cost a back-tap. Back is a Lucide `ChevronLeft`
that mirrors in RTL (it is chrome, and it points at a direction in the flow). Both steps pass
an explicit `description`: `ResponsiveDialog` falls back to `{description ?? title}` inside
an `sr-only` `DialogDescription`, and a title containing the Back `<button>` would otherwise
put a second, keyboard-focusable copy of it in the a11y tree.

`TxEditor` shows the chosen pair on one full-width trigger as `catalog.labelOf(category,
subcategory)` → "Dining · Cafés". `QuickAddCard` passes `allowSubcategory={false}`: quick-add
files under the parent and the user refines later in the editor if they care.

`CategoryIcon` resolves a row's glyph live — the **child's** icon when the row names one,
the parent's otherwise. The surfaces that already hold a `ResolvedCategory` (the picker,
`TxEditor`, `QuickAddCard`) render `<Icon>` directly rather than round-tripping a slug
through a component that opens its own live query.

## Transfers between wallets

A transfer is **two ledger rows sharing a `transferId`**: a `transfer_out` leg on the source
wallet and a `transfer_in` leg on the destination, each in its own wallet's currency, with
`category`/`subcategory`/`goalId`/`merchantId` all null, and `source` null unless an import
wrote it (then both legs carry `csv:<batchId>`). There is no transfer table:
the legs live in `transactions` and come back through the ordinary ledger delta.

- **Types.** `TxType` stays `spend | income`. It is what categories, recurring schedules,
  merchants' learned type, imports and integrations mean by a type, and the server refuses
  transfer types in all of them. Only ledger rows use the wider `TransactionType`
  (`TxType | TransferLegType | AdjustmentType`), and `Transaction.category` is
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
  Balances reflects transfers. Goal contributions ignore legs (no `goalId`).
- **Totals exclude transfers by construction.** Every total in `selectors.ts` reads
  `flowTxns` / `isFlow` (`isCashflow` with a category — so adjustments are out too): the cashflow hero (and its
  `txCount`), the breakdown donut, the calendar shading, the activity day totals. Budgets already
  count only `spend`; recurring schedules cannot be transfers.
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
  one wrapping row of amount box, `TransferAccountsRow` (From · swap · To, shared with the
  editor; `compact` = 44px selects and a round 30px swap, otherwise labelled fields and an
  11px-radius swap), add, and the hint line from `transferHint`. `TxEditor` gains a Transfer type rendering `TransferFields`
  (Amount, From/swap/To with the same-account error, Date + Note side by side, helper text) and hides
  category, account, goal and merchant. Its button reads "Save transfer · <amount>" and is
  disabled (surface-2 / text-3, no shadow) while `resolveTransfer` (`data/transferForm.ts`, also
  what `save` uses) returns null: amount ≤ 0, same account, or cross-currency with no received
  amount. Spend/Income keep the always-on button. A saved
  entry cannot cross the transfer boundary (the other segments are disabled). The mobile FAB
  opens the same editor, so it has the Transfer type too.
- **Cross-currency.** When the wallets' currencies differ a "Received" amount appears, prefilled
  by `suggestReceived` (the merged FX rates via `convertMinor`) and tracking the amount until
  the user edits it. It is sent as `to_amount`; within one currency `to_amount` is null.
- **Balances writes transfers too.** The Balances "Transfer money" dialog
  ([balances.md](balances.md#transfer-money-dialog)) calls the same `createTransfer` /
  `deleteTransfer`; there is one write path.

## Balance adjustments

The user types a wallet's **real** balance and the app records the gap as one ledger row of
type `adjustment_in` / `adjustment_out` (wire `ADJUSTMENT_IN` / `ADJUSTMENT_OUT`). The amount
is positive; the sign comes from the type, as for transfer legs. It moves the wallet's derived
balance and nothing else — **never** income, Spent, the donut, the calendar, a budget, a goal
or a report. `category`, `subcategory`, `goalId`, `merchantId`, `plannedId` and `transferId`
are all null; `currency` is the wallet's own; `source` and `note` are allowed. The server
refuses the links (`spending.transaction.adjustment_refs`), another currency
(`…adjustment_currency`) and a PATCH across cash flow ↔ adjustment (`…type_change`).

- **Types** (`api/types.ts`): `AdjustmentType`, `AdjustmentTypeWire`, `isAdjustment`,
  `isCashflow`; both wire maps carry the new members.
- **Ledger**: `signOf` credits `adjustment_in` and debits `adjustment_out`, so Balances and
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
  TxEditor (`openEditTx` ignores anything that is not cash flow): direction ("Added to" /
  "Taken from balance"), amount in the row's currency, date, note, Delete. The wallet is fixed.
- **Creating** happens on Balances — [balances.md](balances.md#adjust-balance-dialog).
- **Export**: the CSV names it "balance adjustment" and signs its amount (`adjustment_out`
  negative); every other row keeps its raw type and unsigned amount.

## Confirmed planned items in Activity

Activity never lists planned rows — only what settled them. `useTransactions` adds the goal
reservations (`allocations`) and `goals` to `SpendingData` (both optional, so the pure tests
need not pass them).

- **Tag pill.** `TxRow.tag` (`txTagOf`): a transaction with a `plannedId` reads "Income"
  (income) or "Obligation" (spend); an unplanned spend with a `goalId` keeps "Goal". Drawn with
  the shared `components/TagPill` before the category in the meta line.
- **Set-asides.** Every live reservation dated in the window becomes a `SetAsideRow` (goal name,
  "Set aside · <wallet or external label>", base-currency amount). A wallet's reservation shows
  when its wallet is in scope; an external one only unscoped. `SetAsideActivityRow` draws it
  like a transfer (dashed neutral chip, grey amount, "not in totals"). They are **never** in a
  day total, Spent, the donut, the calendar or a budget — those read `txns` only — and a day
  holding only set-asides totals `—`. Wallet-held ones do feed the hero's **Saved**. Tapping one opens `/goals` (the route has no goal selector yet).
- **Nudge.** When `usePlanned().dueCount > 0` the Activity tab leads with `PlannedNudge`
  ("● N planned waiting for you to confirm · Review →"), which switches to the Planned tab; the
  tab's label carries the same count as an amber pill.

## Tests

`data/{planning,ledger,selectors}.test.ts` (vitest) cover the window/cadence math, the
opening+txns balance and goal roll-up, and cashflow/budget/recurring numbers, plus transfer
legs in the ledger, transfers excluded from every total, and the activity collapsing/scope
rules, set-aside rows and tags, plus adjustments (credited/debited, in activity, out of every
total). `data/adjustments.test.ts` drives `createAdjustment` / `updateAdjustment` / bulk writes
against fake-indexeddb. `data/countsToward.test.ts` covers the 1e ranking;
`components/TxEditor.countsToward.test.tsx` the match hint, "Don't link", the saving-goal hint
and income streams against fake-indexeddb. `data/transfers.test.ts` drives the transfer mutations and push handlers against
fake-indexeddb (both legs + one entry, coalescing, lone-leg PATCH, id-taken, 404, rebase).

## Written from outside this slice

Transactions arrive from four places besides the editor, each marked by its `source`. Only the
CSV import produces transfer legs and balance adjustments (a file's own transfer and adjustment
rows — [import.md](import.md#transfers-and-balance-adjustments-in-a-file)); its dedupe index files
existing legs and adjustments by direction on their own wallet:
`recurring:<id>:<date>` (an auto-posted schedule, above), `email:<connection_id>` / `webhook:<key_id>` (a
confirmed or auto-confirmed inbound import — [inbound-imports.md](inbound-imports.md)) and
`csv:<batchId>` (a file import —
[import.md](import.md)). The import path calls `bulkAddTransactions` /
`bulkDeleteTransactions` / `bulkAddTransfers` / `bulkDeleteTransfers` here, which deliberately do
**not** `schedulePush()`: the caller
pushes once for the whole batch. A queued bulk delete carries `baseVersion: null` — the endpoint
takes ids and no versions, because a row the user asked to remove has no content left to lose to
a conflict. `TxEditor` also carries a Merchant field
([merchants.md](merchants.md)) and the queue slice's `SourceSection` — the email or payload
an auto-logged entry came from.
