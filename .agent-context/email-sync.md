# Email sync (frontend)

`features/email-sync/` — connect inboxes (Gmail / Outlook) and give each an ordered set of
**email rules** that pick out bank and card alerts, read them, and file them into an account.
What a sync stages lands in the shared review queue, `features/inbound-imports/` — see
[inbound-imports.md](inbound-imports.md). **Online-only**: the Dexie table is a server-owned
read cache, not an offline outbox — see the exception section in
[data-layer-and-sync.md](data-layer-and-sync.md#exception-email-sync-and-inbound-imports-online-only-server-owned-cache).
The design reference is Integrations ([integrations.md](integrations.md)): a list of things
you own, an editor dialog with settings on one side and ordered rules on the other, and a rule
editor that swaps in with a back chevron and Done/Cancel. Plan and contract:
`working.local/email-rules/PLAN.md`; backend counterpart:
[email-sync.md](../../financial-planner-backend/.agent-context/email-sync.md).

The tap-to-learn pieces — template types, the mapping and its tapping sub-reducer, labels,
readings, `SampleLines`, `FieldTargetChips`, `FieldLabels`/`LabelChip`, `TapHint`,
`NumberChoice`, `ReadingOptions`, `ReadingSummary`, `TermsInput`, `EditorSection` — live in
the shared `features/text-templates/` ([text-templates.md](text-templates.md)), because an
integration key's text rules use them too. `api/types.ts` re-exports the template types, and
`data/ruleDraft.ts` `describeTemplate` / `cleanTerms`, so the slice keeps importing them from
its own modules.

## Surfaces

| Where                         | What                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Settings → Email sync         | `EmailSyncSection` → `InboxList` → `InboxRow`; `NoInboxCard`; `ConnectInboxDialog`; `InboxEditorDialog`; `DisconnectInboxDialog` |
| Import hub inbox card         | `ScanNowControl` + the inbox summary (`features/import/hooks/useInboxSummary`)                                                 |
| Spending → Review             | `ReviewScanPrompt` — compact Sync now, passed into the queue's `PendingReviewModal` as its `toolbar`                           |
| Review queue, an unread row   | the queue's own `FixRuleLink` → `/settings/email-sync?inbox=&sample=&rule=`                                                     |

## The model

- **An inbox** (`LocalEmailConnection`) holds `autoSync` (sync on app open), `scanFrequency`
  (kept for the background sync to come — the UI says so), `lastSyncedAt` and a **summary** of
  its rules (`EmailRuleSummary`: name, enabled, senders, account, type, auto-confirm) — enough
  for the list. Where an email goes is **the rule's** business, not the inbox's.
- **A rule** (`EmailRule`, fetched with the set when an inbox's editor opens, never cached) is
  a filter (`senders`, `subjectAny`, `bodyAny`, `excludeAny`), a learned **template** (how to
  read the amount — its label, which number, decimal style —, the currency — read from the
  email or fixed —, and optionally the merchant), and routing (`walletId`, `type`, `categoryId` —
  the leaf, a root's or a child's id, wire `category_id` —, `autoConfirm`, `enabled`). The set is ordered; the first enabled
  rule whose filter matches an email handles it. One `version` for the whole set.
- The template is **learned by the server** (`POST …/rules/learn`) from the user's taps — the
  client never builds one. That keeps the heuristic (and later an AI strategy) in one place.
- **Labels, not anchors.** Each field is found by a `TemplateLabel` — `{ text, offset }`: the
  normalised label phrase and how many lines after the label's line the value sits (`0` = same
  line, `-3..3`) — or `label: null` (amount/currency), which reads it by the server's keyword
  lexicon alone. `merchant` is `{ label } | null`. There is no `anchor` any more and no
  fallback for it: the backend migrated stored rules once (plan:
  `working.local/email-label-anchors/PLAN.md`).

## Settings → Email sync

`EmailSyncSection` mirrors `IntegrationsSection`: header, offline/stale line, "Inboxes" with
_Connect inbox_, and a list. `useEmailConnections` renders Dexie first and pulls on mount and on
coming back online; `pullConnections` carries a **write generation** (`data/cache.ts`) so a list
overtaken by a connect, save or disconnect — or by sign-out — is dropped. `useInboxFlow` owns
which dialog is open and why the editor was opened (`EditorIntent`: `fresh` / `fix`).

- **`InboxRow`**: a status dot (`inboxHealth`: accent = reading, hollow = every rule paused,
  warn = no rules — with the sentence "Nothing is read from this inbox until it has a rule" and
  an _Add a rule_ button in place of Sync now), the address, `describeInbox` (provider · rules ·
  last sync), **Sync now**, edit, and a ⋯ menu (Sync now, Sync older emails → 7/30/90/180 days
  or _From a date…_,
  Add a rule, Disconnect). The row owns its own `useManualScan`, so the menu's backfill and the
  button share one state. While it runs the status dot turns into a spinner; progress and the
  outcome show in `ScanToast` (portalled, bottom-centre like the update toast): "Checking for new
  emails…" / "Reading the last 30 days…" / "Catching up…", then the summary with _Review n now_,
  or the error with _Try again_ (re-runs the same request, backfill included). `useScanToast`
  fades a result with nothing to act on after 5s and keeps a failure or a review until closed; a
  dismissal holds only for the state it was made on. On a phone the button hides and the menu has it.
- **Reconnecting.** An inbox whose grant the provider refused comes back from the server as
  `status: 'needs_reauth'` (pulled after every scan). `inboxHealth` then says `signin` — warn dot,
  "Means lost access to this inbox…", **Reconnect** in place of Sync now and at the top of the ⋯
  menu, Sync items disabled. `useInboxReconnect` → `beginInboxReconnect` asks for the
  authorize URL **with the connection id** (the server pins the account and keeps the inbox,
  rules and all) and returns to the page it was pressed on. The same prompt
  (`ReconnectInboxNotice`) shows on the Import hub's inbox card and above the review queue
  (`ReviewScanPrompt`, read live from Dexie via `useInboxesToReconnect`).
- **Connecting** (`ConnectInboxDialog`) picks the provider and leaves via `beginInboxConnect`.
  The callback URL is fixed (the provider apps whitelist it), so the return path travels
  through sessionStorage; `takeConnectReturnPath()` reads it once (same-origin only). Back in
  Settings, `connectedReturnUrl` adds `?inbox=<id>&fresh=1` when the inbox has no rules yet, so
  a new inbox's editor opens straight onto its first rule (one signed in again returns to the
  list). The callback goes straight back on a cancelled consent and shows the error with _Go
  back_ when the server refused it (e.g. `email_sync.oauth.account_mismatch`). First-run setup returns to `/setup` unchanged
  ([onboarding.md](onboarding.md)). `PENDING_SETUP` is no longer written by the backend and
  nothing here resumes on it.

## The inbox editor (`InboxEditorDialog`)

Wide `ResponsiveDialog` (full-height sheet on a phone). Start column: `InboxSettingsForm` —
a Sync card (last synced + `ScanNowControl`), "Sync when I open Means", the background-sync
frequency and the queue's `SkippedShapes` (kinds of email skipped as "not a transaction", with
_Forget them_). End column: `InboxRulesSection` — `EmailRuleList` (drag/arrow-key reorder via the
shared `src/hooks/useDragReorder`, a pause switch per rule, edit, delete, "n of 20", _Add rule_),
each row saying which emails (`describeFilter`), what it reads and by which label
(`describeTemplate`: "Reads amount below “amount”, currency, merchant after “at”"; a null
label reads "by keywords"; the currency is only placed when its label differs from the
amount's) and where they go. Below both: `InboxPendingList`, what this inbox left for review.

**Closing and deleting.** Cancel / close / Esc go through `useDiscardGuard` (P4) twice over:
the inbox editor asks while the settings or the rule set are dirty; the open rule asks while
`ruleEdited` (`openRuleEdited`: the draft differs from the rule it opened, or from a blank new
rule) — back, Cancel and Esc all route through it. A rule's delete asks first (`ConfirmDialog`,
P3) even though it is only a draft change until Save. Wide-dialog footers are `EditorFooter`
(hint or error at the start, Cancel + primary at the end — the hint doubles as why Done/Save is
unavailable); in-body buttons are `SmallButton`. Disconnect is a `ConfirmDialog`.

**One Save** stores whatever changed: the settings PATCH (`useInboxSettings`, the connection's
`version`), then the rule set's PUT (`saveRules` → `recordRuleSummaries` updates the cached
row). A 422 goes beside the rule and control it names (`ruleProblems`: `rules[i].filter…`,
`.template…`, `.wallet_id`, …); a 409 offers _Reload rules_.

The editor loads the inbox's recent mail once (`useInboxSamples` → `GET …/messages`, never
cached) and **tests the working set against it** (`POST …/rules/test`), so each rule row shows
"n recent matches" and the pane says how many recent emails the rules pick up.

## The rule editor (`EmailRuleEditor`)

Swaps the dialog body (title "Rule · name" with a mirrored back chevron; Escape returns to the
inbox). Four numbered `EditorSection`s; desktop keeps the sample beside the steps, a phone
stacks it first.

1. **A sample email** — until one is picked (or after _Change_), `SamplePicker`: the recent
   mail folded by the server's `groupId` (`groupMessages`: identical and near-identical alerts
   are one card, "12 similar", likely alerts first, the rule's own senders first via
   `groupsForSenders`), plus "Find their emails" (`?sender=`) to list more from one bank.
   Picking a group makes its newest member the sample and the rest its `similar` set
   (`similarOf`, capped by `emailRuleSamplesMax`); a new rule's sender and name are seeded from
   it. With a sample, **tagging happens here, on the lines**: `FieldTargetChips` ("Pick a tag,
   then tap its line": Amount, Currency, Merchant · optional, each with a dot that fills once
   tagged), a hint ("Tap the line with the merchant."), and `SampleLines` — each line is a
   button; a tap fills the tag (`pickForLine`: an amount line with one number is pinned by its
   char span, else the line alone), then the tag hops amount → currency → nothing; the merchant
   never steals it. A tagged line wears its tags and highlights the amount's span and the
   currency code in place (`currencyTokens`, `src/lib/lineTokens.ts`); the line under the
   pointer asks "Merchant?", and so does the line the learn read the merchant from by its label
   (`merchantGuess`, a `heuristic` reading) while none is tagged.
   **How each value is found.** The user still only taps values; the server finds each one's
   label. The learn answer carries `labels` (per field, null when untagged or a fixed currency:
   `line`, `text` as the email writes it, `offset`, `source` — `picked` / `same_line` /
   `nearby` / `keywords` — and `verified`, whether re-reading the sample gives back the tap).
   `FieldLabels` lists one `FieldLabelRow` per tagged field under the hint (`TapHint`): a
   `LabelChip` — `Found by “Amount” · line above` / `same line` / `2 lines below`, or
   `Read by keywords (Amount, Total…)` —, in the warn tone with "Couldn’t find this again — tap
   the label line" when not verified. **Change label** enters label-tap mode for that field
   (`OpenRule.labelFor`): only lines within `LABEL_OFFSET_MAX` (3) of the value that carry a
   word before any digit (the value's own line only when words precede the value) are tappable
   (`labelCandidates`, `labelModeOf`); a tap sets the pick's `labelLine` (wire `label_line`)
   and the changed request re-learns. The reducer refuses any other line and stays waiting.
   **Auto** (shown once a label was chosen) drops `labelLine`. A new value tap for a field
   drops its `labelLine`; choosing another number on the same line (`setPick`) keeps it. The
   label line of each field — the user's own first, else the learned one — wears an outlined
   "Amount label" tag on a `fp-surface-2` / `fp-border-strong` line (`labelLineMarks`), apart
   from the accent value highlight. Picking a target, a new sample or a fixed currency leaves
   label mode.
2. **How to read it** ("✓ Learned" once current) — `NumberChoice` asks which number is the
   amount when its line has several (or "the one next to the currency"). `ReadingOptions`: the
   **decimal style** (Auto · 1,234.56 · 1.234,56, with how the tapped value reads each way —
   `readNumber` mirrors the server) and the **currency** (read from the email, or always one
   currency via `CurrencyPicker`, which removes the currency tag). Every change sends a
   debounced learn; `ReadingSummary` shows what the sample reads as, field by field (an untagged
   merchant says "Tag its line in step 1", or shows the default merchant), and `GroupPreview`
   proves the template on the similar emails ("Read 11 of 12").
3. **Which emails** — `RuleFilterForm` (`TermsInput` chips: From, Subject has any of, Email
   text has any of, Skip emails that mention) and `MatchSummary`: the tested working set with
   the open rule as `focus_index`, so it says how many recent emails get through **this**
   filter, what each reads as, and how many an earlier rule takes first.
4. **File into** — `RuleRoutingForm`: name (optional — `fallbackName` sends the first sender),
   account (`WalletSelect` from balances, "Choose when reviewing"), Spend/Income, the category
   (the shared `CategoryPicker` — a category or a subcategory in one pick — with a "Decide when
   reviewing" row), the **default merchant** (optional, ≤ 200, wire `default_merchant`: what an
   email with no merchant line is filed as — the scan records it as the merchant), post without
   review (disabled without an account), rule on/off. Changing the type clears `categoryId`
   (the reducer's `edit`); a 422 on `rules[i].category_id` / `.default_merchant` sits beside
   its control.

**State.** `useEmailRuleEditor` wraps the pure reducer `data/ruleEditorState.ts`: the draft
set, the open rule (`OpenRule`: draft, `mapping` — sample, similar, picks (each with an
optional `labelLine`), options —, target, `labelFor`, `learnedFor`, `autoFilter`), and the
effects: load, the debounced learn and test
(`useDebouncedCall`: one request per burst, latest wins, the previous answer stays while the
next is on its way), and save. **A learned template only lands on the picks it answers** —
the `learned` action carries the request's signature and the reducer drops a stale one.
`templateCurrent(open)` gates **Done** (with `draftProblems`: a template, a sender, a name
within 120, no auto-confirm without an account); the footer says what is missing ("Reading
your sample…", "Tag the amount and currency in step 1."). A rule opened without a new sample keeps the
template it came with. The learned `suggestedFilter` refines the filter **until the user
edits it by hand** (`autoFilter`). `workingSet` is the set with the open draft in place, minus
a rule that has nothing to read yet — exactly what a test sends.

**"Fix the rule".** `?inbox=&sample=<importId>&rule=` opens the inbox's editor, then that rule
(else a new one — `startFrom`), and loads the import's stored body
(`inboundImportsApi.getImport`) as the sample. The queue links here without importing this
slice.

## Sync now

`useEmailSyncBootstrap` still fires one scan per app load with **no options** — the automatic
path (only `autoSync` inboxes, from each cursor) — and it must stay that way. It waits for the
server to confirm the session (`session.verified`), not merely for a signed-in state: an app
opened offline starts signed in from the device's cached user, and scanning then would fail and
use up the load's one scan ([data-layer-and-sync.md](data-layer-and-sync.md#the-offline-session)). Everything else
goes through `useManualScan` (→ `runEmailSync(options)` → `POST /email-connections/sync` with a
body): `ScanNowControl` (Sync now + the _Older emails_ menu + `ScanResultLine`) in the inbox
editor and the import hub, compact in the review queue, and `InboxRow`'s own button and menu.
`ScanNowControl` gates itself on `useOnline()`. Offline, the button, the menu and Retry are
off, and the non-compact form adds an `OfflineNotice`. The compact form stays silent, because
its host (the review queue) already says it is offline.

- **The body is what makes a scan manual.** The backend infers manual mode from _any_ field
  being present; `useManualScan` always sends `limit`, so a manual scan is never `{}`.
- **Sync now catches up.** No `lookback_days` means "since the last sync". The response says per
  inbox whether it was read to the end (`connections[].complete`); while one was not, the scan
  runs again (targeting that inbox when it is the only one behind) up to
  `MAX_CATCH_UP_ROUNDS` (5). The rounds' counts are added up (`combineResults`) into one
  summary; if the cap is hit it says "There's more to read — sync again to keep going."
- **Older emails** re-read a 7/30/90/180-day window (trimmed to `emailSyncMaxLookbackDays`)
  under today's rules; already-staged mail is never restaged, and mail no rule matched is
  re-evaluated. _From a date…_ opens `CustomWindowDialog`: any start date up to today, turned
  into `lookbackDays` by `lookbackSince` (days back + 1, so the whole picked day is read) —
  no contract change. The backend has no end date, so a range always runs to now.
- **`lastSyncedAt` is not the scan result.** A narrow backfill deliberately does not advance the
  server cursor, so the outcome is read from the response, never from the connection row.
- **Single-flight twice.** A second `scan()` while one is in the air is dropped on the client;
  the backend runs one scan per user and refuses a second with **409
  `email_sync.sync.in_progress`**, which is `busy`, not failed: wait 4 s, retry once, stay busy.
- `failures` is always an array. A partial failure renders the counts _and_ a note; `ignored`
  (mail from a rule's sender that no rule matched) is reported as "n didn't match a rule".

## Scanning refreshes the queue

`runEmailSync()` pulls the connections as a full list and then the queue's delta
(`pullInboundImportsDelta`, the queue slice's public helper). Disconnecting calls
`dropConnectionImports` — the server cascades that inbox's staged rows away, and the local cache
mirrors it. Email sync never touches the `inboundImports` table directly.

## Tests

`api/types.test.ts` (connection + rule summaries, both template kinds round-tripped with their
labels and no `anchor`, rule set order and new-rule drafts, reading statuses, learn request
casing with `label_line`, learn result with `labels`, test verdicts, sync result with
defaults), `data/labels.test.ts` (label positions, keyword-only labels, rule-row wording,
label candidates within reach in any script, label-line marks),
`components/LabelChip.test.tsx` (chip text per offset and source, warn tone, the unverified
prompt, Change label / Cancel / Auto), `data/samples.test.ts` (grouping, likely-first, merge, similar cap,
own senders first), `src/lib/lineTokens.test.ts` (spans, Arabic-Indic digits, each decimal style,
auto like the server), `data/ruleEditorState.test.ts` (seeding from the sample, the hop, span
picks, fixed currency, learned-only-for-its-picks, hand-edited filters stop adopting
suggestions, label-tap mode on the Bank Albilad layout — the label line sent with the learn,
far or wordless lines refused, a new pick drops it, a refined one keeps it, Auto, leaving the
mode —, `describeTemplate` by label, Done/Cancel, reorder/pause/remove, routing coherence, startFrom, the working set,
drafts), `data/ruleHelpers.test.ts` (verdict counts, focus matches, `ruleProblems`,
`connectedReturnUrl`), `hooks/useEmailRuleEditor.test.ts` (fresh inbox, debounced learn gating
Done, save with the set version, 422 beside its rule + 409 conflict, fix-the-rule sample),
`hooks/useManualScan.test.ts` (manual body, single flight, in-progress retry, summaries, the
catch-up loop and its cap, ignored mail), `components/RuleMapping.test.tsx` (`SampleLines`
marks and taps, the label-line mark, label-tap mode letting only candidates be tapped,
`NumberChoice`), `components/InboxRow.test.tsx` (summary, Sync now, no-rules
state, offline).

## Not here

Merchants are a slice of their own ([merchants.md](merchants.md)). The stored email is plain
text only, so alerts render as monospace lines rather than as the bank's HTML. Importing a
**file** is the other import source and is entirely local — see [import.md](import.md).
