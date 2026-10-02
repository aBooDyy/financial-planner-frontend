# Planned transactions — `src/features/planned/`

Scheduled intentions to move money: goal set-asides, bill payments and set-asides, paydays, and
hand-made "plan for later" items. **A planned row never touches balances, budgets, cashflow or
goal progress.** Only what *settles* it does — an ordinary transaction or a set-aside carrying
its `plannedId`.

What the rows say comes from the planning engine ([planning.md](planning.md)): the funding plan
decides every set-aside, the bills' schedules decide their payments. Product rules and the
design live in `working.local/planning-model/` (and the older `working.local/planned-transactions/`
for the snapshot/recalc lifecycle) until folded into the root knowledge base; this file is how
the frontend realizes them.

## The entity

- **Dexie** `plannedTransactions` (`id, goalId, incomeStreamId, billId, categoryId, status,
  date, dirty, deleted`), `LocalPlanned` in `db/types.ts`, outbox entity `'planned'`. Lowercase
  enums inside the app (`origin: goal|income|bill|manual`, `role: payment|set_aside|income`,
  `status: open|done|skipped`), UPPER on the wire, mapped in `api/types.ts`. Wire is
  **snake_case** like every other entity (06 §4's camelCase was wrong; the backend follows the
  API-wide rule).
- `occurrence` is the date the generator assigned and is **part of the row's identity** — it
  never changes. `date` is when it is due now; moving it sets `pinned`.
- `review` (wire `review`, default false) marks a payday set-aside waiting in the review queue;
  sent on create and on every PATCH. Links (`goalId` / `incomeStreamId` / `billId`) go on
  create only. Origin ↔ role: `goal` → set-aside, `income` → income, `bill` → payment or
  set-aside, `manual` → any (a goal's "use it later" payment is a manual payment with `goalId`).
- **Settled is derived, never stored**: Σ linked transactions + linked set-asides that still
  settle it (live, or released by a payment — not freed or moved; `settlesItsRow`), converted to
  the item's currency
  (`data/settle.ts`). `remainder = max(0, amount − settled)`. Status follows settlements through
  two hooks in `data/rows.ts`, called by every settlement write path (transactions
  create/update/delete/bulk-delete, set-asides create/update/delete):
  `closeCovered` (open → done once covered) and `reopenUnderSettled` (done → open once not).
  So saving a transaction with a `plannedId` from the transaction dialog closes the item exactly like
  confirming it does, and deleting it re-opens the item.
- The legacy `recurring:<id>:<date>` source marker is gone: settlement is by `plannedId` only.

## Deterministic ids (`data/ids.ts`)

Generated rows get `uuidv5("<user>:<ORIGIN>:<originId>:<ROLE>:<occurrence>", PLANNED_NAMESPACE)`
— a synchronous SHA-1 (Web Crypto's digest is async only, and the generator is pure). The
origin segment is the wire name (`GOAL`, `INCOME`, `BILL`, `MANUAL`). Two
devices generating the same occurrence produce the same PK. The namespace constant must never
change (it would re-key every row). Tested against CPython's `uuid5` vectors. Manual rows use
random UUIDs.

## Sync (`data/sync.ts`)

- **Delta-pulled** like the ledger (`DeltaEntityName 'planned'`, `/planned-transactions/changes`):
  history is kept, so the collection grows.
- **Push**: creates go out as `POST /planned-transactions/bulk` in runs capped by
  `/config limits.planned_bulk_max` (`BULK_KINDS` in `db/sync.ts` — a run is one entity *and*
  one op). Updates are full-representation PATCHes (every mutable field, always). A bulk item
  answered `INVALID` is flagged and kept, like every refused push
  ([data-layer-and-sync.md](data-layer-and-sync.md#failed-pushes-flag-hold-retry--never-drop)).
- **`409` on a create is benign** (`planned.id_taken`: another device already generated this
  occurrence). The create is dropped and the server row adopted — from the bulk result's
  `planned_transaction`, or from the list for the singular path (the delta will not re-send an
  unchanged row older than our watermark, so a pull alone would not fix it). If the user already
  acted on this copy before its create went out (status not open, pinned, or a note), that intent
  is re-applied as a PATCH on the server's version — last write wins, as everywhere.
- `planned.has_settlements` on a delete puts the server row back.

## Generation (`data/generate.ts`) — pure

`desiredPlanned({userId, income, bills, goals, funding, paydayMode, today})` builds the rows the
origins call for today (`HORIZON_DAYS` = 90):

- **Paydays** within the horizon, from `goals/data/paydays.paydaysOf` (re-exported here),
  stopping after a stream's `endsOn`. Monthly paydays fall on the stream's `day`, clamped
  (31st → Sep 30). Weekly / quarterly / semi / annual step from the stream's `anchorDate` (a
  known payday) so a quarterly bonus lands in its real months; a stream with no anchor steps
  from a fixed epoch. Both are pure functions of the stream, so every device derives the same
  dates and ids. Editing the anchor, frequency or day re-dates the future open unpinned
  unsettled paydays on the next `fill`.
- **Bill payments**: one PAYMENT row per occurrence (`planning/data/occurrences.billOccurrences`)
  from the bill's `nextDue` through the horizon — an overdue one arrives already due — with the
  bill's wallet, category, name and amount. A closed bill has none; `endsOn` ends them.
- **Set-asides** from the funding plan's `funded` schedule, one row per owner per payday (a
  bill's tracks for that payday summed; each track rounded on its running total, so an
  occurrence's rows add up to exactly what it needed). A **dated goal with a target** gets its
  whole schedule (its stored plan); a **bill** gets every payday through its next open
  occurrence's last one (a yearly bill's whole saving-up run), plus the horizon; anything else
  rolls within the horizon. Rows go to the goal's `saveWalletId` / the bill's
  `saveWalletId ?? walletId`. In **Review** payday mode they are generated `review: true`.

## Reconciliation (`data/reconcile.ts`) — pure

`reconcilePlanned(desired, existing, ctx)` → `{create, update, remove}`. Never touches a row
that is done, skipped, pinned, settled (even partly) or due; never touches MANUAL rows. Goals
and bills are both **plan owners** (`data/owners.ts`: `PlanOwner`, keys `goal:<id>` /
`bill:<id>`): their generated set-asides are their stored plan.

- **`fill`** (background): creates what is missing; removes future unsettled rows whose origin
  is gone or no longer produces them (a payday or payment that moved). **It never rewrites a
  stored set-aside**: a dated goal's plan is written whole, once; any other plan (bills,
  rolling goals) only grows past its last set-aside. It does patch a future set-aside's
  `review` flag to the payday mode. Paydays and bill payments have no stored plan, so their
  future rows follow the origin (amount, wallet, name, `categoryId`). Only a bill payment may
  be created already due. An owner no longer being planned (`activeOwners` — the funding
  plan's tracks: a closed or paused goal, a reached one, a closed bill) loses its future set-asides.
- **`recalc`** (one owner): rewrites that owner's future open unpinned unsettled set-asides to
  the live plan — update, create, remove. Payments are left alone.
- A deleted origin takes its future unsettled open rows (pinned or not). History always stays.

## The planner (`data/runner.ts`, `hooks/usePlannedRunner.ts`)

`usePlannedRunner()` is mounted **once, in the root layout** (like `useSync`). It waits until this
device has pulled the planner's inputs (`db/plannerInputs.ts` — `pullAll` records it when goals
and income, bills, set-asides, spending and planned all came home: an in-memory counter in `db/pullState.ts` plus a per-user
`syncState` marker that outlives the tab). A device that pulled them on an earlier launch does
not wait for this launch's pull, so an app opened offline still generates and auto-posts what
came due. Then it runs debounced 500 ms on origin changes (a
stamp of goals / income / bills), each pull, each plan-rewrite request, and day rollover.
`runPlanner` is single-flight through one queue shared with recalc and undo:

1. Goals and bills being planned with no stored plan (`plannedAt === null`, i.e. new) and
   owners whose plan was asked to be rewritten are rewritten in `recalc` mode and get a
   snapshot (`plannedAt/planAmount/planCount/planStart` on the goal or bill — the headline of
   the rows from today; `setGoalPlanSnapshot` / `setBillPlanSnapshot`).
2. Everything else gets `fill`.
3. Open rows whose origin is gone (link null or the goal / stream / bill deleted) are
   resolved, so they never wait in Needs confirming for nothing: **skipped** when unsettled,
   **closed with the rest abandoned** when partly settled (`orphanedPlanned` in `reconcile.ts`).
   A bill payment dated before its bill's `nextDue` (the user moved the bill on past it) is
   resolved the same way. MANUAL rows are left alone unless they are set-asides of a deleted
   goal or bill. (Deleting a goal or bill deletes its set-asides locally, as the server does,
   so its past set-aside rows read as unsettled and are skipped.)

**Plan rewrite requests** (`data/recalcRequests.ts`, a leaf module so the goals and bills
slices never import the planner) are keyed by owner and may be **quiet**.
`goals/data/mutations.updateGoal` files a loud one when currency, amount, target, due date,
must-have or save-in wallet change (`changesPlan`); `bills/data/mutations.updateBill` when
amount, currency, repeat, `nextDue`, `endsOn`, must-pay, paid-from or save-in change
(`changesBillPlan`). Name / colour / position edits leave the plan alone, and so does
`setBillNextDue` (moving `nextDue` on as occurrences settle is bookkeeping). The runner
remembers a loud rewrite's undo in `stores/recalcUndo.ts` (`byOwner`, keyed `goal:<id>` /
`bill:<id>`); quiet ones and first plans offer none.

**Fitting a rewrite (`data/fit.ts`).** A date the engine plans may already be taken by a row
a recalc may not rewrite (confirmed early, skipped, moved, partly settled) — and its
deterministic id means no second row can exist for it. So a rewrite writes
`Σ planned from today − Σ still open on future rows nobody may rewrite` (hand-made set-asides
included) over the dates it *can* write, in proportion to the engine's amounts, the last row
taking the rounding. It works for either owner (`fitPlan` / `fitPlanFrom(owner, …)`). The
runner stores that header as the snapshot, and `useGoalPlan`'s "From today" / off-plan /
"Recalculate to X" read the same fit — so after a recalc stored == live.

**Recalculate + undo** (`recalcPlan(owner)`, `recalcAllPlans(owners)`): the before-image (rows updated or
removed, the ids created, the snapshot) is held in memory; undo restores it through the normal
write paths — a removed row whose delete is still queued has the delete cancelled, otherwise
it is created again under its old id. Not persisted (04 §5).

## Settlement mutations (`data/mutations.ts`)

`confirmPlanned(id, {amount?, walletId?, externalLabel?, date?, categoryId?, note?, settlementId?})`
writes by role: INCOME → income transaction (under the stream's own category); PAYMENT → a
spend carrying the bill (`billId`, the bill's category, merchant and note) or, for a goal's
manual payment, the goal; SET_ASIDE → set-aside(s) for the row's goal or bill (`origin_gone`
when that owner no longer exists) — in a wallet, or outside under a label. Amounts are in the
item's currency and converted to the wallet's. Defaults: the open remainder, the item's wallet,
**today**. Partial keeps it open; overpaying closes it and the excess still counts.
`settlementId` makes it idempotent (the runner's auto-confirms pass a deterministic one); the
result carries `settlementId` and every row written (`settlementIds`).

- **A payment releases set-asides only in the paying wallet** (03 §5,
  `setAsides/data/payment.releaseForPayment`): the bill occurrence's (or the goal's) live
  set-asides in that wallet, oldest first, up to the amount paid — the last one split — in one
  release batch carrying the payment's id. More than they held comes out of free money; other
  wallets are untouched (`planning/data/leftover.leftoverFor` reports them for the prompt).
- **A bill set-aside fills occurrences in order** (`chunksFor` → `planning/data/fill.spill`):
  from the first open occurrence due on or after the row's date, each up to what it still
  needs, the rest spilling into the next — one set-aside per occurrence reached, all linked to
  the row. (A weekly bill's payday set-aside covers several occurrences.)
- **`nextDue`** (`syncBillNextDue`): after a payment, a close-the-rest or a skip it moves to the
  bill's first occurrence whose payment row is still open — paying a later one ahead leaves it
  put; reopening an earlier occurrence moves it back. Bookkeeping (`setBillNextDue`), not a
  plan change.
- **Skip / close the rest of a bill payment** rolls what is still set aside for that occurrence
  to the next open one (a same-bill move), so it never sits on an occurrence that will not be
  paid. A one-off has no next one: closing the bill frees it.

Also `closeRest`, `skipPlanned` (refused with settlements), `reopenPlanned`, `movePlanned`
(pins), `editPlannedAmount` (pins), `deleteManualPlanned`, and `addContribution(goalId, {mode:
'now'|'later', …})` — always a set-aside: "now" settles the goal's oldest due set-aside if there
is one (unless `link: false`), else writes an unlinked set-aside; "later" writes a MANUAL
set-aside row. Errors are `PlannedActionError` with a stable `code`.

**The category of a confirmed entry** (`categoryFor(type, wanted)`): the input's `categoryId`,
else the row's; used only while the catalog still holds it **and** its root is of the entry's
type. Otherwise an income entry goes to the user's **Salary** root (`bySlug('salary')`) when it
exists — a stream's paydays carry no category, and a payday is a salary — and anything else to
the type's `catalog.fallbackFor(type)`: `other` for a payment, `other_income` for income. With no
catalog pulled yet it trusts the wanted id; with neither it throws `category_invalid`. The
wanted id is the input's, else the row's, else the bill's, else the income stream's.

## Reading it (`hooks/`, `data/views.ts`, `data/preview.ts`)

Everything the UI needs is on the public surface, `features/planned/index.ts`:
`usePlanned()` (Planned tab: due / next 14 days / later with row display fields and actions),
`useGoalPlan(goalId)` (stored vs live header, behind/ahead with reason, progress with the
awaiting segment, contributions timeline + `collapseContributions`, `recalc()`, `lastRecalc`
with its undo, `addContribution`), `useConfirmPlanned(id, walletId)` (dialog defaults + `preview(amount, date)` —
the effect line re-derives the plan with the settlement added), `usePlannedMatch(ref, roles,
date)` (the transaction dialog's "Counts toward" banner; `findMatch`: oldest open item of the origin and role
within −45/+15 days), `useRecalcAll()`. QuickAdd's stricter hint (exact open amount, ±3 days,
no origin chosen) is the Spending slice's own `transactions/data/quickAddMatch.ts`, fed by
`usePlannedData` + `remainderOf` — see [transactions.md](transactions.md). They all sit on
`usePlannedData()`, which derives `PlannerState` (`data/state.ts`) — the same derivation the
runner uses, so the screen always shows what the planner would write.

**One shared read.** `usePlannedData` reads through `data/plannerTables.ts`, a module-level
store consumed with `useSyncExternalStore`: the first mounted consumer opens one Dexie
`liveQuery` per table (goals, income, bills, planned, transactions, set-asides, nodes,
settings, rates), the last one to unmount closes them (`openPlannerReads()` reports how many
are open). Per-table queries keep a write to one table from re-reading the others. The
derivation is shared too: `liveInputs` / `derivePlannerState` / the live nodes are memoised at
module level on the table arrays' identity (plus base, rates, user, day), so however many
hooks a page mounts — Spending's tab + transaction dialog
+ confirm dialog + QuickAdd — the tables are read once and the plan derived once. No provider
is needed, so the hooks work unchanged in tests and in any tree. A consumer that mounts while
others are open renders the current snapshot at once (no loading flash).

**Linked transactions only (`data/linkedTransactions.ts`).** The planner's derivation needs only
the transactions that link to something: a `goalId` (goal progress, contributions), a
`billId` (bill payments), or a `plannedId` (settlements). `linkedTransactions()` reads just
those through the `goalId` / `billId` / `plannedId` indexes (IndexedDB keeps no index entry for a null key), de-duplicated and in primary-key
order like a full read, soft-deleted rows included (`liveInputs` drops them). As a `liveQuery` it
still fires when a row is unlinked (the old key is in the observed range). `plannerTables`,
`loadPlannerInputs` and `useGoals` all use it — **never add a full `db.transactions` read to the
planner's inputs**, and never compute a wallet balance from `inputs.txns`. The confirm dialog's
"<wallet> goes to X" line is the one thing that needs a wallet's whole ledger:
`useConfirmPlanned(id, walletId)` reads just that wallet (`where('walletId')`, live, only while the
dialog is mounted) and hands it to `previewConfirm` as `walletTxns`; the line waits until it lands.
The read is tagged with its wallet id: on a wallet switch `useLiveQuery` keeps the previous
result until the new one lands, and that stale ledger must never price the new wallet.

## The Planned tab and the confirm dialog (`components/`)

The Spending page composes these; they read only the public hooks above.

- **Tab.** `TransactionsPage` calls `usePlanned()` once and passes the view down: tabs are
  Activity · Planned · Budgets (routes `/transactions/$view`), the Planned label carries an amber count pill when
  `dueCount > 0`, and Activity leads with `PlannedNudge` in that case.
- **`PlannedCard`** (1c): header, then `PlannedBand` sections — "Needs confirming · N" (amber,
  no caption) with live rows, "Planned · next 14 days" (neutral, `nextCaption`) with
  muted rows, and "Later in <Month>" collapsed behind "N more · Show all". `PlannedEmpty`
  links to `/goals`. `PlannedRow` draws one row: a dashed icon in the origin's colour
  (`hooks/useOriginColors`: goal → bill → stream → its category's root colour, as everywhere else), name + `TagPill`
  (Goal / Bill / Income), meta, amount
  (income in accent, outflow in text colour, never red; muted rows grey with a dashed pill),
  and — due rows only — Skip + Confirm ("Confirm received" for income). A partly settled row
  has no Skip (refused with settlements); its dialog offers "Close the rest".
- **The rail** (`PlannedRail`, the side column; below the list on mobile). With nothing planned it
  is `PlanningGuideCard`: links to the three places planned rows come from (income, bills,
  goals — still the `/goals` sections until Planning replaces them). Otherwise two cards over `hooks/usePlannedOutlook`,
  which takes the list `usePlanned()` already built plus every live account's balance in base
  (`allAccountsMinor` over the Spending scope sections; `null` while balances load). Both look
  `OUTLOOK_DAYS` (30) ahead through `data/outlook.ts` (open rows with a remainder, overdue ones
  included). They cover all accounts and ignore the scope picker, as the list does.
  - **Balance ahead** (`ForecastCard` / `ForecastChart`, pure `data/forecast.ts`, tested). End-of-day
    balance for today + 30 days as payments and income land; set-asides do not move money, and
    overdue items land today. It is drawn as a step line in a stretched 100×100 SVG box (non-scaling
    stroke), clipped into three zones: accent above goal money, warn inside it, danger below zero.
    Dots, the crosshair and the reference lines ("Goal money", and "Zero" only on a shortfall) are
    HTML over it, so they keep their shape. In RTL the SVG mirrors (`rtl:-scale-x-100`) and overlays
    use `inset-inline-start`. The readout rests on the lowest day. Pointer or arrow keys scrub it
    (it is a `role="slider"` with a per-day `aria-valuetext`), and Escape returns to the lowest day.
    Status line: short (first day below zero) beats reserved (first day under goal money) beats
    clear. Goal money is `walletSetAsides` (every live wallet set-aside, bills' included) from the
    planner's own inputs, summed over live
    wallets in base, and held flat: it doesn't step with future set-asides.
  - **Where it's headed** (`HeadedCard`, pure `data/headed.ts`, tested). Planned income against
    payments and set-asides as a `SegmentedBar` (scaled to whichever is larger), a legend with
    values, and the leftover line ("X of what comes in has no plan yet" / "X more planned than
    comes in").
- **One-tap confirm** (`hooks/usePlannedRowActions`): `confirmPlanned(id)` when `row.oneTap`
  (known wallet, nothing settled), else the dialog. A refused one-tap or skip (e.g.
  `origin_gone` for a deleted goal's leftover set-aside) opens the dialog, which shows why and
  still offers Skip.
- **`ConfirmPlannedDialog`** (1d) — `{ plannedId: string | null; onOpenChange }`, open while
  `plannedId` is set. State lives in `hooks/useConfirmForm`
  (seeded once per opening from `useConfirmPlanned().defaults`: remainder, suggested wallet or
  the first wallet, today). Fields: an `AmountWell` ("How much are you confirming?" / "How much
  came in?", "of X planned" under it), From/Into `ConfirmWalletSelect` (+ "External…" with a
  label for set-asides) beside the Paid/Received `DateField` (relative hint); the effect line and the primary label come from the pure
  `data/confirmCopy.ts` (`effectLine`, `primaryLabel`, `plannedForLine` — the small line above the title,
  "Planned for Sep 1 · 23 days ago"). `EffectLine` is a `NoteBox`: full = accent (with a check), partial = warn with a bold
  "Partial:", over / empty = neutral. Secondary: Move date (`MovePlannedPanel` replaces the row:
  "Move to" `DateField`, "A moved date is pinned…", Cancel / Move → `movePlanned`), Skip this one
  (asks first through a light `ConfirmDialog`), Close the rest (partials) as two equal quiet
  buttons under a full-width primary. `PlannedActionError` codes map to copy via
  `messageForCode('planned.<code>')` (`plannedErrorMessage`).
- Amber on the Planned tab (due band, nudge, due rows) is `fp-warn` at 10 % / 25 %
  (`bg-fp-warn/10`, `border-fp-warn/25`) — there is no separate amber-soft token. The confirm
  dialog's partial line instead uses the dialog kit's `warn` (`fp-spend` on `fp-spend-soft`).

## Where the UI reads it

- **Goals**: nothing yet — the goal detail that read `useGoalPlan` / `useRecalcAll` went with the
  old Goals page. Both hooks (and `buildGoalPlanView`, `ConfirmPlannedDialog`) stay on the
  public surface for the Planning page. See [goals.md](goals.md).

## What planned rows never affect

`walletDeltas`, budgets, the cashflow hero, day totals, `goalProgress`, set-aside totals — none of
them read `plannedTransactions`. Pinned by a regression test in `data/mutations.test.ts`. A confirmed
set-aside does reach the Spending hero's **Saved** — never Spent, day totals or
budgets ([transactions.md](transactions.md)).

## Tests

`data/{ids,generate,reconcile,settle,views,mutations,runner,sync,confirmCopy,linkedTransactions,preview}.test.ts`,
`data/{forecast,headed}.test.ts`, `components/{PlannedCard,ConfirmPlannedDialog,ForecastCard}.test.tsx`,
`hooks/usePlannedRunner.test.ts`, `hooks/useConfirmPlanned.test.tsx`, `hooks/usePlannedData.test.tsx` (consumers share one set of
reads and one derivation; the last unmount closes them), `goals/data/paydays.test.ts`, `goals/data/progress.test.ts`. The design's worked example
(04 §4 — Umrah 1,500 × 8 → Sep 24 behind 1,500, live 1,800 × 5, recalc Oct–Feb to 1,800 with
Sep still due, undo exact) is `runner.test.ts`.
