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
- `updateBill(id, patch)` — any field (incl. `nextDue`, `position` and the plan header the
  planner writes); undefined keeps the stored value.
- `deleteBill(id)` — mirrors the server: its set-asides go with it (`dropSetAsidesOf`), its
  payments keep their rows with `billId` cleared (`unlinkLedgerFrom`, queued payloads rewritten
  too). Its planned rows are resolved by the planner's orphan pass.

## Elsewhere

- Ledger rows carry `billId` (wire `bill_id`; never with `goalId`, never on transfer legs or
  adjustments). Rows stored before bills lack the field, which reads as null.
- Planned rows: origin `bill`, `billId`. **The planner generates nothing for bills yet** — the
  bills engine (coverage set-asides, payments, autopay) is the next phase. Confirming a bill's
  planned payment files the spend under the bill (category, merchant, note) and moves `nextDue`
  past the occurrence (`advanceBillPast` in `planned/data/mutations.ts`); confirming a bill's
  planned set-aside writes a set-aside for that occurrence.
- Category delete `move_to` re-files bills; a merchant merge or adopt repoints them.

## Tests

`data/{mutations,sync}.test.ts`.
