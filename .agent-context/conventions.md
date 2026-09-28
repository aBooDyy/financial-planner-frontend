# Frontend Conventions

House style for the frontend. Complements the global principles in
[`../../CLAUDE.md`](../../CLAUDE.md) (SOLID, DRY, single responsibility, clean code,
minimal non-stale comments).

## Components

- **Smallest possible, single responsibility.** A component renders one thing. If it both
  fetches/derives data _and_ renders complex UI, split: logic → hook, presentation →
  component.
- Presentational components are **dumb**: props in, UI out, no data access, theme/direction
  via tokens and logical utilities.
- Prefer composition over props explosion. Extract shared pieces into `src/components/`
  (e.g. `SegmentedBar`, the stacked proportional bar both hero cards draw; `RailCardHeader`, the
  title / caption / action header of every side-rail card).
- One component per file; file name matches the component.
- **Use shadcn/ui primitives** from `#/components/ui/*` for anything shadcn provides
  (Button, Input, Select, Switch, Checkbox, Dialog/Drawer, DropdownMenu, Tabs, ToggleGroup,
  Alert, Badge, Avatar, Progress, Separator, Collapsible, Card, Tooltip, …). They're already
  restyled to the `fp-`/Means look. For modals/editors use `ResponsiveDialog`
  (`#/components/ui/responsive-dialog`), never a hand-rolled overlay. Keep bespoke components
  only for what shadcn lacks. See [styling-and-theming.md](styling-and-theming.md#shadcnui-integration).
- App-level wrappers in `src/components/` (`Button`, `TextField`, `PasswordField`, `Checkbox`,
  `Divider`) and settings `Toggle`/`Segmented` are thin layers over the shadcn primitives that
  keep their existing public APIs — prefer them where they already exist.
- **Empty lists/sections use `EmptyState`** (`#/components/EmptyState`): accent icon tile,
  a bold title in `fp-text`, supporting copy in `fp-text-2`, optional add `action`. Never a
  lone gray (`fp-text-3`) sentence — it reads like a caption. `size="md"` when it fills a
  list or tab, `size="sm"` in side cards and sub-lists; `framed` only when it isn't already
  inside a card. Picker "no matches" text (`CommandEmpty`) and inline form hints stay plain.

## Hooks

- Feature logic lives in hooks under `features/<feature>/hooks/` (queries, mutations,
  derived state, local-DB access). Components call hooks; they don't embed logic.
- Custom hooks are single-purpose and named `useThing`.

## Naming & files

- Components: `PascalCase`. Hooks/functions/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Files: `PascalCase.tsx` for components, `camelCase.ts` for everything else.
- Use the `#/*` import alias (configured in `package.json`) for absolute imports.

## Types

- TypeScript strict. No `any`. Model domain types from the
  [domain glossary](../../.agent-context/domain-glossary.md); API types mirror the backend
  contracts (see root
  [api-contract-conventions.md](../../.agent-context/api-contract-conventions.md)).

## Styling

- Tailwind utilities + **`fp-` tokens** only; no hard-coded colors/spacing. **Logical**
  (direction-aware) utilities only. See [styling-and-theming.md](styling-and-theming.md).

## State

- Right home for each kind of state — see [state-management.md](state-management.md). Don't
  duplicate domain data into Zustand; derive from the local DB.

## Data access

- All persistence and sync goes through `src/db/`; all HTTP through the single client in
  `src/lib/` (with `credentials: 'include'`). Components never call `fetch` directly.
- **Never make a `useLiveQuery` result an effect dependency.** A live query re-runs on every
  write to the tables it touches and hands back freshly deserialized objects, so a row's
  identity changes even when the row did not. An effect keyed on one re-fires on unrelated
  writes; if it fetches, that is a request loop. Depend on the identifier (`row?.id`) and
  latch work that must happen once per row in a ref.
- **When the work depends on a whole table, stamp it.** Reduce the live rows to a string of
  `id:version:updatedAt` per row and hold the array in a ref, replacing it only when the stamp
  changes (`useLiveRows` in `features/import/hooks/useCsvImport.ts`). `version` moves on every
  write the server acknowledges and `updatedAt` on every write made here, so two emissions
  sharing a stamp hold the same data — which is what lets an expensive derivation survive a
  background pull that changed nothing.
- **App-wide work belongs to the app, not to a page.** Anything whose scope is the whole
  dataset — the sync loops above all — is mounted once in the root layout. A page mount
  effect should only ever start work about that page.

## Money & dates

- Never format money/dates by hand. Use the `lib/` helpers built on `Intl`, locale- and
  direction-aware. Money matches the wire representation end-to-end.
- **Every numeric field is guarded.** An amount input spreads `amountInputProps(code, value, onValue)`
  (`lib/currency.ts`) instead of writing its own `onChange`/`inputMode`; any other decimal
  field (FX rates) spreads `numericInputProps(rules, onValue)` (`lib/numericInput.ts`). Both
  open the phone's number keypad and pass `onValue` only sanitized text: Arabic-Indic digits
  and `٫` become ASCII, letters/commas never appear, one point, the fraction capped at the
  currency's decimals, and a leading `-` only with `{ signed: true }` (balances can go
  negative; transfer, spend and goal amounts can't). The caret stays where the user typed.
  An amount field *shows* its value grouped (`18,420.50`, via `groupThousands`) while state
  keeps the plain `18420.50`; `minorToInputValue` prefills with the currency's full decimals.
- **Ledger rows show exact money.** Activity rows and day totals use `formatMoney`
  (`SR 1,234.50`); `formatMoneyRounded` is for planning/summary figures only.

## Comments

- Minimal. Explain _why_ for non-obvious decisions, local to the code. Avoid comments that
  describe other modules' behavior — they go stale silently.

## Testing

- Vitest + Testing Library. Test behavior (user-visible), not implementation. Cover hooks
  with logic, the sync engine, and critical components. Co-locate tests with the code or
  under a `__tests__` folder — be consistent.

## Linting/formatting

- ESLint + Prettier are authoritative; run `pnpm format` / `pnpm lint`. Don't fight the
  formatter.
