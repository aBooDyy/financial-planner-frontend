# Passkeys — frontend

Sign in with Face ID / Touch ID / a passkey. Accounts still start with a password or Google;
a passkey is added afterwards and is **for signing in only** (no app lock). The contract is in
the backend's `auth.md` (`/auth/passkeys/*`). Library: **`@simplewebauthn/browser`**
(`startRegistration`, `startAuthentication`, `browserSupportsWebAuthn(Autofill)`,
`platformAuthenticatorIsAvailable`, `WebAuthnAbortService`).

## Where things live

- `features/passkeys/` — `api/` (`passkeysApi`, the `Passkey` type + `toPasskey`),
  `passkeySupport.ts` (support + the platform label), `data/` (`ceremony.ts` cancel detection
  and messages, `setupFlags.ts` the storage flags, `describe.ts` the row's lines), `hooks/`
  (`usePasskeys`, `usePasskeyRegistration`, `usePasskeySetupPrompt`, `useResumedSetup`),
  `components/` (Settings section, rows, rename/remove dialogs, `PasskeySetupDialog`, the
  prompt and its host).
- `features/auth/` keeps the sign-in side: `passkeySignIn.ts` (options → sheet → verify),
  `hooks/usePasskeySignIn` (the button), `hooks/usePasskeyAutofill` (conditional UI),
  `hooks/useEnterApp` (`setUser` then navigate to `/`), and `components/GoogleCallback`.
- **Online-only server state, not a Dexie entity.** Nothing is cached: a ceremony needs the
  server at both ends. `usePasskeys` loads on mount and on reconnect and keeps the list in
  component state.

## Platform label

`platformLabel()` reads the user agent: iPhone/iPad/iPod → `Face ID`; a Mac UA with
`maxTouchPoints > 1` (iPadOS) → `Face ID`; other Mac → `Touch ID`; anything else →
`a passkey`. Buttons are built from it: `Sign in with …`, `Set up …`. Display only.

## Sign-in (login screen)

- The button shows on **login** wherever `browserSupportsWebAuthn()` (desktop too — no
  `lg:hidden`), disabled offline, `Signing in…` while running.
- `NotAllowedError` / `AbortError` (closed sheet, timeout, replaced ceremony) is **silent**
  (`isCeremonyCancelled`). `auth.passkey.invalid` → "That passkey isn't recognised. Sign in
  with your password."
- **Conditional UI:** the email field is `autocomplete="username webauthn"`; `LoginForm` starts
  `startAuthentication({ useBrowserAutofill: true })` on mount when
  `browserSupportsWebAuthnAutofill()` and online. It is aborted on unmount / going offline, and
  **the button cancels it before calling options**: each options call replaces the `pk_nonce`
  cookie, so the last options call owns the verify.
- A passkey sign-in does **not** set the just-signed-in flag (no setup offer).

## Adding a passkey — `usePasskeyRegistration`

Phases `idle | password | google | done`, plus `busy`. `start()` calls registration options
with no body. On `403 auth.reauth.required` it moves to `password` when `user.hasPassword`,
else `google`. `password` retries options with `{ password }`; `401 auth.credentials.invalid`
stays in the step as "That password isn't right". Then `startRegistration` → verify (no name:
the server derives one; rename later). A closed sheet returns to idle silently.

`PasskeySetupDialog` renders every step that needs the user (the optional `intro` offer, the
"Confirm it's you" password form, "Verify with Google", the `DoneState`). Leaving a re-verify
step goes back to where it began.

**`lib/http.ts`:** a `401` whose code is `auth.credentials.invalid` is never refreshed and
retried — retrying would resend the password and count twice against the login limiter. The
two public `authentication/*` paths are in `PUBLIC_AUTH_PATHS`.

### Verify with Google → resume

"Verify with Google" sets `sessionStorage['fp:passkey-resume-setup']` and starts the normal
Google sign-in. `GoogleCallback`: if the flag is set **and the same user** came back, it
navigates to `/settings/security` (flag kept); otherwise it clears the flag. The section's
`useResumedSetup` takes the flag and opens "Finish adding your passkey" — **one tap, not
automatic**, because Safari only creates a passkey from a user gesture. If Google returns a
different account than the cached one, the callback wipes the local DB first (as
`verifySession` does), so the new user never inherits the old tables.

## The one-time offer — `PasskeySetupPromptHost`

Mounted in the root layout. `usePasskeySetupPrompt` opens it when all hold:

- `sessionStorage['fp:passkey-just-signed-in'] === user.id` — set by password login, sign-up
  and the Google callback; never by a passkey sign-in or a restored session;
- onboarded, and the path is outside `/auth` and `/setup` (it waits out first-run setup);
- online, `platformAuthenticatorIsAvailable()`, and `GET /auth/passkeys` returns none;
- `localStorage['fp:passkey-prompt-dismissed:<userId>']` is absent.

The flag is consumed once the decision is made (a failed list leaves it for the next chance).
"Not now", closing, and Done after success all set the dismissed key. The session is fresh
right after the sign-in, so normally no password is asked; a slow first-run setup can outlive
the 10-minute window, in which case the re-verify steps appear. All storage access is wrapped
in try/catch.

## Settings › Sign-in & security (`/settings/security`)

Rail item after Account (`KeyRound`). Rows show name + `Synced` chip (`backedUp`), provider ·
`deviceLine` ("iPhone · iOS 18.1 · Safari", `Mobile ` stripped from the browser), and "Added
<date per dateFormat> · Last used <relative> on <device>" or "Never used". Skeleton rows only
while the first answer loads. Empty → `EmptyState`. Rename sends `version`; `common.conflict`
reloads the list, `auth.passkey.not_found` drops the row. Remove confirms (`ConfirmDialog`).
"Add a passkey" is disabled offline or unsupported with a `ReasonTooltip`, and the section shows
an `OfflineNotice` offline.
