# Email sync (frontend)

`features/email-sync/` — connect an inbox (Gmail / Outlook) and let the backend auto-log
transactions from bank alert emails. What it stages lands in the shared review queue,
`features/inbound-imports/` — see [inbound-imports.md](inbound-imports.md). **Online-only**: the Dexie
tables are a server-owned read cache, not an offline outbox — see the exception section in
[data-layer-and-sync.md](data-layer-and-sync.md#exception-email-sync-and-inbound-imports-online-only-server-owned-cache).

## Surfaces

| Where                         | What                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Settings → Email sync         | `EmailSyncSection` → `EmailSyncWizard` (connect + map) / `ConnectedPanel` (toggles, frequency, default wallet, tracked senders) |
| Spending → Review             | `ReviewScanPrompt` — the inbox's scan offer, passed into the queue's `PendingReviewModal` as its `toolbar`                      |
| Spending → edit a transaction | the queue slice's `SourceSection` inside `TxEditor` — the email an auto-logged entry came from                                  |

## Where the callback returns to

The callback URL is fixed (the provider apps whitelist it), so the place a connect started
from travels through sessionStorage: `beginInboxConnect(provider, returnTo)`
(`data/connect.ts`) stores it before leaving, and the callback route reads it once with
`takeConnectReturnPath()` — same-origin paths only, defaulting to `/settings/email-sync`.
Settings' wizard uses the default; first-run setup returns to `/setup`
([onboarding.md](onboarding.md)).

## The wizard's three picks

`useEmailWizard` walks provider → OAuth redirect → callback route
`/settings/email-sync/callback` → select senders → map. In the map step the user taps body
lines to assign them to a field (`FieldTarget`): **amount** and **currency** are required,
**merchant** is optional — without it the backend falls back to a label heuristic
(`Merchant:` / `Payee:` / …). The three are one `FIELDS` array in `EmailSyncWizard`, so a line
can carry several marks and the chips/highlights stay in step. Amount and currency auto-hop to
each other until both are set; merchant never steals the target. Saved as one `RuleDraftWire`
per unique sender (`merchant_index: null` when skipped).

## Scanning on demand

`useEmailSyncBootstrap` still fires one scan per app load with **no options** — that is the
automatic path and it must stay that way. Everything else goes through `useManualScan`
(→ `runEmailSync(options)` → `POST /email-connections/sync` with a body), surfaced by
`ScanNowControl` in three places: the Import hub inbox card, `ConnectedPanel`, and the
review queue's header via `ReviewScanPrompt` (compact — button only, no window picker). The
queue never imports it: the page that opens the queue passes it in, so the shared slice stays
free of any one source.

- **The body is what makes a scan manual.** The backend infers manual mode from _any_ field
  being present; an empty body is the automatic scan, which skips inboxes with `autoSync` off
  and resumes from each cursor. So `useManualScan` always sends `limit: MANUAL_SCAN_LIMIT`,
  whatever the caller asked for. A manual scan that sent `{}` would silently be an automatic one.
- **Window options stay inside 1–180 days**; "Since last scan" simply omits `lookback_days`.
- **`lastSyncedAt` is not the scan result.** A narrow backfill deliberately does not advance
  the server cursor, so the outcome is read from the response, never from the connection row.
- **Single-flight is enforced twice.** A second `scan()` while one is in the air is dropped
  on the client; the backend also runs **one scan per user** and refuses a second with
  **409 `email_sync.sync.in_progress`**.
- **`email_sync.sync.in_progress` is not a failure.** The inbox _is_ being read and
  re-staging is idempotent on `(connection_id, external_id)`, so nothing asked for is
  lost. `useManualScan` enters a `busy` state, waits 4 s and retries **once**; if the slot is
  still held it stays `busy`, never `failed`. `ScanNowControl` keeps the button disabled and
  says a scan is already running — no red alert for work that is happening.
  `useEmailSyncBootstrap` needs nothing: it already swallows failures.
- `failures` is always an array (on the automatic path too). A partial failure renders the
  counts _and_ a note — never a silent no-op, and never a lie about what was covered.

## Scanning refreshes the queue

`runEmailSync()` pulls the connections as a full list and then the queue's delta
(`pullInboundImportsDelta`, the queue slice's public helper). Disconnecting an inbox calls
`dropConnectionImports` — the server cascades that inbox's staged rows away, and the local
cache mirrors it. Email sync never touches the `inboundImports` table directly.

## Not here

Merchants are a slice of their own now — the alias-set identity an email sighting files
into, the scored matcher, `auto_categorize`, the Settings list with rename/merge, and the
merchant field on a hand-entered transaction all live in [merchants.md](merchants.md). The
stored email is plain text only, so alerts render as monospace lines rather than as the
bank's HTML. Importing a **file** is the other import source and is entirely local — see
[import.md](import.md).
