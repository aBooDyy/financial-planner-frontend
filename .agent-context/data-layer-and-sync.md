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

- One Dexie table per synced entity (accounts, transactions, categories, budgets,
  obligations…), keyed by the server **id** (use client-generated UUIDs so records exist
  before first sync).
- Each record stores the server **`version`** and local sync metadata: `dirty` (has
  unsynced local changes), `deleted` (tombstone), `updated_at`.
- An **`outbox`** table holds pending mutations to push (op, entity, id, payload, base
  version, timestamp).

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

## Sync engine

- **Push**: drain the outbox to the backend. Each mutation includes the **base `version`**.
  - `2xx` → store the returned record + new `version`, clear `dirty`, remove from outbox.
  - **`409` conflict** → the server row moved on. Reconcile (see below).
  - Network error → keep in outbox, retry with backoff.
- **Pull**: fetch server changes since the last sync cursor (`updated_at`/`version`) and
  upsert into local tables, **unless** the local record is `dirty` (then it's a conflict).
- **Cadence (locked):**
  - **Push is event-driven**: fire right after a local write (debounced ~1s to batch
    bursts). A periodic **30s** flush is only a safety net and **runs only when the outbox
    is non-empty** — nothing to push ⇒ no request at all.
  - **Pull runs always on app enter**, on reconnect, and otherwise on a **longer background
    interval (5 min)**. Pull is incremental (cursor-based), never a full re-pull.
  - Push and pull are independent loops; a local write triggers a push, not a pull.
- Coalesce/debounce; never run overlapping syncs; single-flight each loop.

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
  - This never silently discards the user's own latest intent. If a retry still conflicts
    repeatedly, **surface it** to the user rather than looping.

## Auth & HTTP

- Single HTTP client in `src/lib/`. All requests use **`credentials: 'include'`** so the
  **HTTP-only auth cookie** is sent. The app **never** reads the token in JS.
- On `401`, stop sync, clear session state, route to login. On reconnect/login, resume sync.

**Implemented (auth slice):** `src/lib/http.ts` is the client — base URL from
`VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`), `credentials: 'include'`,
unwraps the standard `{ success, data, url, method }` envelope's `data`, and throws
`ApiError` (`src/lib/apiError.ts`)
carrying the backend's stable `code` + field `details`. The remote-only auth calls live in
`src/features/auth/api/authApi.ts` (register/login/logout/me) and map the wire `snake_case`
user to a `camelCase` `User` at the boundary. Session lives in `src/stores/session.ts`
(`status: loading|authenticated|anonymous`), bootstrapped once via `GET /auth/me`.

**Implemented (Balances slice):** Dexie + the outbox/sync engine described here now exist —
`src/db/` (`db.ts`, `sync.ts`, `types.ts`) with tables `balanceNodes`, `balanceSettings`,
`exchangeRates`, `outbox`, plus optimistic mutations and the `409` rebase-and-retry loop.
This is the first synced entity; see [balances.md](balances.md) for the concrete realization.

## Offline

- Everything works offline: reads from local DB, writes queue in the outbox. On reconnect
  the engine flushes the outbox and pulls updates. Surface a subtle sync/offline indicator.

## Exception: Email sync (online-only, server-owned cache)

Email sync (`features/email-sync/`, Dexie **v5**: `emailConnections` + `emailImports`) is
inherently online — it talks to Gmail / Microsoft Graph — so it **deliberately does not use
the offline outbox**. The Dexie tables are a read cache of server truth: `data/cache.ts` pulls
replace the cached set, and `data/mutations.ts` call the API directly then update the cache
(toggle / confirm / dismiss / disconnect / saveRules / completeOAuth). No `dirty`/`deleted`
flags. Connecting is a provider OAuth redirect → frontend callback route
`/settings/email-sync/callback` → `POST /email-connections/oauth/callback`; the scan is
client-triggered on login (`useEmailSyncBootstrap` → `POST /email-connections/sync`).
Confirming a pending import inserts the promoted transaction straight into the local
`transactions` ledger (clean, already-synced) so Balances/Spending reflect it immediately.

One thing is **deliberately not cached**: the stored email body behind an import. It is fetched
per item when the user opens one (`useImportDetail`), because bodies are large and most imports
are never opened. See [email-sync.md](email-sync.md).

## Locked decisions (recap)

- **Local DB**: Dexie (IndexedDB). **No TanStack Query.**
- **IDs**: client-generated **UUIDs** (records exist before first sync; matches backend PKs).
- **Push**: event-driven + 30s safety flush only when the outbox is non-empty.
- **Pull**: always on app enter + reconnect + 5-min background interval, cursor-incremental.
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
