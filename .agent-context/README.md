# Frontend Knowledge Base (`.agent-context/`)

Frontend-internal, slow-to-change technical knowledge. The technical counterpart to the
root product [`.agent-context/`](../../.agent-context/). Keep
[`../CLAUDE.md`](../CLAUDE.md) short and point here.

## Index

- [architecture.md](architecture.md) — local-first SPA model, layering, feature/page
  folder structure, data flow.
- [data-layer-and-sync.md](data-layer-and-sync.md) — local DB (Dexie/IndexedDB), the
  outbox/sync engine, bulk push, the incremental (delta) pull and its watermarks, optimistic
  updates, conflict (`409`) handling, the silent refresh on `401`, and the offline session
  (the cached user, what signs out and what doesn't).
- [wallets.md](wallets.md) — the Wallets feature (first synced entity): how the Dexie +
  sync engine, money/derivation, and the recreated UI are realized; the transfer and
  adjust-balance dialogs.
- [goals.md](goals.md) — goals and income streams: the kind-less goal shape, progress from
  set-asides, paydays and cadence (data only — the screens are Planning's).
- [bills.md](bills.md) — bills (once or repeating, must pay / nice to have): the entity, its
  full-representation sync, the mutations and the cross-entity cascades.
- [set-asides.md](set-asides.md) — set-asides: labels on money in real wallets for a bill or
  goal, live vs released, the mutations and the pure totals (wallet pots, per-owner sums).
- [transactions.md](transactions.md) — the Spending feature: the ledger + budgets (per-paycheck
  windows, "Leave out planned bills"),
  the catalog-taking selectors, client-side derivation of wallet balances & goal contributions,
  settlement links to planned rows, and transfers between wallets (two linked legs, the `transfer` outbox entity, the
  collapsed activity row and its scope rules, exclusion from totals), and balance adjustments
  (`adjustment_in`/`adjustment_out` rows outside every total).
- [planning.md](planning.md) — Planning (`features/planning/`): pay periods from the main
  paycheck, the two-tier funding engine, money actions and the pure view models — and the
  Planning page built on them (`/planning/$section`: shell, chooser, editors, Overview,
  Upcoming + payday review, Bills/Goals/Income lists, detail panels, anytime-action sheets).
- [planned.md](planned.md) — Planned transactions: the entity and its derived settled amount,
  deterministic UUIDv5 ids, the generator and reconciler, the app-level planner (fill /
  recalc + undo, orphan resolution), settlement mutations, the id-taken sync branch, the hooks
  Planning reads, the confirm dialog and Activity's nudge.
- [reports.md](reports.md) — Reports: the URL-held period/comparison/accounts, the preset
  periods and comparison windows, the windowed read + pre-period balance, and the pure builders
  (summary, balance strip, trend buckets, category breakdown, largest expenses, the Needs /
  Wants / Savings card and the reusable `needsWantsSummary`).
- [search.md](search.md) — app-level search: the top-bar trigger + shortcut, the sheet, the
  Everywhere / current-tab scope, the on-device index and filters, and the `?open=` hand-off.
- [categories.md](categories.md) — Categories: the two-level model, the synced tree and its
  Dexie/sync branch, `buildCatalog` and the `CategoryCatalog` every surface reads (incl. the
  inherited Needs / Wants / Savings tag, `classOf`, and its Settings chip), the shared
  searchable `CategoryPicker`, the Settings list/editor, and the subtree-aware delete.
- [onboarding.md](onboarding.md) — the `/setup` first-run wizard: `SessionGate`, the
  sessionStorage draft, starter packs over the category catalog, the one commit call, the
  inbox connect round trip.
- [passkeys.md](passkeys.md) — Passkeys: the login button and email-field autofill, adding one
  (re-auth by password or Google + the resume round trip), the one-time post-sign-in offer, and
  Settings › Sign-in & security.
- [settings.md](settings.md) — the Settings page (avatar-menu route): profile editing, synced
  copy-on-write categories, editable FX rates, and the local preferences store.
- [merchants.md](merchants.md) — Merchants: the shared `normalizeKey` port, the scored local
  matcher, `auto_categorize`, and the adopt-and-remap sync branch.
- [email-sync.md](email-sync.md) — the Email sync feature: inboxes and their ordered email
  rules, the rule editor (grouped samples, learned templates, filter test), Sync now, and how an
  inbox feeds the shared review queue.
- [inbound-imports.md](inbound-imports.md) — the shared review queue every automatic source
  stages into: reviewing against the stored body, filling in a failed parse, merchant learning,
  the delta pull, and why the queue is its own slice.
- [integrations.md](integrations.md) — Integrations: webhook keys (server-minted, online-only,
  Dexie read cache), the shown-once secret, key health/expiry, the settings editor, and the
  rule editor: the reducer, tap-to-bind with generated patterns, the payload tree's keyboard
  contract, the debounced dry run, reorder; the delivery log (refusals, per-field report, build
  a rule from a delivery) and the throttled-key notice.
- [import.md](import.md) — Import: the on-device CSV pipeline (worker → mapping → review →
  commit), transfers and balance adjustments found in a file (pairing, lone sides, coupling),
  saved templates, batches and undo, the review grid's virtualisation contract, and what the
  wizard costs.
- [app-config.md](app-config.md) — `GET /config`: the open ISO-4217 currency table, the
  bundled snapshot + cache order, live rates and the auto-update opt-out, the user's **own
  currencies**, rate precedence, and the server limits.
- [state-management.md](state-management.md) — Zustand vs. server cache vs. local DB; what
  state lives where.
- [routing.md](routing.md) — TanStack Router structure and patterns, incl. the routed
  `/settings/*` panes.
- [icons.md](icons.md) — Icons: the generated Phosphor pack and its manifest/generator, the
  lazy path + search chunks, `<Icon>` / `IconChip` / `IconPicker`, the fallback table, and the
  chrome-vs-content rule.
- [styling-and-theming.md](styling-and-theming.md) — Tailwind v4, the `fp-` design tokens,
  light/dark, privacy mode (`.fp-sensitive`), **RTL/LTR** support, and the shadcn/Radix layer (the direction provider, the
  logical-property conversions, and what stays physical), and the **dialog kit** (`src/components/dialog/`: field wells, amount well, chips, confirm/discard/done patterns, the side pane).
- [pwa-and-mobile.md](pwa-and-mobile.md) — PWA: `vite-plugin-pwa` config, the precache and
  its no-glob rule, the update prompt, persistent storage, hosting requirements; offline (the
  nav's offline pill, the online-only actions list and `OfflineNotice`), native-like mobile,
  responsive/platform-specific nav.
- [conventions.md](conventions.md) — component size, naming, structure, style.

## How to use this directory

- **Read** before non-trivial frontend work.
- **Update** in the same change when a pattern or decision changes.
- **Add** a file for a new durable concern and link it here.
- Defer product/domain meaning to the root [`.agent-context/`](../../.agent-context/);
  this dir is implementation.
