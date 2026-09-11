# Routing — TanStack Router

Routing uses **TanStack Router** with file-based routes under `src/routes/` (codegen via
`pnpm generate-routes`, output `routeTree.gen.ts`).

## Structure

- `__root.tsx` — root layout: theme + **direction (RTL/LTR)** providers, global chrome,
  the platform-aware navigation shell (see [pwa-and-mobile.md](pwa-and-mobile.md)).
- Pages compose **features**; routes hold layout/wiring, not business logic.
- Group by product area, mirroring features: `routes/accounts/`, `routes/transactions/`,
  `routes/budget/`, `routes/forecast/`, `routes/settings/`, plus `auth/` (login/register).

## Patterns

- Use typed params/search where helpful (TanStack Router's typed search params are great for
  filters/date ranges on the transactions and forecast views).
- **Local-first loaders**: because data lives in the local DB, route loaders should be thin
  — components read reactively from the DB. Don't block navigation on the network.
- **Auth guards**: protect authenticated routes via a guarded layout route; on `401`/no
  session, redirect to `auth/login`. Auth state comes from the session store, backed by the
  HTTP-only cookie (the app never reads the token).
- Keep route components small; push UI into feature components and logic into hooks.

## Navigation chrome

- The nav differs by platform (desktop sidebar/top bar vs. mobile bottom tab bar). The
  router renders the right shell responsively — see
  [pwa-and-mobile.md](pwa-and-mobile.md). Routes themselves stay platform-agnostic.

## Implemented routes (auth)

- `routes/auth/login.tsx` → `/auth/login`, `routes/auth/signup.tsx` → `/auth/signup`. Both
  render `features/auth/components/AuthScreen` (`mode="login" | "signup"`); the
  login↔signup switch is a `<Link>` between the two routes (not in-component toggling).
- `routes/index.tsx` (`/`) is the guarded landing: reads `useSessionStore().status` and
  shows `<Splash>` while `loading`, `<RedirectTo to="/auth/login">` when `anonymous`, else
  the signed-in home.
- **Guard convention (current):** guards are component-level, driven by the **session
  store**, not router `beforeLoad`/loaders. `__root.tsx` calls `useSessionBootstrap()` once
  (a `GET /auth/me` that resolves the session from the cookie); routes branch on
  `status`. `RedirectTo` (`src/components/RedirectTo.tsx`) is a tiny imperative-redirect
  helper since TanStack's `redirect()` is loader-only. Revisit toward a guarded layout
  route + `beforeLoad` once more authed areas exist.

> Record concrete route-tree decisions and any guard/loader conventions here as they land.
