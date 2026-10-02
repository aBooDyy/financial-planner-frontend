# Goals & income — `src/features/goals/`

Goals (what the user saves for) and income streams (money coming in). Together with
[bills.md](bills.md) and [set-asides.md](set-asides.md) they are the planning model the
**Planning** page is being rebuilt around (working docs: `working.local/planning-model/`). Domain
terms: root [domain-glossary.md](../../.agent-context/domain-glossary.md).

> **The screens live in Planning.** This slice is data only; goals and income are shown,
> edited and acted on by the Planning page ([planning.md](planning.md#the-planning-page--components):
> the Goals and Income sections, the goal and income editors, the goal detail panel and its
> sheets). `/goals/*` only redirects there ([routing.md](routing.md#planning-and-spending-tabs)).

## Local DB & sync (extends [data-layer-and-sync.md](data-layer-and-sync.md))

- Dexie `goals` and `incomeStreams` (`dirty`/`deleted` flagged, client UUIDv7 ids, sha256
  `version`), outbox entities `'goal'` and `'income'`, pushed and pulled by
  `data/sync.ts` (`pushGoalsEntry`, `pullGoalsAll` = `pullIncome` + `pullGoals`, both full
  lists). Usual contract: `409` rebases and retries once, `404` drops the row.
- **Both PATCHes are full representations**: an omitted nullable field is cleared, so
  `data/mappers.ts` always sends every field. The shared wire helpers live there too:
  `repeatWire(r)` (frequency + an interval only with `custom`) and `planWire(l)` (the stored
  plan header + set-aside day) — bills use both.
- **A goal has no kind.** `LocalGoal`: `target`, `amount` (monthly; required by the server when
  there is no `dueDate`), `dueDate`, `mustHave`, `saveWalletId`, `useCategoryId` (the spend
  category "Use it" files under), `closedAt` / `pausedAt` (moved only by the close / reopen /
  pause / resume actions — never by a PATCH), the stored plan header (`plannedAt`,
  `planAmount`, `planCount`, `planStart`) and `setAsideDay`. No `saved`: progress is derived.
- **An income stream** gains `customInterval`/`customUnit` (custom frequency), `endsOn`,
  `categoryId` (an income category, required — the editor defaults it to Salary), `merchantId`,
  `autolog` ("Log it automatically when it arrives") and `note`. `ObligationFrequency` (preset or
  `custom`) is the one repeat type for bills and streams alike.

## Mutations — `data/mutations.ts`

Local row + outbox entry in one Dexie transaction (`db/enqueue.ts`), then `schedulePush()`.

- `createIncome(draft)`, `updateIncome(id, patch)` (any field; undefined keeps it),
  `deleteIncome(id)` — also `forgetMainIncomeStream(id)` on the settings row, as the server does.
- `createGoal(draft)`, `updateGoal(id, patch)` (partial; a change to `currency`, `amount`,
  `target`, `dueDate`, `mustHave` or `saveWalletId` files a plan-rewrite request —
  `changesPlan`),
  `setGoalPlanSnapshot(id, header)` (the planner's), `swapGoalPositions(id, neighbourId)`,
  `deleteGoal(id)` — which mirrors the server's cascade: the goal's set-asides go
  (`dropSetAsidesOf`), and spending from it keeps its rows with `goalId` cleared
  (`unlinkLedgerFrom`, which also rewrites queued payloads). Its planned rows are left to the
  planner's orphan pass, as before.
- **Actions (`data/actions.ts`)** — the bills' pattern ([bills.md](bills.md#actions--dataactionsts)):
  `closeGoal(id, {closedAt?, leftover?})` (also ends a pause; "I spent it" is one spend per paying
  wallet with the goal and its `useCategoryId`, then a close with the default free leftover — not atomic, and
  harmless if the close fails; `planning/actions/goalMoney.markGoalSpent` does both),
  `reopenGoal(id)` (clears `closedAt` and `pausedAt`), `pauseGoal(id, pausedAt?)` (no-op on a
  closed or paused goal) and `resumeGoal(id)`. Reopen and resume file a quiet plan rewrite.
  "Use it" and Add money are `planning/actions` ([planning.md](planning.md#money-actions--actions)). Each writes
  the goal and queues `op: 'close' | 'reopen' | 'pause' | 'resume'`; the "already done" codes are
  `goals.goal.already_closed`, `not_closed`, `already_paused` (and `already_closed` for a
  pause), `not_paused`. A paused goal plans no set-asides (`planning/data/funding.isPlannableGoal`), so the planner's next
  fill removes its future unsettled ones, and `pauseGoal` skips the ones already due with nothing
  settling them (`planned/data/rows.skipDueSetAsides`); resume plans it again from today.

## Derivations

- **Progress (`data/progress.ts`)**: `goalProgress(goals, setAsides, txns, rates)` → per goal
  `setAside` (Σ **live** set-asides, goal currency), `used` (Σ spends with its `goalId`),
  `progress = setAside + used`, `byWallet`, `outside`. Release is explicit, so nothing here
  re-derives what a payment consumed (the old consume-on-payment rule is gone).
- **Funding**: goals are funded by the planning engine alongside bills
  ([planning.md](planning.md#the-funding-engine--datafundingts)) — two-tier priority, per
  payday. `setAsideDay` is still stored and synced but no longer read: set-asides fall on
  paydays.
- **Paydays (`data/paydays.ts`)**: `paydaysOf(stream, from, to)` / `nextPaydayOf`. Monthly
  pays on `day` (clamped); with an `anchorDate`, weekly steps 7 days and quarterly / semi /
  annual whole months from it; without one they step from fixed epochs. **Custom** steps every N
  days / weeks from the anchor (or `day` of Jan 2000), or every N months keeping the anchor's day,
  clamped. The planner stops a stream's paydays after its `endsOn`.
- **Cadence (`data/cadence.ts`)**: `frequencyMetaOf`, `customFrequencyMeta`, and the editor
  helpers (`RepeatDraft`, `repeatDraftOf`, `repeatOfDraft`,
  `repeatBlock`) the Planning editors will reuse. `Repeat` is `{frequency, customInterval,
  customUnit}`, satisfied by bills and streams.

## Tests

`data/{mutations,actions,progress,paydays,cadence}.test.ts`; the funding plan is exercised through
`planned/data/generate.test.ts` and `runner.test.ts`.
