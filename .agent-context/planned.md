# Planned transactions — `src/features/planned/`

Scheduled intentions to move money: goal set-asides, obligation payments, paydays, Spending
schedules, and hand-made "plan for later" items. **A planned row never touches balances,
budgets, cashflow or goal progress.** Only what *settles* it does — an ordinary transaction or a
dated goal reservation carrying its `plannedId`. Product rules and the design live in
`working.local/planned-transactions/` (03 lifecycle, 04 snapshot/recalc, 05 set-asides, 06
contract) until folded into the root knowledge base; this file is how the frontend realizes them.

## The entity

- **Dexie** `plannedTransactions` (`id, goalId, incomeStreamId, recurringId, status, date, dirty,
  deleted`), `LocalPlanned` in `db/types.ts`, outbox entity `'planned'`. Lowercase enums inside
  the app (`origin: goal|income|recurring|manual`, `role: payment|set_aside|income`,
  `status: open|done|skipped`), UPPER on the wire, mapped in `api/types.ts`. Wire is
  **snake_case** like every other entity (06 §4's camelCase was wrong; the backend follows the
  API-wide rule).
- `occurrence` is the date the generator assigned and is **part of the row's identity** — it
  never changes. `date` is when it is due now; moving it sets `pinned`.
- **Settled is derived, never stored**: Σ linked transactions + linked reservations, converted
  to the item's currency (`data/settle.ts`). `remainder = max(0, amount − settled)`. Status
  follows settlements through two hooks in `data/rows.ts`, called by every settlement write
  path (transactions create/update/delete/bulk-delete, allocations create/update/delete):
  `closeCovered` (open → done once covered) and `reopenUnderSettled` (done → open once not).
  So saving a transaction with a `plannedId` from the TxEditor closes the item exactly like
  confirming it does, and deleting it re-opens the item.
- A legacy Spending auto-post (`source = recurring:<id>:<date>`, no `plannedId`) settles the
  matching RECURRING occurrence (`legacyMarkerOf`), so the switch-over never double posts.

## Deterministic ids (`data/ids.ts`)

Generated rows get `uuidv5("<user>:<ORIGIN>:<originId>:<ROLE>:<occurrence>", PLANNED_NAMESPACE)`
— a synchronous SHA-1 (Web Crypto's digest is async only, and the generator is pure). Two
devices generating the same occurrence produce the same PK. The namespace constant must never
change (it would re-key every row). Tested against CPython's `uuid5` vectors. Manual rows use
random UUIDs.

## Sync (`data/sync.ts`)

- **Delta-pulled** like the ledger (`DeltaEntityName 'planned'`, `/planned-transactions/changes`):
  history is kept, so the collection grows.
- **Push**: creates go out as `POST /planned-transactions/bulk` in runs capped by
  `/config limits.planned_bulk_max` (`BULK_KINDS` in `db/sync.ts` — a run is one entity *and*
  one op). Updates are full-representation PATCHes (every mutable field, always).
- **`409` on a create is benign** (`planned.id_taken`: another device already generated this
  occurrence). The create is dropped and the server row adopted — from the bulk result's
  `planned_transaction`, or from the list for the singular path (the delta will not re-send an
  unchanged row older than our watermark, so a pull alone would not fix it). If the user already
  acted on this copy before its create went out (status not open, pinned, or a note), that intent
  is re-applied as a PATCH on the server's version — last write wins, as everywhere.
- `planned.has_settlements` on a delete puts the server row back.

## Generation (`data/generate.ts`) — pure

`desiredPlanned({userId, goals, income, recurrings, plan, base, rates, today, legacyMarkers})`
builds the rows the origins call for today:

- **Goal set-asides** from `planGoals()` (the funding engine, unchanged) via `datedSchedule`:
  month *m* of a goal's schedule falls *m* months after its first set-aside date (the goal's
  `setAsideDay`, default the 1st, on or after today). One-time goals get their **whole**
  schedule — it is the stored plan — and the last row absorbs rounding so the plan sums to
  exactly what is left. Open-ended, sinking and long-cycle bills roll within the 90-day horizon.
- **Obligation payments**: `recurring` goals, one PAYMENT per cycle from `nextDue` within the
  horizon (plus set-asides only when the cycle is longer than a month). A one-time goal with
  `payOnDue` also gets one PAYMENT for its target on its due date — even once saving is done.
- **Paydays** within the horizon, from `goals/data/paydays.paydaysOf` (re-exported here).
  Monthly paydays fall on the stream's `day`, clamped (31st → Sep 30). Weekly / quarterly /
  semi / annual step from the stream's `anchorDate` (a known payday, migration `0025`) so a
  quarterly bonus lands in its real months; a stream with no anchor steps from a fixed epoch
  (weekly: `day` of Jan 2000; longer: the months divisible by the cycle). Both are pure
  functions of the stream, so every device derives the same dates and ids. Editing the
  anchor, frequency or day re-dates the future open unpinned unsettled paydays on the next
  `fill` (old occurrences removed, new ones created — paydays have no stored plan).
- **Spending schedules** (ADR-6): PAYMENT or INCOME by type, iterating `advanceDue` from
  `nextDue` (the old auto-poster's exact dates, so its markers match). Auto-post schedules catch
  up from `nextDue`; hand-confirmed ones surface only the last 31 days.

## Reconciliation (`data/reconcile.ts`) — pure

`reconcilePlanned(desired, existing, ctx)` → `{create, update, remove}`. Never touches a row
that is done, skipped, pinned, settled (even partly) or due; never touches MANUAL rows.

- **`fill`** (background): creates what is missing; removes future unsettled rows whose origin
  is gone or no longer produces them (a payday that moved). **It never rewrites a goal's
  set-asides**: a one-time goal's stored plan stays exactly as saved; rolling plans only grow
  past their last set-aside. Paydays and Spending schedules have no stored plan, so their future
  rows follow the stream / schedule (amount, wallet, name, category).
- **`recalc`** (one goal): rewrites that goal's future open unpinned unsettled rows to the live
  plan — update, create, remove.
- A completed goal loses its future set-asides; a deleted origin its future unsettled open rows
  (pinned or not). History always stays.

## The planner (`data/runner.ts`, `hooks/usePlannedRunner.ts`)

`usePlannedRunner()` is mounted **once, in the root layout** (like `useSync`). It waits for the
first successful pull of the planner's inputs (`db/pullState.ts` — `pullAll` notes it when
goals, spending and planned all came home), then runs debounced 500 ms on origin changes (a
stamp of goals / income / recurrings), each pull, each plan-rewrite request, and day rollover.
`runPlanner` is single-flight through one queue shared with recalc and undo:

1. Goals with no stored plan (`plannedAt === null`, i.e. new) and goals whose plan the user just
   changed are rewritten in `recalc` mode and get a snapshot (`plannedAt/planAmount/planCount/
   planStart` on the goal — the headline of the rows from today).
2. Everything else gets `fill`.
3. Open rows whose origin is gone (link null or the goal / stream / schedule deleted) are
   resolved, so they never wait in Needs confirming for nothing: **skipped** when unsettled,
   **closed with the rest abandoned** when partly settled (`orphanedPlanned` in `reconcile.ts`).
   MANUAL rows are left alone unless they are set-asides of a deleted goal.
4. Open RECURRING rows due today or earlier: fully settled ones (legacy marker) are closed;
   auto-post ones are confirmed with the planned amount and wallet (source marker kept) and the
   schedule's `nextDue` moves past them. This **replaced `transactions/data/autopost.ts`** and
   its Spending-page mount effect.

**Plan-changing edits** (`goals/data/mutations.updateGoal` / `setGoalDate` when target, due
date, amount, frequency, next due, baseline, currency, set-aside day or pay-on-due change) file
a request in `data/recalcRequests.ts` — a leaf module, so the goals slice never imports the
planner. The runner picks it up and remembers the rewrite's undo in `stores/recalcUndo.ts`.
Name / colour / position edits leave the plan alone. A goal's first plan is written silently
(no undo).

**Fitting a rewrite (`data/fit.ts`).** A date the engine plans may already be taken by a row
a recalc may not rewrite (confirmed early, skipped, moved, partly settled) — and its
deterministic id means no second row can exist for it. So a rewrite writes
`Σ planned from today − Σ still open on future rows nobody may rewrite` (hand-made set-asides
included) over the dates it *can* write, in proportion to the engine's amounts, the last row
taking the rounding. The runner stores that header as the snapshot, and `useGoalPlan`'s "From
today" / off-plan / "Recalculate to X" read the same fit — so after a recalc stored == live.

**Recalculate + undo** (`recalcGoalPlan`, `recalcAllPlans`): the before-image (rows updated or
removed, the ids created, the snapshot) is held in memory; undo restores it through the normal
write paths — a removed row whose delete is still queued has the delete cancelled, otherwise
it is created again under its old id. Not persisted (04 §5).

## Settlement mutations (`data/mutations.ts`)

`confirmPlanned(id, {amount?, walletId?, externalLabel?, date?, category?, subcategory?, note?})`
writes by role: INCOME → income transaction; PAYMENT → spend with the goal (the user's own
category — ADR-7; falls back to a category the user's tree has); SET_ASIDE → a dated reservation
(wallet, or an external label). Amounts are in the item's currency and converted to the
wallet's. Defaults: the open remainder, the item's wallet, **today**. Partial keeps it open;
overpaying closes it and the excess still counts. Also `closeRest`, `skipPlanned` (refused
with settlements), `reopenPlanned`, `movePlanned` (pins), `editPlannedAmount` (pins),
`deleteManualPlanned`, and `addContribution(goalId, {mode: 'now'|'later', …})` — "now" settles
the goal's oldest due item if there is one, "later" writes a MANUAL row. Errors are
`PlannedActionError` with a stable `code`.

## Reading it (`hooks/`, `data/views.ts`, `data/preview.ts`)

Everything the UI needs is on the public surface, `features/planned/index.ts`:
`usePlanned()` (Planned tab: due / next 14 days / later with row display fields and actions),
`useGoalPlan(goalId)` (stored vs live header, behind/ahead with reason, progress with the
awaiting segment, contributions timeline + `collapseContributions`, `recalc()`, `lastRecalc`
with its undo, `addContribution`), `useConfirmPlanned(id)` (dialog defaults + `preview()` —
the effect line re-derives the plan with the settlement added), `usePlannedMatch(ref, roles,
date)` (TxEditor "Counts toward" hint; `findMatch`: oldest open item of the origin and role
within −45/+15 days), `useRecalcAll()`. QuickAdd's stricter hint (exact open amount, ±3 days,
no origin chosen) is the Spending slice's own `transactions/data/quickAddMatch.ts`, fed by
`usePlannedData` + `remainderOf` — see [transactions.md](transactions.md). They all sit on
`usePlannedData()`, which derives `PlannerState` (`data/state.ts`) — the same derivation the
runner uses, so the screen always shows what the planner would write.

**One shared read.** `usePlannedData` reads through `data/plannerTables.ts`, a module-level
store consumed with `useSyncExternalStore`: the first mounted consumer opens one Dexie
`liveQuery` per table (goals, income, recurrings, planned, transactions, allocations, nodes,
settings, rates), the last one to unmount closes them (`openPlannerReads()` reports how many
are open). Per-table queries keep a write to one table from re-reading the others. The
derivation is shared too: `liveInputs` / `derivePlannerState` / the live nodes are memoised at
module level on the table arrays' identity (plus base, rates, user, day), so however many
hooks a page mounts — the Goals page's detail + Recalculate-all card, Spending's tab + TxEditor
+ confirm dialog + QuickAdd — the tables are read once and the plan derived once. No provider
is needed, so the hooks work unchanged in tests and in any tree. A consumer that mounts while
others are open renders the current snapshot at once (no loading flash).

## The Planned tab and the confirm dialog (`components/`)

The Spending page composes these; they read only the public hooks above.

- **Tab.** `TransactionsPage` calls `usePlanned()` once and passes the view down: tabs are
  Activity · Planned · Budgets · Recurring (routes `/transactions/$view`), the Planned label carries an amber count pill when
  `dueCount > 0`, and Activity leads with `PlannedNudge` in that case.
- **`PlannedCard`** (1c): header, then `PlannedBand` sections — "Needs confirming · N" (amber,
  no caption) with live rows, "Planned · next 14 days" (neutral, `nextCaption`) with
  muted rows, and "Later in <Month>" collapsed behind "N more · Show all". `PlannedEmpty`
  links to `/goals`. `PlannedRow` draws one row: a dashed icon in the origin's colour
  (`hooks/useOriginColors`: goal → stream → category colour), name + `TagPill`, meta, amount
  (income in accent, outflow in text colour, never red; muted rows grey with a dashed pill),
  and — due rows only — Skip + Confirm ("Confirm received" for income). A partly settled row
  has no Skip (refused with settlements); its dialog offers "Close the rest".
  `PlannedSummaryCard` is the desktop rail: next-14-days in / out / net.
- **One-tap confirm** (`hooks/usePlannedRowActions`): `confirmPlanned(id)` when `row.oneTap`
  (known wallet, nothing settled), else the dialog. A refused one-tap or skip (e.g.
  `origin_gone` for a deleted goal's leftover set-aside) opens the dialog, which shows why and
  still offers Skip.
- **`ConfirmPlannedDialog`** (1d) — `{ plannedId: string | null; onOpenChange }`, open while
  `plannedId` is set; also imported by the Goals slice. State lives in `hooks/useConfirmForm`
  (seeded once per opening from `useConfirmPlanned().defaults`: remainder, suggested wallet or
  the first wallet, today). Fields: amount with "of X", From/Into wallet (+ "External…" with a
  label for set-asides), date; the effect line and the primary label come from the pure
  `data/confirmCopy.ts` (`effectLine`, `primaryLabel`, `plannedForLine` — the small line above the title,
  "Planned for Sep 1 · 23 days ago"). Tones: full = accent-soft, partial = amber-soft, over /
  empty = neutral. Secondary: Move date (inline `DateField` → `movePlanned`), Skip this one,
  Close the rest (partials) as two equal outlined buttons under a full-width primary. `PlannedActionError` codes map to copy via
  `messageForCode('planned.<code>')` (`plannedErrorMessage`).
- Amber is `fp-warn` at 10 % / 25 % (`bg-fp-warn/10`, `border-fp-warn/25`) — there is no
  separate amber-soft token.

## Where the UI reads it

- **Goals** (`features/goals/components/detail/`): the goal read view renders `useGoalPlan` through
  the pure `goals/data/goalDetail.ts`; Recalculate / Undo / Confirm <Mon> / + Add contribution
  live there, and it opens `ConfirmPlannedDialog` for a due or future row. Summary's
  `RecalcAllCard` uses `useRecalcAll`. List rows count due items straight off the table
  (`dueCountByGoal`) instead of mounting another `usePlannedData`. See [goals.md](goals.md).

## What planned rows never affect

`walletDeltas`, budgets, the cashflow hero, day totals, `goalProgress`, reservations — none of
them read `plannedTransactions`. Pinned by a regression test in `data/mutations.test.ts`. A confirmed
set-aside (a reservation) does reach the Spending hero's **Saved** — never Spent, day totals or
budgets ([transactions.md](transactions.md)).

## Tests

`data/{ids,generate,reconcile,settle,views,mutations,runner,sync,confirmCopy}.test.ts`,
`components/{PlannedCard,ConfirmPlannedDialog}.test.tsx`,
`hooks/usePlannedRunner.test.ts`, `hooks/usePlannedData.test.tsx` (consumers share one set of
reads and one derivation; the last unmount closes them), `goals/data/paydays.test.ts`, `goals/data/progress.test.ts`. The design's worked example
(04 §4 — Umrah 1,500 × 8 → Sep 24 behind 1,500, live 1,800 × 5, recalc Oct–Feb to 1,800 with
Sep still due, undo exact) is `runner.test.ts`.
