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
  `buildCatalog`, which drops any row whose parent is itself a child. `t_transactions` has
  exactly two slug columns, so a third level would be unrepresentable in the ledger.
- **Slugs are unique per sibling set** — roots unique per user, children unique per
  `(user, parent)`. "Other", "Fees" and "Misc" are names a user wants under several parents,
  and the ledger already implies the rule by storing the two slugs as a pair. **A bare child
  slug is meaningless without its parent**: every helper that takes one takes both.
- **`type` is inherited and immutable.** A child's type is copied from its parent on create,
  whatever the request said; after creation it never changes at either level.
- **`parentId` is immutable.** It is absent from the update contract. A transaction stores
  the _pair_, so moving `cafes` from `dining` to `groceries` would either rewrite history
  from a settings screen or orphan it. To move a subcategory, delete it and create it where
  you want it — and the editor says so in the locked "In" row.
- **The ledger is unchanged.** `t_transactions.category` holds a parent slug and
  `.subcategory` a child slug, both plain strings, never FKs. Renaming or recolouring never
  orphans history; deleting never deletes transactions — the user either **moves** them
  to a surviving category (see [Deleting with a move](#deleting-with-a-move)) or keeps
  them, and the old slugs resolve through the fallback path. Budgets stay **parent-scoped**: a row filed under `dining/cafes` counts
  against the `dining` budget ([transactions.md](transactions.md)).

## Local rows & sync

`categories: 'id, slug, parentId, dirty, deleted'` — `parentId` is indexed because the
resolver walks children per parent and the subtree delete reads them. A category row is
created with `parentId` and `icon` set to `null` (and a `balanceNodes` row with `icon`)
**explicitly** rather than left `undefined`: an update wire is built from the row, and
`undefined` would drop the key out of the JSON body entirely — an omission the server reads
as "clear it".

`LocalCategory.icon` is `string | null`, not `IconId | null` — narrowed at the render
boundary ([icons.md](icons.md#fallbacks)).

`data/sync.ts` is the ordinary outbox branch: `409` rebases onto the server version and
retries once, `404` drops the local row, network errors bubble. Two things are specific:

- **`pullCategories` is a full list read**, not a delta stream. A category set is bounded at
  dozens of rows; the delta machinery exists for the ledger, which is not
  ([data-layer-and-sync.md](data-layer-and-sync.md#incremental-pull-the-delta-streams)).
  Local edits win until pushed: a row that is `dirty` or `deleted` is left alone.
- **`icon` is replace-on-PATCH.** `UpdateCategoryWire` always carries the current value,
  because a PATCH that omits it clears it. The wire has no `parent_id` at all.

Copy-on-write seeding on first read is unchanged — it just seeds children too.

## The resolver — `data/catalog.ts`

```ts
export function buildCatalog(rows: LocalCategory[]): CategoryCatalog
```

A **pure function of rows**: no React, no async, no IO, which is what keeps the transactions
selectors pure and unit-testable.

```ts
type ResolvedSub = {
  id: string
  slug: string
  name: string
  color: string
  icon: IconId
  position: number
}
type ResolvedCategory = {
  id: string
  slug: string
  name: string
  type: TxType
  color: string
  icon: IconId
  position: number
  subs: ResolvedSub[]
}

type CategoryCatalog = {
  all: ResolvedCategory[]
  byType: (type: TxType) => ResolvedCategory[]
  get: (slug: string) => ResolvedCategory // never throws
  subsOf: (slug: string) => ResolvedSub[]
  sub: (slug: string, subSlug: string | null) => ResolvedSub | null
  labelOf: (slug: string, subSlug: string | null) => string // "Dining · Cafés"
}
```

What it guarantees:

- **Deleted rows are excluded.** Roots sort by `position`, then `createdAt` as a tiebreak;
  children sort the same way within their parent.
- **Orphans and grandchildren are dropped**, not promoted — a child of a child is a level
  the ledger cannot represent, and a child of a missing parent has nowhere to render.
- **An empty row set yields the built-ins.** A first-run client that has not pulled
  `GET /categories` yet shows the right catalog immediately instead of an empty picker —
  the same trick `bundledConfig.ts` plays for currencies ([app-config.md](app-config.md)).
- **`get(slug)` never throws.** An unknown slug resolves against the built-in defaults first
  (so a legacy slug still renders its proper name and icon), then against the user's own
  `other`, then a generic grey "Other" shape.
- **`sub(slug, subSlug)`** falls back the same way, so a deleted or never-seeded built-in
  child still labels the transactions that name it. Those default-derived rows carry `''`
  as their `id`.
- **A blank `color` on a child means "the parent's"** — resolved here, and mirrored by the
  mutations, because that is what the create service stores server-side.
- **`ResolvedSub` carries `id`.** The Settings list has to edit and delete a child by row
  id, and a child slug alone cannot name it; the alternative was re-deriving the whole tree
  from Dexie beside the catalog. Default-derived subs use the slug as id.

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

### The hook

```ts
// hooks/useCategoryCatalog.ts
export function useCategoryCatalog(): CategoryCatalog
```

One `useLiveQuery(() => db.categories.toArray())` plus a memoised `buildCatalog`. Cheap — a
few dozen rows, rebuilt only when the table writes. Every component that needs a name,
colour, icon or child list calls this; pure functions take the result as a parameter.

## `data/defaults.ts` — the seed and the fallback, and nothing else

The built-in two-level catalog (`CATEGORIES`: 24 parents — 18 spending, 6 income — with
their children, each with a colour and an `IconId`; children inherit type and colour). It is
what a brand-new user's rows are seeded from on the server and what an unknown slug falls back
to here. **Its `id` values are the slugs transactions persist**, so it must match the
backend's `app/config/categories.py` exactly — same slugs, names, icons, colours and order;
change the two together. The current set (2026-09-24) is Saudi-flavoured: Family, Personal
care, Insurance, Government & fees (Iqama, visas), Gifts & giving (Eidiah, charity & zakat),
and Other income sit beside the usual roots. Required roots stay `savings` + `other`; the
fallback stays `other`. `savings` is the home for goal contributions (`SAVINGS_CATEGORY_ID`
lives in `features/transactions/constants.ts`, its only consumer). Onboarding's starter packs
must list only these root slugs ([onboarding.md](onboarding.md#packs--datapacksts)).

**Importing it from outside this slice is a lint error.** `eslint.config.js` carries a
`no-restricted-imports` rule covering every spelling of the path, exempted only for
`src/features/categories/**`:

> Read the resolved catalog instead: `useCategoryCatalog()` in a component, or a
> `CategoryCatalog` param in a pure function. Only `features/categories` may import
> `defaults.ts`.

That rule is what keeps the catalog unified: it turns "we migrated the consumers" from a
claim into something the build proves.

## Mutations — `data/mutations.ts`

`createCategory(draft)` slugifies the name (`data/slug.ts`, which lives here because
`slugify` exists only to mint category slugs) and uniquifies it **among siblings**, so two
parents may each own an `other`.

`createCategoryWithSlug(slug, draft)` is the importer's entry point: the wizard mints slugs
while mapping and the rows are final before anything is written. A slug already owned by a
**sibling** short-circuits to that row's id — sibling-scoped, so the importer can create
`other` under two different parents.

Both write the local row to agree with what the server decides on create — a child takes its
parent's `type`, and a blank colour takes the parent's — or the next pull would flip it.

`updateCategory(id, patch)` coalesces into a pending create, or updates a queued update in
place, before enqueuing a new one.

### Deleting is subtree-aware

The server cascades, so a delete is **one** op for the subtree root — the same shape as
`features/balances`. The local side has to mirror that inside a single Dexie transaction:

```
deleteCategory(id)
  neverSynced = the row still has a queued `create`
  for each child of id: drop its pending outbox entries, delete the local row
  drop the parent's pending outbox entries
  delete the parent locally
  unless neverSynced: enqueue one `delete` op for the parent
```

### Deleting with a move

`deleteCategory(id, moveToId)` re-files everything filed under the deleted row — a
root's rows under any of its children, a child's rows only for its exact pair — into
the target's `(category, subcategory)` pair, across `transactions`, `recurrings` and
`plannedTransactions` (`data/refile.ts`, in the same Dexie transaction as the delete).
Synced rows are rewritten **without** outbox ops of their own: the delete op carries
`{ move_to }` and the server re-files them atomically (`DELETE /categories/{id}?move_to=`),
bumping their versions so the delta brings them back. Rows with a queued create/update get
that payload's `category`/`subcategory` rewritten, or their push would file them back.
If the server refuses or 404s a delete that carried a move, `pushCategoryDelete` clears
the `transaction` and `planned` watermarks so the next pull restores server truth.

Dropping the children's queued ops is the load-bearing part: without it, a create for a
child would be pushed _after_ its parent is gone and fail permanently. A parent that was
never synced needs no server op at all. Covered by explicit tests in `mutations.test.ts`,
and recorded as a sync pattern in
[data-layer-and-sync.md](data-layer-and-sync.md#subtree-deletes-categories-and-balance-nodes).

## The Settings UI

`CategoriesSection` composes the slice; everything below it lives in
`features/categories/components/`.

- **`useCategoryTree(initialType)`** is the list's view model: the catalog filtered to one
  type, with a live transaction count per row. A **parent counts every row filed under it,
  including rows that also name a child** — that is the number a user deleting the parent
  needs to see; a child counts rows naming the exact pair.
- **`CategoryTree` / `CategoryTreeRow`** render the two levels with one row anatomy.
  Expansion is **component state, not synced** — a settings list is not a page (unlike a
  balance node's `collapsed`). Children indent with `marginInlineStart`. A collapsed parent
  shows "· N subcategories", hidden below `sm` because at 390px it stole the row and
  truncated the parent name. `+ Add subcategory` is the last item inside an expanded parent,
  which is how the feature announces itself on a parent with no children yet.
- **`useCategoryEditor` / `CategoryEditor`** — a `ResponsiveDialog` with the 56px `IconChip`
  as the picker's trigger (it re-tints live as the colour changes), the name field, the
  `CAT_COLORS` swatch row (`features/categories/constants.ts`), and two rows that are
  controls only on create: **Type** is a `Segmented` when creating at top level and a locked
  row otherwise, and **In** is a `Select` of the user's roots of that type plus "— Top
  level —" on create, a locked row with the can't-be-moved explanation afterwards. Choosing
  a parent adopts its type and its colour. Editing loads from Dexie and narrows a
  stored-but-unknown icon id to `null`.
  **The `IconPicker` is a child of that dialog, not a sibling** — see
  [icons.md](icons.md#a-nested-picker-goes-inside-the-parent-dialogs-children).
- **`DeleteCategoryDialog`** names the subcategories about to go with the parent and,
  when anything is filed under it (`txCount` / `recurringCount` from `useCategoryTree`),
  asks what happens to it: **Move them to another category** (default, with
  `MoveTargetSelect`) or **Keep them as they are**. With nothing filed it is a plain
  confirm. `useDeleteChoice` holds the decision and resets when the dialog opens on another
  row; `data/moveTargets.ts` (pure, tested) lists the targets — same type, never the
  deleted row or a child it cascades to — and suggests one: a subcategory's parent, else
  `other`, else the first root left.

## Who reads the catalog

| Surface                                                            | How                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/transactions/data/selectors.ts`                          | `buildCashflow` / `buildBreakdown` / `buildActivityList` / `buildBudgetsView` / `buildRecurringView` take `catalog: CategoryCatalog` as a **required second parameter**                     |
| `useTransactions`                                                  | returns `catalog` alongside `SpendingData`; `TransactionsPage` threads it                                                                                                                   |
| `CategoryPickerDialog`, `TxEditor`, `QuickAddCard`, `CategoryIcon` | `useCategoryCatalog()` directly                                                                                                                                                             |
| `features/import`                                                  | `useCsvImport` builds the catalog from its own Dexie read; `categoryOptions(catalog)` flattens it for the matcher, `fallbackCategoryOf(catalog)` picks the default ([import.md](import.md)) |
| `features/inbound-imports/hooks/useImportReview`                   | takes a `CategoryCatalog` and normalises the suggested pair against it ([inbound-imports.md](inbound-imports.md))                                                                           |
| `features/settings/components/MerchantRow`                         | resolves the remembered category for its chip                                                                                                                                               |

`features/balances` does **not** read it — a wallet's icon is its own column, resolved in
`buildBalancesView` ([balances.md](balances.md)).

## Tests

`data/catalog.test.ts` (nesting, ordering, orphans, colour and icon inheritance, the
unknown-slug paths, the empty-rows-yields-defaults case), `data/mutations.test.ts`
(sibling-scoped slugs, the create/update coalescing, and the two subtree-delete cases),
`data/defaults.test.ts` (every icon id is in the pack; slugs are unique per sibling set) and
`data/slug.test.ts`. Selector tests build a catalog from fixture rows with `buildCatalog`,
one line per test, so they stay pure.

## Known follow-up

`CategoryIcon` and `useTxEditor` each open their own `useCategoryCatalog()`, so a long
activity list holds one `useLiveQuery(db.categories)` subscription **per row**. Harmless on
a ~60-row table, and measured as such. Collapsing it means a shared subscription inside
`useCategoryCatalog` — not a one-line memo, since the live query is what has to be shared.
