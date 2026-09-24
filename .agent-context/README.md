# Frontend Knowledge Base (`.agent-context/`)

Frontend-internal, slow-to-change technical knowledge. The technical counterpart to the
root product [`.agent-context/`](../../.agent-context/). Keep
[`../CLAUDE.md`](../CLAUDE.md) short and point here.

## Index

- [architecture.md](architecture.md) — local-first SPA model, layering, feature/page
  folder structure, data flow.
- [data-layer-and-sync.md](data-layer-and-sync.md) — local DB (Dexie/IndexedDB), the
  outbox/sync engine, bulk push, the incremental (delta) pull and its watermarks, optimistic
  updates, conflict (`409`) handling, and the silent refresh on `401`.
- [balances.md](balances.md) — the Balances feature (first synced entity): how the Dexie +
  sync engine, money/derivation, and the recreated UI are realized.
- [goals.md](goals.md) — the Goals planning feature: income streams + ranked goals, the
  client-side funding engine, and the shared chrome (`src/components/chrome/`).
- [transactions.md](transactions.md) — the Spending feature: the ledger + budgets + recurring,
  the catalog-taking selectors, client-side derivation of wallet balances & goal contributions,
  settlement links to planned rows, and transfers between wallets (two linked legs, the `transfer` outbox entity, the
  collapsed activity row and its scope rules, exclusion from totals).
- [planned.md](planned.md) — Planned transactions: the entity and its derived settled amount,
  deterministic UUIDv5 ids, the generator and reconciler, the app-level planner (fill /
  recalc + undo, auto-post), settlement mutations, the id-taken sync branch, the hooks the
  Planned tab and goal detail read, and the Planned tab + confirm dialog components.
- [categories.md](categories.md) — Categories: the two-level model, the synced tree and its
  Dexie/sync branch, `buildCatalog` and the `CategoryCatalog` every surface reads, the Settings
  list/editor, and the subtree-aware delete.
- [settings.md](settings.md) — the Settings page (avatar-menu route): profile editing, synced
  copy-on-write categories, editable FX rates, and the local preferences store.
- [merchants.md](merchants.md) — Merchants: the shared `normalizeKey` port, the scored local
  matcher, `auto_categorize`, and the adopt-and-remap sync branch.
- [email-sync.md](email-sync.md) — the Email sync feature: the connect/map wizard, scanning on
  demand, and how an inbox feeds the shared review queue.
- [inbound-imports.md](inbound-imports.md) — the shared review queue every automatic source
  stages into: reviewing against the stored body, filling in a failed parse, merchant learning,
  the delta pull, and why the queue is its own slice.
- [integrations.md](integrations.md) — Integrations: webhook keys (server-minted, online-only,
  Dexie read cache), the shown-once secret, key health/expiry, the settings editor, and the
  rule editor: the reducer, tap-to-bind with generated patterns, the payload tree's keyboard
  contract, the debounced dry run, reorder; the delivery log (refusals, per-field report, build
  a rule from a delivery) and the throttled-key notice.
- [import.md](import.md) — Import: the on-device CSV pipeline (worker → mapping → review →
  commit), saved templates, batches and undo, the review grid's virtualisation contract, and what
  the wizard costs.
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
  light/dark, **RTL/LTR** support, and the shadcn/Radix layer (the direction provider, the
  logical-property conversions, and what stays physical).
- [pwa-and-mobile.md](pwa-and-mobile.md) — PWA/service worker, offline, native-like mobile,
  responsive/platform-specific nav.
- [conventions.md](conventions.md) — component size, naming, structure, style.

## How to use this directory

- **Read** before non-trivial frontend work.
- **Update** in the same change when a pattern or decision changes.
- **Add** a file for a new durable concern and link it here.
- Defer product/domain meaning to the root [`.agent-context/`](../../.agent-context/);
  this dir is implementation.
