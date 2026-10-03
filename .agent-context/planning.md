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
  (`mainIncomeStreamId`) while it is active, else the largest by monthly amount in base. None
  while `incomeVaries` or with no active stream. Streams within 10 % of the largest
  (`NEAR_TIE`) are a near tie settled **without exchange rates**, so a rate move cannot flip the
  pay periods: by native monthly amount when they share a currency, else by position (then id).
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
- **The schedule's anchor** is `nextDue`, except for a month cadence whose `nextDue` sits on a
  day a short month clamped it to: then it is the latest earlier payment-row occurrence that
  steps onto `nextDue` exactly (Jan 31 for Feb 28), so March comes back to the 31st. Only
  `nextDue` is stored, so every occurrence helper takes the bill's payment rows
  (`paymentRowsOf`). A `nextDue` moved by hand to another day starts a new anchor; one moved to
  a day the old one also clamps to (Apr 30 after the 31st) keeps the old day.
- `billOccurrences(bill, payments, through)` — from `nextDue`, stopping at `endsOn`; a closed
  bill has none, a one-off at most its `nextDue`. `occurrenceBefore(bill, payments, o)` is the
  one before (status's Behind window).
- An occurrence is **settled** when its planned PAYMENT row (`paymentRowsOf`) exists and is no
  longer open (paid in full, closed with the rest abandoned, or skipped).
  `firstOpenOccurrence(bill, rows)` is what `nextDue` should read; `openOccurrences` lists the
  rest. `occurrenceFrom(bill, date, rows)` is the occurrence money set aside on `date` goes
  toward (the first open one due from then); `paymentRowsByBill(planned)` indexes every bill's
  payment rows in one pass for selectors that look up many.

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
  left. An underfunded track's pace rises in later slots. **Feasibility floor**
  (`laterRoom`): a must-pay bill or a dated must-have goal takes at least `left − what the
  slots after this one could still give it` — its need placed as late as its window allows,
  higher priority first — so pay that is about to stop (an income with an end, a bonus month)
  goes to it before a nice-to-have takes its even share. The unlimited run has no floor.
- It runs **twice**: `funded` (against capacity) and `required` (unlimited). `shortfall` is
  what the funded run leaves uncovered by a finite track's deadline; `completesAt` the slot it
  is covered in. Amounts are owner currency, unrounded; `roundedSchedule` rounds on the
  running total so a track's rows add up exactly.
- `tracksOf(plan, kind, id)` — one owner's tracks in date order. `rateOf` is the unrounded
  conversion factor the engine uses; `isPlannableGoal`, `isDatedTargetGoal`, `isGoalReached`
  are the shared goal predicates.

## Stranded set-asides — `data/rekey.ts`

A bill's set-aside covers one occurrence by its exact date, so a moved due date, a new repeat or
end, or a skipped occurrence would strand it: held forever while the new occurrence is set aside
for again (and Safe to spend subtracts both). `strandedSetAsides(bill, payments, setAsides)`
lists each live set-aside whose occurrence is not one of the bill's open occurrences, with the
open occurrence **nearest its old date**. Money on an occurrence that was **paid** (`done`
payment row) stays — that leftover is the prompt's call; a closed bill's are released already.
The runner moves them (`moveSetAsides`, same bill, dated today) **before** it derives the plan,
so every exact-date matcher (fill, funding, status, Safe to spend, payment release, leftover)
sees them on the right occurrence.

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
confirmed, that money is still in Free). A closed bill's or a closed or paused goal's rows are
not counted (`funding.isStoppedOwner`; the input carries `goals` for it). Each term lists its rows (`items`) for the
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
  `incomeIn`, `paymentsOut`, `setAsideOut`, `left` (base; may be negative). `left` counts like
  Safe to spend: income less each payment's part nothing is set aside for yet, less the
  set-asides for what falls due **after** the period (one paying a bill inside it is that bill,
  counted once) — so it is not `incomeIn − paymentsOut − setAsideOut`. A bill payment row
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
  (`ticked: false` left out). A closed bill's or a closed or paused goal's set-asides are left
  out. `waitingReviews(...)` lists every payday with lines waiting
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
`no_next_occurrence`, `bad_occurrence`, `signed_out`).

- **`payBill(billId, {occurrence?, amount?, walletId?, date?, note?})`** — Pay now: any open
  occurrence (default the first open one), in full (default) or in part, early or on time. An
  `occurrence` must be on the bill's schedule (`billOccurrences` from `nextDue` through it, so
  within `endsOn`), else `bad_occurrence` — nothing is written. It
  confirms the occurrence's planned payment row — generating it under its deterministic id
  when the occurrence is beyond the planner's horizon — so the payment releases that
  occurrence's set-asides in the paying wallet and `nextDue` moves to the first occurrence
  still open (paying ahead leaves it put). Returns `{transactionId, occurrence, status,
  leftover}` — `leftover` is the leftover report after the payment, **only once the payment
  settles the occurrence** (a part payment returns no lines: the money elsewhere still waits for
  the rest of the bill). It is `leftoverFor` plus, as one more line, what the **paying wallet**
  itself still holds for the occurrence (a settled occurrence would otherwise hold it for good
  when an earlier part came from another wallet). A payment that settles the occurrence also
  files a **quiet** plan rewrite for the bill (the engine's `replanSettledOccurrence`, the one
  place that rule lives), so an early payment doesn't leave the stored plan asking for that
  occurrence's set-asides; `settleBillPayment` (the dialog / QuickAdd path) does the same.
- **`billPaymentTarget(billId, plannedId)` + `settleBillPayment(billId, occurrence, payment)`**
  — the same path for a payment written elsewhere (the transaction dialog, QuickAdd —
  `transactions/data/billPayments.ts`): the first picks the open row to settle (the matched one,
  else the first open occurrence's, generated if missing); after the transaction is written with
  that `plannedId`, the second releases in the paying wallet, syncs `nextDue` and returns the
  leftover report. The dialog's amount stays in the wallet's currency (no round trip through the
  bill's).
- **`resolveLeftover(report, 'move' | 'free' | 'keep', {payingWalletId, date?})`** — the
  leftover prompt's answers: *move* records a transfer from each holding wallet to the paying
  wallet and releases those set-asides (the paying wallet's own line is released without a
  transfer; outside money stays as it is); *free* releases them;
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
- **`markGoalSpent(goalId, {parts | walletId + amount?, categoryId?, date?})`** — I spent
  it (D30): one `spendFromGoal` per paying wallet (`parts` `{walletId, amount}` in the goal's
  currency; one `walletId` without `amount` spends **what that wallet holds** for the goal),
  then `closeGoal` with the rest freed (other wallets, money held outside). Never one spend of
  everything from one wallet: that wallet's Balance would stop matching its bank. Returns the
  spends' ids. Not atomic; a failure in between leaves an open goal with payments, harmless.
- **Close / reopen / pause / resume** stay in their slices (`bills/data/actions`,
  `goals/data/actions`). Close drops the open unsettled rows after the close date, and the
  planner's orphan pass resolves the rest; pause skips the goal's set-asides already due
  (`rows.skipDueSetAsides`) and stops the plan (the planner's fill removes future ones); reopen
  and resume file a quiet plan rewrite, so the owner is planned again from today.

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

## The Planning page — `components/`

The screen over the engine (04, design `working.local/planning-model/design/`): `/planning/$section`
([routing.md](routing.md#planning-and-spending-tabs)). The design decides layout and visuals; the
docs decide words and behaviour (D27–D31): Covered / Saving up / Behind / Short, **Must pay** /
Nice to have for bills, **Must have** / Nice to have for goals, "Left for spending", goals in the
`fp-goal` pink.

- **Shell** — `PlanningPage`: `TopNav` (`active="planning"`), the mobile `PlanningSectionStrip`
  (five icon tabs) or the desktop `PlanningTabCard`, `PlanningHeader` (title + **Plan
  something**), the section, the detail panel and `PlanningSheets` (the toast is app-wide). Badges:
  Upcoming counts Needs confirming (warn), Overview counts Needs a decision (danger).
- **Page state** — `stores/planningUi.ts`: the open detail (`PlanOwner`) and **one** sheet
  (`PlanningSheet`, a union by `kind`: chooser, the three editors, the anytime-action sheets,
  delete, review, confirm). Rows deep in a section open sheets through the store instead of
  threaded callbacks; `PlanningSheets` renders the one open. A sheet that leads to another
  (Pay now → leftover, editor → delete) replaces itself.
- **Toasts** — `stores/toast.ts` (`toast(message, action?)`), drawn by `PlanningToastView`:
  bottom-centre dark pill, 3.6 s, optional action. Every write confirms with one. The view is
  mounted app-wide by the root layout (`shell/AppToastHost`), so Wallets and Settings use the
  same `toast()` and a toast raised just before leaving a page still shows.
- **Kit** — `components/kit/`: `PlanCard`/`CardHeader`, `MicroLabel`, `StatusChip` (ok, warn,
  danger, blue, goal, neutral), `Spine`/`Dot`, `ProgressBar`, `ItemMenu` (the ⋯ menu, destructive
  last), `CountBadge`, `InfoLine` (the blue "what this will do" line).
- **Copy and maths for the screens** live in `view/` (pure, tested): `format.ts` (rounded money,
  "Oct 18" / "Jun 2027", "a paycheck" vs "a month" by the pay calendar), `repeat.ts` (the docs'
  repeat names: Just once · Weekly · Monthly · Quarterly · Semi-annual · Annual · Custom),
  `colors.ts` (the item palette), `emergencyFund.ts`, and one `*Draft.ts` per editor.

### Plan something and the editors

- `PlanChooser`: A bill · A goal · Income, "Regular spending like groceries? Set a budget →"
  (Spending › Budgets), and — while there is no open goal — **Start an emergency fund**:
  a must-have goal targeting 3 × the monthly must-pay bills (`emergencyFundPreset`; no target
  before there are bills). Section headers' **+ Add bill / goal / income** skip it.
- Editors (and every sheet) mount their body only once the planner's inputs and the category
  catalog have loaded (`usePlanningReady`), so the first state holds the real defaults; each has a `use*Editor` hook
  (form, block reason, preview, save) and a pure `view/*Draft.ts` (form ↔ entity, `*Block`,
  `*Preview`). Saving shows the hint above the buttons until ready (`DialogActions`), and a
  dirty close asks first (`useDiscardGuard`).
- **Bill** (`BillEditor`): What is it? · How much? (`AmountWell`, the currency follows the
  "Paid from" wallet pill, which also offers *Decide when paying*) · Repeats · *When is it due?* /
  *Next due date* · Category (`CategoryPicker`, default Housing) · the preview line · More
  options: Ends (Never / On a date), Auto-pay ("Log it automatically on the due date"), Must pay ↔
  Nice to have, Save up in (bills not covered by each paycheck), Merchant (the shared
  `MerchantOptions` in a popover), Note, Colour. Preview (`billPreview`): *Covered from each
  paycheck.* when it repeats at least as often as pay; *We'll set aside SR X a paycheck so it's
  ready on Mar 1.* (amount ÷ the paydays from today through the due date — the engine's first
  window); *Due before your next paycheck. It comes out of what is free now.* when no payday comes
  first.
- **Goal** (`GoalEditor`): What are you saving for? · How much do you need? (optional) · By when?
  (optional, with **No date**) · How much each month? (only without a date) · Save in · How
  important? (Must have ↔ Nice to have, inline as in the design) · the preview · More options:
  Colour. Valid with a name and either a date + target or a monthly amount (`goalBlock`); a new
  goal's currency is its Save-in wallet's, an existing goal keeps its own. Preview
  (`goalPreview`): *Set aside SR X a paycheck to have SR T by Jun 2027.* ((target − saved) ÷
  the paydays to the date), *Set aside SR X a month. Done around Aug 2027.*, *…with no end
  date.*, or what is missing. The emergency fund suggestion opens it pre-filled
  (`GoalPreset`).
- **Income** (`IncomeEditor`, not in the design — built in its language from 02 Income): What is
  it? · How much comes in? (+ "Paid into" pill) · How often? (no Just once) · *Paid on [25] of
  each month* (monthly) or *Next payday* (any other cadence: the anchor every payday steps
  from) · the preview (*SR 12,000 monthly · next payday Oct 25.* — the picked payday when it is
  still ahead) · the main paycheck: a **Sets my pay periods** tag on it, else (while one exists)
  a **Use for my pay periods** switch that saves `mainIncomeStreamId` · More options: Category
  (default **Salary**, required on create), Log it automatically when it arrives, Ends, Note,
  Colour.

### Overview — `components/overview/`

Copy and shapes in `view/overview.ts`; the cards only draw them.

- `VerdictCard` (`verdictCopy`): **Start your plan** (empty: nothing else renders; *Plan
  something* → chooser), **Add your income to see if you're covered** (`start/no_income`; *Add
  income*), **You're covered** / **Tight** (*See what's coming* → Upcoming), **Short by SR X a
  paycheck** / **Short by SR X** (danger tint; the first decision's bill or goal named; **Fix
  the gap** opens its editor).
- `PaycheckCard` (`paycheckBar`): the stacked bar — Bills (grey), Saving up for bills
  (`fp-chart-set-aside`), Goals (`fp-goal`), Left for spending (accent) — segments are buttons
  to their section, values inline above 11 %. When the plan outruns pay the bar scales to the
  plan, a danger line marks *Your pay · SR X* (positioned by `inset-inline-end`, so it mirrors)
  and a hatch covers the overflow. Legend rows under it (Left for spending in danger when
  negative). Under the legend, inside the card, `LastMonthLine`: *Last month: Needs 48% ·
  Wants 31% · Savings 21% ›* from `useLastMonthNeedsWants` (the reports slice; calendar month,
  all accounts), opening `/reports?range=last_month`; nothing while last month has no split.
- `Next30Card` (`next30Events`): bill payments and paydays in the next 30 days from Upcoming's
  periods; a warn pill "N to confirm" with the names; desktop a 152px axis (dots in the bill's
  colour, paydays ringed in accent, labels alternating above/below on stems and hidden when
  within 15 % of the last on their side, ticks Today / +7 / … logical-positioned); mobile a dot
  strip and a list. A bill's dot opens its detail, a payday the Income section.
- `DecisionsCard` (`decisionNote`): goals get **Push out** (to `pushOutTo`, +6 months, with a
  toast) and **Adjust**; bills **Adjust**.

### Upcoming — `components/upcoming/`

`UpcomingSection`: a header with **Review** (accent count = `reviewCount`; opens the payday
review for the oldest waiting payday, else the next one), then the view.

- **By paycheck** (`ByPaycheckList`, copy in `view/upcoming.ts`): the warn **Needs confirming**
  band (`upcoming.due`; *Was due Oct 1 · Main bank*, **Skip** / **Confirm** through
  `usePlannedRowActions` — one tap when the row knows its wallet, else the confirm dialog as the
  `confirmPlanned` sheet), then one `PeriodCard` per pay period: *Until payday* · *Now → Oct
  24* · *N days left* (footer *Still to pay before payday*: payments less what their occurrence
  holds), *Next paycheck · Oct 25* · *Oct 25 – Nov 24* · *+SR 12,000 in* with sub-heads
  Paycheck / Bills due / Set aside for later (footer *Left for spending*, danger when
  negative), and *Later* cards folded to "Bills SR X · Set aside SR Y · Left SR Z · Car service
  Jan 15". Calendar months read *This month* / *Next month*.
- Rows (`UpcomingRowItem`) show the **owner's** name (a planned set-aside row's own name has a
  " set-aside" suffix), a Bill / Goal / Income tag and Auto-pay. Every future bill payment
  (not auto-pay) offers **Pay now** for that occurrence; every set-aside **Set aside now**
  (confirms the planned row early). State line: *Set aside ✓* (covered, within 40 days),
  *Overdue*, *Due in N days* (≤ 10), else the date. A row opens its bill's or goal's detail
  (income: the confirm dialog).

- **Year ahead** (the header's *By paycheck · Year ahead* switch; `YearAheadView` over
  `useYearAhead`, placement in `view/yearView.ts`): desktop **lanes** (`YearLanes`, design default)
  — a horizontally scrolling grid, a sticky label column, the current month's column tinted for
  the full height (a guide cell under the rows, `-z-1` in an `isolate` grid), month heads that
  open a popover of
  everything in the month (`monthLines`; one controlled open month, its head tinted while open); lanes Income (the brief's lane the mock lacked) ·
  Monthly bills (a total per month) · one lane per bill saved up for (a blue ramp from its first
  payday to the month before it is due, filled by what is set aside; a gem marker on the due
  month) · one bar per goal to its finish (its colour at 15 %, *"SR 940 a paycheck"*, *"… ·
  ongoing"*, *"… · done Dec 2028"*, amber *"… · slips to Aug 2027"*, dimmed *Paused*) with an
  outlined target cell · *Total set aside* per month with a stacked bar (its label opens the
  review). Rows are placed on explicit grid rows so a target cell can sit over its bar; columns
  follow the document direction. Mobile: **month cards** (`YearMonthCards`, D22).
- **Rail** (`UpcomingRail`, stacked below on mobile): **Balance ahead** (`view/ahead.ts#balanceAhead`,
  `BalanceAheadCard`) — active wallets' Balance and Free to spend for 30 days from
  `useMoneyFigures().figures.header`: income adds, payments subtract and **release their own
  occurrence's set-aside** (`coverage.setAside`, F8 — the old forecast compared to a fixed
  reserve and cried "Dips into goal money" on a bill that was saved for), planned set-asides
  earmark more. Overdue rows land today. Dashed lines on paydays, a hover/drag readout, and a
  note: *"Free to spend is lowest on Oct 20 at SR X, just before pay arrives."* / *"…goes below
  zero on …"*. The SVG is `dir="ltr"` (time runs left to right in both directions).
  **Where it's headed** (`HeadedCard`) — the next paycheck's Bills / Saving up for bills / Goals as
  bars (share of pay) and *Left for spending*, from the same `paycheckBar` as Overview.

### Payday review — `components/review/PaydayReviewSheet.tsx`

The one-sheet variant (design default, 03 §4, D31): `paydayReview` for the requested payday
(the oldest waiting one from **Review**, else the next payday), groups **Bills due before next
payday** · **Saving up for bills** · **Goals** (each with its base total). Each line: tick, name
+ "Due Nov 1" / "By Jun 2027" / "Goal" (no date), a wallet select, an amount field (its own
currency). Per destination other than the deposit wallet a ticked-by-default **"I've moved SR X
to Savings"** card (`transfersFor` over the ticked, edited lines). The over-commit guardrail
reads free money after those transfers and turns the button into **Set aside anyway**.
**Set aside SR X** → `actions/confirmReview.ts#confirmReview`: one transfer per ticked
destination (`createTransfer`), then `confirmPlanned` per ticked line at its amount and wallet;
**Not now** → `postponeReview` (`dismissFromReview` on the waiting lines: they stay in Needs
confirming). Unticked lines are left alone. The Automatic-mode notice
(`usePaydayNoticeStore`, carrying its `base` currency) becomes a toast with a **Review**
action that opens this sheet and goes to Planning › Upcoming (`usePaydayNoticeToast`). It
shows on **every** page: `AppToastHost` (the hook + `PlanningToastView`) is mounted once by
the root layout, not by `PlanningPage`.

### Bills, Goals, Income — `components/lists/`

- **Bills** / **Goals**: a `SectionHeading` ("Bills 8", a summary line, **+ Add bill / goal**),
  then one `TierCard` per non-empty tier — bills **Must pay** / Nice to have, goals **Must have**
  / Nice to have (D27) — each noting its per-paycheck total, then the collapsed `DoneCard`
  (bills **Done**: closed, plus one-offs with nothing left to pay — those have no Reopen; goals
  **Reached**: closed). An `ItemRow` is grip · spine · name (+ a progress bar: set-aside blue
  for a bill saved up for, the goal's own colour for a goal with a target) · meta · figure +
  chip · ⋯ (`useItemActions`). Chips and meta come from `view/itemCopy.ts` (`billChip` /
  `billMeta`, `goalChip` / `goalMeta`): a bill covered from each paycheck reads *Due Nov 1* /
  *Due in 3 days*, one saved up for *Saving up 800 / 2,400*; *Covered ✓*, *Behind by SR 200*,
  *Short SR X*, *Due · confirm*. A goal's figure is its per-paycheck pace ("—" while paused).
- **Reorder**: `useTierDrag` over `view/reorder.ts` — HTML drag and drop (dropping on a row of
  the other tier moves the item into that tier: `mustPay` / `mustHave` flips) and ↑ / ↓ on the
  grip button for keyboards. Both tiers are renumbered from 0 and only moved rows are written
  (`updateBill` / `updateGoal` with `position`, which `updateGoal` now accepts). Phones have
  no drag (the grip is hidden below `md`), so there `useTierDrag().moveActions` adds **Move up ·
  Move down · Move to {other tier}** to each row's ⋯ menu (`useIsDesktop` decides); the other
  tier is entered at its nearest edge (top of Nice to have, bottom of Must pay / Must have).
- **Income**: one card, every stream (ended ones dimmed) — label + **Sets my pay periods** on
  the main paycheck, "Monthly · 25th · into Main bank", the amount with its cadence's short
  suffix, ⋯ **Edit · Use for my pay periods · Delete**; a row opens its editor. Header:
  monthly income and where pay periods run from, then a quiet **Planning settings** link
  (`SectionHeading`'s `subLink`) to `/settings/preferences#planning`; a footnote explains the
  main paycheck.
- Empty states are dashed cards (`EmptyPlanCard`) with the docs' copy; Goals adds the
  **Emergency fund** pill. They show whenever nothing is **active** (finished items don't count),
  with the Done / Reached card still under them.

### Detail panels — `components/detail/`

`DetailHost` renders the open `PlanOwner` (a row's click) in `DetailFrame`: a 400px panel
floating over the page's end edge on desktop (no reflow, Esc closes, the design's width rather
than the kit's 330), a bottom sheet on mobile. A section tab's click closes it (not the section
change itself, so Overview can switch to Bills and open a bill in one go). Header: colour dot,
name, "Semi-annual · Insurance · Must pay" / "Must have goal · by Jun 2027", the ⋯ menu.

- `DetailHero`: *Set aside so far* (a bill saved up for, blue bar) / *Next payment* (covered
  each paycheck) / *Saved so far* (goal, its own colour), a note and the chip.
- `DetailActions`: bill **Pay now** · Add money · Edit; goal **Add money** · Use it · Edit;
  closed **Reopen** · Edit (Mark as done / End this bill / Pause live in the ⋯ menu).
- `HeldIn` (`BillStatus.heldIn` / `GoalStatus.heldIn`), `PlanBox` (`view/planText.ts`: one
  sentence per shape, *SR X behind / ahead of plan*, and — when `useBillPlan` / `useGoalPlan`
  says the stored plan is off — *"Your plan says SR 500 a paycheck; today it works out to SR
  1,000."* + **Recalculate**, then *Plan updated · Undo* from the recalc-undo store),
  `NextOccurrences` (repeating bills), `HistoryList` (`view/history.ts`: Set aside / Moved in /
  Freed / Paid / Used / Skipped, latest first, 15 shown).

### Anytime-action sheets — `components/sheets/`

Every action is on each row's ⋯ menu and in the detail panel (`hooks/useItemActions`: bill
**Edit · Add money · Pay now · End this bill** / **Mark as paid** (one-off) **· Delete**; goal
**Edit · Add money · Use it · Mark as done · Pause / Resume · Delete**; a closed one **Reopen ·
Delete**). Reopen / Pause / Resume act at once with a toast; the rest open a sheet.

- **Add money** (`AddMoneySheet`, 03 §3): the amount on the blue tint ("It stays in the wallet.
  We just label it."), *Set aside in* wallet cards with each one's free money
  (`useMoneyFigures`) plus **Held outside your wallets** (+ where), **Split across wallets**
  (`SplitRows`: rows of wallet + amount, "SR X left to place" / "Adds up", saving blocked until it adds up),
  When?. The guardrail (`view/addMoney.ts#overCommits`, parts summed per wallet in its own
  currency) shows *"Main bank has SR 300 free. Setting aside SR 500 leaves it SR 200
  over-committed."* and the button turns into **Set aside anyway** — a warning, never a block
  (D31). Calls `addMoney`. With `owner: null` and a `walletId` (Wallets' row menu **Set
  aside…**, 03 §3) it is titled *Set aside in {wallet}*, starts in that wallet and asks **For**
  (open bills and goals, grouped) before it can save (`usePlanOwner` takes null).
- **Pay now** (`PayNowSheet`): *Which one?* (the next three open occurrences), Full amount ↔
  Different amount, Paid from, and the effect line (`view/payNow.ts`): what leaves the wallet and
  how much the occurrence's set-asides **in that wallet** cover. Calls `payBill`; when the
  result's `leftover` has lines it opens the **leftover prompt** in its place, else toasts.
- **Leftover** (`LeftoverSheet`, 03 §5, D31): money the occurrence still holds once a payment
  settles it (never after a part payment) — **Move it to {paying wallet}** (a real transfer; only when some is in another
  wallet), **Free it up**, **Keep it for next time** (repeating bills). `resolveLeftover`.
- **Mark as done** (`MarkDoneSheet`): goals — progress box, then *What happens to the SR X set
  aside?*: **I spent it** (default, D30: `SpentFrom` — *Paid from* wallet + *How much did you
  spend?*, prefilled with what that wallet holds and reset on a wallet change; **Paid from
  several wallets** switches to `SplitRows` prefilled one row per holding wallet; *The other SR X
  set aside is freed.* — plus the category, remembered on the goal → `markGoalSpent` with the
  parts), **Free it up**, **Move it to another bill or goal** (a picker of open ones; a
  bill gets its next due occurrence) → `closeGoal`. Bills: *End {name}* / *Mark {name} as paid*
  with Free / Move → `closeBill`. Nothing set aside → no question.
- **Use it** (`UseItSheet`, D20): amount, paid from, category (asked until the goal remembers
  one) → `spendFromGoal`.
- **Delete** (`DeleteItemConfirm`): the P3 confirm, with what happens to set-asides and history.

## Tests

`data/{payPeriods,occurrences,funding,leftover,balances,safeToSpend,status,paycheck,views}.test.ts`
(leftover + fill; views = Upcoming, review, year ahead; `testing/state.ts` builds a planner
state from rows, `plannedScenario` with the planner's rows written); `hooks/usePlanning.test.tsx`; `actions/actions.test.ts`
(the testing plan's anytime actions); generation and the runner in
`planned/data/{generate,reconcile,runner}.test.ts`; payments in
`planned/data/billPayments.test.ts`.
