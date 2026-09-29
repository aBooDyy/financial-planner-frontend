# PWA & Mobile — Offline, Native Feel, Platform-Aware Nav

The app is an installable **PWA** that must feel like a **native app** on mobile while
offering a richer layout on desktop.

## PWA setup

`vite-plugin-pwa@1.3` (Workbox 7, `generateSW`), configured in **`pwa.config.ts`** at the
repo root and added last in `vite.config.ts`. 1.3 is the first release whose `vite` peer range
includes `^8`; it runs under Rolldown unchanged. `workbox-window` is a direct devDependency
because pnpm does not hoist it and the plugin's virtual register module imports it.

### Manifest

- Lives in `pwa.config.ts`; the build emits `manifest.webmanifest` and injects its
  `<link rel="manifest">` into `index.html`. **Don't add a manifest link or a
  `public/manifest.json` by hand** — there would be two. `pnpm dev` serves no manifest (the
  plugin only does while its dev mode is on).
- `id`/`scope`/`start_url` `/`, `display: standalone`, `lang: en`, `dir: ltr` (the manifest's
  own strings are English; the in-app direction is the locale store's business), categories
  `finance` + `productivity`, theme/background `fp-bg` light `#FAF8F4`. No `orientation` (the
  app works both ways) and **no `shortcuts` yet**: no URL opens quick-add, so an "Add
  transaction" shortcut first needs a route/search param for it.
- **Icons** — the Means mark (the `BrandMark` tile + rotated square) in `public/`:
  - `favicon.svg` — the source of truth; swaps the tile to the dark accent under
    `prefers-color-scheme: dark`.
  - `favicon.ico` (16/32/48) — fallback for browsers without SVG favicons.
  - `apple-touch-icon.png` (180, opaque full-bleed — iOS rounds it itself).
  - `icon-192/512.png` (rounded tile, `any`), `icon-maskable-192/512.png` (full-bleed,
    glyph at 80% so it survives the maskable safe zone), `icon-monochrome-512.png`
    (alpha-only silhouette for themed icons).
  - The PNG/ICO files are rasterised from the SVG geometry. There is no generator in the
    repo, so if the mark changes, regenerate every variant together.
  - `index.html` links the favicons + apple-touch-icon, sets `apple-mobile-web-app-title`
    (iOS otherwise labels the home-screen icon with the long `<title>`), and sets
    `theme-color` per OS scheme (these follow the OS, not the in-app Appearance setting).

### Service worker (`dist/sw.js`)

- **Precache = the whole build.** `globPatterns: ['**/*']` over `dist/`, minus `**/*.map`,
  `_headers` (host config, never served — precaching a 404 fails the install) and
  `manifest.webmanifest` (the plugin adds it itself). Workbox leaves out `sw.js` and its
  `workbox-*.js` runtime on its own. So every JS/CSS chunk, `index.html`, the public icons and
  whatever a future import emits is precached with no list to maintain (142 entries, ~2.1 MB at
  the time of writing), the self-hosted font files included (see below). `includeManifestIcons` is off because the glob already has them.
  `maximumFileSizeToCacheInBytes` is 4 MiB (the entry chunk is ~0.5 MB); a file past it is
  left out of the precache with only a build warning, so watch the plugin's build output if a
  chunk balloons.
- **The icon pack needs no glob.** The two lazy icon chunks (`paths.gen`, `search.gen` —
  [icons.md](icons.md)) are ordinary content-hashed build output, so the precache picks them
  up with the rest of the bundle and re-downloads them only when the pack changes (verified
  in `dist/sw.js`). Avoiding a hand-maintained precache glob is precisely why the icon data is
  a generated module rather than a sprite or loose SVGs in `public/` — **don't add one.**
- **Navigations** fall back to the precached `index.html` (SPA routes, the OAuth callback
  routes included), except `navigateFallbackDenylist: [/^\/api\//]`: the same-origin API
  behind the Worker proxy always reaches the network.
- **No runtime caching at all.** Domain data is local-first (Dexie) and the **outbox** owns
  offline writes ([data-layer-and-sync.md](data-layer-and-sync.md)); the SW only serves the
  shell. Nothing third-party is loaded either: the font is **self-hosted**
  (`@fontsource-variable/hanken-grotesk`, imported in `styles/theme.css`), so its woff2 files
  are hashed build output in the precache and the shell renders in its real typeface offline
  from the first install. Don't bring back a Google Fonts `<link>` — it would need a runtime
  cache again and look different on a first offline launch.
- **`index.html` behind a redirect is fine.** Cloudflare's default `html_handling` answers
  `/index.html` with a 307 to the canonical URL. Workbox follows it and stores a copy without
  the `redirected` flag (`PrecacheStrategy.copyRedirectedCacheableResponsesPlugin`), which is what
  lets the navigate fallback serve it, so the precache entry stays `index.html`.
- `cleanupOutdatedCaches` drops the previous release's precache once the new one activates.
- **Off in dev** (`devOptions.enabled: false`): `pnpm dev` registers nothing and the virtual
  module is a no-op, so HMR is never shadowed by a cached shell. Try the SW with
  `pnpm build && pnpm preview` (localhost counts as a secure context).

### Updates — `features/pwa/`

- `registerType: 'prompt'`, `injectRegister: false`: the app registers the worker itself via
  `useRegisterSW` from `virtual:pwa-register/react` (its types come from
  `vite-plugin-pwa/react` in `tsconfig.json`'s `types`). A new release installs in the
  background and **waits**; nothing reloads on its own.
- `UpdatePrompt` (mounted once in `routes/__root.tsx`) is `useAppUpdate` + the
  presentational `UpdateToast`: a surface card bottom-centre ("New version available",
  **Reload**, and an ✕ "Not now"), `z-40`, clear of the mobile tab bar and its raised add
  button (`bottom: safe-area + 84px`, `md:` safe-area + 24px), logical padding, `fp-` tokens so it
  follows the theme. It sits **under** dialog overlays (`z-50`, and Radix makes the rest of the
  page inert), so it can't reload over a half-filled form. Its `role="status"` region stays
  mounted so the card appearing is announced.
- **Reload** posts `SKIP_WAITING` to the waiting worker; when it takes control, this tab
  reloads. That is safe for data — the outbox is persisted in Dexie and resumes after.
  **Not now** hides the card; the waiting version then starts on the next cold launch.
- **Other tabs never reload by themselves.** By default the plugin reloads every open tab
  when one of them updates; `useAppUpdate` passes `onNeedReload` so only the tab whose user
  pressed Reload does. Any other tab shows (or re-shows) the card and does a plain reload when
  asked — its bundle is stale, since a deploy removes the old hashed chunks from the host.
- `watchForUpdates(registration)` calls `registration.update()` hourly, on
  `visibilitychange → visible` and on `online` (skipped offline, while a worker is already
  installing, and within 60 s of the previous check), so an installed app that is never
  closed still learns about a release.
- `usePersistentStorage` (root layout) calls `navigator.storage.persist()` once per page load
  when the session is `authenticated` — best-effort protection of IndexedDB (the local DB and
  its unsynced outbox) against eviction; browsers may decline.
- Tests: `UpdatePrompt.test.tsx` (virtual module mocked: hidden → shown, Reload → skip-waiting
  then reload on control, Not now, a tab that did not ask never reloads, watching starts and
  stops), `watchForUpdates.test.ts`, `persistentStorage.test.ts`.

### Hosting requirements

Any host must provide:

- **HTTPS** (service workers need a secure context; `localhost` is exempt).
- **`Cache-Control: no-cache`** (or `max-age=0, must-revalidate`) on `/sw.js`, `/`,
  `/index.html` and `/manifest.webmanifest`, so the next update check sees a release. Headers
  match the *request* path, and the host serves the shell at `/`, so `/` needs its own rule.
- **Immutable hashed assets**: `/assets/*` → `public, max-age=31536000, immutable`.
- **SPA fallback** on the host as well (a path with no file → `index.html`), for the first
  visit before the SW is installed and for browsers without one.
- `/api/*` is never answered with the shell.

On Cloudflare Workers ([architecture.md](architecture.md)) the fallback is
`not_found_handling: "single-page-application"` in `wrangler.jsonc`, and the headers come from
**`public/_headers`** (copied into `dist/`, applied to static-asset responses). Workers already
default assets to `max-age=0, must-revalidate` (which also covers SPA-fallback deep routes); the
file makes the no-cache rule explicit and adds the immutable one. Rules that match the same
path **merge** (values joined with a comma), so never add a catch-all `/*` next to `/assets/*`.

## Offline

- Fully usable offline (reads from local DB, writes queued in the outbox). Reconnect resumes
  sync automatically.
- **The indicator** is `OfflineIndicator` (`components/chrome/`), mounted in `TopNav`, so every
  app page gets it on phone and desktop. It renders nothing while online. Offline it is a quiet
  `fp-surface-2` pill (a cloud-off icon, plus "Offline" from `sm` up). A press opens a popover
  that says changes are saved here and sync on reconnect, with the outbox count
  (`usePendingChangeCount`). It is information, not a warning, so it uses no warn or danger
  tint. Per-row sync failures are a separate thing: `SyncFailureBadge` / `SyncFailureBanner`.
- **The sync cloud** is `SyncIndicator` (`components/chrome/`), just before the offline pill
  in `TopNav`, driven by `useSyncStatus()` ([data-layer-and-sync.md](data-layer-and-sync.md#offline)).
  The glyph (`SyncCloudGlyph`) is hand-drawn from Lucide's `cloud-sync` / `cloud-check` /
  `cloud-alert` paths (lucide-react 0.545 has no `cloud-sync`), so only the arrow group turns,
  around (12,16) of the view box. Per state:
  - **syncing** — arrows turn (after 300 ms, for at least 700 ms, via `useCalmFlag`);
    **waiting** — same arrows, still.
  - **synced** — the check pops in and draws itself in `fp-accent`, holds 2.5 s
    (`useFlashOnEnter`), then the whole mark collapses away. Idle-and-synced shows nothing.
  - **failed** — the alert pops in and nudges once, `fp-warn` (server unreachable) or
    `fp-danger` (a change refused), and **stays** until the trouble clears.
  Whenever shown, hover opens a tooltip and a press opens a popover (the same text, "Last synced
  …", and Retry now when failed) — the `SyncFailureBadge` tooltip-inside-popover pattern. It
  stays mounted and collapses width + gap (`inert` while hidden), so it fades both ways; it
  renders nothing offline (the offline pill speaks). Keyframes `fp-pop-in-soft`,
  `fp-stroke-draw`, `fp-nudge` live in `theme.css`; all motion stops under
  `prefers-reduced-motion`. A `role="status"` line announces "Syncing".
- **"Online" means `useOnline()`** (`hooks/useOnline.ts`, `navigator.onLine` plus the
  `online`/`offline` events). It's optimistic: a captive portal still reads as online, so every
  online-only call keeps its own error path too.

### Online-only actions

Some actions need the server. Each one must degrade the same way. Its control is **disabled
while offline**, with the reason shown as **helper text**, not a tooltip, so touch users see
it too. Use `OfflineNotice` (`components/OfflineNotice.tsx`: cloud-off icon, `fp-text-2`,
`role="status"`; the caller renders it only while offline). A string-only slot such as the `DialogActions`
`hint` gets `OFFLINE_HINT` ("Available when you're back online."). Never let a raw network
error or a spinner that never stops stand in for this. Reads that need the server wait for the
connection and load on reconnect.

| Action | Offline behaviour |
|---|---|
| Log in / sign up / Continue with Google | Notice on the auth screen; submit and Google disabled |
| Sign out (account menu, Settings › Data) | The menu item and the Data button are disabled with the hint. `SignOutConfirm` also refuses, in case the connection drops while it's open. Why: `useLogout` wipes Dexie in its `finally`, which would lose the unsynced outbox, and the server couldn't clear the HTTP-only cookie anyway |
| Profile save (Settings › Account) | Save disabled, notice in the footer |
| Merge merchants | Merge disabled, `DialogActions` hint |
| Onboarding finish (`/setup` step 5) and inbox connect/undo | CTA disabled with a footer notice; provider buttons and Undo disabled |
| Email sync: connect, Sync now, older emails, rules, disconnect | Section notice, every control disabled (`model.online`); `ScanNowControl` gates itself |
| Startup inbox scan (`useEmailSyncBootstrap`) | Waits for `session.verified`, so an offline launch doesn't spend the load's one scan ([data-layer-and-sync.md](data-layer-and-sync.md#the-offline-session)) |
| Integrations: create/rotate/revoke/delete keys, rule editor, dry run, delivery log | Section notice, controls disabled; the log says it needs the server |
| Review queue: Confirm / Ignore / Not a transaction / Confirm all / Ignore all | Notice in the modal; every action disabled; the queue stays readable from Dexie |
| Stored body of an import (review card, a transaction's "View email") | `useImportDetail` doesn't request; shows "loads when you're back online", then fetches on reconnect |
| OAuth callbacks (`/auth/google/callback`, `/settings/email-sync/callback`) | Unchanged: they're reached only by a live redirect, and a failure already shows an error or falls through |

Everything else (wallets, transactions, budgets, goals, categories including delete-and-move,
merchants except merge, planned, CSV import, currencies/rates, import templates) goes through
the outbox and works offline.

## Native-like mobile UX

- **Bottom navigation** (thumb-reachable tab bar) as the primary mobile nav. Its centre slot is
  a raised "add transaction" button (desktop gets a floating one bottom-end instead) — see
  [transactions.md](transactions.md).
- **Safe areas.** `index.html` sets `viewport-fit=cover`, so the page runs edge to edge and the
  `env(safe-area-inset-*)` values are real. Each edge is owned by what sits on it, written as an
  inline arbitrary value (`pt-[env(safe-area-inset-top)]`, `bottom-[calc(env(…)+28px)]`), the
  same way the onboarding header and footer already did it:
  - top: `TopNav` pads its surface by the top inset (the offline pill lives in it);
  - bottom: `MobileTabBar` pads by the bottom inset (the home indicator); the `ResponsiveDialog`
    sheet pads its bottom so the footer clears it; `UpdateToast` and the desktop `QuickAddFab`
    add the inset to their offset;
  - sides: `body` pads left/right by the side insets (landscape notch). Those two are
    **physical** on purpose — the notch doesn't flip in RTL.
  No `apple-mobile-web-app-status-bar-style`: `black-translucent` would draw white status-bar
  text over the light theme.
- **Installed-app (standalone) extras.** The inset alone isn't enough in an iPhone home-screen
  app: iOS blurs a strip just below the status bar, and the tab bar's outer tabs crowd the
  rounded screen corners. The `standalone` custom variant (`theme.css`,
  `@media (display-mode: standalone)`) adds padding on top of the inset — `TopNav`
  `max-md:standalone:` +12px top, `MobileTabBar` `standalone:` +10px bottom. Browser tabs are
  untouched (Safari's own toolbars own those edges there).
  Verify in Chromium with CDP `Emulation.setSafeAreaInsetsOverride`.
- **Full-height layouts use `dvh`, never `vh`.** Page shells are `h-dvh` (splash/auth screens
  `min-h-dvh`). `100vh` in mobile Safari is the *large* viewport (toolbar collapsed), so an
  `h-screen` shell sinks its bottom strip — the tab bar — behind Safari's URL bar. `dvh` tracks
  the visible area, so no device detection is needed; in standalone PWA mode it is the full
  screen and the tab bar's safe-area padding clears the home indicator.
- **No page zoom, no page bounce.** The viewport sets `maximum-scale=1`, because iOS zooms
  into any focused field under 16px (most of ours) and never zooms back. `theme.css` gives
  `html, body` `overscroll-behavior: none` (the root never rubber-bands and drags the top bar
  and tab bar along with it) and `touch-action: manipulation` (no double-tap zoom). Inner scroll
  areas still scroll and bounce on their own. Don't bump inputs to 16px to fix the zoom; the
  viewport already does it.
- No desktop-style chrome on mobile.
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

> Keep this file matching `pwa.config.ts` and `features/pwa/` whenever either changes.
