# Planning engine — `src/features/planning/`

The domain logic of the Planning model (bills, goals, income, set-asides): pay periods, the
funding engine, the money actions and the pure view models the Planning, Wallets and Upcoming
screens read. Working docs: `working.local/planning-model/` (02 domain model, 03 set-asides and
balances, 05 settings, 11 decisions). The planner that turns the plan into stored rows stays in
[planned.md](planned.md); the entities live in [bills.md](bills.md), [goals.md](goals.md) and
[set-asides.md](set-asides.md).

Everything under `data/` is pure and clock-free: `today` is an ISO date passed in.

## Pay periods — `data/payPeriods.ts`

- **Main paycheck** (`mainPaycheckOf`): the stream the settings name
  (`mainIncomeStreamId`) while it is active, else the largest by monthly amount in base
  (position, then id, break ties). None while `incomeVaries` or with no active stream.
- **`PayCalendar`** (`payCalendarOf`): `{kind: 'paycheck', stream, perYear}` or
  `{kind: 'month', perYear: 12}` — calendar months on the 1st when there is no main paycheck.
  A paycheck calendar keeps stepping on the stream's cadence after its `endsOn` (only its
  income stops).
- A **period** runs from a payday to the day before the next (`periodOf`, `periodsBetween`);
  a payday opens its own period. `paydaysIn`, `paydayOnOrBefore`, `paydayAfter` search 400
  days either side.
- `perPaycheck(monthly, cal)` spreads a monthly amount over the calendar's paydays
  (× 12 / perYear). `incomeBetween(income, from, to)` is Σ paydays × amount, honouring
  `endsOn`.
- **Safe-to-spend horizon** (`safeHorizonEnd`, inclusive): until payday = the day before the
  next main payday; with no reliable payday (no income, or income varies) today + 30; end of
  month; or today + N days.

## Bill occurrences — `data/occurrences.ts`

- `stepOccurrence(anchor, bill, n)` — month cadences keep the anchor's day, clamped
  (Jan 31 → Feb 28 → Mar 31); day/week cadences step whole days.
- `billOccurrences(bill, through)` — from `nextDue`, stopping at `endsOn`; a closed bill has
  none, a one-off at most its `nextDue`.
- An occurrence is **settled** when its planned PAYMENT row (`paymentRowsOf`) exists and is no
  longer open (paid in full, closed with the rest abandoned, or skipped).
  `firstOpenOccurrence(bill, rows)` is what `nextDue` should read; `openOccurrences` lists the
  rest.

## The funding engine — `data/funding.ts`

`planFunding(input)` → `FundingPlan {calendar, slots, tracks, unlimited, horizonEnd}`. The
planner state derives it once (`planned/data/state.ts`), so the generator, the runner and every
view read the same plan.

- **Slots** = the calendar's paydays from today to `horizonEnd` (13 months, stretched to the
  latest goal date or an undated goal's target run, capped at 10 years). Each slot's
  **capacity** is the income landing in its pay period (`incomeBetween`, base). With
  `incomeVaries` and a floor, every slot holds the floor; with no income at all capacity is
  `Infinity` and `unlimited` is set (the plan funds what it needs — nothing to compare to).
- **Tracks** (`FundingTrack`): one per open bill occurrence (`bill:<id>:<due>`), one per goal
  being planned (`goal:<id>`). Each has a `need` (owner currency) net of what is already set
  aside (and, for a bill occurrence, already paid on its row), a slot **window**
  `[start, end]`, a `tier` and a `deadline`.
  - A bill occurrence's window runs from the slot after the previous occurrence's last slot
    through the last slot on or before its due date; if that is empty it shares the previous
    one (several weekly occurrences covered from one monthly payday). So a bill due within one
    pay period is covered whole on its payday; a longer cycle (or a far one-off) saves up in
    equal installments. With `incomeVaries` the window ends on the slot **before** the due
    month (next month's bills from this month's income). An occurrence due before the first
    slot has **no window** (`end < start`): "not set aside yet", paid from free money.
  - A goal with a target and a date spreads `target − progress` over the slots through its
    date. A goal with a monthly `amount` draws `perPaycheck(amount)` each slot — until its
    target, or its date — `need` is `Infinity` without a target.
  - Bills with `amount` 0, closed bills, settled occurrences, paused / closed / reached goals
    have no track.
- **Priority** (D10, `byPriority`): tier 1 must-pay bills, 2 must-have goals, 3 nice-to-have
  bills and goals; earliest deadline first within a tier (ongoing goals last), then
  `position`, then key. Each slot pays tracks in that order, each at the pace that finishes it
  in its window (`left / slots left`, or its per-paycheck draw), capped by what capacity is
  left. An underfunded track's pace rises in later slots.
- It runs **twice**: `funded` (against capacity) and `required` (unlimited). `shortfall` is
  what the funded run leaves uncovered by a finite track's deadline; `completesAt` the slot it
  is covered in. Amounts are owner currency, unrounded; `roundedSchedule` rounds on the
  running total so a track's rows add up exactly.
- `tracksOf(plan, kind, id)` — one owner's tracks in date order. `rateOf` is the unrounded
  conversion factor the engine uses; `isPlannableGoal`, `isDatedTargetGoal`, `isGoalReached`
  are the shared goal predicates.

## Fill-then-spill — `data/fill.ts`

`occurrenceNeeds(bill, payments, setAsides, index, rates)` — the open occurrences from
`nextDue` (10 years out) and what each still needs (amount − paid on its row − live
set-asides). `spill(needs, amount)` splits money across them in order, each up to its need; an
excess stays with the last one filled (the first, when none needed anything). Used by a
planned bill set-aside's confirm and by Add money.

## Leftover after a payment — `data/leftover.ts`

`leftoverFor({bill, occurrence, payingWalletId, setAsides, payments, rates})` →
`{lines, total, canKeep, nextOccurrence}`: the occurrence's live set-asides **outside** the
paying wallet, one line per wallet / outside label (with the row ids), the total in the bill's
currency, and whether "Keep it for next time" applies (a repeating, open bill) with the
occurrence it would roll to (the next one not settled). Pure — the prompt is the UI's.

## Balance, Set aside, Free to spend — `data/balances.ts`

`balanceFigures({nodes, walletDeltas, setAsides, goals, bills, base, rates})` →
`{wallets, groups, header}`. Per wallet (its own currency): `balance` (opening amount + ledger
delta — the bank's number), `setAside` (Σ its live set-aside lines, `walletSetAsides`),
`free = balance − setAside` (negative = over-committed, `overBy`), its `lines` and the same
three in base (`inBase`). Groups and the header are Σ of their **active** wallets' `inBase`
(archived wallets and anything inside an archived group are left out; their own row still
reads true). Free is derived from the converted Balance and Set aside, so every level adds up
to the minor unit — the 03 §2 invariants, pinned by a property-style test (random trees,
set-asides, payments).

## Safe to spend — `data/safeToSpend.ts`

`safeToSpend({header, planned, index, setAsides, bills, settings, calendar, today, base,
rates})` → `{horizon, end, payday, balance, setAside, free, bills, setAsides, income, safe,
shortBy}` (base). `Safe = header.free − bills − setAsides + income` over H = `safeHorizonEnd`:

- **bills**: open payment rows due by H — what is still open on them less the live
  set-asides of that bill occurrence;
- **setAsides**: open planned set-asides due by H, except a bill's whose occurrence (the
  first open one due from the row's date) also falls by H — its payment is already counted;
- **income**: open income rows due after today, by H.

Deviation from 03 §8's "today…H": overdue payments and set-asides are counted too (until
confirmed, that money is still in Free). Each term lists its rows (`items`) for the
arithmetic. `payday` is set when the window runs until the next main payday. Budgets are never
subtracted (D18).

## Bill and goal status — `data/status.ts`

`billStatusOf(bill, inputs, state, today)` / `billStatuses(...)` → `BillStatus`, about the
bill's **first open occurrence** (bill currency): `state` — first match of
`done` (closed) · `paid` (no open occurrence left: a settled one-off, an ended bill) · `due`
(its date has come, payment not confirmed) · `covered` (set aside + paid ≥ amount) ·
`not_set_aside` (no payday before it is due) · `short` (`shortBy`: the funded plan can't cover
it by then) · `behind` (`behindBy`: planned set-asides for this occurrence — rows dated after
the previous occurrence — came due and were not made) · `saving_up` (with `coveredOn`, the
payday the plan finishes it). Plus `setAside`, `cycle` (`each_paycheck` when one payday covers
an occurrence, else `save_up`), `perPaycheck` / `requiredPerPaycheck` (the next payday's
funded / unlimited set-aside), `heldIn` (per wallet / outside) and `next` (three open
occurrences with what each holds).

`goalStatusOf(goal, …)` / `goalStatuses(...)` → `GoalStatus` (goal currency): `state` —
`done` · `paused` · `reached` · `short` (`shortBy`, `slipsTo` ≈ the payday it would get there at
the pace it was getting) · `behind` (`behindBy`) · `saving_up` (`ongoing` without a target).
Plus `progress` / `setAside` / `used` / `target` / `left`, `perPaycheck`,
`requiredPerPaycheck`, `finish` (the payday the plan reaches the target) and `heldIn`.

## Each paycheck, verdict, Needs a decision — `data/paycheck.ts`

- `eachPaycheck(inputs, state)` → `{payday, income, bills, savingUp, goals, planned, left}`
  (base) for the **next payday**, from the `required` (unlimited) run so a shortfall shows:
  tracks funded whole that payday are `bills`, tracks saving up over several are `savingUp`,
  goals are `goals` (each a `{total, count, items}`). `income` is that slot's capacity (null
  with no income); `left = income − planned` may be negative.
- `verdictOf(inputs, state, paycheck?)` → `start` (`empty`: nothing planned · `no_income`) ·
  `short` (`per: 'paycheck'` when `left < 0`; `per: 'total'` when this paycheck fits but some
  date can't be met — Σ funded shortfalls) · `tight` (left < `TIGHT_SHARE` = 10 % of pay) ·
  `covered`.
- `needsDecision(state)` → per owner, its first track the funded plan leaves short (one that
  had a payday to try — a bill due before the next payday is just paid from free money):
  `shortBy`, `requiredPerPaycheck`, `deadline`, and for a goal `pushOutTo` (+6 months).

## Upcoming, payday review, year ahead

- **`buildUpcoming({inputs, state, nodes, today})`** (`data/upcoming.ts`) → `{due, dueCount,
  periods, isEmpty}`: the Planned tab's row views (`buildPlannedList`) with Needs confirming
  first, then grouped by pay period (`periodsBetween`) — `kind` `this` (today to the day before
  payday) · `next` · `later` — each with `payments` / `setAsides` / `income` rows and
  `incomeIn`, `paymentsOut`, `setAsideOut`, `left` (base; may be negative). A bill payment row
  carries `coverage` (`covered` / `partial` / `not_set_aside` + the amount set aside for its
  occurrence) and `savedUp` (its bill saves up over several paydays — the collapsed summary
  names these). Calendar months without a main paycheck.
- **Payday review** (`data/review.ts`): `paydayReview(inputs, state, payday, {today,
  walletCurrency, waitingOnly?})` → `{payday, period, depositWalletId, groups, total,
  transfers}` — the period's open set-asides as `ReviewLine`s (owner name and colour,
  remainder, wallet, the occurrence a bill line goes toward or a goal's date, `waiting` = in
  the queue), grouped `bills_before_payday` (its occurrence falls within the period) ·
  `saving_up` · `goals`, each in plan priority with a base total. `transfers` = one per wallet
  other than the deposit wallet (Σ its lines, in the deposit wallet's currency);
  `transfersFor(lines, depositWalletId, depositCurrency, rates)` re-totals edited lines
  (`ticked: false` left out). `waitingReviews(...)` lists every payday with lines waiting
  (`review: true`, due), oldest first; `reviewCount` is the badge.
- **`buildYearAhead(inputs, state, today, {months?})`** (`data/yearAhead.ts`) → `{months,
  ramps, goals}`: 12 months from this one, stretched to the latest goal date. Per month
  (`YYYY-MM`): `income` (the streams), `monthlyBills` (occurrences of bills covered from each
  paycheck: total + items), `bigBills` (occurrences of bills saved up for — the markers),
  `goalTargets`, and `setAside` (the funded plan's set-asides on that month's paydays, stacked
  per owner with its colour). `ramps`: each saved-up occurrence's run (`from` its first payday,
  `perPaycheck`, `setAside` now). `goals`: a bar per open goal — `from` its first funded
  payday, `finish` (or `slipsTo`), `target`, `slips`, `paused`, `perPaycheck`.

## Money actions — `actions/`

The anytime actions (02, D23) on top of the planned/set-aside/transaction write paths. Local
first, each a Dexie write plus outbox entries; errors are `MoneyActionError` with a stable
`code` (`not_found`, `closed`, `no_wallet`, `bad_amount`, `category_required`,
`no_next_occurrence`, `signed_out`).

- **`payBill(billId, {occurrence?, amount?, walletId?, date?, note?})`** — Pay now: any open
  occurrence (default the first open one), in full (default) or in part, early or on time. It
  confirms the occurrence's planned payment row — generating it under its deterministic id
  when the occurrence is beyond the planner's horizon — so the payment releases that
  occurrence's set-asides in the paying wallet and `nextDue` moves to the first occurrence
  still open (paying ahead leaves it put). Returns `{transactionId, occurrence, status,
  leftover}` — `leftover` is `leftoverFor` after the payment.
- **`resolveLeftover(report, 'move' | 'free' | 'keep', {payingWalletId, date?})`** — the
  leftover prompt's answers: *move* records a transfer from each holding wallet to the paying
  wallet and releases those set-asides (outside money stays as it is); *free* releases them;
  *keep* moves them to `report.nextOccurrence` (repeating bills only).
- **`addMoney(owner, parts, {date?, note?})`** — Add money / Split: `parts` are
  `{walletId, amount}` or `{externalLabel, amount}` in the owner's currency. A goal gets one
  set-aside per part; a bill's parts fill its open occurrences in order (`fill.spill`, the
  needs shared across parts) — one set-aside per part and occurrence. Each links to the
  owner's oldest planned set-aside still waiting (so it settles the plan instead of sitting
  beside it), and the owner's plan is rewritten **quietly** afterwards: being ahead lowers
  what later paydays set aside. The over-commit guardrail is the UI's (03 §3).
- **`spendFromGoal(goalId, {amount, walletId, categoryId?, date?, note?})`** — Use it: a spend
  with the goal's id under `categoryId ?? goal.useCategoryId` (required the first time, then
  remembered on the goal), releasing the goal's set-asides in the paying wallet.
- **`markGoalSpent(goalId, {walletId, categoryId?, date?, amount?})`** — I spent it (D30): a
  spend of everything still set aside (or `amount`), then `closeGoal` with the leftover freed.
  Not atomic; a failure in between leaves an open goal with a payment, which is harmless.
- **Close / reopen / pause / resume** stay in their slices (`bills/data/actions`,
  `goals/data/actions`). Close drops the open unsettled rows after the close date and pause
  stops the plan (the planner's fill removes future set-asides); reopen and resume file a
  quiet plan rewrite, so the owner is planned again from today.

## Reading it — `hooks/`, `index.ts`

Screens import from `features/planning` (`index.ts`) only. The hooks add no table reads of
their own: they derive from `usePlannedData()` (the planner's one shared read and state, see
[planned.md](planned.md#reading-it-hooks-dataviewsts-datapreviewts)), memoised on it.

- `usePlanning()` → `PlanningView`: `calendar`, `funding`, `bills` / `goals` (statuses by id),
  `paycheck`, `verdict`, `decisions`, `upcoming`, `reviews` (waiting paydays) and
  `reviewCount`.
- `useMoneyFigures()` → `{loading, figures, safe}`: `balanceFigures` over the ledger's running
  totals (`readLedgerSummary` — never the whole ledger) and `safeToSpend` over the planner's
  rows. Safe to spend counts planned rows, so it is only as current as the planner's last run.
- `useYearAhead(months?)` → `buildYearAhead` + `loading`.

Mutations are called directly (`payBill`, `addMoney`, `spendFromGoal`, `markGoalSpent`,
`resolveLeftover`; `confirmPlanned`, `dismissFromReview`, recalc from `features/planned`;
close / reopen / pause / resume from the bills and goals slices).

## Tests

`data/{payPeriods,funding,leftover,balances,safeToSpend,status,paycheck,views}.test.ts`
(leftover + fill; views = Upcoming, review, year ahead; `testing/state.ts` builds a planner
state from rows, `plannedScenario` with the planner's rows written); `hooks/usePlanning.test.tsx`; `actions/actions.test.ts`
(the testing plan's anytime actions); generation and the runner in
`planned/data/{generate,reconcile,runner}.test.ts`; payments in
`planned/data/billPayments.test.ts`.
