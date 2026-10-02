# Set-asides — `src/features/setAsides/`

Money labelled for one bill or one goal, **in its real wallet** (or held outside the app, named
by a label). A set-aside never moves money and never changes a wallet's balance; it replaced
goal allocations and serves bills and goals alike (working docs:
`working.local/planning-model/03-set-asides-and-balances.md`). **Data layer only** so far.

## The entity

- Dexie `setAsides` (`id, goalId, billId, walletId, plannedId, dirty, deleted`),
  `LocalSetAside` in `db/types.ts`, outbox entity `'setAside'`. Wire types in `api/types.ts`,
  calls in `api/setAsidesApi.ts` (`/set-asides`).
- Exactly one owner: `goalId` xor `billId`. A bill's set-aside covers an `occurrence` (that due
  date); a goal's has none.
- `source`: `wallet` (a wallet id; the label is dropped) or `outside` (an `externalLabel`; the
  wallet is dropped) — wire `WALLET` / `OUTSIDE` (it was `EXTERNAL` on allocations).
- **Live while `releasedAt` is null.** A released row stays as history, with `releasedById`
  (the payment that released it) when there was one. A row is wholly live or wholly released: a
  partial release splits it. `movedByTransferId` links a release and the new row of a move.
- `plannedId` = the planned SET_ASIDE row it settles. It settles it while **live**, and still
  does once a **payment** released it (`releasedById` — the money was set aside, then used). One
  freed, moved or released by a close does not (`settlesItsRow` in `planned/data/settle.ts`): the
  money is no longer set aside for that row — a same-owner move's new row carries the link
  instead, so the row is never counted twice.

## Sync — `data/sync.ts`

`pushSetAsidesEntry` / `pullSetAsides`. **Full pull, live and released alike** (no delta
stream yet — the backend's follow-up if the list grows). PATCH is a full representation; the
owner is fixed at create and never sent on update; `position` and `date` are kept by the server
when omitted. Usual `409` / `404` handling, with one exception: **a rebase never touches the
release.** Releasing rides a batch or a close, never an edit, so `rebaseSetAside` takes
`released_at`, `released_by_id` and `moved_by_transfer_id` from the server's copy — re-sending
this device's would un-release money another device paid or freed.

## Mutations — `data/mutations.ts`

- `createSetAside(owner, draft)` — `owner` is `{goalId}` or `{billId, occurrence?}`; a bill's
  set-aside with no occurrence named covers the bill's `nextDue`. Position is next per owner;
  `date` defaults to today. Closes the planned row it settles (`closeCovered`).
- `updateSetAside(id, patch)` — source/wallet/label normalised, re-derives the old and new
  planned rows' status.
- `deleteSetAside(id)` — for a record made by mistake (releasing is how money stops being set
  aside). Re-opens the planned row it was settling.
- `dropSetAsidesOf('goalId' | 'billId', id)` — the local mirror of the server's cascade when a
  goal or bill is deleted: rows and their queued writes go, nothing is queued.

## Release and move — `data/batches.ts`

"Free it up", a payment releasing what it used, "move them with the transfer", "Move to…": each
is applied here at once and queued as **one** batch entry (`op: 'release' | 'move'`) the server
applies all-or-nothing (`POST /set-asides/release`, `/move`).

- `releaseSetAsides(parts, {releasedAt?, releasedById?})` — `parts` are `{id, amount?}`; an
  `amount` below the row's **splits** it: the row is released with its amount cut to the part,
  and the rest is written as a new **live** row (same owner, occurrence, wallet/label, planned
  link, note, position, date) under a `remainder_id` minted here. Whole otherwise.
- `moveSetAsides(parts, {date?, transferId?})` — each part also names `to: {walletId?, owner?}`.
  The source is released on `date` (and split as above); a new row (`new_id` minted here) holds
  the moved amount for the target: another wallet (it becomes a wallet set-aside), and/or
  another bill or goal (planned link dropped; a bill target's occurrence = the one named, else
  the source's when it is the same bill, else the target's `nextDue`; a goal's is null).
  Anything not named keeps the source's. `transferId` is stamped on the released and new rows.
  **A move to the source's own owner** — its goal, or its bill and occurrence — is a wallet
  move: it keeps the planned link and `to` carries only `wallet_id` (`ownerAfterMove`), so the
  server keeps the link too, whether or not it reads a named same owner as "keep" (it does since
  the backend fix; before it, naming the owner dropped the link server-side only). Another
  occurrence of the same bill is another owner and drops the link on both sides.
- Both refuse (throw `SetAsideBatchError`, writing nothing) a row that is not live here.
- **The entry holds every row it writes.** It is keyed by the first source, and `alsoRows`
  lists the others — sources, remainders, new rows — so the drain holds it behind any earlier
  write of any of them, and holds any later write of them behind it
  ([data-layer-and-sync.md](data-layer-and-sync.md#writes-optimistic-local-first)).
- **An edit after a batch never folds into a write queued before it** (that would send the
  batch's effect ahead of the batch): `updateSetAside` appends a fresh update when a batch
  touches the row (`touchedByBatch`, `data/queue.ts`).
- **Pushing.** Success stores the `released` + `created` rows — except a row with writes still
  queued after the batch, which keeps the user's newer edit and is settled by its own push
  (`storeServerSetAsides` skips rows with `hasQueuedWrites`). `409 already_released`, `404
  not_found` and `409 id_taken` mean the batch no longer applies as written (applied before,
  or overtaken elsewhere): the entry settles and the touched rows are cleaned and re-pulled
  (`resyncSetAsides`). Anything else is flagged.
- **`already_released` and `not_found` keep the rest.** When only some sources stopped being
  live there (another device paid, freed or deleted them), `retryWithoutOvertaken` drops those
  items — and the remainder / new rows they minted — from the entry, re-keys it on what is left,
  resyncs the dropped rows to the server's state and sends the rest again, so the user's other
  releases and moves are not lost. Only when no source is live there (a replay of this very
  batch, or all of them overtaken) does the whole entry settle. `id_taken` still settles the
  whole entry: it means the batch already landed.
- **`released_by_invalid` releases without the payment** (`withoutPayment`) once the payment's
  own create is no longer queued — it was deleted; while it is queued the refusal stands and the
  batch retries after it lands. Any other refusal is flagged, and a batch refused four times is
  dropped with its rows resynced (`abandonSetAsideBatch`,
  [data-layer-and-sync.md](data-layer-and-sync.md#failed-pushes-flag-hold-retry--never-drop)).
- **A close whose leftover target is refused frees the leftover** (`closeFreeingInstead`, used
  by bills and goals): the entry is rewritten to `FREE` and the copies minted for the target
  are resynced away, unless the target's create is still queued.
- **Batch size.** The server caps a batch at `limits.set_aside_batch_max` (200,
  `configLimits().setAsideBatchMax`, bundled fallback). `releaseSetAsides` / `moveSetAsides`
  queue longer lists as several entries of at most that many items, each all-or-nothing.

## Payments release them — `data/payment.ts`

03 §5: a payment from wallet *P* releases its owner's live set-asides **in P only** — for a
bill, those of the occurrence paid — oldest first (`date`, then `createdAt`), up to the amount
paid, the last row split. `heldInWallet` and `releasesForPayment` (pure) pick the parts;
`releaseForPayment(paidFor, payment, rates)` queues them as one release batch with
`releasedById` = the payment. `planned/data/mutations.confirmPlanned` calls it for every bill
payment and goal payment it writes. Set-asides in other wallets stay live until the user
decides (`planning/data/leftover.leftoverFor`).

`createSetAside` takes an optional `id` in the draft: an id already held writes nothing, so a
retried auto-confirm never sets aside twice.

**Taking a payment back** (deleted, unlinked, re-priced — `planning/actions/paymentUndo`) does
not un-release: `restoreReleasedBy(paymentIds)` writes a **new** live row per row the payment
released (same owner, wallet, occurrence, amount, date and `plannedId`), under the
deterministic id `uuidv5('<released id>:restored')`, so restoring twice is a no-op. The released
row stays as the record, still carrying `releasedById`.

## Totals — `data/totals.ts` (pure)

- `isLiveSetAside(row)`.
- `walletSetAsides(setAsides, goals, bills, nodes, rates)` → per wallet, one line per bill/goal
  (`ownerId`, `owner`, `ownerName`, `color`, `amount` in the wallet's currency), largest first.
  Only live `wallet` set-asides in a live wallet count. Wallets' pots and the Planned rail's
  "goal money" read it.
- `setAsideFor(ownerId, setAsides, currency, rates)` — Σ one owner's live set-asides.

Goal progress (`goals/data/progress.ts`) = live set-asides + spending from the goal.

## Elsewhere

- Confirming a planned set-aside writes one (a bill's: one per occurrence its money reaches,
  `planned/data/mutations.ts`); "Add money" on a goal writes one, now or as a hand-made
  planned row.
- Spending's Activity lists set-asides as their own rows (`SetAsideRow`, `ownerId`), kept out of
  every total; the cashflow hero only captions Σ wallet set-asides made in the window (never in net).

## Tests

`data/{mutations,sync,totals,batches}.test.ts`; payments in
`planned/data/billPayments.test.ts`.
