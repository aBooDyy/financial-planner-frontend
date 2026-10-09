# Integrations — webhook keys (frontend)

`features/integrations/` — Settings → **Integrations** (`/settings/integrations`, rail entry
between Email sync and Notifications, Lucide `Webhook` — rail icons are chrome, see
[icons.md](icons.md)). The user mints **keys** that another app (Tasker, n8n, Shortcuts, a
script) sends in `Authorization: Bearer fpk_…` to `POST /api/v1/webhooks/transactions`. What
a key receives is staged into the shared review queue ([inbound-imports.md](inbound-imports.md))
as `source: 'webhook'`.

**Online-only**, like email sync: keys are **server-minted** (the secret does not exist until
the server makes it), so there is no offline write and no outbox entity. Dexie `integrationKeys`
(indexed `'id, status'`) is a read cache so the list renders offline — see
[data-layer-and-sync.md](data-layer-and-sync.md#exception-email-sync-and-inbound-imports-online-only-server-owned-cache).

## Layout

| Layer         | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`        | `types.ts` (key wire ↔ domain, `settingsOf`), `integrationKeysApi.ts` (list/create/update/rotate/remove), `ruleTypes.ts` (rule, locator, dry-run shapes + mappers), `integrationRulesApi.ts` (list / replace / dryRun), `deliveryTypes.ts` + `integrationDeliveriesApi.ts` (the delivery log)                                                                                                                                                                                                                                                                                          |
| `data/`       | keys: `cache.ts` (pull + write generation, `recordRuleCount`), `mutations.ts`, `errors.ts` (`keyFailure`), `health.ts`, `describe.ts`, `draft.ts`, `expiry.ts`, `curl.ts`, `mappers.ts`. rules: `ruleEditorState.ts` (the reducer), `ruleDraft.ts` (bind, hop, `sendable`, summaries), `ruleFields.ts`, `payloadTree.ts`, `tokens.ts` (pattern suggestion), `treeMarks.ts`, `fieldStatus.ts`, `ruleErrors.ts`, `verdicts.ts`, `lastPayload.ts`, `prettyJson.ts`. log: `deliveryText.ts` (outcome headlines + fixes), `throttle.ts` (the row's quota notice)                                                 |
| `hooks/`      | `useIntegrationKeys`, `useKeyFlow`, `useCreateKeyForm`, `useKeyEditor`, `useCopy`; `useRuleEditor` (the rule editor's state machine), `useDryRun` (debounced tester), `useFieldStatusContext` (the list's `useDragReorder` is shared, in `src/hooks/`); `useDeliveries`, `useBuildFromDelivery`                                                                                                                                                                                                                                                                                                 |
| `components/` | `IntegrationsSection` → `EndpointCard`, `KeyList` → `KeyRow`, `NoKeysCard`, `CreateKeyDialog`, `TokenRevealDialog`, `ConfirmKeyActionDialog`, `KeyEditorDialog` → `KeySettingsForm` + `KeyRulesSection` → `RuleList` → `RuleListItem`; opening a rule swaps in `RuleEditor` → `MatchConditionRow`, `TraceBanner`, `SamplePayloadPane` → `PayloadTree` → `PayloadTreeItem`, `ReferenceWarning`, `FieldList` → `FieldRow` → `LocatorInputs` (+ `ConstantInput`, `PatternHelp`), `FieldOptions`, `FieldStatusText`; under both panes `DeliveryLog` → `DeliveryRow` → `DeliveryDetails` → `DeliveryFieldReport` |

## The secret exists once

- `CreatedKey { key, token }` is the only shape with a token — create and rotate return it, the
  list and PATCH never do. The token is handed from the mutation to `useKeyFlow` state, shown by
  `TokenRevealDialog`, and dropped when the user continues. It is never cached, stored, or put in
  a URL (tests assert Dexie never holds it and the DOM loses it on dismiss).
- `TokenRevealDialog` is **not dismissible**: `ResponsiveDialog dismissible={false}` hides the
  close button and blocks Escape and backdrop (Radix `preventDefault` on desktop, vaul
  `dismissible` on mobile). Continue unlocks on copy or after `REVEAL_UNLOCK_MS` (8 s).
- Create → reveal → the new key's editor. Rotate → reveal. Rotating is also how a **revoked** key
  comes back; the backend refuses a PATCH back to ACTIVE (`integrations.key.revoked`), so the
  editor disables Save on a revoked key and the row menu offers Rotate, not Revoke.

## Status and expiry

- Local `status` is only the stored `'active' | 'revoked'`. The wire may say `EXPIRED`
  (presentation, derived from `expires_at`); it maps to `'active'` and is never sent back.
  `keyHealth(key, now)` re-derives `active | expiring (≤ 14 days) | expired | revoked` at render,
  so a cached row does not stay "active" after it lapses.
- Row dot: `fp-accent` active, `fp-warn` expiring, `fp-danger` expired, hollow `fp-text-3`
  revoked — always beside a text label. The second line (`describeKey`) is the key's identity
  in words: status · default account · expiry · last use. Expiring keys count in **days**
  (`Intl.RelativeTimeFormat` unit `day`), not `formatRelativeTime`'s "next week".
- **Throttled.** `throttledUntil` (wire `throttled_until`, cached with the key) is when a key
  over its per-minute quota accepts requests again. `throttleNotice` re-checks it against now,
  so a cached row does not keep saying "throttled" after the window rolls; `KeyRow` shows it as
  a third, `fp-warn` line with a Lucide `Gauge` ("Over its limit of 60 a minute — requests are
  refused, accepted again in 34 seconds."), spoken in seconds (a window is one minute). Not on
  a revoked key.
- Expiry picks: Never / 30 / 90 / 365 days / a date. A key expires at the **end** of the chosen
  local day (`endOfDayIso`). Re-sending an unchanged past expiry is accepted by the backend, so
  the editor passes the stored string through untouched unless the user changes it.

## Editing

`useKeyEditor` seeds a `KeySettings` draft from the key once and PATCHes the **whole** settings
object with the key's `version` (the backend treats omitted nullables as cleared). `applyEdit`
keeps it coherent: a type change clears `defaultCategoryId`, clearing the account turns
auto-confirm off. `draftProblems` checks name (≤ 120), rate limit (1–600) and
auto-confirm-needs-account locally; the server re-checks everything. The default category is
the shared `CategoryPicker` with a "Decide when reviewing" row ([categories.md](categories.md))
— a root or a child, wire
`default_category_id`; `integrations.key.category_invalid` / `default_category_id` go beside it
(`KeyField` `defaultCategoryId`).

One **Save** stores whatever changed: the settings PATCH (key `version`), then the rule set's
PUT (the set's own `version`). Either failing keeps the dialog open with the error in the
footer. The rules pane sits in the end column on desktop and below the settings on a phone.

**The dialogs' shape** (Means "Dialogs & side panes", I1–I4). Create: name (example chips
while it is empty), optional default account, expiry as chips (`ExpiryField variant="chips"`;
the editor keeps the select), `DialogActions` with the offline sentence as its hint. Reveal:
the token in a white `CopyField` with a soft "Copy", a warn `NoteBox`, one full-width button.
Rotate/revoke/delete go through the shared `ConfirmDialog` (rotate: warn tint + green button;
revoke/delete: red) with busy labels. The key editor (920px) closes through `useDiscardGuard`
when the settings or the rule set changed; the rule view's back/Esc/Cancel does the same for
the open rule — `OpenRule.base` is the rule as opened and `openDirty` compares against it.
Deleting a rule from the list asks first (`ConfirmDialog` in `KeyRulesSection`).

## Errors

`keyFailure(error)` → `{ fields: Partial<Record<KeyField, string>>, general }`. A 422 lists every
failing field in `error.details` (`{field, code}`, wire field names) and each goes beside its own
control; a bare code maps through `FIELD_OF_CODE`. **`409 integrations.key.name_taken` is a field
error on `name`, not a version conflict** — nothing here rebases. `failureMessage(failure, shown)`
folds errors for fields a surface does not show into one general line (the create dialog only
shows name/account/expiry). Messages live in `lib/errorMessages.ts` under `integrations.*`
(covered by `errorMessages.test.ts`).

## Refresh and the write generation

`useIntegrationKeys` renders `db.integrationKeys` immediately and calls `pullIntegrationKeys()` on
mount and whenever `useOnline()` flips to online. The pull **replaces** the cached set — but a
list that left the server before a create/rotate/delete landed would undo it, so `cache.ts`
counts mutation writes and drops a pull that was overtaken. It also drops one that was in flight
when sign-out wiped the database (`localDbGeneration()` from `db/db.ts`, checked inside the write
transaction), so the next user never sees the previous user's keys. Offline, every server action is
disabled with a sentence saying why (the section line and the delivery log use the shared
`OfflineNotice`); `stale` shows when the last refresh failed.

## Rules — the editor

A key's rules are **one ordered document** (`GET`/`PUT /integration-keys/{id}/rules`, one
`version` for the whole set — see backend
[integrations.md](../../financial-planner-backend/.agent-context/integrations.md#rules--the-set-and-the-tester)).
No Dexie table: rules are fetched when the editor opens and never cached, like an import body.

**State.** `useRuleEditor` wraps the pure `ruleEditorReducer` (`data/ruleEditorState.ts`):
`rules` (the draft set), `saved` (for `dirty`), `open` (the rule being edited, as its own draft
— Cancel drops it, Done folds it back; a new rule only joins the set on Done), `target` (what a
tap fills: a `LocatorField` or `'match'`), `highlightReference`, `sample`. `workingSet()` is the
set with the open draft in place plus its index — exactly what the dry run sends.
`startWithNewRule` (the create flow via `useKeyFlow.editingFresh`) opens straight onto a first
rule. `sendable()` is the only path to the wire: a field pointing nowhere is left out, an empty
condition becomes `null`, a blank name becomes "Untitled rule", and `group` is 1 when the
pattern has a capture group, else 0 (the whole match) — the UI has no group control.

**Tap-to-bind and the hop.** The selected field is the target. `bindLocator` writes the tapped
node's path, keeping the options the user set (unit, sign, format, map); a date guesses its
`format` (`guessDateFormat`: ISO / epoch by magnitude / a first part above 12 means DMY); a type
seeds its `map` with the tapped word → SPEND. After a bind the target **hops** to the next
still-empty of amount → currency → date and then to nothing (`nextTarget`); an optional field
is only ever the target because the user chose it. Tapping with the condition as target writes
`EQUALS` (value) / `CONTAINS` (a word) / `EXISTS` (a container).

**Words inside a string (`tokens.ts`, over `tokenise`/`nameRun` in `src/lib/wordTokens.ts`).** A string of two or more words renders its words as
child tree items. Tapping one binds the string's path **plus a generated pattern**:
`suggestPattern` picks a capture class from what the field expects (a number for amount,
`\b[A-Z]{3}\b` for a currency code, the date's digit shape, a multi-word name run for
merchant/note/account/category — grown over neighbours until a lower-case connector, a date or
a decimal), then tries candidates from most general (the shape alone) to most anchored (the
literal neighbouring words, `\s+` for spaces) and keeps the first whose **first match in JS is
exactly the tapped span** (`RegExp` `d` flag). Only constructs JavaScript and Python's `regex`
read alike are used. No reliable candidate → the whole value is bound and the user writes one.
So the Tasker SMS (`$.text` only) resolves amount, currency, date and merchant from four taps.

**The tree (`PayloadTree`).** `role="tree"`, nested `treeitem`/`group`, roving `tabIndex`,
`aria-level`/`aria-expanded`, `aria-label` = "key: value, fills Amount, press Enter to use for
Currency". Keys: ↑/↓, Home/End, → opens then enters, ← closes then goes to the parent, Enter or
Space binds (toggles a container). The root is never listed. It is an LTR island (`dir="ltr"`)
in either direction; the path of the pointed/focused item shows under it. Token ids are
`<path>*<n>` — `*` can never end a path in the grammar. Keys that need it are written
`$["a.b"]` (`childPath`). `treeMarks` puts each field's label on the node its path reaches, or on
the words its pattern keeps. The component is keyed by the sample text, so a new sample resets
what is open.

**The dry run (`useDryRun`).** Debounced `DRY_RUN_DEBOUNCE_MS` (250) over a JSON signature of
`{keyId, payload, rules, focusIndex}`, latest-ticket-wins. It sends the working set and the open
rule's index as `focus_index`, so the open rule's fields are read **as if its condition had
matched** (`result.focus`) while `trace`/`matchedIndex` still say which rule really fires.
A 422 naming rule fields is retried once without those locators, so one bad pattern shows its
message beside its field and every other field keeps its line. The previous answer stays on
screen while the next is on its way, except when the focus rule changes. Off when offline or
when the sample does not read (`readSample`: empty / invalid JSON / not an object / over
`integrationPayloadMaxBytes`).

**Status lines (`fieldStatus.ts`, `FieldStatusText`).** One per field, `id` = the inputs'
`aria-describedby`, so a screen reader hears the value change. OK → "Reads SR 152.75" (money via
`formatMoney`, dates via the user's date format, accounts/categories by name); the five failure
states say what differs: path not found, "Found “…” but the pattern matched nothing", timeout,
"“…” is not a number / a currency Means knows / a date in the layout chosen below", and
UNRESOLVED (amount: no currency to read it in; type: not in the map → the key's default).
Unset fields say their fallback (the key's default currency/account/category/type, the day it
arrives). **Categories come back as a leaf id plus a name snapshot**: both the dry run's and a
delivery's `resolved` carry `category_id` and `category` / `subcategory` (the root's and the
child's **names** at the time → `categoryText` / `subcategoryText`; all nullable, and a delivery
logged before ids has slugs there with a null id). The snapshot is shown as it is when present,
so the log still reads right after the category is renamed or deleted; otherwise
`useFieldStatusContext`'s `category(id)` names the id from the live catalog (root's name for the
Category line, its own for the Subcategory line) — two children sharing a slug (`maintenance`)
can no longer be confused, which a lookup by bare slug could. The webhook response's `parsed`
carries only `category_id`. **Constants stay text**: a
rule's constant category/subcategory is the slug the server resolves like a payload value
(`ConstantInput` — the category picker emits a root's slug, the subcategory picker a child's,
each slug once). Values sit in a `<bdi>` so a Latin value reads correctly in an RTL sentence.

**Which rule fires.** `TraceBanner` (rule view) says: this rule handles the sample (+ what
ingest would do: stage / post / ignore), its own condition fails (with the server's detail), or
rule _n_ matches first — move this one above it. `KeyRulesSection` badges each row
(`ruleVerdicts`: fires / doesn't match / not reached) and summarises the sample's fate.

**Reorder.** `RuleList` (`<ol>`) with a handle per row: pointer drag via `useDragReorder`
(pointer capture, live reorder on crossing an item's midpoint, `touch-none`, `data-vaul-no-drag`
so the mobile sheet does not take the gesture), or focus the handle and use ↑/↓ — each move is
announced in an `aria-live` region. Order changes go through the same PUT as everything else.

**Reference warning.** A rule with no `external_id` shows the fingerprint nudge; _Fix this_ adds
Reference, makes it the target and rings `referenceCandidates` (`id`, `uuid`, `ref`,
`reference`, `txn_id`, `*_id`, …) in the tree, or says none look like an id.

**Use last payload.** `lastPayload(keyId, PAYLOAD_SOURCES)` walks sources best-first:
`newestDeliveryPayload` (the newest delivery whose payload reads as a JSON object — it records
every request, not only those that staged something), then `newestImportPayload` (the newest
cached inbound import for the key with a body, fetched via `GET /inbound-imports/{id}` and
re-joined from `body_lines`). `deliveryPayload(delivery)` is the whole payload of one delivery:
its excerpt when that parses as an object, else — when the excerpt was cut at 2 000 chars — the
staged import's full body.

**Deep link.** `/settings/integrations?key=<id>&sample=<import id>` (validated in
`routes/settings/integrations.tsx` — each param must be uuid-shaped (`lib/uuid.ts` `isUuid`) or it
is dropped, read in `IntegrationsSection` through
`getRouteApi('/settings/integrations')` — the route module imports the section, so the section
must not import it back). `key` is `useKeyFlow`'s initial `editingId`; `sample` goes to
`useRuleEditor({ sampleImportId })`, which loads that import's body (`importPayload`) as the
sample and opens the first rule on it, or a new rule when the key has none. Closing the editor
drops the params (`replace`). Used by the review queue's "Fix the rule" and the transaction
editor's "View key".

**Errors.** `ruleProblems(error)` parses `rules[i].fields.<field>.<part>`, `rules[i].match…`,
`rules[i].name` into per-rule, per-control messages (shown beside the control and as "Needs a
fix" on the row); anything else is one general line. Save problems are tied to the set they
were about and vanish once it changes. A 409 on save is a conflict with another editor: the
pane offers _Reload rules_ (discards local edits).

**Layout.** Opening a rule swaps the dialog body for `RuleEditor` (title "Rule · name" with a
back chevron that mirrors in RTL; Escape/close returns to the key rather than closing). Desktop:
two panes, sample (sticky) then fields; phone: stacked, sample on top because a tap fills the
field below it, in a full-height sheet (`ResponsiveDialog sheetClassName`). Path and pattern
inputs are `dir="ltr"` monospace; labels and help follow the page.

## Text rules

A key also receives **plain text** — a bank SMS forwarded as-is — read by **text rules**, the
email rule model under a key (backend:
[integrations.md](../../financial-planner-backend/.agent-context/integrations.md#text-messages-and-text-rules)).
One set mixes both kinds; a payload is read only by rules of its kind.

- **The sample.** `readSample` mirrors ingest: a JSON object (`kind: 'json'`, `value`), a body
  that does not parse and does not open with `{` (`kind: 'text'`, `lines` from
  `textLines`), else a problem. Everything that took a JSON object — the dry run, _Use last
  received_, _Build a rule from this_ (`readsAsPayload`; a cut text excerpt falls through to
  the import's full body), the Fix-the-rule deep link — takes text too.
- **The model.** `IntegrationRule.text: TextRule | null` — `{filter: {textAny, excludeAny},
  template | null, walletId, type, categoryId, defaultMerchant}`; a JSON rule has `text: null`,
  a text rule an empty `match`/`fields`. Wire `kind: 'JSON' | 'TEXT'` (`toRuleWire` refuses a
  text rule with no template — `hasTemplate`). `newRule(count, kind)`; `sendable` cleans the
  terms and the default merchant.
- **The reducer.** `add` without a kind makes a text rule when the sample is a message
  (`textSampleOf`), a JSON rule otherwise; `kind` switches a **new** rule. An open text rule
  holds a `tapping` ([text-templates.md](text-templates.md)) on the sample's lines, reset by
  every `sample` change; `{type: 'tap', action}` forwards to `tappingReducer`; `learned`
  lands only on the taps it answers (signature); `editText` (a type change clears the
  category) and `textFilter`. `templateCurrent`: until something is tapped a rule keeps its
  template; after, only one learned from those taps. `workingSet` leaves out a new text rule
  with nothing learned yet.
- **The hook.** `useRuleEditor` adds the debounced learn (`useDebouncedCall` →
  `integrationRulesApi.learn` → `POST …/rules/learn`, the sample sent as its lines joined by
  `\n`), `learned` / `learnError` for the taps on screen, and `openProblem` — why Done is
  disabled ("Tap the amount and currency on the sample.", "Reading your sample…"), shown as
  the footer hint.
- **The editor.** `RuleEditor` keeps the name, a _This rule reads_ switch (new rules only) and
  `TraceBanner` (worded for a filter with `textRule`), then hands a text rule to
  `TextRuleEditor`: `TextSampleStep` (paste / _Use last received_ / _Edit_, then
  `FieldTargetChips`, `TapHint`, `FieldLabels`, `SampleLines`), `TextReadingStep`
  (`NumberChoice`, `ReadingOptions` and `ReadingSummary` with `noun="message"`),
  _Which messages_ (`TextFilterForm`, `TEXT_TERMS_MAX` 10 — the server's own — and whether
  the sample gets through) and _File into_ (`TextRoutingForm`: account and category fall back
  to the key's defaults; auto-confirm stays the key's).
- **Elsewhere.** `RuleListItem` describes a text rule by `describeTextFilter` and
  `describeTemplate`; `ruleProblems` puts `rules[i].filter…`, `.template…`, `.wallet_id`,
  `.category_id`, `.default_merchant` beside their controls; `statusLine` says `NOT_FOUND`
  ("Couldn’t find it in the message"); the queue calls a webhook's text body a **message**
  (`bodyNoun(format, source)`).

## Endpoint and limits

The endpoint card shows `config.integrations.webhookUrl` (the deployment's `WEBHOOK_BASE_URL`)
or, when that is null, `apiOriginUrl(webhookPath)` — the origin the app reaches the API on.
`integrationKeysMax` disables _New key_ at the ceiling with a sentence; `integrationRulesMax`
caps _Add rule_ ("n of 10"); `integrationPayloadMaxBytes` bounds the sample. See
[app-config.md](app-config.md).

## In the review queue and the ledger

`components/ReviewPayloadTree.tsx` is the payload tree, read-only (no marks, taps ignored,
`explainWords={false}`), as a webhook-sourced transaction's `SourceSection` shows the payload it
came from. The queue does not import it — the root layout provides it through the queue's
`PayloadViewContext` ([inbound-imports.md](inbound-imports.md)), so sources depend on the
queue and never the reverse. The review card itself draws a payload as pretty-printed lines
(like an email), so both sources are corrected the same way. The queue links back here
through the _Deep link_ above.

**Skipped deliveries.** Under the key's settings, `SkippedShapes` (from the queue) says how
many kinds of delivery the key skips because the user marked one "Not a transaction", with
_Forget them_. Such a delivery is logged with the outcome `SKIPPED`.

## Delivery log

`DeliveryLog` sits under the settings and rules panes of the key editor (stacked on a phone):
the key's last 50 requests from `GET /integration-keys/{id}/deliveries`, newest first,
**refusals included**. Fetched when the editor opens and on _Refresh_ (`useDeliveries`), never
cached — offline it says the log needs the server. A reload keeps the rows on screen; the result
is tagged with its key id, so switching keys never shows the previous key's rows.

- **Row** (`DeliveryRow`, a shadcn `Collapsible` `<li>`): tone dot + headline
  (`summarizeDelivery`), the rule's name as it was when the request arrived, and the relative
  time (`formatRelativeTime`; exact date+time in `title`). Tones: posted/staged-complete `ok`,
  staged-with-missing-fields / unmatched / ignored `warn`, refused `error`, duplicate `idle` —
  always beside the text, never colour alone.
- **Opened** (`DeliveryDetails`): the fix for a refusal (`deliveryText.REFUSED` — wrong secret →
  re-paste or rotate; revoked → rotate; expired → a later expiry; over the limit → "the rest of
  that minute's requests were refused too and aren't listed", because only the first refusal of
  a window is logged; too large; not a JSON object; failed on our side); for a delivery no rule
  handled, each rule's `didn't match (<detail>)`; the **per-field report**
  (`DeliveryFieldReport`) — each field the rule read or is missing, through the rule editor's
  own `statusLine` / `FieldStatusText`, so "why did nothing happen" reads exactly as the tester
  would have said it; the payload excerpt in an LTR `<pre>` (pretty-printed; "first 2,000
  characters" when cut). A wrong-secret row has no payload: "Nothing it sent is kept".
- **Build a rule from this** (`useBuildFromDelivery` → `deliveryPayload` →
  `useRuleEditor.startFromPayload(text, ruleId)`, which dispatches the `ruleId` and lets the
  reducer's `startFrom` resolve it against the set as it is _then_ — the payload is fetched first,
  and the user may reorder or edit rules meanwhile): the payload becomes the sample and the editor
  opens **the rule that handled it** ("Open its rule with this payload"), else a new rule ("Build
  a rule from this"), else — at the rule ceiling — the first. Offered only when there is a JSON
  object to build from (`canBuildFrom`). `RuleEditor` scrolls its root into view on mount,
  because the dialog body is reused from the key view and would keep the log's scroll offset.

## Tests

`api/types.test.ts` (mappers, EXPIRED, token only on created), `data/keyRules.test.ts` (health,
describe, draft, errors, expiry, order), `hooks/useIntegrationKeys.test.ts` (cache-then-network,
offline from Dexie, failed refresh, 409 as a field error, token never cached, revoke/delete),
`components/TokenRevealDialog.test.tsx`, `CreateKeyDialog.test.tsx`, `KeyRow.test.tsx`;
text rules: `data/textRules.test.ts` (wire mapping both ways, no template no send, cleaning,
filter wording, text samples, the kind of a new rule and the switch, learned-only-for-its-taps,
a saved template kept until a tap, taps dropped with the sample, routing coherence, the working
set, refused parts beside their controls), `useRuleEditor.test.ts` (learn from taps, Done
gated), `deliveries.test.ts` (building from a message, never from a cut one);
rules: `data/ruleData.test.ts` (tokens and pattern suggestion — incl. the four Tasker words —,
date guessing, path quoting, sample reading, visible ids, reference candidates, the reducer's
hop / optional-never-steals / condition binding / Done-vs-Cancel / working set / reorder,
`sendable`, `bindLocator`, `ruleProblems`, `treeMarks`), `data/fieldStatus.test.ts` (a
resolved child named by id on both lines, two same-slug children told apart, a root with no
subcategory, a delivery's logged words as they are, the key default's label),
`hooks/useRuleEditor.test.ts`
(fresh-key rule, draft dry run debounced to one call, save with the set version + cached count,
422 beside its rule, 409 conflict, retry without a refused pattern, no run without a sample),
`components/PayloadTree.test.tsx` (nested render, dotted key path, word binding, the keyboard
contract), `components/RuleList.test.tsx` (summaries, keyboard reorder + announcement,
`FieldRow`'s `aria-describedby`). Delivery log: `data/deliveries.test.ts` (wire mapping,
headlines and fixes, building from an excerpt vs. a cut excerpt's import, _Use last_ preferring
the log then falling back to imports, `throttleNotice`), `components/DeliveryLog.test.tsx`
(wrong secret with its fix and no payload, the failing-field lines, handing payload + rule to
the editor, a new rule for an unhandled delivery, offline), `KeyRow.test.tsx` (the throttle
line and its expiry), `useRuleEditor.test.ts` (`startFromPayload` opening the handling rule or
a new one; by id after a reorder), `hooks/useDeliveries.test.ts` (no previous key's rows while
the next loads), `api/integrationKeysApi.test.ts` (ids are `encodeURIComponent`-ed into paths —
every API module in this slice and the queue does so).
