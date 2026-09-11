# Frontend Knowledge Base (`.agent-context/`)

Frontend-internal, slow-to-change technical knowledge. The technical counterpart to the
root product [`.agent-context/`](../../.agent-context/). Keep
[`../CLAUDE.md`](../CLAUDE.md) short and point here.

## Index

- [architecture.md](architecture.md) — local-first SPA model, layering, feature/page
  folder structure, data flow.
- [data-layer-and-sync.md](data-layer-and-sync.md) — local DB (Dexie/IndexedDB), the
  outbox/sync engine, optimistic updates, conflict (`409`) handling.
- [balances.md](balances.md) — the Balances feature (first synced entity): how the Dexie +
  sync engine, money/derivation, and the recreated UI are realized.
- [goals.md](goals.md) — the Goals planning feature: income streams + ranked goals, the
  client-side funding engine, and the shared chrome (`src/components/chrome/`).
- [transactions.md](transactions.md) — the Spending feature: the ledger + budgets + recurring,
  the category catalog, client-side derivation of wallet balances & goal contributions, autopost.
- [settings.md](settings.md) — the Settings page (avatar-menu route): profile editing, synced
  copy-on-write categories, editable FX rates, and the local preferences store.
- [email-sync.md](email-sync.md) — the Email sync feature: the connect/map wizard, reviewing a
  staged import against the stored email, filling in a failed parse, merchant learning.
- [state-management.md](state-management.md) — Zustand vs. server cache vs. local DB; what
  state lives where.
- [routing.md](routing.md) — TanStack Router structure and patterns.
- [styling-and-theming.md](styling-and-theming.md) — Tailwind v4, the `fp-` design tokens,
  light/dark, and **RTL/LTR** support.
- [pwa-and-mobile.md](pwa-and-mobile.md) — PWA/service worker, offline, native-like mobile,
  responsive/platform-specific nav.
- [conventions.md](conventions.md) — component size, naming, structure, style.

## How to use this directory

- **Read** before non-trivial frontend work.
- **Update** in the same change when a pattern or decision changes.
- **Add** a file for a new durable concern and link it here.
- Defer product/domain meaning to the root [`.agent-context/`](../../.agent-context/);
  this dir is implementation.
