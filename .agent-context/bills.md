# Bills — `src/features/bills/`

Something the user has to pay, once or on a schedule (rent, insurance, a car service). Bills
replaced Spending's recurring schedules and the old goal kinds Obligation / Sinking fund
(working docs: `working.local/planning-model/02-domain-model.md`). Whether to save ahead is
derived from the schedule, never asked. **Data layer only** so far: the Planning page builds the
editors and lists.

## The entity

- Dexie `bills` (`id, categoryId, walletId, dirty, deleted`), `LocalBill` in `db/types.ts`,
  outbox entity `'bill'`. Wire types and `toBill` in `api/types.ts`, calls in `api/billsApi.ts`
  (`/bills`).
- `amount` is per occurrence (`0` = not known yet). `frequency` is an `ObligationFrequency` or
  **`null` = "Just once"** — then `nextDue` is its only occurrence and `endsOn` must be null.
  `customInterval`/`customUnit` are set exactly when `frequency` is `'custom'`. `nextDue` is the
  next open occurrence; **the client moves it on** (a PATCH) as occurrences settle.
- `walletId` = "Paid from" (null: decide when paying), `saveWalletId` = "Save in" (null: the
  paid-from wallet), `categoryId` a required **spend** category, `merchantId`, `note`,
  `autopay` ("Log it automatically on the due date"), `mustPay` (default **true**; false =
  "Nice to have"), `color`, `position`, `closedAt` (moved only by the close / reopen actions),
  the stored plan header and `setAsideDay`.

## Sync — `data/sync.ts`

`pushBillsEntry` / `pullBills`, wired into `db/sync.ts` (dispatch, and the planner-inputs group
of `pullAll`). **Full pull** (a bounded list; absence is how a delete arrives). The PATCH is a
**full representation** — `localBillToUpdateWire` sends every field; an omitted `must_pay`
reads as true and `autopay` as false server-side. `409` on create = the id already landed (pull);
`409 common.conflict` on update rebases the local row on the fresh version once; `404` drops the
row; anything else is flagged by the engine.

## Mutations — `data/mutations.ts`

- `createBill(draft)` — defaults `mustPay: true`, `autopay: false`; `shaped()` drops the end
  date of a one-off and the interval of a non-custom bill, as the server would.
- `updateBill(id, patch)` — any field; undefined keeps the stored value. A change to amount,
  currency, repeat, `nextDue`, `endsOn`, must-pay, paid-from or save-in (`changesBillPlan`)
  files a plan-rewrite request, as a goal's does.
- `setBillNextDue(id, nextDue)` — moving `nextDue` on as occurrences settle; no rewrite.
- `setBillPlanSnapshot(id, header)` — the planner's stored-plan header.
- `deleteBill(id)` — mirrors the server: its set-asides go with it (`dropSetAsidesOf`), its
  payments keep their rows with `billId` cleared (`unlinkLedgerFrom`, queued payloads rewritten
  too). Its planned rows are resolved by the planner's orphan pass.

## Actions — `data/actions.ts`

Close and reopen are **actions, not edits**: applied on this device at once and queued as their
own outbox entry (`op: 'close' | 'reopen'`), which the server applies atomically
(`POST /bills/{id}/close`, `/reopen`). A closed bill stays editable — its PATCH never carries
`closed_at`, and the server keeps it.

- `closeBill(id, {closedAt?, leftover?})` — "Mark as done" / "End this bill". `queueClose`
  (`setAsides/data/leftover.ts`, shared with goals) does in **one Dexie transaction** what the
  server's close does: stamps `closedAt`; releases every **live** set-aside on the close date
  (`leftover: {kind: 'free'}`, the default) or also writes each again for another open bill or
  goal (`{kind: 'move', to: {goalId} | {billId, occurrence?}}` — same wallet/label, amount,
  note, position; dated the close date; no planned link; a bill target's occurrence defaults to
  its `nextDue`); deletes the item's **open, unsettled planned rows dated after the close date**
  with their queued writes (`dropOpenPlannedAfter` — the server deletes and tombstones them);
  queues `{closed_at, leftover: 'FREE' | 'MOVE', move_to?: {goal_id | bill_id, occurrence?,
  new_ids}}`. The moved copies get ids minted here and sent as `new_ids`, so the server's rows
  are the local ones. The touched set-asides are marked dirty with no entries of their own; the
  close carries them. Closing a closed bill is a no-op.
- `reopenBill(id)` — clears `closedAt`; what the close released stays released; the planner
  plans the bill again.
- **Pushing an action** goes through `db/itemAction.ts` (`pushItemAction`): the payload holds no
  version — the row's last-synced one is read when it goes out. `409
  planning.bill.already_closed` (close) / `not_closed` (reopen) means the row is already in the
  asked state: the entry settles and the server's copy is adopted (for a close, the touched
  set-asides are cleaned and re-pulled — `resyncSetAsides` — so a moved copy the server never
  wrote disappears). `409 common.conflict` retries once on the fresh version, then adopts. `404`
  drops the row. A successful close stores the bill and the `released` + `created` set-asides
  it answers with (`storeServerSetAsides`).

## Elsewhere

- Ledger rows carry `billId` (wire `bill_id`; never with `goalId`, never on transfer legs or
  adjustments). Rows stored before bills lack the field, which reads as null.
- Planned rows: origin `bill`, `billId` — a PAYMENT per occurrence and the payday SET_ASIDEs
  that cover it, from the funding engine ([planning.md](planning.md), [planned.md](planned.md)).
  A bill keeps a **stored plan** like a goal (`plannedAt`, `planAmount`, `planCount`,
  `planStart`; recalc + undo). Confirming a bill's planned payment files the spend under the
  bill (category, merchant, note) and moves `nextDue` past the occurrence; confirming a bill's
  planned set-aside writes a set-aside for that occurrence.
- **Occurrences** (`planning/data/occurrences.ts`): stepped from `nextDue`, a month step keeping
  its day clamped to short months. Because only `nextDue` anchors them, a bill due on the 31st
  drifts to the 28th once February's occurrence settles.
- Category delete `move_to` re-files bills; a merchant merge or adopt repoints them.

## Tests

`data/{mutations,sync,actions}.test.ts`.
