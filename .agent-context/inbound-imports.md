# Inbound imports — the shared review queue (frontend)

`features/inbound-imports/` — the queue every automatic source stages into and the user reviews:
an inbox scan ([email-sync.md](email-sync.md)) or a webhook key ([integrations.md](integrations.md)). A staged row is the
**same row** whichever source produced it; only where it came from (`source`) and how its body
reads (`bodyFormat`) differ. **Online-only**, like email sync: the Dexie table `inboundImports`
is a server-owned read cache — see
[data-layer-and-sync.md](data-layer-and-sync.md#exception-email-sync-and-inbound-imports-online-only-server-owned-cache).

## Why its own slice

The queue is owned by no source. Putting it under email sync would make every later source
import from the email feature; putting it under the newest source would make email import from
that. So sources depend on the queue, never the reverse:

- The queue exports **public helpers** — `pullInboundImportsDelta`, `dropConnectionImports`,
  `usePendingImports`, `useImportDetail`, `BodyPreview`, `PendingReviewModal`,
  `SourceSection` + `ledgerSourceOf`, and the `PayloadViewContext` slot — and sources call
  those. They never read or write `db.inboundImports` themselves.
- The queue never imports a source. Source-specific UI inside it arrives through a slot:
  `PendingReviewModal`'s `toolbar` is where the page passes email sync's `ReviewScanPrompt`,
  and **`PayloadViewContext`** (`components/payloadView.ts`) is how a JSON body gets drawn —
  the root layout (`routes/__root.tsx`) provides integrations' `ReviewPayloadTree` (a thin
  adapter over the rule editor's `PayloadTree`). Without a provider a JSON body falls back to
  pretty-printed text, so the queue works (and tests) on its own.

## Surfaces

| Where                         | What                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Spending → Review             | `PendingReviewModal` → one `PendingImportRow` per staged row, `toolbar` from the source |
| Import hub inbox card         | `usePendingImports().count` via `useInboxSummary`                                       |
| Spending → edit a transaction | `SourceSection` (this slice) — the email or payload the entry came from                 |

## The row, locally

`LocalInboundImport` carries `source` (`'inbox' | 'webhook'`) and `bodyFormat`
(`'text' | 'json'`), lowercase like every internal enum (the wire is `INBOX`/`WEBHOOK`,
`TEXT`/`JSON`). At most one parent is set: `connectionId` for an inbox row, `keyId` for a
webhook row — null once its key is deleted (the row survives). `sourceRef` / `sourceLabel` are the sender address and display name for an inbox,
the key's token prefix and name for a webhook — denormalised, so a row outlives a revoked key
and still says where it came from. `occurredOn` is the event's `YYYY-MM-DD`.
`suggestedType` / `suggestedWalletId` are what the source resolved (a webhook rule's type and
wallet, or the key's defaults; an inbox connection's default wallet) — the review form starts
from them. Both are null when the source said nothing.

## Reviewing a staged import

Nothing that was parsed is final. `PendingImportRow` shows the header + category/account for
the fast path, and expands into the **stored body** plus every editable value
(`ImportDetailsFields`: type, amount, currency, date, merchant, subcategory, note).

- **The body is not cached.** `useImportDetail` fetches `GET /inbound-imports/{id}` when the
  user opens a row — most imports are never opened, and bodies are far larger than the row.
  `hasBody` says whether there is one (false for rows staged before the backend kept bodies).
- **The row says where it came from.** `SourceChip` puts a 14px `Mail` (inbox) or `Zap`
  (webhook) before `sourceLabel` (the bank's name / the key's name); the expander and the
  copy name the body by format (`bodyNoun`: "email" / "payload"). The queue's copy is
  otherwise source-neutral.
- **`BodyPreview` switches on `bodyFormat`.** `text` renders monospace lines, each tappable;
  `json` renders the payload through the `PayloadViewContext` view — the payload tree, LTR,
  collapsible — with a `PickTargetBar` above it ("Tap a value to fill: Amount · Currency ·
  Date · Merchant · Note"). A tapped value fills the **target** field (`readPick` in
  `data/pickValues.ts`: amounts via `readLineValues`, so "SAR 38.00" brings its currency;
  currency codes; ISO / epoch / day-first dates; merchant and note as text), then the target
  hops amount → currency → date like the rule editor; merchant/note keep the target. A word
  tapped inside a long string grows into its name run for merchant/note. An unreadable tap
  sets the row's error line ("“soon” doesn't read as a date.").
- **A truncated JSON body is shown as text.** The backend caps the stored body at 32 000
  chars (the payload cap is 64 KiB), and a cut-off body never parses, so `BodyPreview` does
  not try: it shows the raw text with a "only the first part was kept" footnote.
- **"Fix the rule".** A row that needs details shows `FixRuleLink`, which takes the row and
  links to the rule editor of whatever staged it, with this body as the sample: a webhook row
  that still has its key → `/settings/integrations?key=<keyId>&sample=<importId>`; an inbox row
  with a body → `/settings/email-sync?inbox=<connectionId>&sample=<importId>[&rule=<ruleId>]`
  (the inbox editor opens that rule, or a new one, on the stored email). The queue knows only
  each source's settings **route**, never its code; each route's `validateSearch` owns its
  contract. `ruleId` (wire `rule_id`) is on the cached row for this.
- **A failed parse is not a dead end.** When the backend couldn't read an amount/currency the
  row opens expanded with a _Needs details_ chip, and the user types the values in. `confirm`
  sends them as overrides; the backend keeps them on the import too.
- **Tapping a line fills the form.** `readLineValues` (`data/lineValues.ts`, unit-tested) pulls
  a number + currency code out of the tapped line — the shortest path from "here is the amount
  in the body" to a correct entry.
- **The category controls read the user's real catalog.** `useImportReview` takes a
  `CategoryCatalog` ([categories.md](categories.md)), so the category select offers the
  user's own categories of the draft's type and the subcategory select offers that
  category's own children — a staged row can be filed under a category the user invented.
  **The pair is normalised at render, not on write**: a suggestion naming a category Dexie
  has not delivered yet upgrades when the catalog lands, instead of being collapsed to the
  first category of its type on first paint. A `subcategory` the chosen parent does not own is
  dropped rather than kept as a dangling slug.
- **Merchant learning is shown, not hidden.** The detail carries the merchant with what the
  user filed it under before (`MerchantHint`); the next import from that merchant arrives with
  `suggestedCategory`/`suggestedSubcategory` already set by the backend. The merchant field is
  only sent on confirm when it was **edited** — resending it would re-count the sighting.

**The row's shape** (Means R1). 560px dialog, no footer, full-bleed rows. Each row: an
initial tile, who / source · day, the amount or a _Needs details_ pill (and a faint warm tint);
labelled Category / Account quick picks; "View email & details" expands into `BodyPreview`
(a card, with `FixRuleLink` as its `footer`) and `ImportDetailsFields`. Confirm reads as
unavailable until an account and an amount are there (`ready`) but stays pressable: pressing it
without an amount sets `amountError` under the Amount field and a danger note; both are derived,
so they clear once the amount is typed or tapped. **"Not a transaction" is undoable**: the
backend has no undismiss, so `useUndoableDismiss` holds the row as "Marked as not a
transaction · Undo" for `DISMISS_UNDO_MS` and only then calls dismiss — at once if the row
unmounts (the review closes). A failed dismiss brings the row back with the reason.

Form state lives in `useImportReview` (one per row): prefill (type and account from the
suggestion), the tapped-line fill, the payload pick target, validation, and the
confirm/dismiss calls. **The account is resolved at render** like the category: a draft whose
account is not among the loaded wallets lands on the suggested one (else the first), so a row
that rendered before Dexie delivered the wallets does not stay on "no account". Errors surface through `messageForApiError` — the UI keys off the
backend's `code`, never its wire `message`. The queue's codes are `inbound.import.*`
(`not_found`, `already_resolved`, `incomplete`, `wallet_invalid`); inbox-only codes stay
`email_sync.*`.

## Refreshing the staged set

The queue is read as a **delta** (`pullInboundImportsDelta` → `GET /inbound-imports/changes`,
watermark entity `inboundImport`, like the ledger's — see
[data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams)).
The reason is not size, it is **meaning**: a pending-only list answers "what is pending now", and
an import that somebody confirmed on their phone simply stops appearing in it — indistinguishable
from one this device had never heard of. The delta names it, carrying the row with its new
`status`, so the cache **evicts** anything no longer `pending` and deletes what the server purged.
Webhook rows arrive with no client event to hang a pull on, so the delta runs from three
places: the app-wide `pullAll` (start, the five-minute loop, window focus, back online), an
inbox scan (`runEmailSync()`), and opening the review (`useRefreshQueue`). It is
**single-flight** — a call made while one runs joins it. A page or pending list that was in flight
when sign-out wiped the database is dropped (`localDbGeneration()`, checked inside the write
transaction), so it cannot refill the queue with the previous user's rows. If the watermark is too old to
honour, the server says so and the pending-only list (`pullPendingImports`) is the fallback.

## Where a ledger entry came from

`SourceSection` (in the transaction editor) reads the entry's `source` marker through
`ledgerSourceOf`: `email:<connection>` → "View source email"; `webhook:<key>` → "View source
payload", with "Added by <key name>" and a "View key" link (`/settings/integrations?key=`);
a bare `webhook:` (key deleted) still shows the payload, without the link. Anything else —
manual, CSV — renders nothing. The body comes from `GET /inbound-imports/by-transaction/{id}`
on demand; a JSON payload renders read-only (no pick bar).

## Contract notes

`InboundImportWire` carries `source`, `connection_id` / `integration_key_id` (one is null),
`source_ref`, `source_label`, `occurred_on`, `merchant_id`, `suggested_subcategory`,
`suggested_type` (`'SPEND' | 'INCOME' | null`), `suggested_wallet_id`, `rule_id`, `has_body` and
`body_format`; the body itself only comes from the detail endpoints
(`GET /inbound-imports/{id}` and `GET /inbound-imports/by-transaction/{transactionId}`, both →
`ImportDetailWire { inbound_import, body_lines, body_truncated, merchant }`). Confirm returns
`{ transaction, inbound_import }`; its `amount`/`currency`/`date`/`merchant`/`note` are all
optional overrides. Backend counterpart:
[inbound-imports.md](../../financial-planner-backend/.agent-context/inbound-imports.md).

## Tests

`api/types.test.ts` (mappers incl. suggestions), `data/lineValues.test.ts`,
`data/pickValues.test.ts` (reading a tapped value per field, the hop order),
`data/sources.test.ts` (`ledgerSourceOf`), `data/sync.test.ts` (delta, eviction, single
flight, a pull overtaken by sign-out), `api/inboundImportsApi.test.ts` (ids encoded into paths), `hooks/useImportReview.test.ts` (prefill from suggestions, late wallets, payload
picks), `components/BodyPreview.test.tsx` (text lines, the tree via the slot, truncated
fallback), `components/PendingImportRow.test.tsx` (a webhook row renders, opens on its
payload, fills from taps and confirms; the inbox row keeps its copy; an unread inbox row links to its inbox's rule editor with `rule` and `sample`; "Not a transaction" undoes, sends after the wait, and sends at once on unmount),
`components/SourceSection.test.tsx` (email, webhook, deleted key).
