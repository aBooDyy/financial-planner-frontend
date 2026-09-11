# Email sync (frontend)

`features/email-sync/` — connect an inbox (Gmail / Outlook), let the backend auto-log
transactions from bank alert emails, and review what it staged. **Online-only**: the Dexie
tables are a server-owned read cache, not an offline outbox — see the exception section in
[data-layer-and-sync.md](data-layer-and-sync.md#exception-email-sync-online-only-server-owned-cache).

## Surfaces

| Where | What |
| ----- | ---- |
| Settings → Email sync | `EmailSyncSection` → `EmailSyncWizard` (connect + map) / `ConnectedPanel` (toggles, frequency, default wallet, tracked senders) |
| Spending → Review | `PendingReviewModal` → one `PendingImportRow` per staged alert |
| Spending → edit a transaction | `SourceEmailSection` inside `TxEditor` — the email an auto-logged entry came from |

## The wizard's three picks

`useEmailWizard` walks provider → OAuth redirect → callback route
`/settings/email-sync/callback` → select senders → map. In the map step the user taps body
lines to assign them to a field (`FieldTarget`): **amount** and **currency** are required,
**merchant** is optional — without it the backend falls back to a label heuristic
(`Merchant:` / `Payee:` / …). The three are one `FIELDS` array in `EmailSyncWizard`, so a line
can carry several marks and the chips/highlights stay in step. Amount and currency auto-hop to
each other until both are set; merchant never steals the target. Saved as one `RuleDraftWire`
per unique sender (`merchant_index: null` when skipped).

## Reviewing a staged import

Nothing the sync parsed is final. `PendingImportRow` shows the header + category/account for
the fast path, and expands into the **stored email** plus every editable value
(`ImportDetailsFields`: type, amount, currency, date, merchant, subcategory, note).

- **The email body is not cached.** `useImportDetail` fetches `GET /email-imports/{id}` when
  the user opens a row — most imports are never opened, and bodies are far larger than the row.
  `PendingImport.hasBody` says whether there is one (false for alerts staged before the backend
  started keeping them).
- **A failed parse is not a dead end.** When the backend couldn't read an amount/currency the
  row opens expanded with a *Needs details* chip, and the user types the values in. `confirm`
  sends them as overrides; the backend keeps them on the import too.
- **Tapping a line fills the form.** `readLineValues` (`data/lineValues.ts`, unit-tested) pulls
  a number + currency code out of the tapped line — the shortest path from "here is the amount
  in the email" to a correct entry.
- **Merchant learning is shown, not hidden.** The detail carries the merchant with what the
  user filed it under before (`MerchantHint`); the next import from that merchant arrives with
  `suggestedCategory`/`suggestedSubcategory` already set by the backend. The merchant field is
  only sent on confirm when it was **edited** — resending it would re-count the sighting.

Form state lives in `useImportReview` (one per row): prefill, the tapped-line fill, validation,
and the confirm/dismiss calls. Errors surface through `messageForApiError` — the UI keys off the
backend's `code`, never its wire `message`, so new codes go in `lib/errorMessages.ts`.

## Contract notes

`ImportWire` carries `merchant_id`, `suggested_subcategory` and `has_body`; the body itself
only comes from the detail endpoints (`GET /email-imports/{id}` and
`GET /email-imports/by-transaction/{transactionId}`, both → `ImportDetailWire`). Confirm's
`amount`/`currency`/`date`/`merchant`/`note` are all optional overrides. Backend counterpart:
`financial-planner-backend/.agent-context/email-sync.md`.

## Not here

Merchants have no screen of their own — no list, rename, merge, or per-merchant
auto-categorize toggle (the backend stores the flag; nothing reads it yet). A manually added
transaction cannot be tagged with a merchant. The stored email is plain text only, so alerts
render as monospace lines rather than as the bank's HTML.
