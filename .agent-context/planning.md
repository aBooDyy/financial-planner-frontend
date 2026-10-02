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

## Tests

`data/{payPeriods,funding,leftover}.test.ts` (leftover + fill); generation and the runner in
`planned/data/{generate,reconcile,runner}.test.ts`; payments in
`planned/data/billPayments.test.ts`.
