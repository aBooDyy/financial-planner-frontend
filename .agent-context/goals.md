# Goals — the monthly planning feature

The third feature (after [wallets.md](wallets.md)), recreated from the Means `GoalsApp`
design (light/dark, RTL-aware). The user records **income streams** and a ranked list of
**goals/obligations** (four kinds); the page computes how much to set aside each month and
whether the plan is feasible. Domain terms: root
[domain-glossary.md](../../.agent-context/domain-glossary.md).

## Local DB & sync (extends [data-layer-and-sync.md](data-layer-and-sync.md))

- **Dexie** declares two tables for this slice (`src/db/db.ts`): `incomeStreams`, `goals`
  (both `dirty`/`deleted` flagged, client-generated UUID PKs, **string** sha256 `version`).
  Added to `clearLocalDb()`.
- The shared **outbox** carries two new `entity` discriminators, `'income'` and `'goal'`.
  `src/db/sync.ts` dispatches them to `src/features/goals/data/sync.ts`
  (`pushGoalsEntry` / `pullGoalsAll`), which mirror the balances handlers (LWW, 409
  rebase-retry, 404 drop). `pullAll` and the push drain loop call into it.
- Income streams carry an optional deposit `walletId` (where a planned payday confirms into)
  and an optional `anchorDate` (a known payday, below), both always sent on PATCH.
- **Paydays** (`data/paydays.ts`, pure): `paydaysOf(stream, from, to)` and
  `nextPaydayOf(stream, today)` — the one source of payday dates for the income rows ("Paid
  the 27th · next …" / "Next payday …"), the Upcoming card and the planner's generated paydays.
  Monthly pays on `day` (clamped: 31st → Sep 30) and ignores any anchor. With an `anchorDate`,
  weekly steps 7 days and quarterly / semi / annual step whole months from it in both
  directions, each stepped month keeping the anchor's day (clamped, no drift). Without one
  (streams saved before `0025`, or by an older client), weekly steps from `day` of Jan 2000 and
  the longer cadences fall in the calendar months divisible by their length (Jan/Apr/Jul/Oct) —
  both deterministic across devices.
- **Optimistic mutations** (`src/features/goals/data/mutations.ts`): `createIncome`/
  `updateIncome`/`deleteIncome`, `createGoal`/`updateGoal`/`deleteGoal`, plus `setGoalDate`
  (inline date edit) and `swapGoalPositions(id, neighborId)` (priority swap — writes both
  neighbors' `position`; the list passes the _visible_ neighbor's id so a reorder never targets a
  hidden completed goal).
  Coalesced outbox entries; delete of a never-synced row just drops its queued ops.

## The funding engine (the brains)

- `src/features/goals/data/planning.ts` — pure, `today`-parameterized date math (parse/format
  ISO dates, `setAsidesLeft`, `relUntil`, `nextDueDefault`) **plus the time-phased
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
  an approximate monthly shortfall; an empty plan reads `Start your plan` and goals with no
  income read `No income yet` — never `Tight`), and completion **timeline** all read from the simulation.
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
  competing every cycle via refill; this aligns the _display_). `buildGoalsView` turns the path
  into one `ScheduleMonth` per month (`label`, `amountStr`, `muted` for waiting months, `covered`
  at each completion), a one-line `scheduleSummary` (`scheduleSummaryOf`), and a `coverageStr`
  caption (`coverageLabel`). `GoalSchedule` renders it as an **expandable vertical timeline**
  (shared `Collapsible`, one node/month, scrollable) inside the detail panel of any active goal.
- **Monthly plan (`view.monthlyPlan` / `MonthlyPlanCard`).** The cross-goal aggregate: for every
  month across the plan horizon (max of the goals' `plan.schedule` lengths), a `PlanMonth` with the
  month's `total` and `shares` — each goal's set-aside that month (base minor, sorted desc, with a
  `pct` for the stacked-bar width; `muted` when nothing is set aside). `MonthlyPlanCard` (Timeline
  section, below the payments timeline) renders it with a **List/Calendar view switch** (`ToggleGroup`):
  the list shows per-month goal amounts; the calendar shows a year-grouped grid of month cells
  (mini stacked bar + total, per-goal amounts in the cell `title`). A shared goal-color legend sits
  above both. Month 0's total equals `view.setAsideStr`.
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
  (so it draws no income) — but it is **still listed** in a "Completed" group at the bottom of
  the Goals section as a dimmed `CompletedGoalRow` (selectable for edit/delete, no priority
  controls) so a finished goal never looks deleted. Recurring/sinking have no `target` and
  never complete. `totalCount`/`horizonStr` count active goals only; `savedGoalsPct` still
  spans all goals.
- Kinds & frequencies are lowercase in the domain, mapped to the backend's UPPER_SNAKE wire in
  `api/types.ts` (`toWireKind`/`toWireFreq` etc.); `constants.ts` holds `FREQUENCIES`, `KINDS`,
  `GOAL_COLORS`, and fixed `STATUS_COLORS`.
- **Custom frequencies (goals only).** A goal's `frequency` is an `ObligationFrequency` — a
  preset `GoalFrequency` or `'custom'` with `customInterval` (1–365) + `customUnit`
  (`day | week | month`); income and Spending schedules stay on the presets. **Every goal-side
  cadence read goes through `data/cadence.ts`**: `frequencyMetaOf(goal)` returns the preset's
  `FreqMeta` or one built by `customFrequencyMeta` ("Every 28 days", `/28d`, `perYear`
  365/28), each carrying a `cadence` (`{unit, every}`); `stepDue(anchor, cadence, n)` steps
  dues from the anchor (months keep its day, no drift) and `approxCyclesBetween` seeds the
  search. Progress cycles, the upcoming list, planned goal payments and the plan all use it —
  never index `FREQUENCIES` with a goal's frequency. The planner stays month-granular:
  `cycleMonthsOf(meta)` = whole months per cycle (≥ 1), and a bill due more than monthly
  (weekly, every 10 days…) refills `amount × perYear / 12` per month so its true yearly cost
  counts. Rows stored before the fields existed lack them — mappers and `changesPlan` read
  missing as null.
- **Editor.** `FrequencyChips` takes an optional `custom` prop (goals pass it) adding a
  "Custom" chip; the draft keeps the preset in `frequency` plus `customRepeat` /
  `customInterval` (string) / `customUnit`, so income code never sees `'custom'`.
  `CustomIntervalField` reads "Every [28] [days ▾]" with an "About 13 times a year" hint;
  `goalSaveBlocker` holds the save (the footer hint) while the interval is out of range.
  Set-asides show only when `cycleMonthsOf(draftFrequencyMeta(draft)) > 1`.

## Progress: set-asides vs payments (`data/progress.ts`)

A goal is raised two ways: **set-asides** (allocations — the money stays in its wallet, marked
for the goal) and **payments** (goal-linked `spend` transactions — the money leaves). Paying for
the goal **consumes** what was set aside for it, so they never add up (ADR-3, 05 §3):
`progress = max(reserved, spent)`, `stillReserved = max(0, reserved − spent)`. `goalProgress(goals,
allocations, txns, rates, today, planned)` returns both per goal, plus `stillReserved` per wallet
(a payment releases its own wallet's reservation first, then the others' largest first) and held
externally. **Recurring obligations apply it per cycle**: a reservation funds the first due date
strictly after it, a payment pays the first due on or after it (or its planned row's occurrence
when linked, so a late payment still pays the cycle it was due in); progress is the current
cycle's. `useGoals` passes `progressByGoal(...)` to `buildGoalsView` as the settled progress
beyond the stored `saved` baseline. **This replaced `saved + allocations + contributions`**,
which double-counted "saved then paid" and let a rent goal's saved grow forever;
`buildGoalsView`'s trailing `allocations` argument is gone.

## The live plan, dated (`planGoals`, `datedSchedule`)

`planGoals(income, goals, base, rates, today, progress)` in `selectors.ts` is the engine run
`buildGoalsView` itself uses (entries of goal + track + plan + status, completed goals,
monthly income) — exported so the planner (`features/planned/`) reads the same plan.
`datedSchedule(schedule, today, day)` in `planning.ts` puts a schedule on the calendar: month
*m* falls *m* months after the first `setAsideDay` (1–28, default 1) on or after today. The
algorithm is unchanged.

## The stored plan

Goals carry the stored plan's header — `plannedAt`, `planAmount`, `planCount`, `planStart` —
plus two planning knobs, `setAsideDay` and `payOnDue` (one-time obligations: also plan the final
payment). The planner writes the header (`setGoalPlanSnapshot`); a goal created or pulled
without one gets its first plan silently. `updateGoal` / `setGoalDate` compare before/after
(`changesPlan`: currency, amount, target, saved, frequency, next due, due date, set-aside day,
pay-on-due) and on a change file a rewrite request (`planned/data/recalcRequests`) — the plan
follows the edit, with an undo. The rows themselves are planned transactions: see
[planned.md](planned.md). All these fields are sent on every goal PATCH (full representation).

## Sourced allocations (the "Set aside from…" sources)

A goal's saved progress comes from **allocations** — sourced reserves — and goal-linked
payments, by the rule above (the legacy scalar `saved` stays as a zeroable baseline). Each
allocation is **dated** (`date`, defaulting to today) and may settle a planned set-aside
(`plannedId`); both are always sent on PATCH.
Each allocation reserves money from a **wallet** (earmarked in place — the wallet keeps the
money but shows it as reserved) or names an **external** source (a gift, someone's help) by
free-text label.

- **Dexie** declares `goalAllocations` (`id, goalId, walletId, dirty, deleted`); `OutboxEntity`
  carries `'allocation'`. The entity rides the **goals** sync handlers (`data/sync.ts`:
  `pushAllocationCreate/Update/Delete`, `rebaseAllocation`, `pullAllocations`, wired into
  `pushGoalsEntry` + `pullGoalsAll`; `db/sync.ts` routes `'allocation'` to `pushGoalsEntry`).
  Wire types/mappers in `api/types.ts` + `data/mappers.ts`; client `api/allocationsApi.ts`;
  mutations `createAllocation`/`updateAllocation`/`deleteAllocation` in `data/mutations.ts`.
- **`data/reservations.ts`** — the cross-feature derivation (sibling of `transactions/data/
ledger.ts`): `walletReservations(allocations, goals, nodes, rates, txns?, today?, planned?)` →
  per-wallet pot lines (one per goal, wallet currency) of what is **still** reserved after goal
  payments consumed their share — the Wallets view's reserved/available. Without the ledger
  every reservation counts. `allocationsByGoal` (raw totals) and `reservedByWallet` (raw, for
  the editor's over-reserve warning) remain.
- **No allocation editor anymore.** The goal editor's "Set aside (optional)" rows (and their
  over-reserve warning) were replaced by the goal detail's **contributions list** (below): a
  reservation is now added with "+ Add contribution" or by confirming a planned set-aside, and
  taken back from its row ("Take it back" → `deleteAllocation`, which re-opens a planned item it
  settled). `reservedByWallet` stays exported but has no UI caller.

## UI & wiring

- Feature in `src/features/goals/` (`api/`, `data/`, `hooks/`, `components/`, `constants.ts`).
  `useGoals` is the reactive read (`useLiveQuery` → `buildGoalsView`); `useGoalEditor` drives
  the add/edit sheet for both income and goals (kind chips only when creating, since `kind` is
  immutable on update).
- **Page shell — the "Goals v3" design (tab card + sections + detail rail).** The active section
  (`summary | goals | obligations | income | timeline`) is the URL — `/goals/$section`, see
  [routing.md](routing.md#goals-and-spending-tabs) — and `GoalsPage` owns the selection. The tabs
  are `<Link>`s. Desktop: `SectionTabCard`, a tab strip carried **in a card at the top of the content
  column** (48px tabs, accent underline on the active one, count pills for goals/obligations) —
  it replaced the v2 212px side rail, so the content column is the only column. Mobile:
  `SectionTabs`, a strip under the top bar — deliberately **not** a replacement for the app-wide
  `MobileTabBar`, so cross-app nav survives on mobile (the design mock had the section tabs take
  over the bottom bar). Both carry an amber dot on a section holding anything not on track.
  Switching section closes the editor (the tabs' `onNavigate`).
- **Summary** (`SummarySection`) answers three questions in order: does the month balance, what
  gets funded first, what actually moves next. `SummaryVerdictCard` (verdict title/sub, primary
  action, "See timeline"), `MonthlyLedgerCard` ("Every month": Income / Obligations / Goals bars
  plus a "Left over" closing line, all measured against **one denominator** —
  `max(income, set-aside)` — so the widths compare, with `summary.usageStr` in the corner),
  `PriorityCard` ("Funded in priority order": `summary.priority`, ranked by `position`, each row
  opening its goal), `DecisionsCard` ("Needs a decision": **only red/slipping goals**) and
  `UpcomingCard` (`summary.upcoming`: paydays + due dates in the next 60 days, repeating ones
  expanded per occurrence, max 6). The primary action is "Fix the gap" (opens the first
  decision) when anything slips, else "Review goals". v2's `UsageRing`/`SummaryStatGrid` and the
  `cashSegments`/`summary.stats` that fed them are gone — the ledger card carries that reading
  now. Every ledger bar lives in a `flex-1 min-w-0` **track** so its percentage resolves against
  the track and never the whole row: without it the label column pushed a 100% bar straight past
  the card edge. A bar narrower than 26% puts its amount **after** the bar rather than inside it,
  and a zero row drops the bar for plain muted text (the design's flat 2% minimum width turned a
  first-run account into three colour stubs).
  The design's dashed "income runs out at #N" cutoff in the priority list is **not** drawn:
  it assumes a strict top-down cutoff, and time-phased funding defers by deadline instead, so
  the header note is an on-track count.
- **Goals / Obligations** (`GoalListSection`): goals vs obligations split by kind
  (`recurring`/`sinking` are obligations — `GoalCard.isObligation`). `view.goalsList` /
  `view.obligationsList` arrive **pre-grouped by status** as `GoalGroupCard`s — "On track",
  "Scheduled" (on time, funded later), "Won't make it" (note = approx. monthly shortfall);
  empty groups are omitted. The design's two groups ("Funded"/"Short") assumed the old flat
  top-down engine; with time-phased funding a queued goal isn't short, hence three. Rows
  (`GoalRow` on the shared `ListRow`: colour spine, name, `rowMeta` caption tinted when not
  green, saved-progress bar ≥900px, monthly rate) carry **no buttons** — selecting opens the item.
- **Detail panel** (`DetailPanel`): desktop a 330px rail laid **over** the page's end edge
  (never docked — opening it must not narrow or reflow the content column); mobile the
  `ResponsiveDialog` bottom sheet. `GoalsPage` wraps it in `DetailPanelOverlay`, which owns the
  placement and the slide-in and stays mounted across read view ↔ editor and goal-to-goal
  swaps, so only opening the panel animates. Esc closes it
  on desktop — unless a Radix layer opened from it (a dialog, a select) already handled that
  Escape (`defaultPrevented`). Selecting a goal opens its **read view** (`GoalDetailPanel`,
  below); **Edit** swaps in `GoalEditor`, whose close returns to the read view; saving a goal
  (new or edited) lands on its read view. Income rows open the editor directly.
  `useGoalDetail` holds which goal is open and drops that goal's recalc undo when the panel
  closes or moves to another goal (04 §5).
- **Goal editor** (`GoalEditor` + `useGoalEditor(base)`): the pane shell (title follows the kind
  live — "New obligation", "New fund"; `DialogActions` footer; delete through `DeleteGoalConfirm`,
  the shared P3 `ConfirmDialog`; every way out through `useDiscardGuard`, dirty =
  `isEditorDirty` against the `initial` draft kept in `EditorState`) over two bodies in the
  dialog language: `GoalFields` (kind `OptionTiles` with descriptions only when creating,
  `EditorAmount` = the shared `AmountWell` + a pill-styled `CurrencyPicker`, `FrequencyChips`,
  `DueDateField` "By when?"/"Next due date" with its relative hint, a "Pay on the due date"
  `ToggleCard` (one-time → `payOnDue`), `SetAsideDayField` (day 1–28 set-asides fall on; blank =
  the 1st; hidden for monthly/weekly bills, which have no set-asides), `PriorityControl`
  ("Applies right away" — a move saves at once, outside the draft), `GoalSchedule`,
  `ColourField`) and `IncomeFields`. Income streams get
  `DepositWalletField` ("Deposits into" → `walletId`) and `IncomePaydayField`: monthly asks for
  the day of the month ("Paid on [27] of each month", `DayOfMonthField`); any other cadence asks
  for the **Next payday** (a date, defaulting to
  the stream's next computed payday). `incomeScheduleOf` (in `useGoalEditor`) saves monthly as
  `day` + `anchorDate: null`, and anything else as `anchorDate` = the picked date (else the
  stored anchor, else the shown default) with `day` = its day of the month. `save()` resolves with the goal id.
  Inline date edit on cards is gone — the date lives in the panel.
- **Goal read view (1a)** — `components/detail/`. `GoalDetailPanel` (container: `useGoalPlan`,
  dialog state) renders `GoalProgress` (percent; two-segment bar in the goal's colour: solid =
  settled, striped = due and still open; "SR 4,000 saved · SR 1,500 awaiting confirm" / "SR
  9,000 left"), `PlanBox` (two `PlanCellView` tiles: "Saved plan · Jun 12" vs "From today" — today's
  always accent-tinted — or "Previous plan" vs the new one, ringed right after a rewrite) then
  `PlanBand` as its own tinted box
  (behind: "Recalculate to X" + "Confirm <Mon>" → `ConfirmPlannedDialog` for the oldest due
  item; updated: "Plan updated … · Undo"; ahead; the quiet "Plan is X/mo off … · Recalculate"
  line), and `ContributionsList` (`ContributionRow` + `ContributionMark`: solid goal colour =
  confirmed, hollow amber = needs confirming, hollow grey = planned; equal future runs
  collapsed; shown **latest first** (the view model stays oldest-first), older confirmed rows
  beyond the latest 5 behind "Show N earlier" at the bottom beside `ContributionLegend`; tap a planned row
  → confirm dialog, tap a set-aside → "Take it back"). All strings come from the pure
  `data/goalDetail.ts` (`buildGoalDetail`, tested on the design's worked example). A bill
  (`recurring`) reads by its current cycle: "Obligation · SR 3,500 due Oct 1", "paid this cycle",
  its payment as the plan headline ("paid when due"). The add / confirm dialogs render **inside**
  the panel's children so on mobile they nest in its sheet.
- **Add contribution (1b)** — `AddContributionDialog` (+ `ContributionFields`,
  `useContributionForm`): Paid now | Plan for later (`PillSwitch`), "How much?" `AmountWell` in
  the goal's currency (code after the figure), the hint as an accent `NoteBox`, a full-width
  primary and no Cancel, From (wallets; "External…" for a saving goal paid now; "Decide later" for a later
  one), date (now: today; later: the next planned date, else a month out). Hint + CTA from the
  pure `data/contribution.ts`; when a due item exists, paid-now says it settles it. Calls
  `useGoalPlan().addContribution`. Remounted per opening (a `key`) so it starts clean.
- **Summary → `RecalcAllCard`** (container over `useRecalcAll`): shown while any goal is off its
  saved plan; "Recalculate all", then "N plans updated · Undo" (undoes each result).
- **List rows** carry a small amber "N to confirm" pill (`useGoals().dueByGoal`, from
  `dueCountByGoal`: open planned rows of that goal dated today or earlier).
- **`/goals?goal=<id>`** (validated on the `/goals` layout route, carried through the index
  redirect) opens that goal's read view once, navigating (replace) to the goal's own section
  and dropping the param. Wallets pots link here.
- **Income** (`IncomeSection`/`IncomeRow`) and **Timeline** (`TimelineSection` = `TimelineCard` +
  `MonthlyPlanCard`) reuse the same section header and row patterns.
- Route `/goals` (guarded like `/wallets`). Base currency is the shared `balanceSettings`
  (reuses `setBaseCurrency`). Shared chrome (`src/components/chrome/`) renders with
  `active="goals"`.
