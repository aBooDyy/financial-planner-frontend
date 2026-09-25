# Onboarding — the `/setup` wizard

`features/onboarding/` is the first-run wizard from the Claude Design "Onboarding v2" file:
five steps (name, goals, categories, base currency, email sync) and a welcome screen.
Product view: root [features.md](../../.agent-context/features.md); the endpoint:
backend [onboarding.md](../../financial-planner-backend/.agent-context/onboarding.md).

## Who lands here — `SessionGate`

`User.onboardedAt` is `null` until setup is finished. Every guarded route renders through
`components/SessionGate.tsx` — `loading` → `Splash`, `anonymous` → `/auth/login`, not onboarded
→ `/setup` — so nothing in the app opens before setup, whichever URL was typed. Sign-up and the
Google callback just navigate to `/`; the gate does the rest.

`routes/setup.tsx` is the exception that must not use the gate. It decides "already set up"
**once, on arrival** (`useState` initialiser): finishing setup marks the user onboarded
mid-visit, and the welcome step still has to render afterwards. An onboarded user who opens
`/setup` later is redirected to `/`.

## The draft — `stores/onboardingDraft.ts`

Everything the user picks is held in a Zustand store until step 5 commits it. It is
**persisted to `sessionStorage`**, because connecting an inbox leaves the app for the
provider's consent screen and comes back through a full page load. The draft records its
`userId`; `useOnboardingFlow` restarts it (`start(user.id, user.name)`) when a different user
arrives, which is also what pre-fills the name — from the sign-up form or from Google.

- `packId: null` means "follow the suggestion", so changing goals moves the pack with them;
  picking a pack pins it. Toggling a goal resets both the pack and any hand edits.
- `selection: null` means "exactly the active pack". The first chip toggle copies the pack
  into `selection`; **Reset to pack** sets it back to `null`.

## Packs — `data/packs.ts`

Pure data and helpers, unit-tested in `packs.test.ts`:

- `INTENTS` (6) each point at one pack; `suggestedPackId` picks the most specific pack among
  the goals chosen (`family` > `freelancer` > `student` > `traveler` > `saver` > `essentials`).
- `PACKS` (6) list **default top-level slugs only**, and only slugs the built-in catalog has
  — `packs.test.ts` checks that against `buildCatalog([])`, and that every built-in root is
  offered by at least one pack. The design's mock set was adapted to our real catalog: its
  "Fun"/"Subs" became `entertainment`/`subscriptions`, and a **Saver** pack (with
  `investment`) was added for the "Save and grow my money" goal. The 2026-09-24 roots are
  spread where they fit: `family` + `giving` (Family), `personal_care` (Essentials, Student),
  `insurance` (Saver, Family, Traveler), `government` (Essentials, Freelancer, Traveler),
  `other_income` (Freelancer).
- `REQUIRED_SLUGS` = `savings` + `other`, mirroring the backend's `REQUIRED_CATEGORIES`. They
  are in every pack, render as locked chips, and `toggleSlug` refuses to drop them.

Names, colours, icons and subcategories come from `useCategoryCatalog()`, never from the pack
list — the same catalog every other surface reads ([categories.md](categories.md)).
`useCategorySelection` filters the selection to slugs the catalog actually has.

## Committing — `data/complete.ts`

Step 5's button calls `completeOnboarding` → `POST /onboarding` with the name, currency and
selected root slugs, then pulls **categories and balance settings** directly
(`pullCategories`, `pullSettings`) — the server just rewrote both, and `pullAll` would return
early if a background pull happened to be in flight. A `409 onboarding.already_completed`
(setup finished in another tab) is treated as success by re-reading `/auth/me`.

The flow hook moves to the welcome step **before** `setUser(updated)`, so there is never a
render where the user is onboarded but the wizard is still on step 5. "Open Means" navigates
to `/balances`, then clears the draft.

Online-only, like sign-up itself: the categories prune and the marker are server decisions.

## Email sync step

`useInboxConnect` calls `beginInboxConnect(provider, '/setup')`
(`features/email-sync/data/connect.ts`), which stores the return path in sessionStorage
before leaving; the OAuth callback route reads it back with `takeConnectReturnPath()`
([email-sync.md](email-sync.md)). Back on `/setup`, the restored draft is on step 5 and the
connection (now in the `emailConnections` cache) shows as connected. Mapping which alerts to
read is left to Settings → Email sync, which resumes the wizard for a `PENDING_SETUP` inbox.

## Layout

One page (`OnboardingPage`): header, a scrolling body capped at 720px, a pinned footer.
Desktop and mobile differ as in the design — the desktop header centres the progress bar
beside the brand and the footer carries **Back**; the mobile header carries back, progress
and "n/5", and the CTA fills the footer. The packs are a 3-column grid on desktop and a
sideways scroller on mobile, where the suggested pack leads the row. Selection cards share
`selectableCard()`; chevrons flip under RTL.
