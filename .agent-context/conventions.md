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
- Prefer composition over props explosion. Extract shared pieces into `src/components/`.
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

## Money & dates

- Never format money/dates by hand. Use the `lib/` helpers built on `Intl`, locale- and
  direction-aware. Money matches the wire representation end-to-end.

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
