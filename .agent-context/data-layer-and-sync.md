# Data Layer & Sync (Local-First)

The frontend is **local-first**: the local DB is the UI's source of truth, and a sync
engine keeps it reconciled with the backend.

## Local database — Dexie.js (IndexedDB)

**Choice: Dexie.js.** Rationale:

- Mature, well-maintained IndexedDB wrapper with great DX, transactions, and indexes.
- Reactive queries (`dexie-react-hooks` `useLiveQuery`) make local-first reads trivial.
- We control the sync protocol, which fits our **custom FastAPI backend** and its
  **per-row `version` optimistic locking** exactly — no need to adopt a sync engine's own
  backend protocol.

Alternatives considered (record if we ever switch):

- **RxDB** — batteries-included replication, but its replication expects a specific
  backend shape; more weight than we need.
- **PowerSync / ElectricSQL** — excellent local-first sync, but assume Postgres-logical
  replication / their service; heavier coupling than our simple outbox.
- **TinyBase / raw IndexedDB** — viable but less ergonomic for our relational-ish data.

> If requirements change (e.g. we want turnkey replication), revisit here before swapping.

## Tables

**The schema is declared as of version 2, plus each later version's change on top**
(`this.version(2).stores({...})`, then `this.version(3).stores({ ledgerTotals })` in
`db/db.ts`). Dexie diffs the declarations against whatever is installed, so versions before 2
need no declaration of their own. Adding a table or an index means a new version with just
that change, and an `.upgrade()` when installed data has to follow.

- **Version 4 replaces the planning model** (recurring schedules and goal allocations became
  bills and set-asides; goals, income streams and planned rows changed shape). It deletes the
  `recurrings` and `goalAllocations` tables, adds `bills` (`id, categoryId, walletId, dirty,
  deleted`) and `setAsides` (`id, goalId, billId, walletId, plannedId, dirty, deleted`),
  re-indexes `plannedTransactions` on `billId` (no `recurringId`) and `transactions` on `billId`.
  The upgrade **clears `goals`, `incomeStreams` and `plannedTransactions`** (the server dropped
  and recreated them), **deletes queued outbox entries of `recurring`, `allocation`, `goal`,
  `income` and `planned`** (their payloads are in a shape the server refuses), clears `goal_id` /
  `planned_id` from local ledger rows and from queued `transaction` payloads (the server's `0037`
  cleared those links), and deletes the per-user `:planned` watermark and `:plannerInputs`
  marker, so the planned delta re-reads as a first sync and the planner waits for the new pull.
  Every other table, the ledger rows and every other queued write survive. `db.test.ts` opens a
  real v3 database and pins all of it. Deploy the backend (`0037`) first.
- **Version 3 adds `ledgerTotals`** and builds it from the rows already on the device. It is
  derived data: never synced, not in `SYNCED_TABLES`, but wiped on sign-out with the rest
  (`USER_TABLES`). See [Running totals](#running-totals-maintained-in-the-database).

- **Version 2 (category ids) is a one-off wipe.** Rows stopped naming categories by slug pair
  and now carry a `categoryId` ([categories.md](categories.md)); a local row or a queued
  payload in the old shape cannot be translated without the server's ids. The upgrade clears
  every table in `SYNCED_TABLES` — every synced/server-cached table **plus the outbox and
  `syncState`** — so the next pull is a first sync (delta streams re-read from `since: null`,
  full lists replace). **Unpushed writes are discarded**; push before shipping a build that
  bumps the version. `appConfig` (no user data) and `importBatches` (local history; its rows
  come back with the re-pull, found by their `source` marker) survive. `db.test.ts` opens a
  real v1 database and pins what survives.
- **`categoryId` is indexed on `transactions`, `bills` and `plannedTransactions`**: the
  category delete re-files by it and the Settings tree counts rows per category by it.
- `AppDatabase` takes the database name (default `'means-app'`) so a test can open its own.

- One Dexie table per synced entity (accounts, transactions, categories, budgets, bills,
  set-asides…), keyed by the server **id** (use client-generated UUIDs so records exist
  before first sync).
- Each record stores the server **`version`** and local sync metadata: `dirty` (has
  unsynced local changes), `deleted` (tombstone), `updated_at`.
- An **`outbox`** table holds pending mutations to push (op, entity, id, payload, base
  version, timestamp).
- A **`syncState`** table holds one watermark per user per incrementally-pulled entity. It is
  sync bookkeeping, not user data, and it lives in the database precisely so that wiping the
  database takes it too — see [Incremental pull](#incremental-pull-the-delta-streams). It also
  holds one `${userId}:plannerInputs` marker, for the same reason
  ([the planner's gate](#the-planners-gate-dbpullstatets)); no delta stream uses that name.
- **`categories`** (indexed `'id, slug, parentId, dirty, deleted'`) is a **tree** in
  one table — `parentId === null` is a top-level category, anything else is a subcategory of
  it. `parentId` is indexed because the resolver walks children per parent and the subtree
  delete reads them. A category row is created with `parentId`/`icon`, and a `balanceNodes` row
  with `icon`, set to `null` **explicitly**, never left `undefined`: an update wire is built
  from the row, so an `undefined` drops that key out of the JSON body and the server reads the
  omission as "clear it". See [categories.md](categories.md).
- **`customCurrencies`** (outbox entity `'customCurrency'`) is an ordinary
  synced table with one extra duty: `useCustomCurrencies` mirrors it into the app-config
  store, because every currency helper (`decimalsFor`, `fromWireCurrency`) is synchronous and
  reads that store. See [app-config.md](app-config.md#currencies-the-user-defines).

## Running totals, maintained in the database

`ledgerTotals` ([transactions.md](transactions.md#running-totals-ledgertotals)) must equal a
recount of `transactions` at all times, and a ledger row is written from many places —
mutations, transfers, sync pulls and reconciles, imports, the review queue. So no feature
updates it: **`db/ledgerTotalsMiddleware.ts`, a Dexie DBCore middleware registered in the
`AppDatabase` constructor**, does it inside the very IndexedDB transaction of each write.

- **Callers never list the table.** The middleware widens every read-write transaction that
  includes `transactions` to include `ledgerTotals` too, so an explicit
  `db.transaction('rw', db.transactions, db.outbox, …)` needs no change, and an abort rolls
  both back together.
- **It sees every write shape**: `add`/`put` (incl. `update`, `modify`, `bulk*`) read the old
  rows first and diff; `delete` reads what it removes; `clear()` empties the totals. Failed
  items of a bulk write are left out.
- **Writes inside one transaction are applied in turn**, so parallel `put`s in a
  `Promise.all` never read the same stored total and lose an update.
- **Gotcha — no `async`/`await` inside a DBCore middleware.** Dexie's lower layers (the hooks
  middleware) read the current transaction from Dexie's zone, which only Dexie's own promises
  carry; a native `await` drops it and the next call fails with `Cannot read properties of
  undefined (reading 'table')`. Chain `.then` on the promises the layer below returns, and
  start chains from `Dexie.Promise.resolve()`.
- **A live query on `ledgerTotals` wakes only when a total moves** — a note edit or a `dirty`
  flip rewrites no total, so it does not re-run readers.
- `db/ledgerTotals.test.ts` pins every write path against a from-scratch recount, the racing
  writes, the abort, the version-3 build and the self-check.

## Reads

- Components read via reactive local queries (`useLiveQuery`) so the UI updates instantly on
  local writes and on sync-applied server changes.
- **No TanStack Query.** In a local-first app it would be a redundant second cache over the
  local DB, and two caches of the same entities drift out of sync — the classic anti-pattern.
  The local DB is the cache and the source of truth. Derived views (forecast, net position,
  budget-vs-actual) are computed from local data, so they're reactive Dexie reads too, not
  remote queries.

## Remote-only calls (the small exception)

- The only genuinely remote, non-persisted calls are **auth** (login/register/logout/refresh/
  me) and anything server-computed we deliberately don't store locally.
- These go through the single HTTP client in `src/lib/` plus the session Zustand store — a
  thin wrapper is enough; they don't justify pulling in a server-cache library.
- If remote-only calls ever grow enough that retry/loading ergonomics matter, TanStack Query
  can be added back **scoped to those calls only** — never over synced domain data. It's a
  reversible decision, so it stays out until it earns its place.

## Writes (optimistic, local-first)

1. Write to the local DB immediately; mark the record `dirty`.
2. Append the mutation to the **outbox**.
3. UI reflects the change at once (it's reading the local DB).
4. The sync engine pushes the outbox in the background.

`db/enqueue.ts` holds the outbox half of an ordinary write — `enqueueCreate`,
`enqueueUpsert` (fold into the row's queued create or update, else queue an update on the
last-synced version; rewriting clears a flagged failure) and `enqueueDelete` (drop the row's
queued entries; queue a delete only if the server has seen it). The bills, set-asides, goals
and income mutations use it; older slices still carry their own copies of the same logic.

## Sync engine

- **Push**: drain the outbox to the backend, in `seq` order, a **page of one full wave**
  (`transactionBulkMax × BULK_CONCURRENCY` entries per queue query, so the page is never the
  real cap). Each mutation includes the **base `version`**.
  - **A contiguous run of `transaction` creates goes out as `POST /transactions/bulk`, and of
    `transaction` deletes as `POST /transactions/bulk-delete`, cut into request-sized batches,
    four in flight** (`bulkRunLength` + `pushRun` in `db/sync.ts`, `pushTransactionCreates` /
    `pushTransactionDeletes` in `features/transactions/data/sync.ts`). Only that entity, and
    only those two ops: an import queues one create per row and they reference
    wallets/categories/merchants queued _before_ them, never each other, so a batch cannot race
    its own prerequisite — while a batch of `node` creates could push a child ahead of its
    parent and earn a 422 for a row that was fine. Every other entry is still a run of one,
    so ordering between entities is unchanged.
  - **A run never mixes ops, and that is what keeps a row's create ahead of its delete.**
    `bulkRunLength` extends a run only while the next entry has the _same_ `op`, so a page
    holding `create A · create B · delete A · delete B` leaves as two batches in that order.
    Grouping by entity alone would let a row's delete reach the server before the create it
    refers to, which answers `NOT_FOUND` and leaves the row standing forever. A test pins the
    split (`[create, create, delete, delete]` → runs of 2 and 2).
  - **`transfer` creates and deletes batch too** (`POST /transfers/bulk`,
    `POST /transfers/bulk-delete`, capped at `transaction_bulk_max`): an import writes hundreds.
    One entry is one transfer (both legs), and the per-item results are read exactly like the
    ledger's — `CREATED`/`ID_TAKEN` store the returned legs (a taken id that is not ours marks our
    legs clean and runs one pull), `INVALID` flags the entry, a deleted or missing answer to a
    delete is terminal.
    Transfer updates stay singular.
  - **`planned` creates batch the same way** (`POST /planned-transactions/bulk`, capped at
    `limits.planned_bulk_max`): the planner's first pass over an account writes dozens. The
    batchable kinds are one table, `BULK_KINDS` in `db/sync.ts` — entity, op, batch size, push —
    and a run never spans two kinds. A planned create answered `ID_TAKEN` is benign (another
    device generated the same occurrence under the same deterministic id) — see
    [planned.md](planned.md#sync-datasyncts).
  - The run is capped at the server's own `limits.transaction_bulk_max` from `GET /config`, so
    neither side holds its own copy of the number. `flushOutbox()` is the awaitable form;
    `schedulePush()` is the debounced one.
  - **The request is all-or-nothing; the entries are not.** The response answers **per
    item** and each is settled on its own terms: `CREATED` → store the row, drop the entry;
    `ID_TAKEN` → the write already landed, so store the row the server sends back (the
    caller's own row, absent when the id belongs to someone else) and drop the entry;
    `INVALID` → flag the entry as rejected with the item's `error_code` / `error_field` and
    keep it — the same rule the singular path applies to a rejection
    ([Failed pushes](#failed-pushes-flag-hold-retry--never-drop)). An entry the response does
    not mention stays queued.
  - **A delete's answer is nearly always terminal.** `DELETED` / `NOT_FOUND` settle it — the
    row is gone, or nothing of ours ever stood behind that id — so `pushTransactionDeletes` drops
    those entries; `INVALID` (a transfer leg, a malformed id) is flagged like any rejection, and
    an entry the response does not mention stays queued. There is no version in the request
    either: a queued delete carries `baseVersion: null`, ownership is the server's guard, and a
    row edited elsewhere since still deletes. That is the point — the user asked for it to go.
  - **A failure of the batch endpoint itself is not a per-item verdict.** An unavailable
    answer (network, `408`, `429`, `5xx`) keeps the whole run queued, flags only its head, and
    stops; a rejection of the whole batch **falls back to the singular path for that run**,
    which isolates the one row the server refused rather than flagging the rest of the batch.
  - **Batch size and concurrency are separate levers and both were measured.** Batching
    alone left the client idle through a whole server-side insert before starting the next
    batch, which independent batches never need to do — the old 6-at-a-time pipelining had
    that property and the first bulk version dropped it. Against the real database, 4 000
    rows: **one batch at a time 2 377 ms, four in flight 1 733 ms, eight in flight
    1 931 ms**. Past four they contend for the connection pool and the event loop, so
    `BULK_CONCURRENCY` is 4.
  - History: one request per row, then 6 pipelined — at 20 ms/request a 10 000-row import
    cost ~319 s, then ~69 s. It is now 10 requests of 1 000 rows, four of them in flight.
    Undo was the same shape of cost on the way back out and lasted longer: **a measured
    2 608-row undo spent ~75 s in continuous HTTP as 2 608 `DELETE`s, and now costs 3 requests
    and 4.0 s**; a 2 603-row import commit is **3 requests, down from 5**. A test drains a
    2 608-row undo and asserts the batch sizes are `[1000, 1000, 608]`.
  - `2xx` → store the returned record + new `version`, clear `dirty`, remove from outbox.
  - **`409` conflict** → the server row moved on. Reconcile (see below).
  - Anything else → keep in the outbox and **flag** it; see
    [Failed pushes](#failed-pushes-flag-hold-retry--never-drop).
- **Pull**: `pullAll()` fans out to eight collection pulls in one `Promise.all`, single-flight
  and best-effort (a failed pull just retries on the next trigger). Each upserts into its local table, **unless** the local record
  is `dirty` (then it's a conflict). Five of the streams read a delta and the rest read the full
  list — see [Incremental pull](#incremental-pull-the-delta-streams) for which, and
  why it is not all of them.
- **Cadence (locked):**
  - **Push is event-driven**: fire right after a local write (debounced ~1s to batch
    bursts). A periodic **30s** flush is only a safety net and **runs only when the outbox
    is non-empty** — nothing to push ⇒ no request at all.
  - **Pull runs always on app enter**, on reconnect, and otherwise on a **longer background
    interval (5 min)**. The collections that grow read a delta, so the interval stays cheap as
    the ledger does not: measured in the browser, the three delta reads of an idle pull weigh
    **289 / 292 / 296 bytes** between them and no list of rows is fetched to discover that
    nothing happened. The bounded collections are still read in full on every pull.
  - A tab regaining focus pulls at most once a minute (`VISIBILITY_PULL_MIN_MS`). Coming
    back to the app is a hint that data may have moved, not a reason to refetch every
    collection each time it happens.
  - Push and pull are independent loops; a local write triggers a push, not a pull.
- Coalesce/debounce; never run overlapping syncs; single-flight each loop.

### The planner's gate (`db/pullState.ts`)

`pullAll` wraps the pulls the planner generates from — goals and income, bills, set-asides,
spending, planned rows — in one
`Promise.all` and, when all three came home, calls `recordPlannerInputsPulled`
(`db/plannerInputs.ts`): it bumps `plannerInputsPulled` in a small Zustand store (this app load)
and writes a per-user `syncState` marker (this device). `usePlannedRunner` does nothing until
one of them says the inputs arrived, so a fresh device never generates rows the server already
holds (harmless with deterministic ids, but noise), and re-runs after every successful pull. The
marker is what lets an app opened **offline** run the planner over the rows an earlier launch
pulled; the counter alone would hold it until a pull succeeds. `clearLocalDb` resets the counter
and, with `syncState`, the marker.

### Where sync is started

**`startSync()` is mounted exactly once, from the root layout** — `useSync()` (`src/db/useSync.ts`),
called by `RootLayout` and gated on `session.status === 'authenticated'`. It is the one component
navigation does not unmount, so the loops live for the session and stop at logout.

**Never start it from a page.** One pull fans out to _every_ collection (12 endpoints today), so a
page-level `startSync()` refetches the whole dataset on each navigation — opening Wallets would
fetch goals, bills, budgets, merchants and import templates. It also restarts the 5-minute
interval from zero each time, so a user who changes tabs more often than that never gets a
background pull at all. Both were live bugs: sync was started from five page components until the
call was hoisted here. `startSync()` now ignores a second concurrent start, and
`src/db/startSync.test.ts` pins the lifecycle (one pull per start, idempotent, throttled on focus,
silent after teardown, restartable).

## Incremental pull (the delta streams)

A pull every five minutes is only cheap if it stays cheap as the ledger grows. **Measured
against a 2 000-row account: an idle delta is 288 bytes and the full pull of the same data is
854 090 bytes** — about 2 965× — for a question whose answer is almost always "nothing". So the
collections that grow read a delta instead, resuming from a watermark held in the Dexie table
`syncState`:

| Stream                      | Entity          | Reached from                                                         |
| --------------------------- | --------------- | -------------------------------------------------------------------- |
| `/transactions/changes`     | `transaction`   | `pullTransactionsDelta` → `pullSpendingAll` → `pullAll`              |
| `/merchants/changes`        | `merchant`      | `pullMerchantsAll` → `pullAll`                                       |
| `/merchant-aliases/changes` | `merchantAlias` | `pullMerchantsAll` → `pullAll`                                       |
| `/inbound-imports/changes`  | `inboundImport` | `pullInboundImportsDelta` → `pullAll`, `runEmailSync()`, review open |
| `/planned-transactions/changes` | `planned`   | `pullPlannedDelta` → `pullAll` |

**Everything else stays on the full list, deliberately.** Balance nodes, balance settings,
exchange rates, categories, custom currencies, income streams, goals, bills, set-asides,
budgets, import templates, and the email connections (whose alert rules ride inside the
connection row). Two reasons, and they are the same reason twice: those collections are bounded
by how much a person can be bothered to create, and **a full list teaches deletion by absence** —
whatever we hold and the response does not is gone. A delta cannot say that, which is why the
server has to keep tombstones for the four above. Paying for a watermark, a paging loop and a
tombstone table to save a few kilobytes would be buying the machinery without the problem.

Three modules, one per job: `db/changes.ts` (the transport), `db/watermarks.ts` (where a stream
resumes from), `db/delta.ts` (`pullDelta`, the loop). Each entity supplies a `DeltaSpec` —
`fetchChanges`, `apply`, `idOf`, `fullPull`, and an optional `reconcile` — and owns its own table
writes; `pullDelta` writes nothing itself.

- **`since` beside `cursor` is made unrepresentable**, not merely unused:
  `ChangesQuery = {since, limit} | {cursor, limit}`, and `changesPath` narrows on
  `'cursor' in query`. A resumed page carries the window inside the cursor, so a `since` sent
  with it could only contradict it. `retention_days` is received and **dropped at the boundary**:
  `ChangesPage` has no counterpart for it, because nothing here acts on it.
- **The watermark is `<userId>:<entity>`** in the Dexie table `syncState` (keyed `id`).
  The user half is not decoration: sign-out wipes the database, but that wipe is best-effort, and
  a watermark that outlived its owner would hand the next user of this device a stranger's
  `since` — whose delta silently omits every row older than it. `clearLocalDb` clears
  `syncState` for the same reason. With no signed-in user, `readWatermark` answers `null` and
  `writeWatermark` no-ops, so the worst case is a first sync rather than a wrong one.
- **Nothing ever back-fills a watermark**, and that is what makes a missing one safe: an entity
  with no watermark reads its first delta as a **first sync** — the one reading under which any
  pre-existing rows are reconciled against the server.
- **The watermark is adopted only when the run finishes.** `pullDelta` follows `cursor` to the
  end and writes `as_of` on `complete` (and on the `full_resync_required` branch, after the full
  pull — a snapshot is no older than the `as_of` it came with). A run that dies mid-way leaves
  the old watermark, restarts from there next time, and re-applies what it already had, which an
  upsert by id makes free.
- **A first sync reconciles by absence, exactly like a full pull.** With `since: null` the
  response carries every live row, so anything local the server did not deliver is gone: each
  spec's `reconcile` deletes those rows **unless they are dirty**. This is the one thing a
  watermark-less client cannot learn from tombstones, which only cover the window it never had.
- **Applying a page never overwrites unpushed work.** An `items` row is upserted unless the local
  row is `dirty` or `deleted`; a `deleted_ids` id is removed only when the local row is not
  `dirty`. A queued local write wins and keeps winning — whole-record last-write-wins, below —
  and the `404` its push earns is what finally drops a row the server has deleted.
- **Merchants then aliases, sequentially, never together.** A merchant item restates that
  merchant's _whole_ alias set while the alias stream carries the alias tombstones, so applying
  the aliases last is what stops a deleted spelling from being written back by its merchant's
  page. The alias stream has no `reconcile` of its own: on a first sync the merchant stream
  delivers every merchant with its aliases, and that per-merchant reconciliation already covers
  them.
- **`sync.since_invalid` clears the watermark and re-runs as a first sync** — once. Re-sending a
  watermark the server cannot read would wedge that entity forever, and a first sync is always a
  correct answer. The guard is keyed on the stable `code`, not on the `422`.
- **Inbound imports pull on the loop and on their own triggers.** Webhook rows arrive with no
  client event behind them, so `pullInboundImportsDelta` is part of `pullAll` (start, the
  five-minute loop, focus, online) and also runs after an inbox scan (`runEmailSync()`) and
  when the review opens. It is single-flight: overlapping triggers share one run. It is also
  the one stream whose rows are a server-owned cache with no `dirty` flag, so its apply is a
  plain upsert that additionally **evicts** anything no longer `pending` — which a
  pending-only list has no way of expressing.
- In the browser, the three delta reads of an idle pull are **289 / 292 / 296 bytes** — three
  requests that say "nothing moved" and fetch no rows to prove it.

`db/delta.test.ts` drives the real ledger spec and pins the whole protocol: the cursor followed
to the end before `as_of` is adopted, `since` never sent beside a cursor, the next run resuming
from the stored watermark, an interrupted run adopting nothing and restarting from the old
watermark, a re-delivered row upserting rather than duplicating, tombstoned ids deleted, a dirty
row surviving both an update and a tombstone, a first sync dropping local rows it did not
deliver, `full_resync_required` running the full pull first, a watermark dying with
`clearLocalDb`, a second user on the same device never reading the first one's, and a refused
`since` restarting as a first sync. Backend mechanism:
[sync.md](../../financial-planner-backend/.agent-context/sync.md).

## Failed pushes: flag, hold, retry — never drop

A change the server cannot take is **kept and flagged**, never deleted. Dropping it (the old rule
for any non-network error) left the local row `dirty` forever: pulls skip dirty rows, so the
change lived only on this device, quietly diverged from the server, and the user never knew.
The pieces live in `db/syncFailure.ts` (classification, flagging, the reads) and
`db/syncRetry.ts` (manual retry); the drain is `drainPass` in `db/sync.ts`.

**The flag is three non-indexed fields on `OutboxEntry`** (no Dexie version bump):
`failure: SyncFailure` (`kind`, `status`, `code`, `field`, `message`, `at`), `attempts` (how
many times the server has _rejected_ it) and `nextAttemptAt` (no automatic retry before it).

| Result of a push | Treatment |
| --- | --- |
| network (`0`), `408`, `429`, `5xx` | **unavailable** — flag the attempted entry, **stop draining** (every later entry would fail the same way). Retried on the next flush (800 ms debounce, 30 s safety net). |
| `409`, `404` | the feature handler's own path, unchanged (rebase, adopt, 404-drops-the-row, 404-on-delete is success) |
| `400`, `403`, `422`, any other 4xx, a non-`ApiError` throw | **rejected** — flag, `attempts += 1`, `nextAttemptAt = at + 1 / 5 / 15 / 60 min` (capped), **keep draining past it** |
| `401` that survived the refresh | stop draining, flag nothing (the session is ending) |
| bulk item `INVALID` | rejected, from the item's `error_code` / `error_field` (no message on the wire) |

- **A whole-batch failure** that is unavailable flags **only the head** of the batch — the rest
  were never judged and stay plainly pending — and stops. A whole-batch _rejection_ falls back to
  the singular path, which isolates the one row the server refuses.
- **The drain walks the queue once per pass**, with a `seq` cursor (`where('seq').above(after)`),
  because kept entries would otherwise be re-read from the head forever. An entry re-queued by its
  own handler during a pass (the category re-slug) goes out on the next flush.
- **Backoff.** A rejected entry whose `nextAttemptAt` is in the future is skipped.
- **Same-row hold.** A pass keeps a `blocked` set of `entity:id` keys: a row whose entry failed,
  is backing off, or is still queued after its push (an unanswered bulk item). Every later entry
  of that row is **held** — never pushed ahead of it — and joins the set. Without this an update
  behind a refused create would earn a `404`, and a `404` deletes the local row. A transfer is keyed
  `transfer:<transferId>`, one entry for both legs, so it holds the same way. A bulk run is cut short
  at the first held entry.
- **Releasing dependants.** When an entry that had failed before is gone after its push, the pass
  ends by clearing `nextAttemptAt` on every rejected entry (`releaseRejected`) and goes round
  again: a ledger row refused because its wallet's create had failed retries right after that
  create lands.
- **A verdict belongs to a payload.** `flagEntry` writes nothing when the entry was settled or
  re-queued with a different payload while the request was out.
- **Editing a flagged row clears it.** Every coalescing site (`enqueueUpsert` in each feature,
  the transfer update, planned `savePlanned`, wallets/settings/rates/templates) and every
  payload rewrite (the category refile, the merchant adopt) writes through `requeued(entry)`,
  which drops `failure` and `nextAttemptAt` and keeps `attempts`. The next flush sends it at
  once — this is how the user fixes a refusal themselves.
- **Rebase fallbacks only accept the server copy on a second `409`.** They used to accept it on
  any error, so a `422` or an outage in the rebase retry silently threw the user's edit away;
  anything else now propagates and is classified above.
- **Manual retry.** `retrySync(entity, id)` clears `nextAttemptAt` (keeps `attempts`) on that
  row's entries and flushes; `retryAllFailed()` does it for every flagged entry — exposed for a
  future global indicator, with no UI yet.
- **Reads.** `failuresByRow(entities)` returns the first failure per row id in one scan of the
  outbox (`useFailedSyncIds` — **one live query per list**, never one per row);
  `failureOfRow(entity, id)` reads one row by `[entity+id]` (`useSyncFailure`). Wording lives in
  `lib/syncFailureMessages.ts` (`describeSyncFailure`), keyed by the code's last segment and
  reusing `lib/errorMessages.ts` for the refused-value codes. Only ledger rows show it today
  ([transactions.md](transactions.md#sync-failures-on-ledger-rows)); the data layer is generic.
- Tests: `db/syncFailure.test.ts` (classification, hold, backoff, retry, release),
  `db/sync.test.ts` (bulk `INVALID` and whole-batch failures),
  `features/transactions/data/editClearsSyncFailure.test.ts`, `lib/syncFailureMessages.test.ts`,
  `features/transactions/components/TransactionList.syncBadge.test.tsx`.

## Conflict handling (`409` / version mismatch)

- The backend is authoritative on conflicts via the `version` column (root
  [api-contract-conventions.md](../../.agent-context/api-contract-conventions.md)).
- **Strategy (locked): last-write-wins, client re-apply.** Conflicts are rare (single user,
  rarely editing the same record on two devices at once), so we deliberately keep this
  simple — **no field-level merging**.
  - On `409`, the sync engine **pulls the current server record** (to get the latest
    `version`), **re-applies the pending local mutation** on top, and **retries once**. The
    user's most recent action wins.
  - Whole-record LWW: a local delete still wins over a server update, and vice versa.
  - This never silently discards the user's own latest intent. If the retry conflicts
    again, the server copy is accepted rather than looping; if it fails any other way, the
    entry is flagged and kept like any failed push.

## Auth & HTTP

- Single HTTP client in `src/lib/`. All requests use **`credentials: 'include'`** so the
  **HTTP-only auth cookie** is sent. The app **never** reads the token in JS.
- **A `401` is a renewal, not a sign-out.** The access cookie lives 15 minutes, so the ordinary
  meaning of a `401` on a protected path is that it aged out while the tab sat in the
  background. `http.ts` is split for this: `send()` is one fetch and no policy, `request()` is
  the policy — one `POST /auth/refresh`, then one retry. **The retry sits outside the `try`**, so
  a second `401` propagates instead of re-entering the refresh; a logical request is at most two
  wire calls plus a shared refresh, never a loop.
- **The refresh is single-flight.** A sync wave is a dozen parallel calls and the cookie expires
  for all of them at once, so whoever finds a refresh running awaits the same promise and retries
  behind it; the slot is freed before the waiters resume, so the _next_ expiry gets its own
  refresh. Verified in a browser: **12 parallel `401`s → exactly 1 refresh → 12 retries, all
  `200`, session alive**, and a test pins the same numbers.
- **`PUBLIC_AUTH_PATHS` is the list of paths a `401` is the _answer_ for** — `/auth/register`,
  `/auth/login`, `/auth/logout`, `/auth/refresh`, and the two Google OAuth paths. There a `401`
  means bad credentials or a spent refresh cookie, and refreshing would recurse or mask it.
  **`/auth/me` is deliberately _not_ on that list**: reopening the app after 15 idle minutes
  bootstraps through `GET /auth/me`, and it should renew the session rather than bounce the user
  to login.
- **Sign-out has one implementation and one trigger.** `features/auth/endSession.ts` clears the
  session store (which is what routes every protected route out) and then `clearLocalDb()`; both
  `useLogout` and `http.ts` go through it. It fires **only when the server explicitly refuses the
  refresh** — a `401` on `/auth/refresh` itself. A network error or a 5xx leaves the session and
  the local data alone, because an offline client that wiped its unsynced outbox on a failed
  refresh would be destroying the user's writes to report a problem it cannot even diagnose. (A
  retry that still `401`s does not sign out either; it just propagates.) The refresh failure
  deliberately replaces the caller's `401` with its own — usually `common.network` — which the
  sync engine reads as "keep the outbox, flag it unavailable, and stop".
- **A refused refresh only signs out the session it was sent for.** `runRefresh` snapshots the
  session user before sending and skips `endSession()` if the user changed while it was out. The
  case: on `/auth/google/callback` the root's boot `GET /auth/me` runs cookie-less alongside the
  code exchange; the exchange sets the cookies and `setUser`s, then the stale refresh `401` lands
  — without the guard it wiped the fresh sign-in and bounced the user to `/auth/login`.
- `clearLocalDb()` empties every user table (`USER_TABLES`: the synced tables, `outbox`,
  `syncState` and `importBatches`), removes the cached user (below), and **keeps `appConfig`**:
  it holds no user data, and keeping it means the next sign-in already knows the currency table
  offline. It also resets the pull state (so the planner waits for the next user's first pull)
  and bumps `localDbGeneration()` first: a server-owned cache whose pull was already
  in flight at sign-out (integration keys, the inbound-import queue) compares the generation
  inside its write transaction and drops the stale answer instead of refilling the wiped table.

### The offline session

An installed app opened without a network must come up **signed in, with its Dexie data**. So
the last user the server returned is cached on the device, and only the server's refusal signs
out.

- **The cache** — `stores/cachedUser.ts`, localStorage `fp-session-user`. localStorage, not a
  Dexie row, because the session store reads it **synchronously when it is created**: a device
  that has it starts `status: 'authenticated'` with `verified: false` and renders the app on the
  first frame, with no Splash waiting on IndexedDB. Every `setUser` writes it (every caller hands
  it a user the server just returned: `/auth/me`, login, sign-up, Google, onboarding, profile
  edit) and `clear()` removes it; `clearLocalDb()` removes it too, so no wipe leaves a device
  that reopens signed in over empty tables. A value that is not a well-formed `User` reads as
  nothing cached.
- **`verified`** is true once the server confirmed the session in this app load. Work that needs
  the server rather than just a user waits for it: the config refresh
  ([app-config.md](app-config.md)) and the once-per-load email scan
  ([email-sync.md](email-sync.md)). Sync and the planner don't — they are local-first and start
  on `authenticated`, so an offline launch keeps its outbox flushing on reconnect.
- **`verifySession()`** (`features/auth/verifySession.ts`, single-flight) asks `GET /auth/me`:

  | Answer | Outcome |
  |---|---|
  | a user | `setUser` (verified, re-cached). If it is a different user than the cached one, `clearLocalDb()` first — the tables are the cached user's. |
  | `401` / `403` (after `http`'s refresh) | `endSession()` — the one sign-out path: clear, forget the cache, wipe. |
  | anything else (network `0`, `408`, `429`, `5xx`, …) | keep the cached user, still unverified; with no cache, `clear()` → anonymous → login. |

  An answer that arrives after the session changed under it (the user signed out meanwhile) is
  dropped.
- **Re-verifying** — `useSessionBootstrap` verifies once on mount and runs
  `watchUnverifiedSession()`, which re-asks while the session is authenticated but unverified, on
  the window's `online` event and on each successful planner-inputs pull (a server that was down
  while the network was up fires no `online`). A later refusal goes through `endSession()` like
  any other. A **verified** session is not re-asked: its expiry reaches the sync engine's refresh,
  which ends the session itself.
- **Known cost:** a session that expired while offline for longer than the refresh cookie lives
  ends on reconnect **with its unsynced outbox** — the server's refusal is the same verdict the
  refresh path already acts on.

**Implemented (auth slice):** `src/lib/http.ts` is the client — base URL from
`VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`; production `/api/v1`, same-origin
through the Worker proxy — see [architecture.md](architecture.md)), `credentials: 'include'`,
unwraps the standard `{ success, data, url, method }` envelope's `data`, and throws
`ApiError` (`src/lib/apiError.ts`)
carrying the backend's stable `code` + field `details`. The remote-only auth calls live in
`src/features/auth/api/authApi.ts` (register/login/logout/me) and map the wire `snake_case`
user to a `camelCase` `User` at the boundary. Session lives in `src/stores/session.ts`
(`status: loading|authenticated|anonymous`, plus `verified`), hydrated from the device's cached
user and verified through `GET /auth/me` — see [The offline session](#the-offline-session).

**Implemented (Wallets slice):** Dexie + the outbox/sync engine described here now exist —
`src/db/` (`db.ts`, `sync.ts`, `types.ts`) with tables `balanceNodes`, `balanceSettings`,
`exchangeRates`, `outbox`, plus optimistic mutations and the `409` rebase-and-retry loop.
This is the first synced entity; see [wallets.md](wallets.md) for the concrete realization.

## One entry, two rows: transfers

A transfer between wallets is the one outbox entity whose entry does not map to one local row.
`entity: 'transfer'` is keyed by the transfer id, and its push (`POST/PATCH/DELETE /transfers`)
writes **both** ledger legs, which share a `transferId` (indexed on `transactions`). The
optimistic write puts both legs and the entry in one Dexie transaction; the legs return through
the ordinary ledger delta, so there is no transfer stream or table. Its update carries a version
per leg inside the payload (`out_version`/`in_version`) rather than `baseVersion`, and only
`409 common.conflict` rebases; `409 spending.transfer.id_taken` is settled by a pull. Runs of
transfer creates and deletes go out in bulk (above); updates never do. See
[transactions.md](transactions.md#transfers-between-wallets).

## Exception: merchant identity (`409 merchants.alias.taken`)

Merchants (`features/merchants/`) sync through the normal outbox, with one branch
nothing else needs. Merchant identity is a per-user uniqueness constraint on the server, so two
devices inventing the same merchant offline must converge on one row. When `POST /merchants` is
refused with `409 merchants.alias.taken`, **nothing was written** — the client-generated id does
not exist server-side — and the server names the winning merchant in `details[0].value`. The
client adopts it: local rows are repointed, **still-queued transaction payloads are rewritten in
place** rather than earning a second op, only already-pushed rows get a `PATCH`, and the temp
merchant is dropped. `POST /merchants/merge` is the other exception: it is a server-side bulk
operation, so it is called directly and followed by a pull instead of being queued. Detail in
[merchants.md](merchants.md).

## Subtree deletes: categories and balance nodes

Two entities are trees — `balanceNodes` (groups holding wallets) and `categories`
(categories holding subcategories) — and the server deletes a subtree by cascade. The local
side has to mirror that exactly, and the pattern is the same in both
(`features/wallets/data/mutations.deleteNode`,
`features/categories/data/mutations.deleteCategory`):

1. Collect the subtree locally. Wallets walks to arbitrary depth; categories reads one
   level, because two is the cap ([categories.md](categories.md)).
2. In **one** Dexie transaction, **drop every descendant's pending outbox entries** and
   delete their local rows, then the root's.
3. Enqueue **one** `delete` op — for the subtree **root only**, and only if the root was
   ever synced. A root whose `create` is still queued just has its ops dropped; the server
   never heard of it.

Step 2 is the load-bearing one. A child's queued `create` that outlives its parent's delete
is pushed **after** the parent is gone and fails forever — a permanently stuck outbox entry
for a change the user already saw succeed. Dropping those ops inside the same transaction as
the local delete is what prevents it, and it is covered by explicit tests on both sides.

What was filed under the subtree follows the same rule as a wallet's dependants: the
server rewrites every dependant, and the local side mirrors it in the same Dexie transaction
**without** per-row outbox ops, rewriting only the payloads already queued. A category in use
must move (`move_to`); one not in use unlinks its config references
([categories.md](categories.md#moving-what-is-filed--datarefilets)).

**A rewritten reference must not overtake its target.** The outbox drains in `seq` order, so a
queued payload rewritten in place to name a category whose own `create` is queued _later_ would
reach the server first, be refused, and be dropped. When that is the case the row's entries are
deleted and re-added (in their order) behind the target's create.

**Remap on a create conflict.** A client-minted id is the one references are written with
before the server has seen it. When a category create comes back `409` because the server
already holds the same `(parent, slug)` — of the same type — under another id, every local
reference and queued payload is remapped onto the server's id before the local row is dropped
(a root of the other type is a different category: the local one re-slugs and retries)
([categories.md](categories.md#local-rows--sync)). Merchants have the same shape
(adopt-and-remap, [merchants.md](merchants.md)).

## Bulk writes: the CSV import

A CSV import is the one place hundreds of rows are written at once, so it bypasses the
per-row mutations without leaving the pattern (`features/import/data/commit.ts`):

- Entities the mapping promised to create (wallets, categories, merchants) are materialised
  **first**, through their owning feature's mutations. Wallets and merchants are created under
  the **exact id the rows already carry** (minted while mapping); a category is created under
  the slug minted while mapping, and the rows' placeholder `new-category:<parentId>:<slug>` id
  is swapped for the id that comes back. A failure here leaves nothing imported.
- Rows are then written in **200-row chunks**, one Dexie transaction per chunk
  (`bulkAddTransactions` in the transactions slice: `bulkPut` the rows, `bulkAdd` their outbox
  creates), yielding to the event loop between chunks so a 10 000-row import stays responsive.
- **One `schedulePush()` at the end** — never one per chunk, or an import becomes hundreds of
  debounce timers.
- Every imported row carries `source = 'csv:<batchId>'`, the same convention as an
  email path's `email:<connection_id>`. Dexie
  indexes `source`, which is what makes an import findable — and undoable — as a unit.
- `importBatches` is **local-only** (no outbox, no server table): the durable fact is the
  marker on the transactions, which _is_ synced, so an import committed on one device can be
  undone from another.
- **Undo** deletes through `bulkDeleteTransactions`, which drops a row whose create is still
  queued outright and queues a `delete` only for rows the server has seen — with
  `baseVersion: null`, since the bulk delete takes no versions. Those deletes leave as bulk
  batches like the creates did (**a 2 608-row undo is 3 requests and 4.0 s**), and like
  `bulkAddTransactions` this function schedules no push: the caller pushes once. A row whose
  `updatedAt` differs from its `createdAt` has been changed since and is **kept** — our writes
  set both stamps together and a server create returns them equal, so that difference is the
  only reliable signal. (Comparing against the batch's own `createdAt` would not work: once a
  row syncs its `updatedAt` is the server's clock, always later than the local commit stamp.)
  Wallets, categories and merchants an import created are deliberately kept too. An imported
  **transfer** is undone whole through `bulkDeleteTransfers` (grouped by `transferId`; kept whole
  if either leg changed) — the ledger's bulk delete refuses legs. The commit writes transfers
  after every ledger row, so each kind leaves as its own bulk run.

## Exception: import templates (`import.template.name_taken`)

Saved CSV mappings (`features/import/`, the `importTemplates` table) sync through the
ordinary outbox — `'importTemplate'` is an `OutboxEntity` with its branch in `db/sync.ts` — with
three things nothing else does:

- **`config` is an opaque JSON string on the wire**, stored and echoed back by the server
  byte-for-byte (cap 64 KiB) and never validated by it, so **the pull parses it tolerantly**. A blob
  that is not JSON, not an object, or missing a part the apply step reads is cached as
  `config: null` and shown as **"needs rebuilding"** — a corrupt blob is a row to rebuild, not a
  crash in the apply step. Such a row is still renamable and deletable, because `PATCH` is a true
  partial: a field that is omitted is left alone, so a mapping this client could not read is never
  overwritten by the act of renaming it.
- **`409 import.template.name_taken` is a _name_ conflict, not a version conflict.** Rebasing it
  would re-send the same refused name forever, so the push **parks** the row (`nameConflict: 1`) and
  drops the op; Settings → Data & privacy shows the row with "rename it to finish syncing", and
  renaming re-queues it (a `create` when the row has no `version`, since its create never landed).
  The same treatment the merchant alias 409 gets: surface, never loop.
- **A version 409 rebases the patch, not the row.** Because the endpoint is a true partial, the
  retry re-sends only the fields that op changed on the server's fresh `version` — a rename pushed
  from here does not undo a use bump made on the phone.

`lastUsedAt` / `useCount` are **client-maintained**: there is no "record a use" endpoint and no
server-side increment, so a use bump is an ordinary, rebasable `PATCH` queued like any other write.

## Offline

- Everything works offline: reads from local DB, writes queue in the outbox. On reconnect
  the engine flushes the outbox and pulls updates.
- **No push while the browser reports offline** (`navigator.onLine === false`): `flushOutbox`
  returns at once. A push then could only fail, and it would flag the head entry "couldn't
  reach the server", so the first row written offline showed a sync-failure badge for an
  expected state. Offline entries stay plainly pending (the offline pill counts them); the
  `online` listener flushes them. A connection that is up but can't reach the server still
  goes through the unavailable path above.
- **Sync activity** is counted in `db/syncActivity.ts`: `flushOutbox`'s drain and `pullAll`'s
  fan-out run inside `trackSync`, and `useSyncing()` is true while any of them is running.
  `trackSync` also records `lastSyncedAt` (a run finished without throwing) and
  `lastPassFailed` (the latest run threw — e.g. a pull that couldn't reach the server). One-off
  pulls outside `pullAll` (after onboarding, the review queue's delta) are deliberately left out.
- **The nav's sync status** (`useSyncStatus()` → `syncStatusOf` in `lib/syncStatus.ts`) folds
  that together with the outbox count and `tallyFailures()` (flagged entries by kind) into one
  state: `syncing` › `failed` (any rejected/unavailable entry, or `lastPassFailed`) › `waiting`
  (queued, no trouble) › `synced` › `connecting`. `SyncIndicator` shows it
  ([pwa-and-mobile.md](pwa-and-mobile.md#offline)); its Retry now is `syncNow()` in
  `db/syncRetry.ts` (`retryAllFailed()` plus a `pullAll()`).
- **The offline indicator exists**: `OfflineIndicator` in `TopNav`, with the outbox count
  (`usePendingChangeCount`). Actions that need the server are listed in
  [pwa-and-mobile.md](pwa-and-mobile.md#online-only-actions). It only reports being offline.
  The **global sync-trouble cue** is the sync cloud's alert state: it counts flagged entries of
  every entity (rows badge only for transactions, adjustments and transfer legs). Still owed: an
  op the outbox had to _park_ rather than retry (a name-conflicted import template, visible only
  on its Settings card) is not flagged, so the cloud doesn't count it.

## Exception: Email sync and inbound imports (online-only, server-owned cache)

Email sync (`features/email-sync/`, Dexie `emailConnections`) and the review queue it
stages into (`features/inbound-imports/`, Dexie `inboundImports`) are
server-owned and online-only — email sync talks to Gmail / Microsoft Graph — so they
**deliberately do not use the offline outbox**. The Dexie tables are a read cache of server truth: `data/cache.ts` pulls
replace the cached set, and `data/mutations.ts` call the API directly then update the cache
(settings / confirm / dismiss / disconnect / saveRules / completeOAuth). No `dirty`/`deleted`
flags. The staged imports are the exception within the exception: they are read as a **delta**
(see [Incremental pull](#incremental-pull-the-delta-streams) and
[inbound-imports.md](inbound-imports.md#refreshing-the-staged-set) for why).
`pullConnections()` still replaces the whole connection set, with a write generation (like
integration keys) so a list overtaken by a connect, save or disconnect is dropped; an inbox's
rules are fetched when its editor opens and never cached. Connecting is a provider OAuth
redirect → frontend callback route
`/settings/email-sync/callback` → `POST /email-connections/oauth/callback`; the scan is
client-triggered on login (`useEmailSyncBootstrap` → `POST /email-connections/sync`).
Confirming a staged import inserts the promoted transaction straight into the local
`transactions` ledger (clean, already-synced) so Wallets/Spending reflect it immediately.

**Integration keys** (`features/integrations/`, Dexie `integrationKeys`) follow the same
exception: server-minted, so a pull replaces the set and mutations call the API then cache —
with a write generation so an overtaken pull cannot undo a create. The secret is never cached.
See [integrations.md](integrations.md).

One thing is **deliberately not cached**: the stored body behind an import. It is fetched
per item when the user opens one (`useImportDetail`), because bodies are large and most imports
are never opened. See [inbound-imports.md](inbound-imports.md).

## Locked decisions (recap)

- **Local DB**: Dexie (IndexedDB). **No TanStack Query.**
- **IDs**: client-generated **UUIDv7** via `newId()` in `src/lib/uuid.ts` (records exist before
  first sync; matches backend PKs; the time prefix keeps server index inserts ordered). Older
  records keep their v4 ids. Planned occurrences are the exception — deterministic v5 ids
  (see [planned.md](planned.md)). Random-suffix uses (e.g. `uniqueSlug`) stay on
  `crypto.randomUUID()`: a v7's leading characters are the timestamp, not randomness.
- **Push**: event-driven + 30s safety flush only when the outbox is non-empty.
- **Pull**: always on app enter + reconnect + 5-min background interval. **Delta (cursor +
  watermark) for the collections that grow, full list for the bounded ones** — the full list is
  also the first sync and the resync fallback for the delta streams.
- **Conflicts**: whole-record **last-write-wins, client re-apply** (no field merge).
- **Money** in the local store matches the wire format exactly: integer minor units +
  ISO-4217 `currency` (root
  [api-contract-conventions.md](../../.agent-context/api-contract-conventions.md)).
- **`version`** is the backend's **sha256 string** (not an int) — store it as `string`; it's
  the opaque optimistic-lock base sent back on update. A not-yet-synced local record uses an
  empty-string placeholder until the first sync returns the server hash.
- **Enums** travel as UPPER_SNAKE strings on the wire (backend `PersistedEnum`). Map them to
  the app's internal representation at the wire boundary — e.g. node `kind` is `WALLET`/`GROUP`
  on the wire, `wallet`/`group` internally (`toWireKind`/`fromWireKind` in `balances/api/types.ts`).
- **Pagination**: page/limit, carried inside `data` (aligned with the backend).
