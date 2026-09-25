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
- **Auth guards**: protect authenticated routes via a guarded layout route and redirect to
  `auth/login` on an **anonymous session** — the session store's status, not a raw `401`. A
  `401` is ordinarily just an expired access cookie that the HTTP client renews behind the
  scenes ([data-layer-and-sync.md](data-layer-and-sync.md#auth--http)); only `endSession()`
  turns the session anonymous, and that is what routes the user out. Auth state comes from the
  session store, backed by the HTTP-only cookie (the app never reads the token).
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
  (a `GET /auth/me` that resolves the session from the cookie). Guarded routes wrap their
  content in **`SessionGate`** (`src/components/SessionGate.tsx`): `loading` → `Splash`,
  `anonymous` → `/auth/login`, signed in but not onboarded → `/setup`. Use it for every new
  authed route rather than branching on `status` by hand. `RedirectTo`
  (`src/components/RedirectTo.tsx`) is a tiny imperative-redirect helper since TanStack's
  `redirect()` is loader-only. Revisit toward a guarded layout route + `beforeLoad` once more
  authed areas exist.
- **`/setup`** (`routes/setup.tsx`) is the first-run wizard and the one authed route that does
  not use the gate — see [onboarding.md](onboarding.md).

## Settings (`/settings/*`)

Every Settings pane is its own route, so a pane is linkable, bookmarkable, and the browser's
back button moves between them. `routes/settings/route.tsx` is the layout — the session guard
plus `SettingsLayout` (TopNav, rail, `Outlet`, MobileTabBar) — and each pane is a thin file
rendering its feature component directly:

`account` · `preferences` · `currencies` · `categories` · `merchants` · `email-sync` ·
`integrations` · `notifications` · `data`.

- `routes/settings/index.tsx` **redirects** `/settings` → `/settings/account` in
  `beforeLoad`, so nobody ever sees an empty `Outlet`.
- `SettingsRail` is a set of `<Link>`s using `activeProps`/`inactiveProps`; the active pane
  comes from the URL, not component state.
- The sections became **self-sufficient** when the page that fed them props went away:
  `AccountSection` reads the session store, `PreferencesSection`/`CurrenciesSection` read
  `useBalances`, `DataSection` uses `useLogout`. Route files stay wiring-only.
- **`routes/settings_.email-sync.callback.tsx` keeps its `settings_` escape.** Its URL
  (`/settings/email-sync/callback`) is what the provider apps whitelist, but it must not
  render inside the Settings layout — it is a redirect target, not a pane.
- **Typed search on a pane:** `/settings/integrations` validates `?key=` and `?sample=`
  (`IntegrationsSearch`) — the deep link the review queue's "Fix the rule" and a
  transaction's "View key" use. `/transactions?review=1` is the other search-driven entry.

## Goals and Spending tabs

`/goals/$section` and `/transactions/$view` put the page tab in the URL, like Settings panes, so a
tab is linkable and the back button moves between tabs. Each area is a directory:

- `route.tsx` — the session guard + `Outlet`, and the area's search params (`?goal=`,
  `?review=`), so they're shared by every tab.
- `index.tsx` — **redirects** the bare path to the first tab (`summary` / `activity`) in
  `beforeLoad`, carrying the search along, so `/goals?goal=<id>` and `/transactions?review=1`
  still work.
- `$section.tsx` / `$view.tsx` — renders the page; `beforeLoad` redirects an unknown tab to the
  first one. The valid tabs are `GOALS_SECTIONS` (`features/goals/components/sections.ts`) and
  `SPENDING_VIEWS` (`features/transactions/constants.ts`).

**A tab is a param, not a child route per tab** (unlike Settings) because the tabs share page
state — the goal editor/detail, the Spending scope, range and calendar. One param route keeps
the page mounted across tab switches, since TanStack only remounts a route's component on a
param change when `remountDeps` asks it to. Tabs are `<Link>`s; the pages read the tab with
`useParams` and navigate with `to: '/goals/$section'` / `'/transactions/$view'`.

## Import hub (`/import`)

`routes/import.tsx` renders `features/import/components/ImportPage`, guarded exactly like
`/balances` and `/transactions` (session-store branch + `RedirectTo`). It is **not** a
`NAV_SECTIONS` entry — it's a sub-page reached from the Spending header (**Import**) and from
Settings → Data & privacy (**Import a file**), so `TopNav`/`MobileTabBar` render with no
`active` section, as `/settings/*` does.

> Record concrete route-tree decisions and any guard/loader conventions here as they land.
