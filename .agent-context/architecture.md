# Frontend Architecture — Local-First SPA

A single-page React app that is **local-first**: the UI talks to a **local database**, and
a background **sync engine** reconciles with the backend. The network is an enhancement,
not a requirement.

## Data flow

```
        ┌──────────── UI (React components) ────────────┐
        │  read via useLiveQuery      write via actions  │
        ▼                                                ▼
            Local DB (Dexie/IndexedDB)  ─────────────────┐
                       ▲                                  │ enqueue change
                       │ apply server truth               ▼
                 ┌─────┴────────────────────────────────────┐
                 │              Sync engine                  │
                 │       (outbox push + pull/merge)          │
                 └─────────────┬────────────────────────────┘
                               │ HTTP (cookies)
                               ▼
                          FastAPI backend
```

- **Reads**: components read from the **local DB** (reactively, via Dexie `useLiveQuery`).
  The UI never blocks on the network. There is **no TanStack Query** layer — the local DB is
  the cache and the source of truth; a second cache would only create disagreement.
- **Writes**: components write to the local DB **immediately** and enqueue the change in an
  **outbox**; the sync engine pushes it to the backend later.
- **Sync**: the engine pushes queued changes and pulls server updates on a reasonably
  frequent cadence (and on reconnect/focus). Conflicts use the backend's `version`/`409`.
  Detail in [data-layer-and-sync.md](data-layer-and-sync.md).

## Layers

1. **Routes/pages** (`src/routes/`) — TanStack Router tree. Pages compose features; they
   hold layout and wiring, not business logic.
2. **Features** (`src/features/<feature>/`) — the bulk of the app. Each feature owns its
   `components/`, `hooks/`, optional `stores/`, and `api/`. Features are self-contained and
   don't reach into each other's internals.
3. **Shared UI** (`src/components/`) — generic, presentational, theme- and direction-aware
   primitives (Button, Card, Sheet…). No feature/business knowledge.
4. **Data layer** (`src/db/`) — Dexie schema, local tables, outbox, sync engine, and the delta
   watermarks the incremental pulls resume from.
5. **Cross-cutting** (`src/lib/`, `src/stores/`) — http client, i18n, money/date utils,
   global Zustand stores (theme, direction, session).

## Folder structure (target)

```
src/
├── routes/            # page composition (TanStack Router)
├── features/<feature>/{components,hooks,stores,api}/
├── components/        # shared primitives
├── db/                # dexie schema + sync engine + outbox
├── lib/               # http, i18n, money, dates, formatters
├── stores/            # global zustand stores
└── styles/            # tailwind entry + fp- tokens
```

## Principles

- **Smallest components possible**, single responsibility. Presentational components stay
  dumb; logic lives in hooks; data access lives in the data layer.
- **Feature isolation.** Cross-feature sharing goes through `components/`, `lib/`, or the
  data layer — never deep imports into another feature.
- **Unidirectional flow.** UI → action → local DB → (sync) → server; server truth flows
  back into the local DB → reactive reads → UI.
- **No business logic in components or routes.** It belongs in hooks/feature modules.

## Rendering model — client-only SPA, no SSR (locked)

The app is a **standard client-rendered SPA**. **No SSR, no Node server in production** —
`vite build` emits static assets served from any CDN/static host with an SPA fallback to
`index.html`. The only backend is FastAPI.

**Hosting (Cloudflare Workers, static assets):** the Worker `means` serves `dist/` per
`wrangler.jsonc`, whose `not_found_handling: "single-page-application"` is the SPA fallback:
a path with no file behind it (e.g. `/auth/login`) gets `index.html`, while real files
(assets, icons, manifest) are served as-is. Without it a deep link or refresh hits
Cloudflare's "There is nothing here yet" 404. Don't add a `public/_redirects` catch-all
(`/* /index.html 200`): Workers rejects it as an infinite loop and the deploy fails.

**API proxy (`worker/index.ts`):** `run_worker_first: ["/api/*"]` sends only API paths
through the Worker script, which forwards them (method, headers, body, cookies both ways;
`redirect: 'manual'`) to the `BACKEND_ORIGIN` var, the Cloud Run URL. It exists for the
cookies: `workers.dev` and `run.app` are different sites, so a direct call makes the auth
cookies third-party (blocked by Safari/iOS; dropped under `SameSite=Strict` everywhere).
Through the proxy they are first-party and the backend keeps `SameSite=Strict`. The Worker
sets `X-Forwarded-For` to `CF-Connecting-IP` so the backend's per-IP auth limits see the
user, not Cloudflare. `BACKEND_ORIGIN` lives in the dashboard (Settings → Variables), which
`keep_vars: true` stops a deploy from wiping; unset, `/api/*` answers `500`. Production
builds must set the build variable `VITE_API_BASE_URL=/api/v1` (dashboard → Build), or the
bundle calls the `http://localhost:8000` default. Only `/api/*` counts against the Workers request
quota; static assets don't.

**Cache headers (`public/_headers`):** `no-cache` on `sw.js`, `index.html` and
`manifest.webmanifest`, immutable on `/assets/*` — what the service worker's update flow needs;
see [pwa-and-mobile.md](pwa-and-mobile.md#hosting-requirements).

**Why (not SSR):** data lives in the browser's IndexedDB (local-first), so the server can't
render real data anyway — SSR would paint an empty shell the client immediately re-fills
from the local DB. An offline-capable PWA loads from cached static assets via the service
worker, which is exactly what a static SPA is. SSR would add a Node deployment, hydration
concerns, and server features we don't use.

### Migration off TanStack Start (the scaffold) → plain Vite SPA

The scaffold shipped with TanStack **Start**. Convert it to plain Vite + TanStack Router.
No server entry files exist yet, so this is clean:

1. **Remove Start deps** from `package.json`: `@tanstack/react-start`,
   `@tanstack/react-router-ssr-query`, and the `@tanstack/devtools-vite` /
   `@tanstack/react-start/plugin/vite` wiring. **Keep** `@tanstack/react-router`,
   `@tanstack/router-plugin`, `@tanstack/router-cli`, and the devtools packages.
2. **`vite.config.ts`**: drop `tanstackStart()`; use the file-based routing plugin
   `tanstackRouter()` from `@tanstack/router-plugin/vite` (before `viteReact()`), keep
   `tailwindcss()`, and add `VitePWA()` (see [pwa-and-mobile.md](pwa-and-mobile.md)).
3. **Add `index.html`** at the project root: `<head>` with charset/viewport/title, a
   `<div id="app"></div>`, and `<script type="module" src="/src/main.tsx"></script>`. The
   head tags currently in `__root.tsx`'s `head()` move here.
4. **Add `src/main.tsx`**: import `./styles.css`, build the router, and
   `createRoot(document.getElementById('app')!).render(<RouterProvider router={router} />)`.
5. **Simplify `src/router.tsx`**: export a plain `createRouter()` returning
   `createTanStackRouter({ routeTree, ... })` (keep the `Register` module augmentation).
6. **Rewrite `src/routes/__root.tsx`**: replace the SSR document shell — remove
   `HeadContent`, `Scripts`, and `shellComponent` rendering `<html>` — with
   `createRootRoute({ component: RootLayout })` where `RootLayout` renders `<Outlet />`
   (plus devtools). The HTML document now lives in `index.html`.
   - **Devtools are dev-only.** Dropping `@tanstack/devtools-vite` also dropped the thing
     that stripped `<TanStackDevtools>` from production builds — that shell does not no-op
     itself. `<Devtools />` (`src/components/dev/`) lazy-imports the panel behind
     `import.meta.env.DEV`, so the build eliminates it. Never import the devtools packages
     anywhere else.
7. **Verify scripts**: `pnpm dev`/`build`/`preview` are plain Vite; route codegen stays
   `pnpm generate-routes`.

Record any concrete deviations from the target structure here as they happen.
