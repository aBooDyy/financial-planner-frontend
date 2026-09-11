# Financial Planner — Frontend Guide

Local-first **PWA SPA** for the Financial Planner (Vite + React). Read the **root guide**
first: [`../CLAUDE.md`](../CLAUDE.md) (product, global principles, contract). This file
governs frontend conventions; deep technical detail lives in
[`.agent-context/`](.agent-context/).

## `.agent-context/` — frontend knowledge base — read & keep current

Slow-to-change frontend internals live in [`.agent-context/`](.agent-context/). Read the
relevant file before non-trivial work; update it in the same change when a decision or
pattern changes. Index: [`.agent-context/README.md`](.agent-context/README.md).

- [architecture.md](.agent-context/architecture.md) — local-first SPA model, layers, folder structure.
- [data-layer-and-sync.md](.agent-context/data-layer-and-sync.md) — local DB (Dexie/IndexedDB), the sync engine, conflict handling.
- [state-management.md](.agent-context/state-management.md) — Zustand stores vs. server cache vs. local DB; who owns what.
- [routing.md](.agent-context/routing.md) — TanStack Router structure, feature/page routing.
- [styling-and-theming.md](.agent-context/styling-and-theming.md) — Tailwind, the `fp-` design tokens, light/dark, **RTL/LTR**.
- [pwa-and-mobile.md](.agent-context/pwa-and-mobile.md) — PWA setup, offline, native-like mobile UX, responsive nav.
- [email-sync.md](.agent-context/email-sync.md) — Email sync: the connect/map wizard, import review against the stored email, merchant learning.
- [conventions.md](.agent-context/conventions.md) — component size, naming, structure, style.

## Tech stack

- **Vite + React 19**, TypeScript — built as a **standard client-rendered SPA, no SSR**.
  (The scaffold shipped TanStack **Start**; we deliberately run plain Vite. Rationale &
  migration steps in [architecture.md](.agent-context/architecture.md).)
- **TanStack Router** (routing) — used in client/SPA mode.
- **Zustand** for client/UI state.
- **No TanStack Query** — in a local-first app it would be a redundant second cache over
  the local DB. Domain reads come from reactive local-DB queries; the few remote-only calls
  (auth) use a thin HTTP client. Rationale in
  [data-layer-and-sync.md](.agent-context/data-layer-and-sync.md).
- **Dexie.js** (IndexedDB) as the **local-first database** — chosen for its mature
  IndexedDB ergonomics and a clean fit with our custom FastAPI sync + version locking.
  Rationale & alternatives in [data-layer-and-sync.md](.agent-context/data-layer-and-sync.md).
- **Tailwind CSS v4** with project design tokens (all custom tokens use the **`fp-`** prefix).
- **shadcn/ui** (Radix-based) for UI primitives, in `src/components/ui/`, restyled to the
  `fp-`/Means tokens via a token bridge in `theme.css`. Use shadcn for anything it provides;
  modals use the shared `ResponsiveDialog` (Dialog on desktop, vaul Drawer on mobile). Details
  in [.agent-context/styling-and-theming.md](.agent-context/styling-and-theming.md#shadcnui-integration).
- **PWA** with a service worker; installable, offline-capable, native-feel on mobile.
- **Auth via HTTP-only cookies** — the app never reads the token; requests use
  `credentials: 'include'`.

## Core principles (frontend)

- **Local-first.** UI reads from and writes to the **local DB** first; changes queue and
  **sync** to the backend in the background on a reasonably frequent cadence. The app is
  fully usable offline and feels instant.
- **Single responsibility, smallest components possible.** Decompose aggressively. A
  component renders one thing; logic lives in hooks; data access lives in the data layer.
- **Feature-based + page-based structure.** Features own their components/hooks/stores;
  pages/routes compose them. See [architecture.md](.agent-context/architecture.md).
- **RTL is first-class.** Every layout works in **both RTL and LTR**. Use logical
  properties and direction-aware patterns from day one — never hard-code left/right.
- **Light & dark themes**, driven by the `fp-` token system.
- **Responsive, platform-aware.** Desktop and mobile can differ meaningfully (e.g.
  **different nav bars**); mobile should feel like a native app.
- **SOLID / DRY / clean code**, minimal non-stale comments — see [`../CLAUDE.md`](../CLAUDE.md).

## Suggested folder structure

```
financial-planner-frontend/
├── CLAUDE.md
├── .agent-context/
└── src/
    ├── routes/                 # TanStack Router route tree (pages compose features)
    ├── features/               # feature modules — the bulk of the app
    │   └── <feature>/
    │       ├── components/     # small, single-responsibility components
    │       ├── hooks/          # feature logic (queries, mutations, derived state)
    │       ├── stores/         # zustand stores scoped to the feature (if needed)
    │       └── api/            # feature's API calls + contract types
    ├── components/             # shared, generic UI primitives (direction/theme-aware)
    ├── db/                     # Dexie schema, local tables, sync engine, outbox
    ├── lib/                    # cross-cutting utils (http client, i18n, money, dates)
    ├── stores/                 # global zustand stores (theme, direction, session)
    └── styles/                 # tailwind entry + fp- token theme
```

The scaffold shipped as TanStack **Start**; the app is being run as a plain **local-first
SPA (no SSR)** — see the rendering-model decision and migration steps in
[architecture.md](.agent-context/architecture.md). Evolve the structure toward the tree
above and record deviations there.

## Common commands

```bash
pnpm install
pnpm dev               # vite dev server (port 3000)
pnpm build
pnpm test              # vitest
pnpm lint / pnpm format
pnpm generate-routes   # TanStack Router codegen
```

> Keep this guide and `.agent-context/` current as the frontend takes shape.
