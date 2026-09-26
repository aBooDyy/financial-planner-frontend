# PWA & Mobile — Offline, Native Feel, Platform-Aware Nav

The app is an installable **PWA** that must feel like a **native app** on mobile while
offering a richer layout on desktop.

## PWA setup

- **Decision (locked): `vite-plugin-pwa`** (Workbox under the hood) for the service worker
  and manifest generation.
- **Update the web manifest** — the scaffold ships TanStack's placeholder
  (`public/manifest.json` still says "TanStack App"). Set real `name`/`short_name`, theme &
  background colors (aligned to `fp-` tokens), proper icons (incl. maskable), `display:
standalone`, and `start_url`.
- Service worker caching:
  - **App shell**: precache for instant, offline-capable loads.
  - **Data**: the app's data is local-first (Dexie), so the SW mainly handles the shell and
    static assets, not domain data. Don't cache API mutations in the SW — the **outbox** in
    the data layer owns offline writes (see [data-layer-and-sync.md](data-layer-and-sync.md)).
  - **The icon pack needs no glob.** The two lazy icon chunks (`paths.gen`, `search.gen` —
    [icons.md](icons.md)) are ordinary content-hashed build output, so the shell precache
    picks them up with the rest of the bundle and re-downloads them only when the pack
    changes. Avoiding a hand-maintained precache glob is precisely why the icon data is a
    generated module rather than a sprite or loose SVGs in `public/` — **don't add one.**
- Provide an in-app "new version available" prompt on SW update.

## Offline

- Fully usable offline (reads from local DB, writes queued in the outbox). Show a subtle,
  non-alarming offline/sync indicator. Reconnect resumes sync automatically.

## Native-like mobile UX

- **Bottom navigation** (thumb-reachable tab bar) as the primary mobile nav. Its centre slot is
  a raised "add transaction" button (desktop gets a floating one bottom-end instead) — see
  [transactions.md](transactions.md).
- Respect **safe areas** (`env(safe-area-inset-*)`), full-height layouts, no desktop-style
  chrome on mobile.
- Native-feeling interactions: momentum scrolling, large tap targets, sheets/drawers instead
  of modals where appropriate, snappy transitions, optimistic UI (already free via
  local-first writes).
- Avoid jank: never block interaction on the network; animate at 60fps; skeletons only for
  genuinely remote reads.

## Platform-aware navigation (desktop vs. mobile differ on purpose)

The nav bar is **intentionally different** per platform:

- **Mobile**: bottom tab bar + contextual top bar (title/back). Native app pattern.
- **Desktop**: a sidebar and/or top navigation with more density and secondary actions.

Implementation:

- A single responsive **navigation shell** in the root layout picks the right chrome by
  breakpoint (and optionally pointer/coarse detection). Routes/pages stay nav-agnostic and
  just render their content.
- Keep the two nav components small and separate (`MobileNav`, `DesktopNav`) rather than one
  branchy component — single responsibility. Share route definitions, not layout.
- Everything direction-aware (RTL/LTR) — bottom tabs and sidebars flip correctly. See
  [styling-and-theming.md](styling-and-theming.md).

## Responsive strategy

- Mobile-first. Desktop adds layout richness (multi-column dashboards, side panels for the
  forecast/timeline) rather than just scaling up.

> Lock in the PWA plugin and manifest details, then keep this file matching the setup.
