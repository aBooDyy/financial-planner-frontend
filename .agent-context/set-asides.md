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
- `plannedId` = the planned SET_ASIDE row it settles. **A released set-aside still settles its
  row** (the money was set aside, then used).

## Sync — `data/sync.ts`

`pushSetAsidesEntry` / `pullSetAsides`. **Full pull, live and released alike** (no delta
stream yet — the backend's follow-up if the list grows). PATCH is a full representation; the
owner is fixed at create and never sent on update; `position` and `date` are kept by the server
when omitted. Usual `409` / `404` handling.

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

## Totals — `data/totals.ts` (pure)

- `isLiveSetAside(row)`.
- `walletSetAsides(setAsides, goals, bills, nodes, rates)` → per wallet, one line per bill/goal
  (`ownerId`, `owner`, `ownerName`, `color`, `amount` in the wallet's currency), largest first.
  Only live `wallet` set-asides in a live wallet count. Wallets' pots and the Planned rail's
  "goal money" read it.
- `setAsideFor(ownerId, setAsides, currency, rates)` — Σ one owner's live set-asides.

Goal progress (`goals/data/progress.ts`) = live set-asides + spending from the goal.

## Elsewhere

- Confirming a planned set-aside writes one (`planned/data/mutations.ts`); "Add contribution"
  on a goal writes one, now or as a hand-made planned row.
- Spending's Activity lists set-asides as their own rows (`SetAsideRow`, `ownerId`), kept out of
  every total; the cashflow hero's "Saved" is Σ wallet set-asides made in the window.

## Tests

`data/{mutations,sync,totals}.test.ts`.
