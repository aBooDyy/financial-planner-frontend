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
  `SourceSection` + `ledgerSourceOf`, `SkippedShapes`, and the `PayloadViewContext` slot — and sources call
  those. They never read or write `db.inboundImports` themselves.
- The queue never imports a source. Source-specific UI inside it arrives through a slot:
  `PendingReviewModal`'s `toolbar` is where the page passes email sync's `ReviewScanPrompt`,
  and **`PayloadViewContext`** (`components/payloadView.ts`) is how `BodyPreview` draws a
  JSON body read-only under a ledger entry — the root layout (`routes/__root.tsx`) provides
  integrations' `ReviewPayloadTree` (the rule editor's `PayloadTree`, read-only). Without a
  provider a JSON body falls back to pretty-printed text, so the queue works (and tests) on its
  own. The review card draws a payload as pretty-printed lines itself.

## Surfaces

| Where                         | What                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending → Review             | `PendingReviewButton` (beside Add in the Activity transactions card, only while rows are pending) opens `PendingReviewModal` → one `ReviewCard` at a time on a swipeable `CardStack`, `toolbar` from the source |
| Import hub inbox card         | `usePendingImports().count` via `useInboxSummary`                                                                                                                                               |
| Spending → edit a transaction | `SourceSection` (this slice) — the email or payload the entry came from                                                                                                                         |

## The row, locally

`LocalInboundImport` carries `source` (`'inbox' | 'webhook'`) and `bodyFormat`
(`'text' | 'json'`), lowercase like every internal enum (the wire is `INBOX`/`WEBHOOK`,
`TEXT`/`JSON`). At most one parent is set: `connectionId` for an inbox row, `keyId` for a
webhook row — null once its key is deleted (the row survives). `sourceRef` / `sourceLabel` are the sender address and display name for an inbox,
the key's token prefix and name for a webhook — denormalised, so a row outlives a revoked key
and still says where it came from. `occurredOn` is the event's `YYYY-MM-DD`.
`suggestedType` / `suggestedWalletId` / `suggestedCategoryId` are what the source resolved (a
webhook rule's type, wallet and category, a merchant's learned category, or the key's defaults;
an email rule's routing) — the review form starts from them. All are null when the source said
nothing; with no `suggestedType` the form starts on the suggested category's own direction
(else spend). `suggestedCategoryId` is the leaf (a child's id when a subcategory was resolved),
an FK the server moves with a delete's `move_to` or nulls without one — the local cache mirrors
either at once (`categories/data/refile.ts`). Confirm refuses an unknown or foreign id with
`inbound.import.category_invalid` and one of the other direction with
`spending.transaction.category_type_mismatch`, both on `category_id`.

## Reviewing a staged import (Means R1)

Nothing that was parsed is final. `PendingReviewModal` shows **one import at a time on a card
stack** (`CardStack`: "1 of 3", prev/next that wrap, two faint cards behind while more wait),
with the source's `toolbar` above and a pinned footer for the whole queue: what still needs
details, **Ignore all** and **Confirm all · n** (only the ready ones; the rest stay).

**The stack animates with `motion` (`motion/react`, framer-motion's successor).** The top card
is a `SwipeCard`: dragged sideways (mouse or touch) it tilts with the pointer, and a drag past
28% of its width or a flick turns it — toward the reading direction's start (left in LTR, right
in RTL) is **next**, the other way **previous**. Next flies the card off and the next one rises
from the stack; previous sinks the card back into the stack while the previous one flies in over
it. The prev/next buttons play the same turns. A card that leaves without a turn (confirmed,
ignored) fades up. `CardStack` tells these apart by whether a turn was pending when `itemKey`
changed. Gotchas:
- Motion already skips a drag that starts in a text input; a drag that ends over a button or an
  email word has its click swallowed (`onClickCapture`), so a swipe never also taps.
- The card carries `data-vaul-no-drag`, else a slightly diagonal swipe also drags the mobile
  sheet down. Vertical scrolling still works (`drag="x"` sets `touch-action: pan-y`).
- The exiting card stays mounted until its exit ends; it is `inert` + `aria-hidden`, so only the
  new card answers queries and focus.
- The dialog body is `overflow-x-hidden` so a flying card never shows a horizontal scrollbar.
- `MotionConfig reducedMotion="user"` drops the movement for reduced-motion users.

**State lives in the queue, not the card** (`hooks/useReviewQueue`). Every import's edits are a
patch over its prefill (`data/reviewDraft.ts`: `initialDraft` → `resolveDraft`), so paging
keeps them and Confirm all posts exactly what each card would. The card API it hands out
(`ReviewCard` type) has the resolved draft, `draftState` (`amountMissing`, `currencyMissing`,
`needsDetails`, `ready` = amount + currency + account + category), the picked field, the
row's error, the import's `merchant` (`MerchantCategories` or null), and `setField` /
`setType` / `pickCategory` (a category plus its own type) / `use` / `confirm` / `ignore` /
`notTransaction`.
The header counts drafts that still need details, so filling one in updates "1 needs details".

**The card** (`ReviewCard`): the header (`PendingImportHeader`: initial, who — the merchant
title-cased by `displayName`, else the source — source · day, the amount or _Needs details_),
the merchant hint (`MerchantHint`: "✦ Careem — you filed it under" + one `Chip` per category,
the selected one active; tapping one picks it, switching Spend/Income with it), Spend/Income, then `ReviewFields` — amount and currency (red with "Enter it, or tap it
in the email below." while missing), merchant, date, **category (the shared `CategoryPicker`:
a category or a subcategory in one pick)**, account, note ("Defaults to the subject"). Then the
body, then Ignore · Not a transaction · Confirm & add (disabled until `ready`).

- **The body is not cached.** The card fetches `GET /inbound-imports/{id}` when it shows
  (`useImportDetail`); bodies are far larger than the row. Offline the hook doesn't ask. It
  returns "The original message loads when you're back online." and fetches on reconnect. A
  body already on screen survives a dropped connection and isn't refetched.
- **Offline, the queue is read-only.** Confirm, ignore and dismiss are server calls, so
  `PendingReviewModal` shows an `OfflineNotice` and locks every action (`locked = busy ||
  !online`, passed to the card as `busy`). Edits to the drafts still work and are kept.
- **`ReviewEmail` draws the body with what was read in place.** A JSON payload is
  pretty-printed first (`displayLines`; a cut-off one stays as stored), so both sources read
  the same way. `locateReads` finds each value the draft holds — the amount by its **number**
  (preferring a line that also names the currency), the currency by its code (on the amount's
  line when there), the merchant by its text, case-insensitively — and `lineSegments` cuts
  each line into plain text, tappable tokens (`tokenise`, `src/lib/wordTokens.ts`) and the read
  spans, which wear a tag ("Amount", "Currency", "Merchant") and swallow the tokens under them.
- **Pick a field, then tap its text.** The chips ("Wrong? Pick a field, then tap its text")
  show each value or "Not set"; the picked field defaults to the first empty one
  (`firstEmpty`). `fieldForTap` decides what a tap fills: a currency code → currency, a number
  → amount (dashed underline on both, always tappable), and words only while Merchant is
  picked, growing into the name around them (`nameRun`). `readPick` reads the value
  (`data/pickValues.ts`); an unreadable one sets the card's error. After a tap the pick goes
  back to the first empty field.
- **"Fix the rule"** sits in the body's header for every row whose source can take it:
  `FixRuleLink` → `/settings/integrations?key=&sample=` for a webhook row that still has its
  key, `/settings/email-sync?inbox=&sample=[&rule=]` for an inbox row with a body. The queue
  knows only each source's settings **route**, never its code.
- **Ignore vs Not a transaction.** Both are held for an Undo (`useHeldBatch`, `UNDO_MS` = 5 s,
  the dark `UndoToast` over the dialog) and only then sent — at once when another batch is held
  or the review closes; a sent batch stays hidden until the server answers. **Ignore** is a
  plain dismiss. **Not a transaction** dismisses with `skip_similar`, so the source stops
  staging messages shaped like it ("Not a transaction — ones like it will be skipped", when the
  row is `skippable`). Ignore all holds the whole queue the same way. A failed dismiss brings the
  row back with the reason.
- **Confirm is final** (no Undo): "Added to your ledger" / "n added to your ledger" as a
  plain toast. The merchant is only sent when it was **edited** — resending it would re-count
  the sighting. Errors surface through `messageForApiError` (the UI keys off `code`).
- **Merchant category suggestions are local** (`hooks/useMerchantCategories` →
  `data/categorySuggestions.ts`): for each import's `merchantId`, the synced merchant's
  `learnedCategoryId` first, then the categories its local transactions are filed under, most
  used first (later date breaks a tie), catalog-known only, at most 5. Local, so Confirm all
  uses them for cards never opened, and a merchant learned *after* the email was staged (the
  staged `suggestedCategoryId` is frozen) still wins.
- **The category is resolved at render, not on write**: the draft starts with no category;
  `resolveDraft` keeps the user's pick while the catalog holds it under the draft's type, else
  the first of `categoryCandidates` of that type, else `catalog.fallbackFor(type)`. Candidates
  are the merchant's categories then the staged suggestion for an inbox row, the staged
  suggestion first for a webhook row (it may be a payload-named category). So suggestions Dexie
  has not delivered yet apply when they land, and switching Spend/Income re-points it. The account is
  resolved the same way (the suggested wallet, else the first).

**Seeing and forgetting skips.** `SkippedShapes` (exported for sources) reads
`GET /inbound-imports/skips?connection_id=|integration_key_id=` and, when the count is not 0,
says "n kinds of email are skipped because you marked one as not a transaction. Forget them"
(`DELETE` the same route). Email sync mounts it under the inbox settings, integrations under
the key settings.

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
`source_ref`, `source_label`, `occurred_on`, `merchant_id`, `suggested_category_id`,
`suggested_type` (`'SPEND' | 'INCOME' | null`), `suggested_wallet_id`, `rule_id`, `has_body`,
`body_format` and `skippable` (the row has a shape signature and its inbox/key still exists); the body itself only comes from the detail endpoints
(`GET /inbound-imports/{id}` and `GET /inbound-imports/by-transaction/{transactionId}`, both →
`ImportDetailWire { inbound_import, body_lines, body_truncated, merchant }`). Confirm returns
`{ transaction, inbound_import }`; its request (`ConfirmImportWire`) takes `wallet_id`,
`category_id` and `type` (required) and `amount`/`currency`/`date`/`merchant`/`note` as
optional overrides. `POST /inbound-imports/{id}/dismiss` takes an optional `{ skip_similar:
true }` (`dismissImport(item, skipSimilar)`); `GET`/`DELETE /inbound-imports/skips?connection_id=
| integration_key_id=` answer `{ count }` (`inboundImportsApi.skipCount` / `clearSkips`). A
webhook delivery that matches a skipped shape is answered `SKIPPED` and never staged. Backend
counterpart:
[inbound-imports.md](../../financial-planner-backend/.agent-context/inbound-imports.md).

## Tests

`api/types.test.ts` (mappers incl. suggestions), `data/mutations.test.ts` (confirm sends
`category_id` and files the promoted row locally), `data/lineValues.test.ts`,
`data/pickValues.test.ts` (reading a tapped value per field), `data/bodyReads.test.ts`
(locating what was read, line segments, name runs, which field a tap fills, `displayName`,
pretty-printed payloads), `data/reviewDraft.test.ts` (readiness, the confirm input, the
merchant only when edited), `data/sources.test.ts` (`ledgerSourceOf`), `data/sync.test.ts`
(delta, eviction, single flight, a pull overtaken by sign-out), `api/inboundImportsApi.test.ts`
(ids encoded into paths), `components/BodyPreview.test.tsx` (read-only text lines, the tree via
the slot, truncated fallback), `components/PendingReviewModal.test.tsx` (one card at a time and
the queue's counts, the read values tagged in the email with Fix the rule, a tapped number and a
tapped name, Ignore held for Undo and sent after the wait, Not a transaction with
`skip_similar`, held batches sent on close, Confirm all posting only the ready ones),
`components/SourceSection.test.tsx` (email, webhook, deleted key).
