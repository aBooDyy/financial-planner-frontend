# Goals — the monthly planning feature

The third feature (after [balances.md](balances.md)), recreated from the Means `GoalsApp`
design (light/dark, RTL-aware). The user records **income streams** and a ranked list of
**goals/obligations** (four kinds); the page computes how much to set aside each month and
whether the plan is feasible. Domain terms: root
[domain-glossary.md](../../.agent-context/domain-glossary.md).

## Local DB & sync (extends [data-layer-and-sync.md](data-layer-and-sync.md))

- **Dexie** gained two tables in schema **v2** (`src/db/db.ts`): `incomeStreams`, `goals`
  (both `dirty`/`deleted` flagged, client-generated UUID PKs, **string** sha256 `version`).
  Added to `clearLocalDb()`.
- The shared **outbox** carries two new `entity` discriminators, `'income'` and `'goal'`.
  `src/db/sync.ts` dispatches them to `src/features/goals/data/sync.ts`
  (`pushGoalsEntry` / `pullGoalsAll`), which mirror the balances handlers (LWW, 409
  rebase-retry, 404 drop). `pullAll` and the push drain loop call into it.
- **Optimistic mutations** (`src/features/goals/data/mutations.ts`): `createIncome`/
  `updateIncome`/`deleteIncome`, `createGoal`/`updateGoal`/`deleteGoal`, plus `setGoalDate`
  (inline date edit) and `swapGoalPositions(id, neighborId)` (priority swap — writes both
  neighbors' `position`; the list passes the *visible* neighbor's id so a reorder never targets a
  hidden completed goal).
  Coalesced outbox entries; delete of a never-synced row just drops its queued ops.

## The funding engine (the brains)

- `src/features/goals/data/planning.ts` — pure, `today`-parameterized date math (parse/format
  ISO dates, `setAsidesLeft`, `relUntil`, `nextPayday`, `nextDueDefault`) **plus the time-phased
  funding simulation `simulatePlan`** (see below).
- **Time-phased funding (`simulatePlan`).** The plan is **not** a flat "remaining ÷ months,
  fund top-down by `position`" snapshot anymore. `selectors.ts` translates each active goal into
  a `PlanTrack` (base-minor `remaining`, whole-month `deadline`, recurring refill data, or a
  steady monthly draw for `openended`) and `simulatePlan(tracks, incomeMonthly, horizon)` walks
  **forward month by month**: each month it spends income on goals in **earliest-deadline-first
  order, `position` breaking ties**, each at the smooth pace needed to finish by its own
  deadline. A goal starved this month is **deferred**; next month its horizon is shorter so its
  pace rises and it climbs the queue — so **near obligations are funded first and later ones ramp
  up as the near ones complete** (this is the user-requested behavior). Per goal it returns
  `now` (set aside _this month_), `peak` (the pace it ramps to), `startsIn`, `completesIn`,
  `meetsDeadline`, `fundedNow`. Horizon = past the furthest deadline, clamped to [12, 600].
- **What `buildGoalsView` derives from it.** `monthlyStr` headlines the **rate the goal runs
  at** — this month's set-aside, or, when it's queued (nothing set aside yet), the rate it ramps
  to (`plan.peak`) so the figure is **never a bare SR 0**; `monthlySubStr` qualifies it ("from
  Aug 2026"). The sum of this-month set-asides (`now`) **never exceeds income**, so the hero
  always balances and `leftover ≥ 0` — feasibility risk shows up as **goals that slip their
  deadline**, not a negative "left over". Status: **green** "On track" (funded at pace now &
  meets deadline), **amber** "Scheduled" (meets deadline but deferred/catching up), **red**
  "Won't make it" (dated goal misses its deadline even with optimal phasing; `openended` →
  "Unfunded"). The cashflow bar, verdict (`Some goals will slip` vs `Tight` vs `On track`, with
  an approximate monthly shortfall), and completion **timeline** all read from the simulation.
  The funded bar (`fundedPct`) shows **progress toward the objective** (saved ÷ target, or
  current cycle), not this-month allocation.
- **Per-goal monthly timeline (`scheduleMonths`/`coverageStr`).** `simulatePlan` keeps **every**
  active goal's month-by-month set-aside path (`TrackPlan.schedule`) and every month it's covered
  (`TrackPlan.completions` — one entry for a finishing goal, **one per cycle** for a recurring
  obligation). The schedule's end (finalize pass in `planning.ts`) is kind-aware: a finishing goal
  (one-time / open-ended-with-target) stops at its completion; **recurring/sinking obligations and
  target-less open-ended funds never end, so they run to the global `coverEnd`** = the latest
  finishing goal's coverage (≥ a 12-month forecast). That's the fix to "recurring obligations
  vanish after their first due": they repeat across the whole horizon, stay visible, and keep
  weighing on other goals' numbers up to the last goal's date (the simulation already kept them
  competing every cycle via refill; this aligns the *display*). `buildGoalsView` turns the path
  into one `ScheduleMonth` per month (`label`, `amountStr`, `muted` for waiting months, `covered`
  at each completion), a one-line `scheduleSummary` (`scheduleSummaryOf`), and a `coverageStr`
  caption (`coverageLabel`). `GoalCard` renders an **expandable vertical timeline** (shared
  `Collapsible`, one node/month, scrollable) **for every card and any status**.
- **Monthly plan (`view.monthlyPlan` / `MonthlyPlanCard`).** The cross-goal aggregate: for every
  month across the plan horizon (max of the goals' `plan.schedule` lengths), a `PlanMonth` with the
  month's `total` and `shares` — each goal's set-aside that month (base minor, sorted desc, with a
  `pct` for the stacked-bar width; `muted` when nothing is set aside). `MonthlyPlanCard` (main
  column, below the goals list) renders it with a **List/Calendar view switch** (`ToggleGroup`):
  the list shows per-month goal amounts; the calendar shows a year-grouped grid of month cells
  (mini stacked bar + total, per-goal amounts in the cell `title`). A shared goal-color legend sits
  above both. Month 0's total equals the hero's `setAsideStr`.
- **Payments timeline (`view.timeline` / `TimelineCard`).** No longer just final completions: it's
  a forward **coverage forecast** — every point a goal or obligation is covered, in chronological
  order, up to `coverEnd` (the latest goal's date). A finishing goal contributes one milestone; a
  recurring obligation contributes **one per cycle** (its repeating due dates), so the rail reads
  as a real month-by-month payments schedule — **except monthly/weekly obligations
  (`track.cycleMonths <= 1`), which are left off so they don't flood it** (their per-card plan
  still shows them in full). `buildTimeline` derives it from `plan.completions` (slipping goals
  fall back to a stalled/deadline marker). Money is minor units throughout.
  Unit-tested in `selectors.test.ts` (deferral's SR 0→SR 300 per-month timeline with its covered
  marker; an annual obligation whose plan spans past its first cycle and shows **twice** on the
  timeline alongside the latest goal).
- **"On track" vs "Completed" — two distinct meanings.** The green status (`statusLabel`
  "On track") means _the goal is funded to meet its deadline (now or via the ramp)_ — a
  cashflow-plan verdict, **not** that the target is saved. A goal that has actually met its
  target (`(target ?? 0) > 0 && saved >= target`, contributions/allocations folded in) is
  **completed**: `buildGoalsView` partitions it out of the active plan into `view.completedGoals`
  (so it draws no income) — but it is **still rendered inline** at the bottom of `GoalsListCard`
  as a dimmed `CompletedGoalRow` (no ▲▼, keeps edit/delete) so a finished goal never looks
  deleted. Recurring/sinking have no `target` and never complete. `totalCount`/`horizonStr` count
  active goals only; `savedGoalsPct` still spans all goals.
- Kinds & frequencies are lowercase in the domain, mapped to the backend's UPPER_SNAKE wire in
  `api/types.ts` (`toWireKind`/`toWireFreq` etc.); `constants.ts` holds `FREQUENCIES`, `KINDS`,
  `GOAL_COLORS`, and fixed `STATUS_COLORS`.

## Sourced allocations (the "Set aside from…" sources)

A goal's saved progress is the sum of **allocations** — sourced reserves — folded in alongside
goal-linked transaction contributions (the legacy scalar `saved` stays as a zeroable baseline).
Each allocation reserves money from a **wallet** (earmarked in place — the wallet keeps the
money but shows it as reserved) or names an **external** source (a gift, someone's help) by
free-text label.

- **Dexie v6** adds `goalAllocations` (`id, goalId, walletId, dirty, deleted`); `OutboxEntity`
  gains `'allocation'`. The entity rides the **goals** sync handlers (`data/sync.ts`:
  `pushAllocationCreate/Update/Delete`, `rebaseAllocation`, `pullAllocations`, wired into
  `pushGoalsEntry` + `pullGoalsAll`; `db/sync.ts` routes `'allocation'` to `pushGoalsEntry`).
  Wire types/mappers in `api/types.ts` + `data/mappers.ts`; client `api/allocationsApi.ts`;
  mutations `createAllocation`/`updateAllocation`/`deleteAllocation` in `data/mutations.ts`.
- **`data/reservations.ts`** — the cross-feature derivation (sibling of `transactions/data/
ledger.ts`): `allocationsByGoal(allocations, goals, rates)` (goal-currency totals fed to
  `buildGoalsView`'s trailing `allocations` arg) and `walletReservations(allocations, goals,
nodes, rates)` → per-wallet reserve lines (wallet currency) consumed by the Balances view.
- **Editor**: `useGoalEditor(base, nodes, allAllocations)` carries an `allocations` row list in
  its draft and, on save, **diffs** rows against stored allocations to create/update/delete them
  (goal id resolved after create). `GoalEditor` renders the rows (amount + wallet/External picker
  via balances `walletGroupOptions`; label field for external) in place of the old scalar
  "Already set aside" input. `useGoals` now also returns `nodes` + `allocations` for the editor.

## UI & wiring

- Feature in `src/features/goals/` (`api/`, `data/`, `hooks/`, `components/`, `constants.ts`).
  `useGoals` is the reactive read (`useLiveQuery` → `buildGoalsView`); `useGoalEditor` drives
  the add/edit sheet for both income and goals (kind chips only when creating, since `kind` is
  immutable on update).
- Components are dumb; `GoalsPage` composes them: `PlanHeroCard` (income − set-aside = leftover
  - cashflow bar), `IncomeCard`/`IncomeRow`, `GoalsListCard`/`GoalCard` (priority ▲▼, status
    pill, funded bar, inline date) with completed goals rendered inline below as read-only
    `CompletedGoalRow`s, and the rail `VerdictCard` + `TimelineCard`. Editor reuses the
    modal/sheet pattern.
- Route `/goals` (guarded like `/balances`). Base currency is the shared `balanceSettings`
  (reuses `setBaseCurrency`). Shared chrome (`src/components/chrome/`) renders with
  `active="goals"`.
