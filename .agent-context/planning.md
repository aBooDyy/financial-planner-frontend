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

## Tests

`data/payPeriods.test.ts`.
