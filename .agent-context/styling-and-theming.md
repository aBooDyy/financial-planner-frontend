# Styling & Theming — Tailwind, `fp-` Tokens, RTL/LTR, Light/Dark

Styling uses **Tailwind CSS v4**. All project-defined design values are **tokens prefixed
with `fp-`** and live in one place. Theming and direction are first-class.

## Base layer — the pointer cursor

Tailwind v4's preflight sets `cursor: default` on `button` and `[role="button"]` (a
deliberate break from v3, which inherited the browser's pointer). Left alone, almost every
control in the app — raw `<button>`s, Radix menu items, tabs, select options — looks
unclickable. `theme.css` restores `cursor: pointer` for buttons and the interactive ARIA
roles in an `@layer base` block, with a following `:disabled, [aria-disabled='true'],
[data-disabled]` rule putting it back to `default`.

It lives in `base` on purpose: utilities beat base in the cascade, so a per-element
`cursor-*` class still wins. **Don't** add `cursor-pointer` to individual buttons — that
duplicates the base rule and will drift.

## Design tokens — the `fp-` prefix

- **Every** custom color/space/radius/etc. we define is named `fp-*` (e.g. `fp-primary`,
  `fp-surface`, `fp-danger`, `fp-income`, `fp-expense`). This keeps our tokens unmistakable
  vs. Tailwind defaults and makes theme swaps trivial.
- Tailwind v4 is **CSS-first**: define tokens in the CSS entry with `@theme`, not a JS
  config. Single source of truth in `src/styles/` (e.g. `theme.css`).

```css
/* src/styles/theme.css */
@import 'tailwindcss';

@theme {
  --color-fp-primary: oklch(0.62 0.17 256);
  --color-fp-surface: oklch(0.99 0 0);
  --color-fp-income: oklch(0.72 0.17 150);
  --color-fp-expense: oklch(0.63 0.2 25);
  /* ...all fp- tokens here... */
}
```

- Use tokens via Tailwind utilities (`bg-fp-surface`, `text-fp-primary`,
  `border-fp-danger`). Never hard-code hex values in components — add an `fp-` token.
- Semantic naming (`fp-surface`, `fp-on-surface`, `fp-income`, `fp-expense`) beats literal
  color names — it survives palette changes.

## Light & dark themes

- Drive themes by redefining the `fp-` token values under a theme selector (e.g.
  `.dark { --color-fp-surface: ...; }`) so components never branch on theme — they just use
  tokens.
- Theme choice (system/light/dark) is stored in a global Zustand store, persisted, and
  applied by toggling a class/attribute on `<html>` in the root layout.

## Privacy mode — `.fp-sensitive`

An eye button in `TopNav` (`components/chrome/PrivacyToggle.tsx`) flips `usePrivacyStore`
(`src/stores/privacy.ts`, persisted as `fp-privacy`), which sets `data-privacy` on `<html>`.
`theme.css` then blurs every element carrying the **`fp-sensitive`** class (`blur(0.45em)`, so
it scales with the figure's size; width is kept, so nothing reflows). Hiding is pure CSS — no
component reads the store, and the formatted strings are untouched.

- **Tag figures, not labels**: put `fp-sensitive` on the element holding a money amount (the
  label "available", "Income" etc. stays readable). Tag the smallest element that holds only
  the figure; if a line mixes a figure with a short word ("SR 10 in bank"), tag the line.
- **What is tagged**: balances (total hero, group/wallet rows, pots, by-currency card, the
  Spending scope picker), the cashflow hero, the "Where it went" centre total, calendar-cell
  totals, budget spent/limit/left, and the Goals monthly ledger. Individual transaction rows
  and editor inputs are deliberately not blurred.
- Any new summary/balance figure should carry `fp-sensitive`.
- `BrandMark`'s wordmark goes `sr-only` below 400px so the top bar fits its extra button at 320px.

## RTL / LTR — first-class, non-negotiable

RTL is a core requirement. Build for it from the start:

- **Use logical CSS utilities, never physical ones.** `ms-*`/`me-*` (margin-inline),
  `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`. **Never** `ml-/mr-/left-/right-`
  for layout that should flip.
- Set `dir` on `<html>` (and `lang`) from the direction store; let the browser flip the
  layout. Default Tailwind logical utilities respect `dir`. **That is enough for CSS and not
  enough for Radix** — see [shadcn/ui integration](#shadcnui-integration).
- **Icons/affordances that imply direction** (back/forward chevrons, progress) must mirror
  with direction — handle explicitly.
- **Don't mirror** things that shouldn't flip: numbers, charts/timelines axes semantics,
  brand logos. Money figures stay LTR-formatted within an RTL layout via `Intl`.
- Test every screen in both directions. A layout isn't done until it works in RTL.

## Icons: chrome vs. content

The app draws from **two** icon sets, and the line between them is a rule, not a preference.

| Language    | Source                                                 | Used for                                                                                                     |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Chrome**  | `lucide-react` (runtime dependency)                    | controls and affordances the _app_ owns — `ChevronRight`, `Pencil`, `Trash2`, `Plus`, `Check`, `X`, `Search` |
| **Content** | the generated Phosphor pack, via `<Icon>` / `IconChip` | things the _user's data_ owns — category, subcategory, wallet and group icons                                |

**If the icon changes when the user edits a row, it is content and comes from `<Icon>`. If
it is the same for every row, it is chrome and comes from `lucide-react`.** A Settings
category row is the canonical case: one Phosphor glyph (the category's) beside a Lucide
chevron, pencil and trash. They sit together because the sizes agree — chrome at 14–17px
and `strokeWidth` ~1.8–2.2, content at 18–20px filled.

**The icon chip** (`IconChip`) is the visual primitive that carries a content icon: the glyph
in the entity's own colour on a square tinted with that colour at 12%
(`color-mix(in oklab, <color> 12%, transparent)`), `rounded-[10px]`. It replaced the bare
colour swatch everywhere one existed — 34–36px in a list row, 56px as an editor's icon
trigger. Because the glyph takes its colour from CSS `color` and the tint is a `color-mix`,
one chip is correct in both themes with no theme branch and no second asset.

**Content icons never mirror in RTL** — a category icon is a pictogram of a thing, and
mirroring `airplane-takeoff` would make the plane land. Chrome icons mirror as the rule
above requires. Mechanics, the pack and the picker: [icons.md](icons.md).

## i18n

- Direction is tied to locale (e.g. Arabic → RTL). The active locale lives in a global
  store; formatting (numbers, currency, dates) goes through `Intl`/a small `lib/` helper so
  it's consistent and locale-aware.

## Component styling rules

- Tokens + utilities; extract shared variants into small primitives in `src/components/`.
- Keep components presentational and direction/theme-agnostic — they consume tokens and
  logical utilities and "just work" in any theme/direction.
- No inline magic numbers for color/spacing that should be a token.

## Implemented palette & token mechanism (Means)

Tokens live in `src/styles/theme.css` (imported by `main.tsx`). Mechanism: `@theme inline`
maps each `--color-fp-*` to a runtime `var(--fp-*)`, and `:root` / `.dark` redefine the
`--fp-*` values. So utilities like `bg-fp-surface` resolve through the variable and **flip
on the `.dark` class** — components never branch on theme. (`@theme inline` is required so
Tailwind emits the var reference instead of copying a static value.) Opacity modifiers
(`bg-fp-danger/10`) still work via Tailwind v4's `color-mix`.

Palette (from the Means design's `THEMES` const): warm-neutral surfaces, emerald accent.
Concrete light/dark hex values are recorded in the agent memory `means-design-tokens`.
Added beyond the design: `fp-danger` (form errors) — light `#B42318`, dark `#F2998E`; `fp-warn`
(a warning that is not yet an error, e.g. a key expiring soon) — light `#B54708`, dark `#F5B35C`.
The transaction dialog's type tints: `fp-spend` / `fp-spend-soft` (light `#B4561A` on
`rgba(232,131,58,.11)`, dark `#F4A66E`) and `fp-transfer` / `fp-transfer-soft` (light `#2457B8` on
`rgba(59,130,246,.10)`, dark `#8DB4F8`); income uses the accent.

`ResponsiveDialog` also takes `onBack`: a back button replaces the close button before the title,
for a sub-view of the dialog (the transaction dialog's in-place pickers).

- Theme is a Zustand store (`src/stores/theme.ts`, `light|dark|system`, persisted) that
  toggles `.dark` on `<html>`. Direction is `src/stores/direction.ts` (`en→ltr`, `ar→rtl`,
  persisted) setting `dir`/`lang` on `<html>` **and** feeding Radix's `Direction.Provider`. Both
  are applied on app start from `__root.tsx`.
- Auth screens use logical utilities (`ps-/pe-`, `end-0`) so they work LTR + RTL. The font
  (Hanken Grotesk) is **self-hosted**: `@fontsource-variable/hanken-grotesk` is imported at the
  top of `theme.css` (one variable woff2 per unicode subset, weights 100–900, so 400–800 are all
  there) and `--font-sans` names its family, **`'Hanken Grotesk Variable'`** — the package's name
  for it, not Google's. The files become hashed build output, so the service worker precaches
  them ([pwa-and-mobile.md](pwa-and-mobile.md)). No font `<link>` in `index.html`.

> When you add a token, add it to the `@theme` block (and the dark overrides) — that's the
> single source of truth. Record palette decisions here.

## The dialog kit — `src/components/dialog/`

Every dialog and side pane is built from the same parts (design: "Dialogs & side panes", shared
patterns P1–P7). Labels are questions (`FieldLabel` / `FormRow`, with an `optional` suffix);
values sit in field wells.

- `AmountWell` — the one big amount on a tint, when money is the point of the dialog.
- `Chip`/`ChipRow` (one-tap picks: cadences, dates), `PillSwitch` (2–4 way segmented track),
  `OptionTiles` (choices that need a description line), `ColorSwatches`, `ToggleCard`, `NoteBox`
  (tinted "what this will do" line).
- `DialogActions` — the footer: hint line, `[Delete] [extra] [Cancel] [Primary flex-1]`; `ready`
  keeps the primary pressable while it looks disabled, so pressing shows what's missing.
- `ConfirmDialog` — every "are you sure" (P3 delete in `danger`, archive in `neutral`), with
  consequence `bullets` and an optional grey `note`. Every delete goes through one.
- `useDiscardGuard` — P4 "Discard your changes?" for editors whose close would lose edits.
- `DoneState` — P5 check + Undo/Done body for create flows that land something undoable.
- `DateField` takes `hint` ("in 5d" / "12 days ago" via `relativeDayLabel`, or a fixed word).
- Side pane (P6): the goals `DetailPanel` — a 330px rail floating 12px in from the page's end
  edge, same header as a dialog, footer pinned; a bottom sheet on mobile.

## shadcn/ui integration

The UI primitives are **shadcn/ui** (Radix-based), installed under `src/components/ui/`
(config in `components.json`, `cn()` in `src/lib/utils.ts`). Rule of thumb: **if shadcn has
a component, use it**; only keep a bespoke component for things shadcn lacks (the native
`DateField` overlay, the password-strength meter, charts/timeline/hero visualizations, the
mobile tab bar, per-category color grids/swatches).

**Token bridge — single source of truth stays `fp-`.** shadcn's semantic tokens
(`--background`, `--primary`, `--border`, `--ring`, `--card`, `--muted`, `--destructive`, …)
are defined in `theme.css` as **aliases of the `fp-` vars** (e.g. `--primary: var(--fp-accent)`),
mapped into Tailwind via `@theme inline` (`--color-primary: var(--primary)`). They're defined
**once** in `:root` and theme-flip automatically because the `fp-` vars they point at flip
under `.dark`. So every shadcn component renders in the Means palette and supports dark mode
for free, with no parallel token system. Do **not** override Tailwind's default `--radius-*`
scale — existing components rely on it; shadcn keeps the default radius scale.

**Primitives are restyled to the Means look**, so feature code can use them plainly (no
per-call className needed for the base look): `button.tsx` (accent CTA = `default` variant,
`rounded-xl`, accent shadow, `font-bold`; plus `quiet` / `danger-soft` variants and the
`dialog` size every dialog button uses), `input.tsx`/`textarea.tsx`/`select.tsx` trigger (the
**field well** — `FIELD_WELL` in `ui/field-well.ts`: `bg-fp-surface-2`, 14px radius, a hairline
in `fp-border` that reads as borderless, accent on focus, red tint when `aria-invalid`; every
plain text/search field sits in it — a wrapper holding an icon plus a bare input uses
`FIELD_WELL_GROUP`, as `command.tsx`'s `CommandInput` does for every picker search; only the
themed hero inputs like `AmountWell`/`TxAmountHero` stay transparent on their own tint), the select popover (16px radius, 10px-radius items, accent-soft checked row, uppercase group
labels) — its surface, row and separator are `MENU_SURFACE` / `MENU_ITEM` / `MENU_SEPARATOR` in
`ui/menu-surface.ts`, shared by `SelectContent`, `PopoverContent` (the CurrencyPicker) and every
`DropdownMenu` (content, sub-content, items): one hairline `fp-border` frame + soft deep shadow,
so a menu reads on any background (decided 2026-09-27: bordered, not borderless). There is **no
global border colour**, so a bare `border` class draws in `currentColor` — always name
`border-fp-border` (or set the colour inline); shadcn's stock `border` is what drew a dark
outline on the ⋯ menus. Also restyled: `switch.tsx`/`checkbox.tsx` (fp sizing + colors). Don't pass border/radius/background
overrides to these per call — only layout (width). When you re-run `shadcn add` for a new component, re-apply this fp-
styling to its base classes (and check RTL — the `Switch` thumb uses `rtl:` to flip).

**Modals → `ResponsiveDialog`** (`src/components/ui/responsive-dialog.tsx`): one primitive for
all editors/dialogs — a centered Radix `Dialog` on desktop and a vaul `Drawer` bottom-sheet on
mobile (via `useIsDesktop()` in `src/hooks/useMediaQuery.ts`). It supplies the Means modal
chrome from the "Dialogs & side panes" design (title + `description` as the subtitle + close,
a scrollable body that stacks its children `gap-[14px]`, a footer pinned under a hairline;
470px default). `icon` + `tone` turn it into an alert (tinted icon circle, no close,
equal-width buttons); `hideHeader` keeps the title for screen readers only (a done state). Controlled with `open`/`onOpenChange`;
pass fields as `children` and action buttons as `footer`. Never hand-roll `fixed inset-0`
overlays anymore. `dismissible={false}` removes the close button and blocks Escape, backdrop
and drag-to-close (Radix `preventDefault` / vaul `dismissible`) — only for a dialog whose
accidental close loses something, like the shown-once key secret.

**RTL with Radix: the tree is wrapped in `Direction.Provider`, and that is a correctness fix,
not a nicety.** Radix does **not** read the `dir` attribute on `<html>`. Its `useDirection()`
reads a React context and **falls back to `'ltr'`**, then stamps `dir="ltr"` onto triggers and
onto portalled content — which is mounted outside the app subtree and so would not inherit the
document's `dir` even if Radix did not set one. Without the provider, every select, dropdown and
menu in the app rendered LTR inside an RTL page, and every logical CSS property inside them was
inert, because the element they resolved against said `ltr`. Measured on a select trigger:
`dir` goes `"ltr"` → `"rtl"`, and an item's inline padding flips from 8/32 to 32/8.

So `routes/__root.tsx` wraps everything — outside `TooltipProvider`, outside the `Outlet` — in
`<Direction.Provider dir={direction}>` (the `Direction` namespace of the `radix-ui` package),
fed by `useDirectionStore`. The document's `dir`/`lang` are still applied on mount by
`applyStoredDirection()`; the two are not redundant, they cover different consumers (CSS and
Radix). Direction is derived from the locale — `setLocale` is the only mutator — so a change here
means changing the locale.

**`SelectContent` anchors to the trigger's start edge** (`position="popper"`, `align="start"`,
both defaults on our wrapper). `item-aligned` measures every option on open to line the selected
one up with the trigger, which our ~60-option menus cannot afford; and under `item-aligned` the
`align` prop is dead code, so switching to `popper` without setting `align` would have silently
centred every menu on its trigger. Start-aligned menus are now the app-wide convention, in both
directions.

**Conversions and the deliberate exceptions.** The primitives use logical utilities throughout —
`ps-`/`pe-` for item padding and inset labels, `start-`/`end-` for check indicators, the dialog
close button and the avatar badge, `ms-auto` for menu shortcuts and submenu chevrons (plus
`rtl:rotate-180` on the chevron _glyph_, which points at the submenu and must mirror),
`rounded-s-`/`rounded-e-` and `border-s` for the toggle-group's segmented edges, `text-start`
for dialog and drawer headers, and the Radix transform-origin variable rather than a static
origin. Three things stay **physical on purpose**:

- **`data-[side=*]` animation classes** (`slide-in-from-right-2`, `-translate-x-1`, …). `side` is
  floating-ui's _resolved placement_ — a geometric fact about where the menu actually landed, not
  a reading of direction — so a menu that opened to the left must animate from the left in either
  direction. Flipping these would animate the menu away from its own trigger.
- **Dialog centring** (`left-[50%]` + `translate-x-[-50%]`): symmetric, so there is nothing to
  flip.
- **vaul's drawer-edge positioning and borders**, keyed on its own physical
  `data-[vaul-drawer-direction=left|right]`. The library's axis is physical; ours would disagree
  with the sheet it is describing.

Two more that look physical and are not: Tailwind v4 compiles `space-x-*` to `margin-inline-*`
(so `AvatarGroup`'s overlap flips on its own), and `Switch`'s thumb keeps an explicit
`rtl:-translate-x-[18px]` escape because a transform has no logical form. Keep using logical
utilities in any custom classes you add to a shadcn component, and when you re-run `shadcn add`,
convert the physical ones it ships with — the upstream defaults are LTR-only.

**`SegmentedBar` — the one stacked bar** (`src/components/SegmentedBar.tsx`). The Cashflow hero
(Spending) and the Total hero (Wallets) both draw a proportional stack of coloured parts, so the
stack itself is a shared primitive: it takes `BarSegment[]` (`key`, `label`, `color`, `pct`,
`valueStr`, `pctStr`, optional `note`) and reveals a part's figures on hover, keyboard focus and
tap. A segment is a real `<button>` with an `aria-label` carrying the same three facts, so the bar
is reachable without a pointer; non-active segments dim to 0.4 so the one being read stands out.
The numbers are **built by the selectors, not the bar** — `buildCashflow`/`buildRecurringView`
(`CashflowSegment`) and `buildWalletsView` (`GroupBar`) already hold the catalog, the base
currency and the denominator, and money is never formatted in a component.

Its tooltips are shadcn `Tooltip`s driven **fully controlled — `open` is passed, `onOpenChange`
deliberately is not.** That makes Radix's own hover/pointerdown/dismiss logic inert and routes
every input path through one `active` key, which is what a touch device needs: Radix's built-in
trigger opens on hover only, and its pointerdown handler would shut the tooltip during the very
tap meant to open it. The component therefore owns the whole interaction — `pointerenter`/
`pointerleave` are **filtered to `pointerType === 'mouse'`** (a touch fires both around a tap, so
an unfiltered handler opens then instantly closes), a tap toggles, and a `pointerdown` listener on
`document` closes on a press outside the bar, since a finger has no pointer to move away.

**Empty Select values:** Radix `Select` forbids an empty-string item value. For a "none"/
placeholder option use a sentinel (convention: `const NONE = '__none__'`) and map it back to
`''`/`null` in the change handler.

**Radix floor: `radix-ui` >= 1.6.2 — below it, dismissing a menu inside a modal closes the
modal too.** While a `Select`/`DropdownMenu`/`Popover` is open it becomes the top dismissable
layer, so Radix gives the dialog underneath `pointer-events: none`; a click aimed at the dialog's
own body then hit-tests through to the overlay. `DialogContent` hardcodes
`deferPointerDownOutside`, and in `@radix-ui/react-dismissable-layer` <= 1.1.14 the guard that is
supposed to ignore that click (`isPointerEventsEnabled`) was only evaluated on the deferred
`click` — by which time the menu had unmounted and the guard had gone stale, so the dialog
dismissed itself. 1.1.15 moved the guard to `pointerdown`. This hit every modal in the app, both
the desktop `Dialog` and the mobile vaul `Drawer`.

Because of it, **`@radix-ui/react-dismissable-layer` must resolve to a single copy** across the
tree: its layer stack is module-level state, so a second copy means the dialog's layer registry
cannot see the menu's. `vaul` and `cmdk` both carry their own `@radix-ui/react-dialog`, and
bumping `radix-ui` alone leaves them pinned on the old one — run
`pnpm update @radix-ui/react-dialog @radix-ui/react-dismissable-layer` alongside the bump and
check the lockfile lists exactly one version of each.

> `__root.tsx` holds the app's two providers, outermost first: `Direction.Provider` (fed by the
> direction store — see above) then `TooltipProvider` (required by shadcn `Tooltip`).
