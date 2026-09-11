# Styling & Theming — Tailwind, `fp-` Tokens, RTL/LTR, Light/Dark

Styling uses **Tailwind CSS v4**. All project-defined design values are **tokens prefixed
with `fp-`** and live in one place. Theming and direction are first-class.

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

## RTL / LTR — first-class, non-negotiable

RTL is a core requirement. Build for it from the start:

- **Use logical CSS utilities, never physical ones.** `ms-*`/`me-*` (margin-inline),
  `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`. **Never** `ml-/mr-/left-/right-`
  for layout that should flip.
- Set `dir` on `<html>` (and `lang`) from the direction store; let the browser flip the
  layout. Default Tailwind logical utilities respect `dir`.
- **Icons/affordances that imply direction** (back/forward chevrons, progress) must mirror
  with direction — handle explicitly.
- **Don't mirror** things that shouldn't flip: numbers, charts/timelines axes semantics,
  brand logos. Money figures stay LTR-formatted within an RTL layout via `Intl`.
- Test every screen in both directions. A layout isn't done until it works in RTL.

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
Added beyond the design: `fp-danger` (form errors) — light `#B42318`, dark `#F2998E`.

- Theme is a Zustand store (`src/stores/theme.ts`, `light|dark|system`, persisted) that
  toggles `.dark` on `<html>`. Direction is `src/stores/direction.ts` (`en→ltr`, `ar→rtl`,
  persisted) setting `dir`/`lang` on `<html>`. Both are applied on app start from
  `__root.tsx`.
- Auth screens use logical utilities (`ps-/pe-`, `end-0`) so they work LTR + RTL. The font
  (Hanken Grotesk) is loaded in `index.html` and wired to `--font-sans`.

> When you add a token, add it to the `@theme` block (and the dark overrides) — that's the
> single source of truth. Record palette decisions here.

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
`rounded-xl`, accent shadow, `font-bold`), `input.tsx`/`textarea.tsx`/`select.tsx` trigger
(`rounded-xl`, `bg-fp-surface-2`, `py-3`, soft accent focus ring), `switch.tsx`/`checkbox.tsx`
(fp sizing + colors). When you re-run `shadcn add` for a new component, re-apply this fp-
styling to its base classes (and check RTL — the `Switch` thumb uses `rtl:` to flip).

**Modals → `ResponsiveDialog`** (`src/components/ui/responsive-dialog.tsx`): one primitive for
all editors/dialogs — a centered Radix `Dialog` on desktop and a vaul `Drawer` bottom-sheet on
mobile (via `useIsDesktop()` in `src/hooks/useMediaQuery.ts`). It supplies the Means modal
chrome (title + close, scrollable body, pinned footer). Controlled with `open`/`onOpenChange`;
pass fields as `children` and action buttons as `footer`. Never hand-roll `fixed inset-0`
overlays anymore.

**RTL with Radix:** Radix reads direction from the `dir` attribute on `<html>` (set by the
direction store), so dropdowns/selects/popovers position correctly in RTL automatically. Keep
using logical utilities in any custom classes you add to a shadcn component.

**Empty Select values:** Radix `Select` forbids an empty-string item value. For a "none"/
placeholder option use a sentinel (convention: `const NONE = '__none__'`) and map it back to
`''`/`null` in the change handler.

> `TooltipProvider` wraps the app in `__root.tsx` (required by shadcn `Tooltip`).
