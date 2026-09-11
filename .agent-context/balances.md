# Balances — the first synced, local-first feature

The first domain feature, and the one that **landed the local DB + sync engine**. A tree of
**wallets** and **groups** with multi-currency totals in a switchable **base currency**.
Recreated from the Means `PlannerApp` design (pixel-faithful, light/dark, RTL-aware).
Domain terms: root [domain-glossary.md](../../.agent-context/domain-glossary.md).

## Local DB & sync (realizes [data-layer-and-sync.md](data-layer-and-sync.md))

- **Dexie** (`src/db/db.ts`, `dexie` + `dexie-react-hooks`): tables `balanceNodes`,
  `balanceSettings` (singleton key `'me'`), `exchangeRates`, and the `outbox`. Sync flags
  `dirty`/`deleted` stored as `0|1` (IndexedDB can't index booleans). `clearLocalDb()` runs
  on logout (`useLogout`) so the next user starts clean.
- **Sync engine** (`src/db/sync.ts`): `startSync()` (called once by each page) runs the
  pull-then-push loops + online/visibility/interval triggers and dispatches every synced
  entity (nodes/settings, plus the Goals `income`/`goal` entities — see [goals.md](goals.md)).
  Push drains the outbox debounced ~800ms with a 30s safety flush; pull is a full refresh
  that skips `dirty` records. `409` → pull, rebase the local edit on the server
  version, retry once, else accept server (whole-record LWW, client re-apply). Non-network
  4xx drops the bad op and lets a pull restore canonical state (no infinite loops).
- **Optimistic mutations** (`src/features/balances/data/mutations.ts`): write Dexie + queue
  a **coalesced** outbox entry (a pending create absorbs later edits; delete of a
  never-synced node just drops its queued ops). Server cascade means delete enqueues **one**
  op for the subtree root. IDs are client-generated UUIDs.

## Money & derivation (the brains)

- `src/lib/currency.ts` — currency metadata + `formatMoney`/`parseAmountToMinor`/
  `convertMinor`. Money is integer **minor units** + ISO-4217 end to end; formatting (via
  `Intl`) and FX conversion happen only here. Totals are computed client-side, not fetched.
- `src/features/balances/data/selectors.ts` — pure `buildBalancesView(nodes, base, rates,
walletDeltas?, reservations?)` builds the flattened tree (honoring collapse), grand total,
  per-currency breakdown, and top-level bars. `groupParentOptions` powers the "Place inside"
  picker (excludes self + descendants). Unit-tested in `selectors.test.ts` / `currency.test.ts`.
- **Reserved vs available (goal earmarks).** The 5th arg, `reservations` (per-wallet reserve
  lines from goals' `walletReservations` — see [goals.md](goals.md)), splits each wallet into
  `reserved`/`available`, with a per-goal `reservations[]` breakdown; groups roll the figures up
  in base currency, and the view exposes `reservedTotal` + `availableTotalStr`. `useBalances`
  reads `goals` + `goalAllocations` to build the reserves. Wallet money is **earmarked in
  place** — the balance and grand total are unchanged; reserving only reclassifies part of a
  wallet as spoken-for. **Over-reserving is allowed**: reserved is _not_ capped at the balance,
  so `available` can go **negative** and the row carries `overReserved` (rendered red). The goal
  editor warns first (red box + "Save anyway"), comparing each wallet's live balance against its
  reserves from all goals (`reservedByWallet`) plus the draft's rows.

## UI & wiring

- Feature lives in `src/features/balances/` (`api/`, `data/`, `hooks/`, `components/`,
  `constants.ts`). `useBalances` is the reactive read (`useLiveQuery`); `useNodeEditor`
  drives the add/edit sheet. Components are dumb; `BalancesPage` composes them.
- Recreated shell: the **shared chrome** now lives in `src/components/chrome/` (`TopNav`,
  `MobileTabBar`, `AccountMenu`, `BrandMark`, `sections.ts`), section-aware via an `active`
  prop and reused by both Balances and Goals — Balances/Goals nav items navigate (TanStack
  `Link`), Budget is disabled. Balances-specific UI: `TotalHeroCard`, `WalletsGroupsCard`
  (+ `GroupRow`/`WalletRow`), the rail (`CurrencyBreakdownCard`, `BaselineTeaserCard`), and
  `NodeEditor` (centered modal on desktop, bottom sheet on mobile). A wallet with reserves shows
  an `available · reserved` toggle line and **expands** (collapse state is local to
  `WalletsGroupsCard`, not synced) to list its per-goal reserve breakdown; `TotalHeroCard` shows
  the overall available/reserved split when anything is reserved. `ExchangeRatesCard` exists
  but is **not** mounted on the page (FX editing belongs to Settings). `BaselineTeaserCard`
  reads `useGoals().view.savedGoalsPct` — it shows real saved-toward-target progress once a
  goal with a target exists, and just the message (no bar) otherwise.
- Route `/balances` (guarded like the auth routes); the index redirects authenticated users
  there (it replaced the old `SignedInHome` placeholder). API types/mappers in
  `api/types.ts`, calls in `api/balancesApi.ts` (the HTTP client gained `patch`/`del`).
