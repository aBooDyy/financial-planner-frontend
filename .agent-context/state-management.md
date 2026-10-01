# State Management

Two kinds of state, two homes. Putting state in the wrong place is the most common
source of bugs and re-renders — be deliberate. (There is intentionally **no TanStack
Query / server-cache layer** — see below.)

## 1. Persistent domain data → **Local DB (Dexie)**

- Accounts, transactions, categories, budgets, bills, goals — anything synced and persisted.
- The **source of truth for the UI**. Read reactively (`useLiveQuery`).
- When many components on one screen need the same large read *and* an expensive derivation
  of it, share both instead of reading per component: a module-level store over Dexie
  `liveQuery` (one query per table, opened by the first subscriber, closed by the last),
  consumed with `useSyncExternalStore`, with the derivation memoised on the arrays' identity.
  No provider, so it works in any tree and in tests. The planner's `usePlannedData` is the
  example ([planned.md](planned.md)).
- Never duplicate this into Zustand. Derive views from the DB query instead.
- See [data-layer-and-sync.md](data-layer-and-sync.md).

## 2. Client / UI state → **Zustand**

- Ephemeral or UI-only state that isn't server data: theme, **direction (RTL/LTR)**,
  current session/user summary, sidebar/sheet open state, active filters, wizard steps,
  toasts, sync status indicator.
- Small, focused stores — one per concern, not a single mega-store (single responsibility).
- Co-locate feature-specific stores under `features/<feature>/stores/`; truly global stores
  (theme, direction, session) live in `src/stores/`.
- Select narrowly (`useStore(s => s.x)`) to avoid needless re-renders. Keep actions in the
  store; components call them.
- Persist only what should survive reload (e.g. theme, direction) via Zustand `persist`.
  Do **not** persist domain data here — that's the DB's job.
- **Per-session UI memory** goes to **sessionStorage** (`createJSONStorage(() => sessionStorage)`),
  not localStorage: `useEntrySession` (last entry wallet/day, Spending filter — see
  [transactions.md](transactions.md)) and the onboarding draft. A closed home-screen app loses it.
- **The session store persists its user by hand** (`stores/cachedUser.ts`, localStorage key
  `fp-session-user`), not with `persist`: the store is _created_ from it synchronously, so a
  device that has one renders the app on the first frame, and `status`/`verified` are derived
  from whether it was there rather than restored. See
  [data-layer-and-sync.md](data-layer-and-sync.md#the-offline-session).

## Server data → handled by the data layer, not a cache library

- There is **no TanStack Query**. Synced domain data lives in the local DB; the sync engine
  (`src/db/`) handles push/pull and online/offline status. See
  [data-layer-and-sync.md](data-layer-and-sync.md).
- The few remote-only calls (auth) use the HTTP client in `src/lib/` + the session Zustand
  store — no server-cache layer needed.
- Why: a server cache over a local-first DB is a redundant second cache; two caches of the
  same entities drift apart. One source of truth, always.

## Rules of thumb

- "Is it persisted and synced?" → Local DB.
- "Is it UI/ephemeral or a global toggle?" → Zustand.
- "Is it a one-off remote call (auth)?" → HTTP client in `src/lib/` + session store.
- Derive, don't duplicate. If two stores can disagree, you've created a bug.
