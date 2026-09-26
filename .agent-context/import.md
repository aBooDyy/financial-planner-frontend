# Import (CSV on the device · templates · batches · undo)

Bringing transactions in from outside the app. Two sources share one hub, the **Settings › Import** pane
(`/settings/import`, `ImportSection`), which also lists recent batches and saved templates: a
connected **inbox** (server-side, online-only — see [email-sync.md](email-sync.md)) and a
**CSV file**, which is read, mapped, reviewed and committed **entirely in the browser**.
No upload endpoint exists and none is wanted: the ledger's source of truth is already Dexie,
imported rows travel the same outbox as a hand-typed one, and a bank statement never leaves
the device. The file wizard itself runs on its own full-width page at `/import` (`ImportPage`)
so the review grid has room; cancelling or finishing returns to the pane. The backend's only part in the CSV path is remembering the _mapping_
(`financial-planner-backend/.agent-context/import-templates.md`).

## Slice

```
src/features/import/
├── api/{types.ts,importTemplatesApi.ts}      # import templates only — nothing else is remote
├── data/
│   ├── csv/{encoding,dialect,dates,amounts,read,caps,errors,messages}.ts
│   ├── csv/{worker.ts,workerClient.ts,rows.ts}
│   ├── csv/__fixtures__/*.csv + *.expected.json   # 14 real-shaped statements
│   ├── {roles,matching,values,validate,reference,predict}.ts # the pure pipeline
│   ├── rowScan.ts                            # the one pass + the lazy row reader
│   ├── pairing.ts                            # transfer rows: pairing, lone sides, the note
│   ├── {mapping,review,rowView,rowEdits,rowEditForm,skippedCsv,importCounts}.ts  # wizard helpers
│   ├── {templates,mappers,mutations,sync}.ts                 # saved mappings
│   ├── {commit,batches}.ts                                   # the only writers
│   └── types.ts                              # the mapping model + the row vocabulary
├── hooks/                                    # useCsvImport (the spine) + one per step
└── components/                               # presentation over the hooks
```

Nothing outside `data/commit.ts` and `data/batches.ts` writes to the database, and neither
touches another feature's tables directly — they call the owning feature's id-carrying
mutations (`createNodeWithId`, `createCategoryWithSlug`, `createMerchantWithId`,
`bulkAddTransactions`, `bulkDeleteTransactions`, `bulkAddTransfers`, `bulkDeleteTransfers`).

## The pipeline, in order

```
File → parseCsvFile (worker) → CsvReadResult{dialect, headers, rows}   ← the raw matrix, held
     → draftForFile → MappingDraft --(the user answers ② and ③)--> Mapping
     → scanRows  (one streaming pass: buildRow → predictRow → pairing)  → RowScan
     → rowReader.at(index)  (one ParsedRow, on the way to the screen)
     → review overrides → commitImport (200-row chunks) → Dexie + outbox → schedulePush()
```

**No duplicate detection** (removed 2026-09-27, user decision): a file is imported as it is.
Nothing is compared against the ledger or against the file's other rows; if a file repeats a
row, that is the file's business. So the importer never reads `db.transactions` at all.

### Nothing is derived before it is asked for

The whole file is read **once per mapping**, and only for a step that asks a question about
the whole file. This is the shape, and it is the fix for a real reported defect (see
_What the wizard costs_):

- **Steps ① – ③ read the raw matrix and nothing else.** `useValueMapping` takes its distinct
  values from `(matrix, columnIndex)`, so answering a value is O(distinct values), never
  O(rows). Picking an alias, applying a template and stepping back and forth cost **zero**
  passes over the file — and not one row-walk either, which is a separate promise; see
  _What an answer in step ③ touches_.
- **`scanRows` is the one pass.** It is chunked (2 000 rows), yields between chunks, aborts on
  a mapping change, and produces **compact per-row state, never rows**: a status byte per row
  (`flags`, with the review rank in the low bits and "left out by a skip mapping" above them),
  the table's order as an `Int32Array` (a counting sort over the three ranks — error, warning,
  ok — stable by construction), the transfer pairs, the status counts and the per-issue counts. At 5 000 rows that is
  ~25 KB against ~2.4 MB for the same file as `ParsedRow[]`.
- **It runs for `columns` and `review` only** (`WHOLE_FILE_STEPS`). Step ② renders "_4 329
  rows: this row has no account_", which is a whole-file fact and cannot be answered any other
  way; step ④ is the review. `useCsvImport` keys the completed pass to
  `{mapping, source, context, merchantIndex, ledgerIndex}` by identity, so leaving review and
  coming back re-uses it and only a real change re-runs it.
- **It waits for the live queries.** Every `useLiveQuery` resolves on its own tick and each
  one changes what a pass would find, so `dataReady` gates the effect — the difference between
  one pass and five when a file is opened.
- **`rowReader.at(index)` is the only place a `ParsedRow` is made after the pass**, from the
  matrix + the current mapping + the pass's transfer pairs. The review table builds the ~26
  rows of its window and no more; `useReviewRows` holds them in a 200-entry LRU so identity
  stays stable and `ReviewRow`'s `memo` keeps biting.
- **The commit streams.** `commitImport` takes a `CommitSource`
  (`{total, cellsAt, rowsAt}`) and pulls 200 rows at a time, so the peak is one chunk rather
  than the file. `merchantSpellings` reads the matrix cells directly and builds nothing.
  `rowsSource(rows)` adapts an array for callers (and tests) that already hold one.
- **Nothing ships a whole-array pass.** `predictRow` is per-row, the scan is its only caller,
  and it never clones a row that did not change. The pure tests map it
  over an array themselves — putting such a `map` back into production is the regression this
  feature is most likely to suffer twice.

### What an answer in step ③ touches

Step ③ is one screen with up to hundreds of rows on it — one per distinct file value — each
carrying a select over every wallet, category or merchant the user owns. An answer writes one
alias. The chain from that write to the screen is what has to stay short, and every link in it
turned out to be longer than it looks:

- **`columnsOf(draft.roles)`, not `columnsOf(draft)`.** The column indices feed the distinct
  values, and taking the distinct values is a walk over **every row of the file**. An answer
  returns a new draft object holding the _same_ `roles` array, so memoising on `draft.roles`
  keeps `columns` → `distinct` → `proposals` all cached, while memoising on the draft made a
  full row-walk the price of answering one question. A real change of roles in step ② changes
  the array's identity and pays for the walk, which is correct.
- **A proposal is a function of `(kind, distinct values, catalogue)` and never of the aliases.**
  `data/values.ts` owns `Proposals` — a map from the file's key to `{value, tier, ambiguity}` —
  and `proposalsFor(kind, values, catalogue)` builds it; `valueRows` and `seedFor` now _receive_
  it instead of computing it. Our reading of what a file value probably means cannot change
  because the user answered a _different_ value, so the matchers (including the scored wallet
  ladder) run once per distinct value per file rather than once per value per answer. The aliases
  still decide what a row **shows** — whether it is answered, with what, and whether an ambiguity
  hint is still worth showing.
- **The target option lists live in their own memo** (`targets`, keyed on the catalogue), hoisted
  out of the `groups` memo. Inside it they got a new identity on every answer, which defeated the
  memo on every row of every group — and they are the same few hundred entries every time.
  `preferredFirst` moved out with them, into the option child: re-ordering a group's options
  around an ambiguous match only means anything in a menu that is open.
- **`describe` narrowed to `draft.aliases`.** It reads them for one thing, the "creating a new X"
  note, so that is all it may depend on.
- **`ValueMatchRow` is `memo`ised with a custom comparator.** `valueRows` rebuilds every row
  object on each answer, so identity cannot be the test: the comparator compares the row's fields
  and every other prop by reference. The callbacks are flattened to `(key, value)` with the
  `kind` bound once per group, because a callback built per row is a new prop on every render.
  `Intl.NumberFormat` is module-level — constructing one costs more than formatting the number
  does.
- **Option elements are not built for a closed picker.** Step ③'s wallet/category/merchant/
  type answers, and the row editor's account and category fields, use `TargetPicker` (Popover +
  cmdk, `shouldFilter={false}`): searchable, icon chips from `TargetOption.icon/color`, parents as
  group headings with subcategories indented (`TargetOption.name` is the short in-group label),
  a check on the chosen option. Its sections are only built while open; the closed trigger
  resolves the chosen option with a lookup. `categoryTargetGroups` (`data/values.ts`) is the one
  builder for category groups, shared by step ③ and the review step's row editor.
  It files spending parents before income ones under sticky _Money out_ / _Money in_ bands
  (`TargetGroup.section`; transfer/adjustment sit under _Other_), and the trigger wears the
  chosen category's direction as a badge (`TargetOption.tag`). Search is substring-per-word,
  case- and accent-blind, over the option and its group name — not cmdk's fuzzy scorer, which
  matched letters scattered across unrelated names. jsdom tests
  that open it need a `ResizeObserver` stub.

`hooks/useValueMapping.cost.test.ts` counts the two quantities that were multiplying, **rows
walked** and **matcher calls**, and asserts that forty answers over a 4 000-row file add **zero**
of either — while changing a column in step ② does add rows walked, because it must.

### Reference-stability rule

The pass depends on `[mapping, source, context, merchantIndex, ledgerIndex]`, by **identity**:
`fresh` is a `===` on the memoised key object, not a comparison of its contents. Anything feeding
it must therefore be reference-stable — `useCsvImport` memoises the merchant index from the raw
Dexie tables rather than taking `useMerchantIndex()`, whose object is new on every render and
once pinned the CPU in an infinite re-derive.

**The same rule reaches step ③.** Anything feeding the distinct values — the roles, the matrix —
must be reference-stable too, for the reason above: they are the input to a walk over every row,
so a new identity is a re-walk. The two halves of the wizard have one rule, not two.

And it reaches the live queries the pass reads. `useLiveQuery` republishes a new array on **any**
write to the table it touches, and a background pull writes every row it receives whether or not
the row moved — so a pull that changed nothing invalidated a completed pass and took the review
screen down with it. `useLiveRows` (with `stampOf`, `id:version:updatedAt` per row) reduces a
table's live rows to one string and hands back the **same array** while that string holds, which
stabilises the five queries the pass depends on (balance nodes, transactions, categories,
merchants, merchant aliases). `version` moves on every write the server acknowledges and
`updatedAt` on every write made here, so two emissions sharing a stamp hold the same data. The
sixth live query, the single settings row, is read for one field and needs none of this.

## Reading the file (`data/csv/`)

- **`read.ts` is the whole read as one pure function over bytes** — decode, detect the
  dialect, tokenise (Papa Parse, type conversion off), cut the preamble away. It lives
  outside the worker so the risky half of the feature is testable without one.
- **`worker.ts` is a thin Vite adapter**; `workerClient.ts` is the typed front door
  (`parseCsvFile(file, {overrides, onProgress, signal})`). The protocol streams
  `progress` → `head` → `rows` in 5 000-row chunks → `done`/`error`. Chunking is not
  cosmetic: sending a 50 k-row matrix in one message costs a **58 ms** main-thread
  deserialisation task against **6.5 ms** chunked, and a test pins the rule.
- **The caps travel in the request.** The worker has its own module registry and would only
  ever see the bundled config snapshot, so `workerClient` reads `configLimits()` on the main
  thread and passes `{maxRows, maxBytes}` in — see [app-config.md](app-config.md).
- **Every detection is a proposal.** Encoding (BOM sniffing, UTF-8 vs windows-1256 decided by
  how many non-ASCII characters sit in Arabic runs), delimiter, quote, decimal separator,
  preamble length, header presence and date format are all inferred and all overridable in
  the Adjust dialog — which **re-reads the file** rather than reinterpreting the old parse. A
  failed re-read keeps the previous reading instead of dropping the user back to the drop
  zone.
- File-level failures are codes, not prose (`import.file.empty` · `too_large` ·
  `too_many_rows` · `single_column` · `unreadable` · `cancelled`), so the wizard and the
  worker boundary speak the same language as an `ApiError.code`. Row-level codes
  (`import.row.*`) are a separate vocabulary owned by `validate.ts`. Both resolve through
  `lib/errorMessages.ts`.
- `readCsv` returns no line numbers (`skipEmptyLines: 'greedy'`), so `ParsedRow.line` is
  `skipRows + (hasHeader ? 1 : 0) + index + 1` and is approximate for rows with embedded
  newlines. Data cells are verbatim; only headers are trimmed.

## The mapping model (`data/types.ts`, `data/mapping.ts`)

- **Roles are the single source of column meaning.** Every column holds exactly one
  `ColumnRole`; `skip` and `note` may repeat, everything else is exclusive. `suggestColumns`
  guesses from a bilingual (en + ar) synonym table over the headers, then sniffs content for
  whatever is left — **98.3 %** accurate over the fixture corpus, with both the floor and the
  exact miss list pinned by a test.
- **`AmountMode` is a shape, not a column**: `signed` (one column plus what a minus means),
  `split` (money-out / money-in) or `typed` (magnitude plus a direction word). Because it
  needs columns the user has not picked yet, the wizard holds a **`MappingDraft`** — a
  `Mapping` minus `amount`, plus `amountKind` + `negativeMeans` — and `toMapping(draft)`
  resolves it or returns `null`. Rows derive only from a complete mapping.
- **`amountUnit: 'major' | 'minor'` is a flag, not a fourth mode**, so it composes with all
  three. It exists because **our own `exportCsv()` writes `amount_minor`** while banks write
  major units: re-importing our own export as major units is 100× off. `detectAmountUnit`
  reads it off the header; the export format was deliberately _not_ changed, because
  anyone's existing scripts read it.
- **Aliases are the whole contract between step ③ and the rows.** `Aliases` maps a
  **normalised file value** to what it means here — a wallet id, a category id (a root's, or a
  child's when the value names a subcategory), a merchant id, a `TxType`, a currency code. `rows.ts` looks each cell up under exactly that key and
  step ③ writes under it; nothing else passes between them.
- **A wallet or merchant `create` target carries its final client id** (`crypto.randomUUID()`),
  minted in the dialog, so those rows carry real ids from the moment they are derived and the
  commit only materialises the entity under them.
- **A category `create` target carries a slug, not an id** — `{kind:'create', parentId, name,
  type, slug}`. `createCategoryWithSlug` mints the id (and returns an existing sibling's when
  the slug is taken), so rows filed under a create carry `pendingCategoryId(target)`
  (`new-category:<parentId>:<slug>`, unique because sibling slugs are) until the commit swaps in
  the real one. `ReviewStep` offers pending creates under the same value, so the row editor and
  the labels read them like any other category.
- **A category created here can be a subcategory.** `CreateCategoryDialog` offers a parent
  `Select` over the user's root categories (plus "— Top level —"); a chosen parent is also
  where the type comes from. The slug is minted there (`uniqueSlug`), and `takenSlugs(parentId)`
  is **sibling-scoped**, counting pending creates under the same parent, so an import may mint
  `other` under two different parents in one run. `commit.ts` calls `createCategoryWithSlug`
  with a **blank colour** for a parented create, so the create service inherits the parent's —
  matching what the local mutation writes.
- **The candidates are the user's own catalog, never the built-ins.** `useCsvImport` builds a
  `CategoryCatalog` from its `categories` Dexie read ([categories.md](categories.md)) and
  flattens it with `categoryOptions(catalog)` — each parent, then each of its children, by
  `id` / `parentId`, with the name (and `"<parent> <child>"` for a child) as the match keys; a
  select's value is the id. Slugs are not match keys: child slugs repeat across parents and
  would turn clean name matches into ties.
- **The default is one per direction.** `MappingDefaults.categoryIds: Record<TxType, string>`
  — a category belongs to one type and the server refuses a row filed under the other
  (`*.category_type_mismatch`), so money out and money in each fall to their own. Step ② shows
  two selects (each type's roots with their children indented — a template may name a child);
  `fallbackCategoriesOf(catalog)` seeds them from `catalog.fallbackFor(type)` (`other` /
  `other_income`, else the type's first root). `readCategory` takes the row's direction, and a
  review edit that flips a row sitting on its old direction's default (a guess, a skipped
  category, a movement turned into spending) moves it to the other default (`applyRowPatch`). `DraftSeed.fallbackCategories` is
  **required, not defaulted**, for the same reason the selectors' catalog param is: the
  compiler names every call site.
- **A category of the other direction is an error, not a silent swap.** `RowContext.categoryTypes`
  (every catalog id plus the import's pending creates, `categoryTypesOf`) lets `validateRow` flag
  `import.row.category_type_mismatch` on a cash-flow row. The draft is kept (`draftFrom` ignores
  this one error) so the row editor opens on it; `isCommittable` holds it back. A cash-flow row
  whose id is **not in `categoryTypes` at all** gets `import.row.category_missing` (an error): a
  review edit still naming a create the mapping no longer makes (`new-category:` placeholder),
  a category deleted mid-session, or an empty default because the catalog was not loaded — none
  of which may reach the ledger. A merchant's learned category is applied (and suggested) only
  when `categoryTypes` holds it **with the row's direction** (`predictRow` takes the map), so a
  stale or other-direction learned id never slips past these checks.
- **Resolution policy is split on purpose.** Wallets, categories and merchants resolve
  **only** through explicit aliases — auto-filing money into an account nobody chose is not a
  guess worth making. Types and currencies fall back to matchers, because they are closed
  vocabularies. `matchCurrency` refuses an ambiguous symbol (`$` has 12 owners) and returns
  null so step ③ asks.
- **The leftovers are answerable in one click.** A long tail of one-row spellings is the
  usual reason step ③ stalls, so each group's header offers a bulk answer for whatever is
  still unmatched — `fillUnmatched(kind, value)` writes one target across every value still
  `UNSET`, never over one already answered. Accounts offer _Skip the unmatched rows_ (a
  `skip` target, so those rows are left out of the import) and Categories _Use ‹default› for
  the rest_ (also a `skip` target, which `readCategory` reads as "filed under the step-②
  default, deliberately" — not a guess, so no `category_defaulted` warning). Both appear
  only while something is left over.

## Transfers and balance adjustments in a file

An export that covers several wallets (Money Lover, our own) holds rows that are neither income
nor spending: each transfer twice — money out of one wallet, money into another — and balance
corrections. Left as cash flow they would double-count every transfer as a spend *and* an
income. They are recognised in step ③ and settled in the pass.

- **Two more category answers.** `CategoryTarget` gains `{kind:'transfer'}` and
  `{kind:'adjustment'}` (select values `TRANSFER` / `ADJUSTMENT` in `data/values.ts`), offered as
  the group _Not income or spending_ at the foot of every category select, next to Create/Skip.
  They are **proposed**, never forced: a value matching `/transfer/i` → transfer, `/adjust/i` →
  adjustment, ahead of the category matcher — `auto` for the exact phrases ("Transfer", "Balance
  adjustment", "Adjust balance"…), `check` for a value that merely contains the word ("Bank
  transfer fee"). Templates keep both as they are (settling and `applyTemplateConfig` only
  touch `create`/`category`); `createPendingTargets` ignores them.
- **`RowIntent`** (`cashflow | transfer | adjustment`) rides on `RowFacts` and `ParsedRow`
  (`readCategory` returns it). The draft stays a `TransactionDraft` whatever the intent — its
  `type` is the **direction** (`spend` = money out of the row's wallet, `income` = in), and it
  keeps the step-② default category so a row turned back into spending in review has one to
  show. A movement is validated harder: a zero amount and a currency other than the wallet's are
  **errors** (the server writes it in the wallet's currency and refuses zero), and it never gets
  `category_defaulted`. `predictRow` skips it — no merchant, no learned category.
- **Pairing rides the pass** (`data/pairing.ts`, called from `rowScan.ts`). A transfer row that
  is readable, not skipped and non-zero is a `PairCandidate`; the pass holds the row back
  instead of recording its status, and `finish` runs `pairTransfers` and
  settles the held rows before the counting sort. The rule: a money-out side pairs with a
  money-in side of the **same currency and amount, in another wallet, at most 2 days apart** —
  the same day first, then the closest, the earliest row on a tie — greedy over the out-sides
  in file order, so a file always pairs the same way. In-sides sit in buckets keyed
  `currency|amount|day`, so each out-side looks at five small buckets: linear in the file (a
  test pairs 10 000 transfers well under a second). The output is `RowScan.pairs` — a map from
  each paired row to `{partner, walletId}` (the partner's wallet) — plus a
  `TRANSFER` bit in `flags` so the tally can count transfers without building rows.
- **A lone side needs its other wallet.** `settleTransfer` (the pass, `rowReader.at` and
  `applyRowPatch` all call it) lays the pair on, or else: the user's own choice
  (`RowFacts.counterpartId`, from a patch), or the **one** other known wallet the note names —
  names are the user's wallet names plus the file's own spellings bound in step ③
  (`transferLookupOf`), whole words, a longer name beating one it contains ("Home bank 2" over
  "Home bank"), two named wallets meaning no answer. Named by the note → warning
  `import.row.transfer_guessed`; none → error `import.row.transfer_unpaired`; itself →
  `…transfer_same_wallet`; another currency → `…transfer_currency`. A lone side **keeps its
  draft** (the table shows its date and amount), so `isCommittable` also checks for errors.
- **The pair is one decision** (`useReviewRows`). Leaving either side out leaves both out
  (`excludedFor` ORs the partner's own verdict, and `toggleRow`/the header checkbox write both);
  a correction to a field the pair was matched on — date, amount, currency, direction, account,
  intent or the other account (`breaksPair`) — writes `unpaired: true` into **both** patches,
  and each side is then re-settled as a lone row. A note edit keeps the pair.
- **Review.** `describeRow` shows "Transfer → STC Pay" / "Transfer ← Albilad Bank" / "Balance
  adjustment" in the category cell and a neutral amount (`tone`). The tally returns
  `plan: {transactions, transfers}` (a pair counts once) for the footer ("Import 1 204
  transactions · 243 transfers") and a line under the summary; `committable` puts a paired row's
  partner straight after it. `RowEditDialog` leads with the amount in an `AmountWell` (tinted by
  the row's kind, the currency as a pill under it), then offers **Spend | Income | Transfer |
  Adjustment** as a `PillSwitch` (`RowKindField`), a money-out/in switch under the last two, and an **Other account** select
  (`WalletSelect`, own wallet excluded) for a transfer; its form logic is `data/rowEditForm.ts`.
- **Commit.** Cash flow and adjustments stream through `bulkAddTransactions` (an adjustment as
  `adjustment_in/out` by direction, no links); transfer rows are collected — a paired side waits
  in a map until its partner arrives, so no chunk boundary can split a pair, and a side whose
  partner never comes is written from its own `counterpartId` — and written **after** every
  ledger row through `bulkAddTransfers(…, 'csv:<batchId>')`, 200 at a time, so the outbox holds
  one run of each kind for the bulk drain. A pair's transfer is dated and noted by the out side
  (the in side's note if that is empty). `LocalImportBatch.transferCount` records them.
- **Undo** groups the batch's legs by `transferId`: a transfer goes whole through
  `bulkDeleteTransfers` (the ledger's bulk delete refuses legs), and is **kept whole** if either
  leg changed since. The dialog, history row and done card count "N transactions · M transfers"
  (`data/importCounts.ts`).

## Matching accounts: the group is a name too, and a tie is a question

A statement names the **bank**; the app names a **wallet inside a group**. "Al Bilad" in the
file is the group here, and the wallet in it is called "Main" — so the group label is a
first-class key, scored beside `name` and `"<group> <name>"` (`walletSignals` in
`data/matching.ts`).

- **A group holding one wallet is not ambiguous** — the value binds to that wallet at 100.
- **A group holding several is** — `resolveWallet` returns `{kind:'ambiguous', group, wallets}`,
  nothing is seeded, and step ③ shows _"Matches the group “X” — choose which account"_ with
  that group's accounts offered first in the picker (`preferredFirst`).
- **Ties are never broken.** `topCandidates` returns _every_ candidate sharing the best score
  and `bestCandidate` answers only when exactly one survives. Two wallets that score alike are
  a question, not a coin flip: picking the first would file money into an account nobody chose,
  and the user would never see that it happened. This applies to categories as well.
- **Spacing is not identity.** `scoreKey` adds one rung above the shared ladder: two keys equal
  once every space is removed score 100, so `ALBILAD` finds `Al Bilad` and `ALRAJHI` finds
  `Al Rajhi`. It is an extra _exact_ key, deliberately not a looser threshold — `AUTO_MATCH_SCORE`
  70 and `CHECK_MATCH_SCORE` 40 are calibrated and stay put. Digits still separate
  `CURRENT****4471` from `CURRENT****9902`.
- The merchant normaliser (`merchants/data/matching.identityKey`) is pinned byte-for-byte to a
  backend fixture and knows none of this; the space-insensitive rung is import-local.

## A kind with no column is said out loud

`KINDS.filter(kind => distinct[kind].length > 0)` used to mean an unmapped account column
rendered **no Accounts group at all**, and every row then failed `import.row.wallet_unresolved`
with nowhere to go. `useValueMapping` now also returns `notices` — one per kind in `EXPLAINED`
(`wallet`, `category`) whose column is missing — rendered as `ValueMissingCard`: what every row
becomes, and where to change it. Marked `unresolved` when there is no fallback account either,
because then the rows have nothing at all to land on. Step ② carries the other half:
`missedRoles` (`data/roles.ts`) names a skipped column whose header holds a role nothing else
carries ("_“Account” isn't mapped_"), and a line appears when no column is Account and no
fallback is set. Step ③ still does **not** block — a user with no accounts would be trapped; the
card explains and review shows the flagged rows.

## Validation and the reference

- `validate.ts` is a **pure, ordered rule table**: facts in, `RowIssue[]` out, read
  top-to-bottom the way a person checks a row. An `error` blocks the row from being
  committed; a `warning` commits by default. `import.row.type_defaulted` and
  `import.row.category_defaulted` exist because silently defaulting a direction or a category
  is exactly the silence this feature must avoid.
- A mapped `reference` rides at the **end of the note** as ` · ref:<id>` (`reference.ts`:
  `withReference` / `referenceFromNote` / `stripReference`), because `t_transactions` has one
  `source` column and the batch marker has to win it. Review and pairing read the note without
  it.
- Saved templates written before 2026-09-27 still carry a `dedupe` key in their `config`; it is
  ignored, and nothing writes it any more.

## Where the user's row-level state lives

**Not on the rows.** A mapping change re-reads every row from the file, so an exclusion or a
correction kept on a row would vanish the moment the user stepped back to ② or ③.
`useReviewRows` holds a `Map<rowIndex, {excluded?, patch?}>` — owned by `CsvImportWizard`, so
it survives leaving the step — and lays it back over each row as it is built. It is
invalidated only by a **re-read of the file** (it is keyed to `csv.file`'s identity), because
a new dialect means the indices no longer point at the same lines.

A correction is stored as a **`RowPatch` — the changed fields only, never a frozen row**.
`applyRowPatch` re-reads that row's own cells through the current mapping, lays the patch over
the facts and re-runs `validateRow`, so a fixed row flips to ready immediately _and_ still
tracks later mapping changes. A transfer pair is carried across rather than re-paired (pairing
is a whole-file question), unless the patch breaks it.

**The corrected rows are the only rows the hook builds eagerly**, and there are only ever a
handful — the user corrects rows, not files. Everything the screen needs about the rest of the
file comes from the pass:

- `tally()` walks `scan.order` once, reading a status byte per row and consulting the override
  map, and returns the counts, the committable row indices and the excluded row indices. It
  builds nothing; a corrected row substitutes its own re-validated status.
- the same two rules (`statusFor`, `excludedFor`) answer per row for the filter, the header
  checkbox and one row on screen, so the summary and the table can never disagree.
- `review.rowsFor(indices)` builds a named set on demand — the skipped-rows download, and
  nothing else.

`csv.actions.updateRows` **is gone**: with no derived array to write into, the trap it warned
about no longer exists.

## A pass landing under the user must not take the screen away

**The defect this shape exists to prevent**, reproduced twice in a browser: with the row editor
open on step ④, a background sync pull arrived, the completed pass was invalidated, `ReviewStep`
early-returned to `ScanProgress` — which unmounted the grid **and the dialog** — and the
correction the user had typed went with it. All 4 329 rows were then re-scanned to arrive back at
the same answer. Three separate things had to be true for that, and each is now fixed where it
went wrong:

- **A completed pass survives a pull that changed nothing** — `useLiveRows` / `stampOf`, above.
- **A still-valid result is not blanked while a new pass runs.** `scanned` carries the
  `CsvReadResult` it was computed over, and `scan.result` stays exposed for as long as that
  _reading_ of the file is the one on screen (`usable`). Whether another pass is **owed** is a
  different question, and `fresh` still answers it. So a re-scan runs underneath a table that goes
  on showing the answer it is replacing. Only a **re-read of the file** — an Adjust that changes
  the dialect — retires the result outright, because new row indices no longer point at the same
  lines: the same rule `useReviewRows` invalidates the user's own row decisions by.
- **`ReviewStep` never early-returns.** `firstPass` is a ternary inside one fragment, and
  `RowEditDialog` is a **permanent sibling** of it, so no scan state can unmount the editor. The
  dialog is split accordingly: a guard, then `RowEditForm key={row.index}` seeded once by
  `useState`. That replaces an effect keyed on `[row, defaults]`, which re-seeded the form — and
  so discarded an in-progress edit — every time anything upstream handed the open dialog a new
  `row` or `defaults` object, which the derive chain does constantly. Keying on the row index
  remounts when a _different_ row is opened, which is the only moment re-seeding is what anybody
  wants.

`ReviewStep.test.tsx` holds the reproduction: it types into the note field, re-renders with the
pass running and a freshly-built `defaults`, and asserts the grid is gone, the progress bar is up,
and the typed text is still there. `useCsvImport.cost.test.ts` holds the other half — a re-`put`
of an identical row costs no pass, and `scan.result` is the **same object** afterwards.

**`ImportDoneCard` reads its batch live** (`useImportBatch`) rather than trusting the snapshot the
commit handed it, because that snapshot cannot know it was later undone — the card used to go on
claiming the rows were imported after the user had removed them. Undone, it says _"Import
undone."_, explains what was kept, and drops the Undo and _See them in Spending_ affordances. Only
`undoneAt` is read live; the counts stay on the snapshot, which is what they described.

## The virtualisation contract (the review grid)

The review table is the one screen in the app that can hold tens of thousands of rows.

- **Fixed row heights** — 56 px desktop, 104 px mobile, declared in `ReviewStep` and handed to
  `useVirtualRows`. This is a deliberate constraint, not a limitation: it keeps the scrollbar
  honest and the arithmetic exact, which is worth more here than a row that grows to fit its
  longest note.
- One scroll container, two spacer paddings, ~8 rows of overscan. `ResizeObserver` measures
  the viewport where it exists; a 560 px assumption stands in where it does not (jsdom), so
  tests still window.
- **The window is keyed on the row index, not the pixel offset**, so a scroll inside the row
  already on screen does no React work at all (median scroll event: 0.28 ms).
- **The window is a list of positions, not of rows.** `ReviewStep` asks
  `review.rowAt(position)` for each position between `first` and `last`; that builds the row
  from the matrix if it is not already in the LRU. Windowing the DOM while deriving every row
  first would have moved the cost, not removed it — so the tests count **rows built**, not row
  nodes: 26 on first paint at 5 000 rows, and a scroll that stays inside the current rows
  builds none at all.
- **`ReviewRow` is `memo`ised**, with `describeRow` called inside it and stable
  `onToggle`/`onEdit` callbacks from the parent. The 200-entry LRU in `useReviewRows` is what
  keeps the `row` prop's identity stable across renders; without it every scroll would hand
  each row a new object and the memo would stop biting. Crossing a row boundary must mount one
  row, not re-render the whole window.
- **A first pass has to be visible, and only a first pass.** `ScanProgress` ("Checking 2 000 of
  5 000 rows…") shows while a pass is running **and there is no result yet** — entering ④ with a
  long file, rather than a table saying "0 rows · 0 ready" under an Import button that claims
  nothing is selected. Every later pass keeps the result it is replacing on screen, so a
  background re-scan never takes the step away from the user (above).
- A 10 000-row test asserts the DOM holds **under 40 row nodes** with the real pipeline behind
  it. Accessibility rides along: the grid is a real `role="grid"`, its spacer div is a
  `rowgroup`, and every row carries `aria-rowindex` plus a one-line `aria-label` summary — a
  virtualised grid gives a screen reader no neighbours to read a row against. Keyboard:
  arrows / `j` `k`, `PageUp`/`PageDown`, `Home`/`End`, `Enter` to edit, with keys pressed
  inside a row's own controls left to those controls, and an `sr-only` paragraph
  (`aria-describedby`) announcing the set.

## Why the raw matrix is held for the whole session

`useCsvImport` keeps `source.rows` for as long as a file is open, and **deliberately does not
release it** — it is now the _only_ whole-file thing held, and everything else reads from it:

- steps ① – ③ answer entirely from it (the distinct values in step ③ are a projection of two
  columns of it);
- the pass reads it once per mapping;
- the review table builds its window from it, and the commit its 200-row chunks;
- `applyRowPatch` re-reads the edited row's own cells through it;
- _Download skipped rows_ quotes the file's cells verbatim, with the file's own delimiter.

It is also **not a second copy of the file** — each `ParsedRow.raw` points at the same array
the matrix holds — so releasing the outer array would free a pointer list, not the data.
Dropping it would mean re-reading the file from disk on every change, which is strictly worse
than keeping the one copy the worker already produced. It goes on `reset()` and on unmount;
unmount also aborts the read, which is what terminates a worker otherwise left holding the
whole file.

## Templates — recognising the file next month

Pure half in `data/templates.ts`, persistence in `mappers.ts`/`mutations.ts`/`sync.ts`, Dexie
table `importTemplates` (**v9**), synced through the ordinary outbox.

- **The signature is `csv1:<fnv1a-hex>` over the header layout**:
  `headers.map(normalizeKey).filter(nonEmpty).join('|') + '#' + delimiter`. The layout is the
  one thing a bank's export keeps from month to month while every cell in it changes.
  Normalisation absorbs what legitimately varies between two exports of the same statement
  (case, padding, punctuation, a BOM, diacritics); empty headers are dropped, because a
  nameless trailing column is an artefact of a trailing delimiter that is there some months
  and not others. What _does_ move it is a different column set or a different order — which
  is exactly when the old mapping would be wrong. The `csv1:` prefix retires every stored
  signature at once if the algorithm ever changes, rather than matching them wrongly.
- **Signatures are not unique.** Several templates may match one file, so the picker ranks
  matches first and **never auto-applies** (ADR-12: a silent auto-apply is right when it is
  right and infuriating when it is wrong, and the user cannot tell which happened). Step ①
  pre-selects the match, and _Continue_ goes straight to ④ when a template resolved into a
  complete mapping; ② and ③ stay reachable from the rail.
- **`ImportTemplateConfig` is the `MappingDraft` plus its own `version`**, and nothing
  transient. Every save stamps `TEMPLATE_CONFIG_VERSION = 2`: categories by id, in the aliases
  and in `defaults.categoryIds`. A **version-1** blob (categories as slug pairs, one default
  `category`/`subcategory`) is still read — `StoredTemplateConfig` is the union, `isConfigV1`
  tells them apart — and `upgradeTemplateConfig(stored, catalog)` (run by `applyTemplateConfig`)
  looks each pair up with `catalog.bySlug(child, parent)` / `bySlug(root)`: a match is kept by
  id, a pair with no match is dropped and reported like a deleted target. The old default keeps
  its own direction; the other direction gets `fallbackFor`. The next save writes it back as
  version 2. `parseTemplateConfig` is tolerant: a blob that is not JSON, not an object, or
  missing a part the apply step reads (for version 2 that includes `defaults.categoryIds`, for
  version 1 `defaults.category`) returns `null`, and the row is cached and listed as **needs
  rebuilding** — still renamable and deletable, never overwritable, so a mapping this client
  failed to read is not destroyed.
- **Applying re-checks the world.** `applyTemplateConfig(config, columnCount, catalogue)`
  drops wallet/category/merchant answers whose target no longer exists and returns them as
  `UnknownAlias[]`, rendered by `TemplateNotice` and re-asked in step ③, so no row can resolve
  to a dead id — a default category that is gone, or no longer of its direction, falls to
  `fallbackFor(type)` and is reported as a `default` notice. A saved role list is aligned to the
  open file's width (`skip`-padded or truncated) rather than silently mis-read. `create`
  targets are **settled** into plain bindings when saved, so a template can never resurrect a
  deleted account: wallets and merchants in `configFromDraft`, categories after the commit by
  `withCreatedCategories(config, result.createdCategories)` (`useImportCommit`), because only
  then do they have ids — a create the commit did not make is left out, and one found in a
  stored config is dropped on apply. _Save as template_ on the Done screen first re-reads
  those ids (`liveCreatedCategories` in `commit.ts`): a create pushed in the meantime may have
  been remapped onto a server twin, and the template must name the twin. A template is only
  applied once the catalog has loaded (`useTemplatePicker`), or every category answer would
  read as deleted. Each `default` notice has its own key (`spend` / `income` / `wallet`).
- **A category id can change under a saved template.** When a category created on this device
  comes back from the server under another id (slug taken there), `remapTemplateCategories(
  fromId, toId)` (`data/mutations.ts`, over the pure `remapTemplateCategoryIds`) rewrites the
  local rows and their queued payloads; the categories slice's remap calls it. Restoring a saved dialect that changes how the file is _parsed_ triggers
  one re-read, then re-applies.
- **Saving is explicit** — _update "X"_ / _save as new_ / _don't save_. A one-time mapping
  writes nothing at all, pinned by a test. One deliberate exception: a _saved_ template the
  import was actually mapped with has its `lastUsedAt`/`useCount` bumped even when the user
  declines to save the mapping, because that use is a fact and it is what orders the picker
  next month.
- **Deleting one asks first** (`DeleteTemplateDialog`, a `ConfirmDialog`): the imported rows
  stay, only the mapping is forgotten.
- `409 import.template.name_taken` is a **name** conflict and must never be rebased; the sync
  branch and the parked-row behaviour live in
  [data-layer-and-sync.md](data-layer-and-sync.md#exception-import-templates-importtemplatename_taken).

## Commit, batches and undo

The commit is the first and only moment an import writes anything, and every write is local —
rows and their outbox entries land in Dexie, and **one** `schedulePush()` lets the sync engine
drain them whenever the network is there. An import committed on a plane is a correct ledger
on a plane.

The order in `data/commit.ts`, and no other: materialise every `create` target — wallets and
merchants under the ids the rows already carry, categories through `createCategoryWithSlug`,
queued **before** any row filed under them, with the pending id → created id map kept
(`CommitResult.createdCategories`) and applied to each draft's `categoryId` as it is written →
file the file's own spelling as an `import`-origin alias on
every bound merchant → write rows in **200-row chunks**, one Dexie transaction each, with a
`setTimeout(0)` yield between them → the batch record last, in its own transaction → one push.
The rows arrive as a **`CommitSource`**, not an array: `rowsAt(start, end)` builds one chunk at
a time straight off the matrix, and `cellsAt(at)` lets the merchant-spelling pass read raw
cells without building anything, so the peak is 200 rows rather than the file.
A merchant that cannot be created (an Arabic-only name normalises to nothing) has its
`merchantId` nulled on the drafts rather than writing rows that point at a merchant the server
would reject.

`source = 'csv:<batchId>'` on every row is the durable, synced fact; the `importBatches` row is
local-only presentation. Undo, the edited-since rule and the chunking rationale are in
[data-layer-and-sync.md](data-layer-and-sync.md#bulk-writes-the-csv-import).

## The inbox source

The pane's other source card is **Sync now** over a connected inbox — `ScanNowControl`,
`useManualScan`, and the "any field present means manual" contract — all owned by the email
sync slice; see [email-sync.md](email-sync.md#sync-now). The two sources have
deliberately opposite architectures: CSV is local-first because it can be, email sync is
server-side and online-only because OAuth tokens and provider APIs cannot live in a browser.

## Tests

`data/csv/__fixtures__/` holds **14 real-shaped statements**, each with a `.expected.json`:
our own export, an Arabic windows-1256 file with a 4-line preamble and a debit/credit pair, UK
`DD/MM` with Paid in/out, US `MM/DD` signed, European `;` with `1.234,56`, tab and pipe
dialects with commas inside descriptions, mixed-currency with **JPY (0 dp)** and **KWD (3 dp)**,
`Amount` + `DR/CR`, a deliberately messy file (ragged, quoted newline, blank line, a repeated
row, `N/A`, a future date), genuinely ambiguous dates, UTF-8 BOM, UTF-16LE BOM, and a Money
Lover export with a same-day pair, a pair a day apart, a lone side named by its note, a lone side
naming nothing and a balance adjustment (`data/__fixtures__/moneyLover.ts` maps it the way a user
would, for the pairing, commit and undo tests). They are the
regression suite for detection, role suggestion and amount parsing at once — add a new
bank shape here before fixing it anywhere else. `__fixtures__/useStubImport.ts` is a working
stand-in for the spine (the same pass and the same lazy reader, run synchronously) for
component tests; it defaults to a freshly seeded account's catalog (`defaultCategoryRows()`,
ids from `catId`).

Categories by id: `data/templates.test.ts` (the v1 → v2 upgrade — pairs by slug, an unmatched
pair dropped and reported, the default per direction, saved back as 2; settling a created
category; a gone default), `api/types.test.ts` (the shape check per version),
`data/sync.test.ts` (`remapTemplateCategories` over a row and its queued payload),
`data/commit.test.ts` (rows written under the created id, the category queued first),
`data/csv/rows.test.ts` (the income default; the type-mismatch error keeping its draft),
`data/rowEdits.test.ts` (a flipped row following the other default).

Five suites guard the laziness, and they guard a **shape**, not a speed:
`data/rowScan.test.ts` (the pass says exactly what a pass over every built row would have
said — counts, order, issue counts), `hooks/useCsvImport.cost.test.ts` (passes and rows
built per user action at 5 000 rows, and a background pull that changed nothing costing none),
`hooks/useValueMapping.cost.test.ts` (rows walked and matcher calls per answer in step ③),
`components/ReviewStep.lazy.test.tsx` (rows built per paint, per scroll and per filter change)
and `hooks/useReviewRows.test.ts` (an exclusion and a patch surviving a mapping change, the
filter-scoped header checkbox).

## What the wizard costs

**The defect this shape exists to prevent.** The derive effect used to be keyed on `mapping`,
and every alias written in step ③ produced a new one — so a file with forty distinct accounts,
categories and merchants cost **forty complete passes over the file**, each allocating the
whole array three times (`buildRowsAsync`, then a prediction `map` into a fresh array, then a
duplicate `map` cloning every row), and each pushing 5 000 objects through `setRows`
into React. A user importing 5 000 rows reported it as "sooooo laggy", and they were right:
the cost was O(values × rows) for work whose answer only needs O(distinct values).

Two kinds of number follow, and they are **never blended**: the **counts** are
environment-independent and pinned by tests, and the **milliseconds** are a browser measurement
belonging to the machine they were taken on. jsdom's per-pick wall clock is not one of them and is
not quoted here — it has no layout, paint or compositor, so it under-reports a pick by an order of
magnitude, and a sub-millisecond figure would read as a claim that answering a value is free. It
is not free; it is cheap enough.

**Counts** — one honest session (open → ② → ③, forty values answered → ④):

|                                     | before                                            | after                                    |
| ----------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| passes over the file, 40 picks in ③ | **40** (200 000 rows built, predicted and cloned) | **0**                                    |
| passes, whole session               | 44                                                | **2** (step ②, step ④)                   |
| rows walked by 40 answers in ③      | **40 × the file** (160 000 at 4 000 rows)         | **0**                                    |
| matcher calls, 40 answers in ③      | every distinct value, forty times over            | **0**                                    |
| whole-file state held               | `ParsedRow[]`, **2.4 MB**                         | status bytes + order + marks, **~25 KB** |

Pinned by `hooks/useCsvImport.cost.test.ts` (passes and rows built per user action, at 5 000
rows), `hooks/useValueMapping.cost.test.ts` (rows walked and matcher calls per answer, at 4 000)
and `components/ReviewStep.lazy.test.tsx` (rows built per paint and per scroll), so the shape
cannot regress silently.

**Milliseconds, in a browser** — a production build on a 20-core desktop, 4 329-row file. These
are the real figures:

|                                    | before         | after        |
| ---------------------------------- | -------------- | ------------ |
| blocked main thread, per pick in ③ | **433–465 ms** | **62–76 ms** |
| the menu hanging open after a pick | ~730 ms        | 319–353 ms   |
| entering step ③                    | **1 383 ms**   | **488 ms**   |

A pick is still not free — sixty milliseconds is a frame and a half — but it is no longer half a
second of dead screen per answer, forty times in a row.

The pass itself is **not faster** — that was never the problem. What changed is how many of them
there are and what survives one. On the Node/jsdom harness one pass costs **179 ms** before and
**181 ms** after; the same harness, at 10 000 rows / 549 KiB, parses in **111 ms** and commits in
**2 815 ms**. The commit chunk size was measured there too, not guessed: 200/500/1000-row chunks
cost 2 655 / 2 369 / 2 148 ms, and 200 was kept — 19 % is not worth coarser progress and a longer
blocking transaction.

**The drain is counted in requests**, because that is what dominates it: a **2 603-row commit
pushes in 3 requests** and a **2 608-row undo in 3 requests / 4.0 s**, where the same undo cost
**~75 s** of continuous HTTP when it was one `DELETE` per row. Both directions now ride the bulk
endpoints — see [data-layer-and-sync.md](data-layer-and-sync.md).

## Open threads

- **Two QA items have never been measured for real**: sustained 60 fps while scrolling the
  review grid on a device, and a commit against a real IndexedDB. jsdom has no layout, paint or
  compositor, so neither can be closed in the test environment — the pass **counts** are
  environment-independent, the milliseconds are not, which is why the step-③ figures above were
  taken from a browser instead.
- **The pass itself is still ~36 µs a row** (validate + the merchant matcher).
  Nothing has been done about that; at 50 000 rows it is ~1.8 s of chunked, yielding work, and
  it is the next thing worth profiling if a long file still feels slow.
- **An error row is not "skipped".** `skipReason` has copy for it, but only rows whose
  `excluded` is true reach the skipped-rows download, and a row that fails to parse is not
  excluded — it simply cannot be committed. Pre-existing, preserved deliberately while the
  laziness work was in flight; worth a decision of its own.
- **`MAX_CONFIG_BYTES` (64 KiB) is hard-coded** in `api/types.ts` to match the backend's
  `import_template_rules.py`; `GET /config`'s `limits` does not publish it, so the two
  constants move together by hand until it does.
- **A parked `nameConflict` template surfaces only in Settings › Import.** The app has no global
  sync/offline indicator of any kind, so the cue belongs with that indicator when it is built;
  inventing global chrome whose only occupant is one parked template would be the wrong shape.
- **`lib/errorMessages.ts` is a single-locale map.** Every `import.*` code the client can
  produce or receive has text in it; a second locale is a seam (the codes stay, the strings
  move), not a second map to maintain by hand.
