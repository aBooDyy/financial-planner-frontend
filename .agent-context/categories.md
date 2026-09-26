# Categories — the two-level catalog every surface reads

`src/features/categories/` owns the user-editable, synced category tree: the entity and its
sync branch, the **resolver** that turns Dexie rows into the catalog every other feature
reads, and the Settings list that edits it. The Settings page composes the slice from
outside (`features/settings/components/CategoriesSection.tsx`), the same arrangement
`features/merchants/` uses.

There is exactly **one** catalog. A name, a colour, an icon or a child list rendered
anywhere — the transaction editor, the donut, a budget row, the import wizard, the inbound
review — comes from here, so the picker and the chart two inches away can never disagree.

## The model — one table, two levels

`t_categories` carries a nullable self-FK. A row with `parentId === null` is a **category**;
a row with a parent is a **subcategory**. No second table, no discriminator: every field a
child needs (`name`, `color`, `icon`, `position`, `version`) is a field a parent already
has, and one table means one model, one outbox entity, one sync handler.

- **Depth is capped at two**, enforced by the service and the database, and again by
  `buildCatalog`, which drops any row whose parent is itself a child.
- **Slugs are unique per sibling set** — roots unique per user, children unique per
  `(user, parent)`. "Other", "Fees" and "Misc" are names a user wants under several parents.
  **A bare child slug is meaningless without its parent**: `bySlug` takes both. Slugs are now
  only a lookup key (default icons, onboarding, the per-type fallback, import/webhook text) —
  no row stores one.
- **`type` is inherited and immutable.** A child's type is copied from its parent on create,
  whatever the request said; after creation it never changes at either level.
- **`parentId` is immutable.** It is absent from the update contract. To move a subcategory,
  delete it and create it where you want it — and the editor says so in the locked "In" row.
- **Rows reference a category by id — one leaf id.** Every row filed under a category stores
  a single `categoryId` (wire `category_id`, a server FK to `t_categories`): the child's id
  when a subcategory was chosen, else the root's; the root is found through the catalog
  (`rootOf`). That covers `LocalTransaction.categoryId` (null on transfer legs and
  adjustments), `LocalRecurring.categoryId` (required), `LocalPlanned.categoryId` (null on a
  set-aside), `LocalMerchant.learnedCategoryId`, `LocalIntegrationKey.defaultCategoryId`,
  `LocalInboundImport.suggestedCategoryId`, and an email rule's `categoryId`. Budgets stay
  **root-scoped**: `LocalBudget.categoryId` is a **root** id (set for `scopeType: 'category'`)
  and `walletId` is set for `'wallet'` — together they replaced the overloaded `target`. A row
  filed under `dining/cafes` counts against the `dining` budget
  ([transactions.md](transactions.md)). Renaming or recolouring never touches a row. Webhook
  payloads and integration-rule constants still name a category as text; the server resolves
  it to an id.

## Local rows & sync

`categories: 'id, slug, parentId, dirty, deleted'` — `parentId` is indexed because the
resolver walks children per parent and the subtree delete reads them. A category row is
created with `parentId` and `icon` set to `null` (and a `balanceNodes` row with `icon`)
**explicitly** rather than left `undefined`: an update wire is built from the row, and
`undefined` would drop the key out of the JSON body entirely — an omission the server reads
as "clear it".

`LocalCategory.icon` is `string | null`, not `IconId | null` — narrowed at the render
boundary ([icons.md](icons.md#fallbacks)).

`data/sync.ts` is the ordinary outbox branch: `409` on an update rebases onto the server
version and retries once, `404` drops the local row, network errors bubble. Specific here:

- **`pullCategories` is a full list read**, not a delta stream. A category set is bounded at
  dozens of rows; the delta machinery exists for the ledger, which is not
  ([data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams)).
  Local edits win until pushed: a row that is `dirty` or `deleted` is left alone.
- **`icon` is replace-on-PATCH.** `UpdateCategoryWire` always carries the current value,
  because a PATCH that omits it clears it. The wire has no `parent_id` at all.
- **A create refused with `409` adopts the server's row — and remaps onto it**
  (`adoptServerCategory`). It lists the categories: when the server already holds **this id**
  (a retried create) that row is stored as-is. Otherwise the slug was taken — another device
  created the same category first — so it finds the server row with the **same `parentId` and
  `slug`** and `remapLocally(localId, serverId)` (`data/refile.ts`) rewrites every local
  reference in one Dexie transaction: `categoryId` on transactions, recurrings and planned rows,
  budgets' `categoryId`, merchants' `learnedCategoryId`, children's `parentId`, and the same
  wire fields (`category_id`, `learned_category_id`, `parent_id`) inside queued outbox payloads.
  Then the local row goes. This hazard only exists since rows store ids: under slugs, two
  devices' "Coffee" were the same filing. An import template's `config` (owned by
  `features/import`) is rewritten by that slice's `remapTemplateCategories(fromId, toId)`
  (`features/import/data/mutations.ts`: local rows plus queued payloads, its own Dexie
  transaction over `importTemplates` + `outbox`), called right after that transaction commits.
  The server-owned caches (keys, pending imports) re-pull. **A clash with a root of the other
  type is not a twin**: a root slug is unique per user across both types, so a spend "Gifts"
  can collide with another device's income "Gifts". Remapping would file spend rows under an
  income category, so instead the local row takes the next free slug (`uniqueSlug` over the
  server's and this device's siblings), the queued create's payload is rewritten, and the
  engine pushes it again on its next flush (a drain pass never revisits an entry it has pushed).
- **A delete the server refuses with `409`** (`settings.category.in_use` / `.required`) is the
  server keeping the category: `pushCategoryDelete` drops the op and runs the full category pull,
  which brings the local row (already removed by the delete) back. Any other refusal (a `422`
  such as `move_target_invalid`) is flagged and kept by the engine like every failed push
  ([data-layer-and-sync.md](data-layer-and-sync.md#failed-pushes-flag-hold-retry--never-drop)).
  Either way, first `pushCategoryDelete` clears the `transaction`, `planned` and `merchant`
  delta watermarks, so the rows this device moved or unlinked are restored from the server too
  (budgets and recurrings pull in full anyway). A `404` does the same and then drops the local
  row.

Copy-on-write seeding on first read is unchanged — it just seeds children too.

## The resolver — `data/catalog.ts`

```ts
export function buildCatalog(rows: LocalCategory[]): CategoryCatalog
```

A **pure function of rows**: no React, no async, no IO, which is what keeps the transactions
selectors pure and unit-testable. **Keyed by id.**

```ts
type Entry = { id; slug; name; type: TxType; color; icon: IconId; position }
type ResolvedSub = Entry & { parentId: string } // `type` is the parent's
type ResolvedCategory = Entry & { parentId: null; subs: ResolvedSub[] }
type CatalogEntry = ResolvedCategory | ResolvedSub

type CategoryCatalog = {
  all: ResolvedCategory[] // roots, display order; empty = not pulled yet
  byType: (type: TxType) => ResolvedCategory[]
  has: (id: string) => boolean // a live root or child
  get: (id: string) => CatalogEntry // never throws
  rootOf: (id: string) => ResolvedCategory // itself, or a child's parent
  parentOf: (id: string) => ResolvedCategory | null // null for a root / unknown id
  subsOf: (rootId: string) => ResolvedSub[] // [] for a child / unknown id
  labelOf: (id: string) => string // "Dining · Cafés" | "Dining"
  bySlug: (slug: string, parentSlug?: string) => CatalogEntry | null
  fallbackFor: (type: TxType) => ResolvedCategory | null
}
```

What it guarantees:

- **Deleted rows are excluded.** Roots sort by `position`, then `createdAt` as a tiebreak;
  children sort the same way within their parent.
- **Orphans and grandchildren are dropped**, not promoted — a child of a child is a level
  nothing can represent, and a child of a missing parent has nowhere to render.
- **An empty row set yields an empty catalog**, and that means "not pulled yet": every account
  has categories on the server (seeded at signup; `savings`, `other` and `other_income` can't be
  deleted). There are no built-ins to fall back to — a row's id means nothing without the
  user's own rows. `SessionGate` holds the app shell on the splash until the catalog is
  non-empty (below).
- **An unknown id resolves to `DELETED_CATEGORY`** — one shared, stable entry (id
  `DELETED_CATEGORY_ID`, name "Deleted category", neutral `#64748B`, the spend fallback icon,
  no children). `rootOf` returns it too, so grouping by root puts all such rows in one bucket.
  With the FK this is only ever transient (a delete this device has not pulled yet). Ask
  `has(id)` before putting a name in a sentence ("Usually …", "you filed it under …"), so
  copy falls back to its own wording instead of reading "Deleted category".
- **`bySlug(slug)`** finds a root; **`bySlug(slug, parentSlug)`** finds a child under that
  root — a bare child slug is ambiguous.
- **`fallbackFor(type)`** is where a row goes when nothing chose a category: `other` for spend,
  `other_income` for income (the required roots), else the type's first root; null only while
  the catalog is empty. Hard-coded slug literals (`'other'`, `'salary'`…) go through this or
  `bySlug`, never straight into a row.
- **A blank `color` on a child means "the parent's"** — resolved here, and mirrored by the
  mutations, because that is what the create service stores server-side.

### Icon resolution

`icon` is nullable and `null` means "the default for my kind"
([icons.md](icons.md#fallbacks)). The chain is:

- **A root**: its own icon → the built-in icon for its slug → `CATEGORY_ICON_FALLBACK[type]`
  (`tag` for spend, `hand-deposit` for income).
- **A child**: its own icon → **the built-in icon for the `(parent, child)` slug pair** →
  the parent's _resolved_ icon. The pair step matters: the default for `dining/cafes` is
  `coffee`, not the parent's `fork-knife`.

A child's icon is stored as `null` locally, never eagerly copied from its parent — writing
the parent's id locally while sending `null` to the server would diverge on the next pull.
Inheritance lives here, in the resolver, and nowhere else.

### The hooks

```ts
// hooks/useCategoryCatalog.ts
export function useCategoryCatalog(): CategoryCatalog
export function useCategoryCatalogState(): { catalog: CategoryCatalog; loaded: boolean }
```

One `useLiveQuery(() => db.categories.toArray())` plus a memoised `buildCatalog`. Cheap — a
few dozen rows, rebuilt only when the table writes. Every component that needs a name,
colour, icon or child list calls this; pure functions take the result as a parameter. A
module-level last read seeds a remount's first render, so it does not flash empty while the
query resolves — tagged with `localDbGeneration()`, so after a sign-out it is never shown to
the next user (nor lets `SessionGate` through on a stranger's catalog). **`loaded` is
`catalog.all.length > 0`.**

### The loading gate — `SessionGate`

`components/SessionGate.tsx` renders `Splash` for an onboarded user until `loaded` is true.
Everything under it (every guarded page, quick add) renders ids through the catalog, so it
must not mount before the catalog does — on a new device, right after setup, and after the
Dexie v2 wipe ([data-layer-and-sync.md](data-layer-and-sync.md#tables)). No extra pull is
kicked: `useSync` pulls on sign-in (the account is seeded at signup, so the catalog is
normally there before setup ends) and `completeOnboarding` re-pulls categories. The cost is
that an offline device that has never pulled waits on the splash until it reconnects — it has
nothing to show anyway. `/setup` is not behind the gate; its catalog reads tolerate an empty
catalog (the lists are empty until the pull lands).

### Test fixtures — `__fixtures__/categories.ts`

`defaultCategoryRows()` / `defaultCatalog()` build the rows and catalog a freshly seeded account
holds, with ids from `catId(slug, parentSlug?)` (`cat-dining`, `cat-dining-cafes`);
`categoryRow(over)` makes one row. Tests outside this slice use these instead of
`buildCatalog([])` (now empty) or `defaults.ts` (lint-restricted).

## `data/defaults.ts` — default icons by slug, and nothing else

The built-in two-level catalog (`CATEGORIES`: 26 parents — 20 spending, 6 income — with
their children, each with a colour and an `IconId`). The server seeds a new user's rows from
its own copy (`app/config/categories.py`); here it is **no longer a row resolver** — it only
supplies `defaultCategory(slug)` / `defaultSubcategory(parentSlug, slug)`, the icon of a row
whose own is unset, plus the test fixtures. Slugs and icons must match the backend. The current
set (2026-09-25) targets a wide general audience: one root per kind of spend so reports never
split the same money across two parents (e.g. Family & kids holds childcare/kids/support, not
family groceries), 3–5 children each, and the mainstream roots Pets, Debt & loans and Taxes &
fees. Required roots are `savings` + `other` + `other_income`. Onboarding's starter packs must
list only these root slugs ([onboarding.md](onboarding.md#packs--datapacksts)).

**Importing it from outside this slice is a lint error.** `eslint.config.js` carries a
`no-restricted-imports` rule covering every spelling of the path, exempted only for
`src/features/categories/**`:

> Read the resolved catalog instead: `useCategoryCatalog()` in a component, or a
> `CategoryCatalog` param in a pure function. Only `features/categories` may import
> `defaults.ts`.

That rule is what keeps the catalog unified: it turns "we migrated the consumers" from a
claim into something the build proves.

## Mutations — `data/mutations.ts`

`createCategory(draft)` mints the slug with `uniqueSlug(name, siblingSlugs)` (`data/slug.ts`,
which lives here because slugs exist only to identify categories; the importer's
`CreateCategoryDialog` uses the same helper) — unique **among siblings**, so two parents may
each own an `other`.

`createCategoryWithSlug(slug, draft)` is the importer's entry point: the wizard mints slugs
while mapping, and its rows carry a placeholder id the commit swaps for the one returned here.
A sibling already owning the slug is reused only when it has the same type (a root of the other
type keeps its slug, and the new one takes the next free one); a child whose parent is gone is
refused rather than created as an orphan. Slugs are sibling-scoped, so the importer can
create `other` under two different parents.

Both write the local row to agree with what the server decides on create — a child takes its
parent's `type`, and a blank colour takes the parent's — or the next pull would flip it.

`updateCategory(id, patch)` coalesces into a pending create, or updates a queued update in
place, before enqueuing a new one.

### Deleting is subtree-aware

The server cascades, so a delete is **one** op for the subtree root — the same shape as
`features/wallets`. The local side has to mirror that inside a single Dexie transaction
(`refileTables()` — categories, the three ledger tables, budgets, merchants, outbox):

```
deleteCategory(id, moveToId?)
  refuse a required root (savings, other, other_income)        → CategoryDeleteRefused('required')
  subtree = id + its children's ids
  target  = moveToId, if it is live, outside the subtree and of the same type
  target?  refileLocally(subtree, target.id, rootOf(target))    → the delete carries { move_to }
  in use?  (any live transaction / recurring / planned row on the subtree, via the
           `categoryId` index)                                  → CategoryDeleteRefused('in_use')
  else     unlinkLocally(subtree)                               → the delete carries no payload
  for each child: drop its pending outbox entries, delete the local row
  drop the parent's pending outbox entries, delete the parent locally
  unless neverSynced (a queued `create`): enqueue one `delete` op for the parent
```

`CategoryDeleteRefused.code` is the server's code (`settings.category.required` /
`settings.category.in_use`), so `messageForApiError` reads it. `data/required.ts`
(`REQUIRED_ROOT_SLUGS`, `isRequiredCategory`) is the one list of undeletable roots; onboarding
keeps the same three.

Dropping the children's queued ops is the load-bearing part: without it, a create for a
child would be pushed _after_ its parent is gone and fail permanently. A parent that was
never synced needs no server op at all.

### Moving what is filed — `data/refile.ts`

A category **in use** (anything in the ledger, a schedule or a planned row) can only be deleted
with a target; the server refuses otherwise. The "keep them as they are" option is gone — it was
lossy anyway. `refileLocally(from, to, toRoot)` mirrors `DELETE /categories/{id}?move_to=`:

- transactions, recurrings and planned rows filed under any id in `from` → `to` (found through
  the `categoryId` index);
- budgets on `from` → **`toRoot`** (budgets are root-scoped, so moving into a child caps its
  root);
- merchants whose `learnedCategoryId` is in `from` → `to`.

Synced rows are rewritten **without** outbox ops of their own: the server moves them atomically
and bumps their versions, so the delta brings them back. A row with a queued create/update has
that payload's field (`category_id`, `learned_category_id`) rewritten, or its push would file it
back. **When `to` is a category whose own create is still queued** (created offline, then
chosen as the move target), the row's entries are deleted and re-added in their order, so they
push _after_ that create — the outbox drains in `seq` order, and a row filed under a category
the server does not hold yet would be refused (and flagged). Not in use, `unlinkLocally(from)`
mirrors the server's no-move delete: merchants forget the category (`learnedCategoryId → null`,
queued payloads too) and budgets on it are deleted locally along with their queued ops.

The read caches of server-owned rows follow the same rule in place (they never queue
anything): integration keys' `defaultCategoryId` and pending imports' `suggestedCategoryId`
move to `to` (the target itself, as the server does) or become null on an unlink. Email rules
are not cached locally and follow on their next read.

Covered in `mutations.test.ts` (move incl. budgets + merchants + queued payloads + the requeue
behind a queued target + the key/import caches, the in-use and required refusals, the unlink) and `sync.test.ts` (the 409 remap, the refused delete).
Recorded as a sync pattern in
[data-layer-and-sync.md](data-layer-and-sync.md#subtree-deletes-categories-and-balance-nodes).

## The Settings UI

`CategoriesSection` composes the slice; everything below it lives in
`features/categories/components/`.

- **`useCategoryTree(initialType)`** is the list's view model: the catalog filtered to one
  type, with live `txCount` / `recurringCount` / `plannedCount` per row, tallied by
  `categoryId`. A **parent's counts roll up its children's** — its delete takes them along, so
  that is the number a user deleting it needs to see; a child counts only rows filed under its
  own id.
- **`CategoryTree` / `CategoryTreeRow`** render the two levels with one row anatomy.
  Expansion is **component state, not synced** — a settings list is not a page (unlike a
  balance node's `collapsed`). Children indent with `marginInlineStart`. A collapsed parent
  shows "· N subcategories", hidden below `sm` because at 390px it stole the row and
  truncated the parent name. `+ Add subcategory` is the last item inside an expanded parent,
  which is how the feature announces itself on a parent with no children yet.
- **`useCategoryEditor` / `CategoryEditor`** — a `ResponsiveDialog` (440px): the 56px `IconChip`
  with a "Change" caption as the picker's trigger (it re-tints live as the colour changes)
  beside the **Name** well, the shared `ColorSwatches` over `CAT_COLORS`
  (`features/categories/constants.ts`), and a **Type | In** pair that is a control only on
  create: **Type** is a `PillSwitch` (Spending | Income) when creating at top level and a
  `LockedField` (lock glyph in the field well) otherwise; **In** is a `ParentCategorySelect`
  (the roots of that type with their icon chips, plus "Top level") on create and a locked well
  afterwards. The reason for the locks is one help line under the pair. Choosing a parent
  adopts its type and its colour. The footer is `DialogActions` (**Add category / Add
  subcategory / Save**); an empty name keeps the primary looking unready and pressing it shows
  "Give it a name." The form (`CategoryEditorForm`) mounts per opening, so that state resets.
  Editing loads from Dexie and narrows a stored-but-unknown icon id to `null`.
  **The `IconPicker` is a child of that dialog, not a sibling** — see
  [icons.md](icons.md#a-nested-picker-goes-inside-the-parent-dialogs-children).
- **`ParentCategorySelect`** is shared with the import wizard's `CreateCategoryDialog`; only the
  top-level option's wording differs (`noneLabel`).
- **`DeleteCategoryDialog`** is a `ConfirmDialog` (trash icon, danger tone). It names the
  subcategories about to go with the parent and, when anything is filed under it (`txCount` /
  `recurringCount` / `plannedCount` from `useCategoryTree`), says how much will move and shows a
  required **"Move them to"** `MoveTargetSelect` — there is no keep option. With no same-type
  category left it says to add one first and the confirm stays disabled. With nothing filed it is
  a plain confirm ("Nothing is filed under it. This can't be undone."). The confirm reads
  **Delete & move** or **Delete**. `useDeleteChoice` holds the target (`blocked` when something
  is filed and nothing is chosen) and resets when the dialog opens on another row;
  `data/moveTargets.ts` (pure, tested) lists the targets — same type, never the deleted row or a
  child it cascades to — and suggests one: a subcategory's parent, else the type's
  `fallbackFor`, else the first root left.
- **The required roots have no delete button.** `CategoryTree` passes no `onDelete` for a root
  `isRequiredCategory` names, and `CategoryTreeRow` renders a spacer in its place.

## The picker — `CategoryPicker`

`components/CategoryPicker` is the one control for choosing a category **or** a subcategory
(quick-add and the transaction/recurring editor). Props: `type`, `categoryId` (the leaf),
`onChange(categoryId)`. The trigger is an `IconChip` (the child's icon/colour when
one is chosen) + "Parent › Sub" (parent muted, child bold); its accessible name is
`"Category: Parent › Sub"`. It opens a Popover + cmdk `Command` (`components/CategoryOptions`)
built **only while open** — the same pattern as `CurrencyPicker`:

- Every parent is a **pickable row** (28px chip, semibold); its children sit indented on a
  rail under the parent's chip (22px chip, muted). The current pick has a check + accent ink
  (`data-checked`), and the list scrolls it into view on open.
- Matching is by hand (`shouldFilter={false}`) in the pure `data/pickerSections.ts`: a parent
  whose name matches brings **all** its children; otherwise a parent appears with just its
  matching children; sections sort by best `commandFilter` score. **An item's value is its category id** — unique
  across the list — and `CategoryOptions` takes `value` (the picked id) and `onPick(id)`. The highlight resets to the top hit on every
  new result, so Enter picks the best match; arrow keys walk parents and children alike.
- Inside a `ResponsiveDialog` (`ScheduleEditor`) it works like `CurrencyPicker` in the node and
  goal editors — no nested dialog is needed.

## Who reads the catalog

| Surface                                                            | How                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/transactions/data/selectors.ts`                          | `buildCashflow` / `buildBreakdown` / `buildActivityList` / `buildBudgetsView` / `buildRecurringView` take `catalog: CategoryCatalog` as a **required second parameter**                     |
| `useTransactions`                                                  | returns `catalog` alongside `SpendingData`; `TransactionsPage` threads it                                                                                                                   |
| `CategoryPicker`, `TransactionDialog`, `QuickAddCard`, `CategoryIcon`       | `useCategoryCatalog()` directly                                                                                                                                                             |
| `features/import`                                                  | `useCsvImport` builds the catalog from its own Dexie read; `categoryOptions(catalog)` flattens it for the matcher by id, `fallbackCategoriesOf(catalog)` picks one default per direction, a v1 template is upgraded through `bySlug` ([import.md](import.md)) |
| `features/inbound-imports/hooks/useImportReview`                   | takes a `CategoryCatalog` and resolves the suggested `categoryId` against it — kept while the catalog holds it under the draft's type, else `fallbackFor(type)` ([inbound-imports.md](inbound-imports.md)) |
| `SuggestedCategorySelect` (email rules, integration-key defaults)  | one id-valued select over a type's roots and their children, plus "Decide when reviewing" ([email-sync.md](email-sync.md), [integrations.md](integrations.md))                          |
| `features/integrations/hooks/useFieldStatusContext`                | names a dry run's resolved `categoryId` (root, and child when it is one) for the status lines                                                                                             |
| `features/settings/components/MerchantRow`                         | resolves the remembered category (`labelOf`, "Dining · Cafés") for its chip                                                                                                               |

`features/wallets` does **not** read it — a wallet's icon is its own column, resolved in
`buildWalletsView` ([wallets.md](wallets.md)).

## Tests

`data/catalog.test.ts` (nesting, ordering, orphans, lookups by id, `rootOf`/`parentOf`,
`bySlug`, `fallbackFor`, the shared deleted entry, colour and icon inheritance, the empty
catalog), `data/mutations.test.ts`
(sibling-scoped slugs, the create/update coalescing, the subtree deletes, the move by id across
ledger/budgets/merchants/queued payloads, the in-use and required refusals, the unlink),
`data/sync.test.ts` (the create-409 remap and same-id adopt, the refused delete),
`data/pickerSections.test.ts` (the search rules), `components/CategoryPicker.test.tsx`
(lazy rows, trigger label, type filter, parent/child/keyboard picks, the check),
`data/defaults.test.ts` (every icon id is in the pack; slugs are unique per sibling set) and
`data/slug.test.ts`. Selector tests build a catalog from fixture rows with `buildCatalog` (or
take `defaultCatalog()` from `__fixtures__/categories.ts`), so they stay pure.

## Known follow-up

`CategoryIcon` and `useTxEditor` each open their own `useCategoryCatalog()`, so a long
activity list holds one `useLiveQuery(db.categories)` subscription **per row**. Harmless on
a ~60-row table, and measured as such. Collapsing it means a shared subscription inside
`useCategoryCatalog` — not a one-line memo, since the live query is what has to be shared.
