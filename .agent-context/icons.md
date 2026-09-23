# Icons — the pack, the generator, and the two icon languages

The app draws from **two** icon sets, on purpose. Controls and affordances are
`lucide-react` React components. **Content icons** — the ones a user's own row owns — are
Phosphor glyphs generated into `src/lib/icons/` and rendered by `<Icon>`. A category, a
subcategory, a wallet and a group each store an **icon id** (`piggy-bank`, `fork-knife`):
a short lowercase-kebab string that the backend validates for shape only and never
interprets ([categories.md](categories.md), [balances.md](balances.md)).

## The pack

- **`@phosphor-icons/core@2.1.1`, regular weight, MIT**, 258 curated ids in 15 groups.
  Chosen for domestic vocabulary a finance catalog actually needs (`invoice`, `taxi`,
  `washing-machine`, `first-aid-kit`, `mosque`) that an interface set like Lucide does not
  carry, and for filled paths that stay legible at the 18–20px a row uses.
- **It is a `devDependency`.** The runtime bundle contains no icon package: the generator
  reads the assets out of `node_modules` at build-author time and writes TypeScript. Adding
  Phosphor to `dependencies` would be a mistake — nothing imports it.
- **Nothing is written to `public/`**, and nothing is fetched from a CDN. A local-first PWA
  cannot depend on a third-party origin for core UI, `<img src="…svg">` cannot inherit
  `currentColor` (and the whole design is the glyph tinted in the entity's colour), and the
  picker would fire 258 requests on first open.
- Every glyph is `viewBox="0 0 256 256"`, one path, `fill="currentColor"` — so a chip is
  optically identical across the set and tints from CSS with no per-icon work.
- **The id is the upstream filename**, stored verbatim. No private id space, no mapping
  table to drift. If Phosphor ever renames one, the generator fails loudly naming the id,
  and the fix is a manifest edit plus a one-line data migration; until it runs, the stored
  id renders as its fallback.

The pack has no Saudi riyal glyph — Phosphor's currency set stops at
`currency-dollar/-eur/-gbp/-btc` and friends. Generic money uses `coins` / `money` /
`currency-circle-dollar`; money _formatting_ is unaffected, it goes through `Intl`.

## The manifest — the one file you edit

`src/lib/icons/icons.manifest.json` is hand-curated and the generator's **only** input.
Nothing else in the repo lists icon ids.

```
{
  "source": { "package": "@phosphor-icons/core", "version": "2.1.1",
              "weight": "regular", "license": "MIT" },
  "groups": [ { "key": "food", "label": "Food & drink" }, ... 15, in picker order ],
  "icons":  [ { "id": "fork-knife", "group": "food", "label": "Restaurant",
                "keywords": ["dining", "eat", "cutlery", "meal"] }, ... 258 ]
}
```

- **`id`** is both the Phosphor filename and the value stored on a row.
- **`label`** is _our_ wording, not Phosphor's — `fork-knife` is labelled "Restaurant". It
  is what the picker shows and what a screen reader announces.
- **`keywords`** extend search past the label, so `piggy-bank` is findable by "save".
- **Groups are presentation only.** They order the picker's sections; an icon is never
  restricted to a category type or an entity kind.

Adding an icon is one line here plus `pnpm generate-icons`, committed together.

## The generator — `scripts/generate-icons.mjs`

Plain Node ESM, a sibling of `generate-bundled-config.mjs`, run by hand
(`pnpm generate-icons`) and committed with its output. **It never touches the network** —
assets come from `node_modules` — so a `--frozen-lockfile` CI job can regenerate and assert
`git diff --exit-code src/lib/icons`.

It **refuses to write a partial pack**. Every gate exits non-zero with the offending id or
key named:

| Gate           | Fails when                                                                                |
| -------------- | ----------------------------------------------------------------------------------------- |
| manifest shape | `source.package`/`version`/`weight` missing, or the package is not `@phosphor-icons/core` |
| version pin    | the installed `@phosphor-icons/core` version differs from `source.version`                |
| floor          | fewer than `MIN_ICONS` (200) entries in the manifest, or fewer resolved                   |
| groups         | a group has no key/label, is declared twice, or ends up with no icons                     |
| ids            | not lowercase-kebab, duplicated, or in a group nothing declares                           |
| metadata       | an empty label, or keywords that are not non-blank strings                                |
| assets         | `assets/<weight>/<id>.svg` missing (an upstream rename) or carrying no `<path>`           |
| output         | a resolved entry with an empty `d` or label, or a duplicate id                            |

Then it extracts each `d` attribute (discarding the wrapper — `viewBox` and `fill` are
constants `<Icon>` supplies), writes the three modules, copies the package's `LICENSE` to
`src/lib/icons/PHOSPHOR-LICENSE.txt`, runs Prettier over what it wrote, and prints one
summary line: count, groups, total bytes, and the pinned upstream version.

### The legal banner, and the two rules that keep it

`paths.gen.ts` opens with a `/*! @license … */` notice naming the package, version, weight
and licence. Two pieces of config exist solely so it survives:

- **`vite.config.ts`** sets `build.rollupOptions.output.comments.legal = true`. Rolldown
  drops `/*!` and `/*! @license` banners from emitted chunks by default; without this the
  attribution ships only in the source tree. It costs ~1 KB across the bundle and preserves
  other libraries' banners too. (`legalComments: 'inline'` also works but is deprecated.)
- **`eslint.config.js`** sets `'@stylistic/spaced-comment': ['error', 'always', { markers: ['!'] }]`.
  The repo does not ignore generated files, so allowing the marker beat adding the first
  generated-file lint exemption.

`PHOSPHOR-LICENSE.txt` is committed but never imported — it is the copy that survives a
pipeline that strips comments anyway.

## The outputs — and why the split is the whole point

All three live in `src/lib/icons/`, all generated, all committed.

| Module           | Loaded                | Holds                                                                                                              | Built size                      |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `catalog.gen.ts` | **eagerly**           | `ICON_IDS`, the `IconId` union, `IconGroupKey`, `ICON_GROUPS` (key + label + ids), `isIconId()`. **No path data.** | ~10 KB raw source               |
| `paths.gen.ts`   | **lazily, own chunk** | `PATHS: Record<IconId, string>` — the `d` strings                                                                  | **123.99 kB raw / 43.91 kB gz** |
| `search.gen.ts`  | **lazily, own chunk** | `SEARCH: Record<IconId, IconSearchEntry>` — label + keywords                                                       | **19.78 kB raw / 6.92 kB gz**   |

`catalog.gen.ts` is what the type system needs and costs nothing. `paths.gen.ts` is the
weight, and it arrives once in a content-hashed chunk that only re-downloads when the pack
changes. `search.gen.ts` is paid for only by users who open the picker. **The entry chunk
carries neither** — verified by grepping `dist/` for an id, which hits the catalog, the
fallbacks and the two lazy chunks and nothing else.

Both are ordinary Vite build output, which is the point: no sprite fetch, no hidden `<svg>`
injection, no `#i-` id namespace, and **no service-worker precache glob to maintain** — see
[pwa-and-mobile.md](pwa-and-mobile.md).

> The generator prints total bytes on every run. 258 icons is the measured 43.91 kB gz;
> revisit splitting `paths.gen.ts` per group somewhere past ~400.

## Rendering

**`src/lib/icons/paths.ts`** owns one module-scope promise, so every icon on the page shares
a single chunk request:

```ts
export type IconPaths = Record<IconId, string>
export const loadIconPaths = (): Promise<IconPaths> =>
  (pending ??= import('./paths.gen').then((m) => m.PATHS))
```

`routes/__root.tsx` fires `void loadIconPaths()` on mount, so the chunk flies alongside the
first local-DB reads instead of starting when the first row paints.
**`components/icons/useIconPaths.ts`** wraps it and caches the resolved table in a
module-level variable as well as state — a mount _after_ the chunk has landed must paint its
path on the first render, or the placeholder would flash on every row.

```tsx
// src/components/icons/Icon.tsx
type Props = { id: IconId; size?: number; className?: string; title?: string }
```

`<Icon>` renders `<svg width height viewBox="0 0 256 256" fill="currentColor">` with the
single `<path>`. It is `aria-hidden` by default; passing `title` switches it to
`role="img"` with a `<title>` child — give one only when the glyph carries meaning no
adjacent text already carries. **Colour comes from CSS `color`**, so a tinted chip is
`style={{ color }}` and nothing else, correct in both themes with no second asset. Until the
chunk resolves it renders a correctly sized empty `<svg>`, so the glyph appears without
reflowing.

```tsx
// src/components/icons/IconChip.tsx
type Props = {
  id: IconId
  color: string
  size?: number
  iconSize?: number
  className?: string
  title?: string
}
export const iconTint = (color: string) =>
  `color-mix(in oklab, ${color} 12%, transparent)`
```

`IconChip` is the visual primitive that replaced the bare colour swatch everywhere: the
glyph in the entity's colour on a 12%-tint square of the same colour, `rounded-[10px]`,
`size` 36 by default (34 in the Settings category list, 56 for an editor's icon trigger),
`iconSize` defaulting to half the square. `iconTint` is exported because the picker tints a
selected tile with the same mix.

## Fallbacks

A stored id can outlive the pack that defined it (a hand-edited row, a regenerated or
rolled-back manifest), and `null` is a first-class value meaning "the default for my kind".
Both resolve through the same helper in `src/lib/icons/fallbacks.ts`, so nothing throws and nothing renders a broken glyph:

```ts
iconIdOr(id: string | null | undefined, fallback: IconId): IconId
```

| Context                   | Falls back to                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Category, `type = spend`  | `SPEND_CATEGORY_ICON` = `tag`                                                          |
| Category, `type = income` | `INCOME_CATEGORY_ICON` = `hand-deposit`                                                |
| Subcategory               | the built-in icon for its `(parent, child)` slug pair, then its parent's resolved icon |
| Wallet                    | `WALLET_ICON` = `wallet`                                                               |
| Group                     | `GROUP_ICON` = `stack`                                                                 |

`CATEGORY_ICON_FALLBACK` maps `'spend' | 'income'` to the first two.

**The stored field is `string | null`, not `IconId | null`.** `LocalCategory.icon` and
`LocalBalanceNode.icon` are plain strings because the database is not the place to enforce
a union that the pack can redefine. Narrowing happens at the **render boundary** —
`iconIdOr` in the resolvers (`buildCatalog`, `buildBalancesView`), `isIconId` in the editor
hooks — so a `BalanceRow.icon` or a `ResolvedCategory.icon` handed to a component is always
an `IconId`. An editor hook narrows a stored-but-unknown id to `null` rather than freezing
it into the draft, so an id from a newer pack degrades to "the default for this kind"
instead of sticking.

## The picker — `IconPicker` + `useIconPicker`

```tsx
// src/components/icons/IconPicker.tsx
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: IconId | null // the entity's stored icon; null = its kind's default
  color: string // every tile draws its glyph in it
  onSelect: (id: IconId | null) => void // null when the user clears
  title?: string // default 'Choose an icon'
}
```

Presentation only; `useIconPicker` owns the lazy chunks, the query and the grouping:

```ts
type IconPickerModel = {
  query: string
  setQuery: (value: string) => void
  ready: boolean // false until both chunks are in
  searching: boolean
  groups: Array<IconPickerGroup> // { key, label, ids }
  labelOf: (id: IconId) => string
}
```

- **A `ResponsiveDialog`** — centred Dialog on desktop, vaul Drawer on mobile — with a
  `cmdk` `Command` inside. The body mounts only while `open`: mounting 258 tiles for a
  closed picker is exactly what the lazy chunks avoid.
- **Both chunks load on first open**, in one `Promise.all`; until then the list is a
  skeleton grid of 48 placeholder tiles at the real tile size, so opening never shifts.
- **Browsing** shows a "Recent" group (the last 8 picked ids, from `usePreferencesStore` —
  localStorage, not synced, filtered through `isIconId`) followed by the manifest's 15
  groups in manifest order. A recent tile's cmdk value is prefixed `recent:` so a repeat is
  not a duplicate key in the list.
- **Tiles are 44×44**, six columns on mobile and eight from `sm`, each drawn in the entity's
  current colour and carrying `aria-label={label}`. The chosen one gets a `ring-2` and the
  `iconTint` background.
- **The footer** shows `{258} icons` and a **Use the default icon** action that hands back
  `null`.
- **The highlight is driven, not inferred.** The `Command` runs `shouldFilter={false}` with
  a controlled `value`: cmdk only tracks the best match itself while it owns filtering, so
  the picker pins the highlight to the entity's own icon at open and to the top hit as
  results change.

### Search is a field-aware scorer, not `commandFilter`

`CurrencyPicker` ranks its options with cmdk's exported `commandFilter` (command-score); the
icon picker deliberately does not. command-score is fuzzy and failed the pack's own cases —
`"zzz"` returned `pizza`
and `puzzle-piece`, and `"save"` ranked `bookmark` (label "Saved") above `piggy-bank`
(label "Savings", keyword `save`). **A search over curated keywords wants exact-match
ranking, not fuzzy matching.**

`matchIconIds(index, query)` scores each id over its label, its keywords and the id itself:
whole field **100**, word start **70**, substring anywhere **40**, plus a field bonus
(label **3**, keyword **2**, id **1**) so an exact keyword still beats a label prefix.
Hyphens and underscores are normalised to spaces. **Every term of the query must hit**, or
the icon scores zero. Ties keep the manifest's order.

Searching **collapses the list to a single ranked "Results" group** rather than filtering
the 15 groups in place — per-group ordering buries the best hit under whichever group comes
first in the manifest.

### A nested picker goes _inside_ the parent dialog's children

**Render `<IconPicker>` among the parent `ResponsiveDialog`'s `children`, never as a
sibling of it.** As a sibling, picking an icon closes the parent editor too: the click lands
outside the editor's dismissable layer and is delivered once the picker's own layer
unmounts. `CategoryEditor` and `NodeEditor` both nest it as the last child of their dialog
body. This is a rule for every future picker-inside-an-editor, not a quirk of these two.

## Two icon languages, and the line between them

| Language    | Source                                                 | Used for                                | Examples                                                           |
| ----------- | ------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| **Chrome**  | `lucide-react` (runtime dependency)                    | controls and affordances the _app_ owns | `ChevronRight`, `Pencil`, `Trash2`, `Plus`, `Check`, `X`, `Search` |
| **Content** | the generated Phosphor pack, via `<Icon>` / `IconChip` | things the _user's data_ owns           | category, subcategory, wallet and group icons                      |

The rule, stated so a reviewer can apply it without asking: **if the icon changes when the
user edits a row, it is content and comes from `<Icon>`. If it is the same for every row, it
is chrome and comes from `lucide-react`.** The one chrome glyph Lucide lacks is the design's
half-headed ⇄ transfer mark, drawn by `components/icons/TransferGlyph` (point-symmetric, so
never mirrored). A Settings category row is the canonical case —
one Phosphor glyph (the category's) beside a Lucide chevron, pencil and trash. At these
sizes the families sit together comfortably: chrome is 14–17px at `strokeWidth` ~1.8–2.2,
content is 18–20px filled. See also
[styling-and-theming.md](styling-and-theming.md#icons-chrome-vs-content).

## RTL

**Content icons never mirror.** A category icon is a pictogram of a _thing_ — mirroring
`airplane-takeoff` in Arabic would make the plane land — so `<Icon>` renders identically in
both directions, including the handful of ids that imply direction (`trend-up`,
`chart-line-down`, `hand-arrow-up`, `road-horizon`, `tag-chevron`, …). All RTL work here is
layout: the picker grid is a grid, chip rows use logical spacing, and the Settings list
indents children with `marginInlineStart`.

The **chrome** icons around them mirror as they always do — the disclosure chevron on a
parent row, and the picker's Back chevron in the transactions category sheet
(`rtl:-scale-x-100`).

## Tests

- `src/lib/icons/fallbacks.test.ts` — `iconIdOr` over known, unknown, `null` and `undefined`.
- `src/components/icons/Icon.test.tsx` — the sized-but-empty `<svg>` before the chunk lands,
  and the `title` → `role="img"` switch.
- `src/components/icons/useIconPicker.test.ts` — the ranking cases the scorer exists for:
  `save` → `piggy-bank` above `bookmark`, `zzz` matching nothing, multi-term queries.

No test asserts the generated files' contents; the generator's own gates are the guard, and
`pnpm generate-icons` + `git diff --exit-code src/lib/icons` is the CI-shaped check.
