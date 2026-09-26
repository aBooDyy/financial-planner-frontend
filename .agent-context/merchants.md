# Merchants (identity · local matching · adopt-and-remap)

Who the user pays, as a first-class synced entity. A merchant's identity is a **set of
strings**, not one string: a bank alert, a card network and a CSV each spell the same shop
differently. Matching is **hybrid** — the client matches locally against the synced cache, the
server owns creation and uniqueness. Backend counterpart:
`financial-planner-backend/.agent-context/merchants.md`.

## Slice

```
src/features/merchants/
├── api/{merchantsApi.ts,types.ts}
├── components/MerchantOptions.tsx         # search existing / create — the transaction dialog's merchant pane
├── hooks/useMerchantName.ts              # a merchant's display name by id, with a just-created fallback
├── data/{mappers.ts,matching.ts,adopt.ts,mutations.ts,sync.ts}
│   └── __fixtures__/normalize_key_cases.json   # copied verbatim from the backend suite
└── hooks/{useMerchants.ts,useMerchantMatch.ts}
```

Dexie declares `merchants: 'id, dirty, deleted'` and
`merchantAliases: 'id, merchantId, normalizedKey, dirty, deleted'`, and `transactions` carries
a `merchantId` index (the adopt branch repoints rows by merchant, and the
merchant list counts them). Both tables are wiped by `clearLocalDb()`. `OutboxEntity` carries
`'merchant'` and `'merchantAlias'`.

## `normalizeKey` — one algorithm, two languages

`data/matching.ts` ports the backend's `normalize_key` exactly: lowercase → every run outside
`[a-z0-9]` becomes one space → trim → first 120 characters. Digits are kept on purpose
(`carrefour 402` ≠ `carrefour 118`): two rows that should be one can be merged, one row that
swallowed two merchants cannot be split. Non-ASCII letters are dropped, so an Arabic-only name
normalises to `""` — the UI must offer a Latin spelling rather than crash (`isUsableAlias`).

Truncation happens _after_ the trim, so a key over 120 characters can end in a space the
server's re-normalisation strips. **`identityKey` applies the function twice** and is what we
store and compare with; `normalizeKey` is the raw, fixture-pinned step.

`__fixtures__/normalize_key_cases.json` is the same file `tests/unit/test_merchant_rules.py`
asserts. `matching.test.ts` runs all 22 cases. Change the algorithm and the fixture in the same
commit on both sides, or identity silently diverges.

**Known gap, pinned so it cannot move by accident.** Because non-ASCII is dropped, an
Arabic-only merchant name has no identity at all — in a bilingual product that is a real
limitation, not a curiosity. Every caller therefore guards with `isUsableAlias` before a round
trip: the create row is disabled with a usable message, and the CSV import skips such a
spelling rather than sending one the server answers `422 merchants.alias.invalid` to. Widening
the normaliser means changing the fixture, the Python original and this port **together**.

## The scored ladder

`matchMerchant(raw, { merchants, aliases })` returns the best candidate:

| Signal                                          | Score                  |
| ----------------------------------------------- | ---------------------- |
| Exact hit on a stored **alias**                 | **100, short-circuit** |
| Exact normalised equality with the display name | 100                    |
| One contains the other as a whole-token run     | 70                     |
| Jaccard token overlap (both sides ≥ 2 tokens)   | 40–69, proportional    |
| Levenshtein similarity ≥ 0.82, both ≤ 16 chars  | 60                     |
| Otherwise                                       | 0                      |

`AUTO_MATCH_SCORE` (70) applies automatically; `CHECK_MATCH_SCORE` (40) pre-selects but asks.
Ties go to the merchant with the higher `timesSeen`. The import feature reuses this matcher
rather than owning merchant logic of its own.

## `auto_categorize` is read here

The backend stores the flag and deliberately never acts on it. `useMerchantMatch.predictionFor`
is the one place it is read: **on** ⇒ the learned category is applied silently, **off** ⇒ it is
offered as a suggestion. A `CategoryPrediction` is `{ categoryId, apply }` — the leaf id the
merchant was last filed under (`learnedCategoryId`, wire `learned_category_id`, an FK the
server nulls when the category is deleted without a move); its direction is the category's.
`useTxEditor.setMerchant` applies or stashes it, and only when the learned category belongs to
the type the row is being filed as (the CSV importer checks `learnedType`). `MerchantOptions`
and Settings' `MerchantRow` name it with `catalog.labelOf` ("Dining · Cafés").

## Sync — standard, plus one branch

Merchants follow the usual optimistic-write → outbox → `schedulePush()` pattern. Aliases ride
inside the merchant's queued `create` payload while it is still pending; once the merchant has
synced, a new spelling becomes its own `merchantAlias` outbox entry. Every alias records where
it came from — `AliasOrigin` is `'email' | 'import' | 'manual' | 'webhook'` (`MANUAL` by default,
`'import'` from a CSV commit) — which is how the Settings list can say why a merchant answers
to a string nobody typed. The server mints its own
alias ids, so a local alias row is replaced by the server's on the push response — and a row
that never synced can only be dropped locally, never `DELETE`d remotely.

**Pulling is two delta streams, run one after the other** (`pullMerchantsAll`): merchants, then
aliases. Merchants and their spellings grow on their own — every alert and every import can add
one — so both are watermarked reads rather than full lists
([data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams)).
Aliases need a stream of their own because **forgetting a spelling moves nothing on the
merchant**: the merchant's own row is untouched, so only the alias stream can report it. And the
order is load-bearing in the other direction: a merchant item restates that merchant's _whole_
alias set, so applying the aliases **last** is what stops a tombstoned spelling from being
written straight back by its merchant's page. On a first sync the merchant stream delivers every
merchant with its aliases, and that per-merchant reconciliation is why the alias stream needs no
reconciliation of its own.

### Adopt-and-remap (`data/adopt.ts` + `data/sync.ts`)

`POST /merchants` answers `409 merchants.alias.taken` when one of our proposed identifiers
already belongs to another merchant of this user. **Nothing is written**: our temp merchant does
not exist server-side and can never be patched or deleted remotely. The winner's id rides in
`details[0].value` (`ApiError.fieldValue('merchant_id')`; `FieldError` gained an optional
`value` for this).

`planAdoption` is pure and decides, `adoptWinner` applies it in one Dexie transaction:

1. Local transactions pointing at the temp id are repointed at the winner.
2. A transaction whose push is **still queued** has its queued payload's `merchant_id` rewritten
   in place — no second op. Only rows the server has already seen earn a real `PATCH`.
3. The temp merchant row and everything queued for it are deleted.
4. Its spellings move onto the winner and queue as ordinary alias adds (the endpoint is
   idempotent, so re-sending one the winner already owns costs nothing). A spelling a _third_
   merchant owns is discarded rather than pushed into another 409.
5. If the winner is not held locally (invented on another device) a pull fetches it.

`adopt.test.ts` covers the planner; `sync.test.ts` forces the real 409 against Dexie
(`fake-indexeddb`).

**A bulk import goes down this branch too, and unchanged.** A CSV commit creates merchants
with `createMerchantWithId` under ids its rows already carry, so if one of those ids loses the
alias race, step 2 above is what saves the import: the imported transactions are still queued,
so their payloads are rewritten in place and no second op is enqueued for hundreds of rows.
This is the branch most worth not breaking — it is rarely taken and it is where an import
would otherwise lose its merchant links silently.

### Merge

`POST /merchants/merge` carries the **source's** version and is deliberately **not** queued
through the outbox: the server repoints transactions and inbound imports in one transaction and
bumps every version it touches, so the client pulls merchants + transactions afterwards rather
than guessing. It therefore needs a connection, and failures surface in the dialog.

## UI

- **The transaction dialog** has a "Where?" merchant field, opening `MerchantOptions` as a pane (transactions only — recurring schedules have no
  `merchant_id`), so a hand-entered row can finally be tagged. A learned category the flag did
  not auto-apply shows as a one-tap "Usually Groceries — use it" chip.
- **Settings → Merchants** lists them by `times_seen` descending, which puts the near-duplicates
  a bulk import creates where they can be renamed, merged, or have a stray spelling forgotten.
- **Merge suggestions** (`data/suggestions.ts` → `hooks/useMergeSuggestions` →
  `settings/components/MergeSuggestionsCard`) sit above that list. Every pair of merchants
  **that shares a whole alphabetic word of 3+ characters** is scored with the same ladder,
  over display names _and_ stored aliases; a pair reaching `CHECK_MATCH_SCORE` is offered.
  The word requirement is the filter and the rule: a shared _number_ is a branch code, so
  `Corner Shop 402` and `Bakery 402` are never paired. The rarer row is always the one
  proposed for folding, each merchant is spoken about **once** (no suggestion chains), and at
  most `MAX_SUGGESTIONS` (8) are shown. Clicking one opens the ordinary `MergeMerchantDialog`
  with the target pre-picked — nothing merges without that confirmation.

## `/transactions` carries `merchant_id`

`PATCH /transactions/{id}` **replaces**: omitting `merchant_id` clears the link, the same
semantics `goal_id` has. `localTransactionToUpdateWire` therefore always sends the merchant from
the Dexie row — never from a form value — so editing an email-derived transaction cannot
silently drop its merchant.
