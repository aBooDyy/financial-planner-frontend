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
  `anonymous` → `/auth/login`, signed in but not onboarded → `/setup`. It also mounts the
  app-wide add-transaction FAB + sheet ([transactions.md](transactions.md)). Use it for every new
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

`account` · `security` · `preferences` · `currencies` · `categories` · `merchants` · `import` ·
`email-sync` · `integrations` · `notifications` · `archived` · `data`.

- `routes/settings/index.tsx` **redirects** `/settings` → `/settings/account` in
  `beforeLoad`, so nobody ever sees an empty `Outlet`.
- `SettingsRail` is a set of `<Link>`s using `activeProps`/`inactiveProps`; the active pane
  comes from the URL, not component state.
- The sections became **self-sufficient** when the page that fed them props went away:
  `AccountSection` reads the session store, `PreferencesSection`/`CurrenciesSection` read
  `useWallets`, `DataSection` uses `useLogout`. Route files stay wiring-only.
- **`routes/settings_.email-sync.callback.tsx` keeps its `settings_` escape.** Its URL
  (`/settings/email-sync/callback`) is what the provider apps whitelist, but it must not
  render inside the Settings layout — it is a redirect target, not a pane.
- **Typed search on a pane:** `/settings/integrations` validates `?key=` and `?sample=`
  (`IntegrationsSearch`) — the deep link the review queue's "Fix the rule" and a
  transaction's "View key" use. `/settings/email-sync` validates `?inbox=` with either
  `&fresh=1` (the OAuth callback: open the new inbox onto its first rule) or `&sample=` and
  an optional `&rule=` (the queue's "Fix the rule" for an inbox row) — `EmailSyncSearch`;
  every id must be uuid-shaped or the whole intent is dropped. `/transactions?review=1` is the
  other search-driven entry, with `?open=<kind>:<id>` (`tx`, `adjustment`, `transfer` — by
  `transferId` — `budget`; `data/openParam.ts`, the id uuid-shaped or the
  param is dropped): the global search's way of opening a result. `useOpenFromSearch` waits for the
  page's data, opens that editor, then strips `open` with `replace`, re-arming on the next value.

## Planning and Spending tabs

`/planning/$section` and `/transactions/$view` put the page tab in the URL, like Settings panes, so
a tab is linkable and the back button moves between tabs. Each area is a directory:

- `route.tsx` — the session guard + `Outlet`, and the area's search params (`?open=`,
  `?review=`), so they're shared by every tab.
- `index.tsx` — **redirects** the bare path to the first tab (`overview` / `activity`) in
  `beforeLoad`, carrying the search along, so `/planning?open=goal:<id>` and
  `/transactions?review=1` still work.
- `$section.tsx` / `$view.tsx` — renders the page; `beforeLoad` redirects an unknown tab to the
  first one. The valid tabs are `PLANNING_SECTIONS` (`features/planning/sections.ts`:
  `overview`, `upcoming`, `bills`, `goals`, `income`) and `SPENDING_VIEWS`
  (`features/transactions/constants.ts`: `activity`, `budgets`).

**A tab is a param, not a child route per tab** (unlike Settings) because the tabs share page
state — the Planning detail panel and sheets, the Spending scope, range and calendar. One param
route keeps the page mounted across tab switches, since TanStack only remounts a route's
component on a param change when `remountDeps` asks it to. Tabs are `<Link>`s; the pages read the
tab with `useParams` and navigate with `to: '/planning/$section'` / `'/transactions/$view'`.

**Old links redirect, so bookmarks and installed-PWA links survive** (04 §2):

- `/goals` and `/goals/<section>` → `/planning/<section>` (`summary` → `overview`, `obligations`
  → `bills`, `timeline` → `upcoming`, `goals`, `income`; anything else → `overview`), and
  `?goal=<id>` → `/planning/goals?open=goal:<id>` (`data/goalsRedirect.ts`). `routes/goals/` only
  holds these redirects; `GoalsSearch` keeps `?goal=` typed for the Wallets pot links.
- `/transactions/planned` → `/planning/upcoming`, `/transactions/recurring` → `/planning/bills`
  (checked before the unknown-tab fallback in `$view.tsx`).

**`/planning?open=<kind>:<id>`** (`features/planning/data/openParam.ts`): `bill`, `goal`,
`income` or `planned`, the id uuid-shaped or the param is dropped. Each kind opens on its section
(`PLANNING_OPEN_SECTION`: a bill's detail on Bills, a goal's on Goals, the income editor on
Income, a planned item's confirm dialog on Upcoming); the page consumes it once its data has
loaded and strips it with `replace`, like Spending's `useOpenFromSearch`.

## Reports (`/reports`)

`routes/reports.tsx` renders `features/reports/components/ReportsPage` behind `SessionGate`, the
4th `NAV_SECTIONS` entry (`active="reports"`). Its controls are typed search params
(`ReportsSearch`, validated by `parseReportsSearch`) — `?range=&from=&to=&compare=&accounts=`,
defaults omitted, written with `replace` — see [reports.md](reports.md).

## Import wizard (`/import`)

`routes/import.tsx` renders `features/import/components/ImportPage` — the CSV wizard only,
full width so the review grid has room — guarded exactly like `/wallets` and
`/transactions`. The import **hub** (sources, recent imports, templates) is the Settings pane
`/settings/import`; its "Choose a file" is the only link here, and "Cancel import" / "Back to
Import" navigate back to it. Not a `NAV_SECTIONS` entry, so `TopNav`/`MobileTabBar` render
with no `active` section, as `/settings/*` does.

> Record concrete route-tree decisions and any guard/loader conventions here as they land.
