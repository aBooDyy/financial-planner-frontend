# Wallets — the first synced, local-first feature

The first domain feature, and the one that **landed the local DB + sync engine**. A tree of
**wallets** and **groups** with multi-currency totals in a switchable **base currency**.
Recreated from the Means `PlannerApp` design (pixel-faithful, light/dark, RTL-aware).
Domain terms: root [domain-glossary.md](../../.agent-context/domain-glossary.md).

**Naming.** The page, route (`/wallets`), nav section and feature folder
(`features/wallets/`) are "Wallets" (renamed from "Balances"). The data model keeps its
contract names: Dexie tables `balanceNodes`/`balanceSettings`, `BalanceNode*` types, the
backend `/balance-nodes` + `/balance-settings` endpoints and `balances.*` error codes. Don't rename
those without a coordinated backend + Dexie migration.

## Local DB & sync (realizes [data-layer-and-sync.md](data-layer-and-sync.md))

- **Dexie** (`src/db/db.ts`, `dexie` + `dexie-react-hooks`): tables `balanceNodes`,
  `balanceSettings` (singleton key `'me'`), `exchangeRates`, and the `outbox`. Sync flags
  `dirty`/`deleted` stored as `0|1` (IndexedDB can't index booleans). `clearLocalDb()` runs
  on logout (`useLogout`) so the next user starts clean.
- **Sync engine** (`src/db/sync.ts`): `startSync()` (mounted **once**, by `useSync()` in the
  root layout, for as long as there is a session — never per page, see
  [data-layer-and-sync.md](data-layer-and-sync.md#where-sync-is-started)) runs the
  pull-then-push loops + online/visibility/interval triggers and dispatches every synced
  entity (nodes/settings, plus the Goals `income`/`goal` entities — see [goals.md](goals.md)).
  Push drains the outbox debounced ~800ms with a 30s safety flush; pull is a full refresh
  that skips `dirty` records. `409` → pull, rebase the local edit on the server
  version, retry once, else accept server (whole-record LWW, client re-apply). Any other
  failure keeps the op and flags it — rejected ones back off, unavailable ones stop the drain
  ([data-layer-and-sync.md](data-layer-and-sync.md#failed-pushes-flag-hold-retry--never-drop)).
- **Optimistic mutations** (`src/features/wallets/data/mutations.ts`): write Dexie + queue
  a **coalesced** outbox entry (a pending create absorbs later edits; delete of a
  never-synced node just drops its queued ops). Server cascade means delete enqueues **one**
  op for the subtree root. IDs are client-generated UUIDs.

## Money & derivation (the brains)

- `src/lib/currency.ts` — money helpers over the **config** currency table
  (`formatMoney`/`parseAmountToMinor`/`convertMinor`/`decimalsFor`). Money is integer
  **minor units** + ISO-4217 end to end; the minor unit is per-currency data (0 for JPY, 3 for
  KWD), so formatting (via `Intl`) and FX conversion happen only here. Any ISO code is valid,
  validated at the wire boundary — see [app-config.md](app-config.md). Totals are computed
  client-side, not fetched.
- **Rates**: `useWallets` builds one map with `useStableRates(rateRows)` (`src/hooks/`) — the
  config's seed rates with the user's override rows on top, memoized so it can key a live
  query (`useMergedRates` returns a new object every render). The server stores overrides only; an unpriced
  currency has no rate and `convertMinor` returns `0` for that pair.
- `heldCurrencies(base, sources)` lists the currencies the user actually holds (wallets,
  goals, bills, transactions, set-asides, overrides); anything that renders a rate list uses it.
- `src/features/wallets/data/selectors.ts` — pure `buildWalletsView(nodes, base, rates,
walletDeltas?, reservations?)` builds the flattened tree (honoring collapse), grand total,
  counts, and top-level bars. `groupParentOptions` powers the "Place inside"
  picker (excludes self + descendants). Unit-tested in `selectors.test.ts` / `currency.test.ts`.
- **Wallet pickers show groups as headings.** A dropdown where only wallets can be picked
  lists them under their group's name (`Parent › Child` for nested groups). The group is a
  label, never an option, and wallets outside any group come first with no heading. Build it
  from `walletGroupOptions` and don't hand-roll a flat list:
  - `useWalletGroups()` gives the live tree as groups, for a picker that is handed only its
    wallets.
  - `sectionByGroup(groups, rows)` (`data/walletSections.ts`) lays that picker's own rows out
    under their groups, keeping its filter.
  - `walletSections(groups)` is for a picker that lists every wallet.
  - Render with `WalletSelectSections` inside a `Select`, or `WalletMenuSections` inside a
    `DropdownMenu`. Both use the shared `MENU_LABEL` heading style.
  - Pickers where a group *is* a pick (Spending's scope filter, "Place inside",
    `TxAccountPill`) keep their own sections.
- **Icons resolve in the selector, not the row.** A node carries `icon: string | null` — never
  `undefined`, because an update wire is built from the row and a dropped key reads as "clear
  it" ([categories.md](categories.md#local-rows--sync)). `buildWalletsView` hands every row a
  ready `icon: IconId` —
  `iconIdOr(node.icon, WALLET_ICON | GROUP_ICON)`, so a node with no icon, or one the pack
  no longer defines, falls back to `wallet` / `stack` by kind and **no row is ever
  iconless**. `WalletRow` and `GroupRow` stay dumb, and the default-by-kind rule is
  assertable straight out of the selector. `useNodeEditor` narrows a stored-but-unknown id
  to `null` rather than freezing it into the draft, so an id from a newer pack degrades to
  "the default for this kind" instead of sticking. See [icons.md](icons.md).
- **Collapse is view-only.** A group's `collapsed` flag decides which rows are emitted and
  nothing else. Wallet/group/currency counts and the grand total are
  tallied over the whole synced tree (`tally` in `buildWalletsView`, separate from the row
  `walk`), so collapsing a group never changes a headline figure.
- **Reserved vs available (set-asides).** The 5th arg, `reservations` (per-wallet lines from
  `walletSetAsides` in `features/setAsides/data/totals.ts` — see [set-asides.md](set-asides.md)),
  splits each wallet into `reserved`/`available`, with a per-owner `reservations[]` breakdown
  (`ownerId`, `owner: 'goal' | 'bill'`, `ownerName`); groups roll the figures up in base
  currency, and the view exposes `reservedTotal` + `availableTotalStr`. `useWallets` reads
  `goals`, `bills` and `setAsides` to build them: a line is the sum of one bill's or goal's
  **live** wallet set-asides in that wallet (a released row no longer counts — release is
  explicit, nothing is re-derived from payments), one line per owner per wallet. The rows still
  say "reserved / available"; the Wallets rebuild renames them Set aside / Free to spend. Wallet
  money is **earmarked in place** — the balance and grand total are unchanged; reserving only reclassifies part of a
  wallet as spoken-for. **Over-reserving is allowed**: reserved is _not_ capped at the balance,
  so `available` can go **negative** and the row carries `overReserved` (rendered red). Nothing
  checks before the money is reserved — no editor, contribution or confirm flow compares against
  `available` — so an over-reserve only shows **after the fact**, as the red available figure and
  "over-reserved" label on the wallet row (`ReservedWalletLines`).

### The ledger read and the loading state

- **`useWallets` never holds the ledger's rows.** `readLedgerSummary(rates)`
  (`features/transactions/data/ledgerReads.ts`) reads the whole table inside one live query and
  hands back only what the view derives from it: each wallet's `walletDeltas` and the set of
  row **currencies**
  (deleted rows included, as `heldCurrencies` always counted them). A balance sums every row, so
  the read itself stays whole; nothing it shows changed — `hooks/useWallets.test.ts` compares
  deltas, the full view and `held` against the old every-row derivation. It waits for the rates
  (so a mount costs one read, not two); a rate edit re-runs it.
- **Two flags.** `loading` = the nodes are not known yet. `balancesLoading` = any input a figure
  derives from is still missing: the nodes, the settings (`null`, not `undefined`, when there is
  no row), the rates, goals, bills, set-asides or the ledger summary. The old flag
  ignored all but nodes and rates, so balances first drew as bare opening balances and then
  jumped. While `balancesLoading`, the view is built with **no deltas and no set-asides**, so
  the tree is right but its figures are not — and must not be shown.
- **Skeletons for figures only.** The page renders every card, the tree (names, icons, child
  counts, actions), titles, labels, the base pill and the wallet/group/currency counts at once;
  each figure goes through the shared `ValueOrSkeleton` with `loading` passed down —
  `TotalHeroCard` (total, group-bar values, the bar itself), `GroupRow` (subtotal), `WalletRow`
  (balance; the foreign base line waits), and the editor's `BalanceNowStrip` (`currentBalance: null`). `ReservedWalletLines`/`PotRow`
  need no flag: with no set-asides while loading, no wallet has pots until the figures land.
  The page grid is `aria-busy` with one `sr-only` `role="status"`.
  `components/walletsLoading.test.tsx` pins chrome present, no money figure, skeletons in place.

## UI & wiring

- Feature lives in `src/features/wallets/` (`api/`, `data/`, `hooks/`, `components/`,
  `constants.ts`). `useWallets` is the reactive read (`useLiveQuery`); `useNodeEditor`
  drives the add/edit sheet. Components are dumb; `WalletsPage` composes them.
- Recreated shell: the **shared chrome** now lives in `src/components/chrome/` (`TopNav`,
  `MobileTabBar`, `AccountMenu`, `BrandMark`, `sections.ts`), section-aware via an `active`
  prop and reused by both Wallets and Goals — Wallets/Goals nav items navigate (TanStack
  `Link`), Budget is disabled. Wallets-specific UI: `TotalHeroCard`, `WalletsGroupsCard`
  (+ `GroupRow`/`WalletRow`), the rail (`ComingUpCard`, `MonthlyFlowCard` — see
  [The rail](#the-rail)), and
  `NodeEditor` (centered modal on desktop, bottom sheet on mobile). Every wallet and group row
  leads with an `IconChip` — the node's glyph in its colour on a 12%-tint square — in place of
  the old 11px colour dot, which is what makes a tree of eight accounts readable at a glance.
  `NodeEditor` puts a 56px chip above the name field as the `IconPicker`'s trigger; the picker
  is rendered **inside** the editor's `ResponsiveDialog` children, never beside it
  ([icons.md](icons.md#a-nested-picker-goes-inside-the-parent-dialogs-children)).
  `TotalHeroCard` gains no icon — an aggregate has none to be.
  `TotalHeroCard`'s group bar is the shared `SegmentedBar`: each root group's chunk names
  itself, its base-currency total and its share on hover/focus/tap, which is what
  `GroupBar.pctStr` exists for. Only positive root nodes get a chunk, and shares are taken
  over their sum — not the netted grand total — so a negative root (a card in debt) can never
  push the shares past 100%
  ([styling-and-theming.md](styling-and-theming.md#shadcnui-integration)).
  **Known gap:** at 320px the group row still overflows the card by ~28px and the trailing
  trash button clips. The chip costs horizontal room the row never had; `min-w-0 truncate` on
  the group name fixed clipping from 375px up, and the row overflowed by ~54px _before_ the
  chip, so this is an improvement, not a regression. Fixing it properly means shrinking the
  chip or the action cluster — a design decision. **Pots (05 §6, ADR-3).** A wallet
  holding goal money leads with **available** as its headline (red, captioned "over-reserved",
  when negative), a secondary "SR 10,000 in bank" line under its name, and its **pot rows shown
  by default** underneath (`PotRow`: goal colour swatch, name, amount, chevron — no expand
  state). Its text is `ReservedWalletLines`: two paired lines (name | available, then
  in-bank | caption) instead of two columns, so the in-bank figure gets the width the short
  caption leaves, not what the headline amount leaves. Figures are `whitespace-nowrap` and
  `shrink-0`; a line that still runs out of room wraps (the caption or the "≈ base" part drops
  to the next line); **only the name truncates** — at 320px included. Tapping a pot navigates to `/goals?goal=<id>`, which redirects to `/planning/goals?open=goal:<id>` (that goal's detail panel). A
  wallet with nothing reserved looks exactly as before. `TotalHeroCard` still shows the overall
  available / "reserved for goals" split when anything is reserved. `ExchangeRatesCard` exists
  but is **not** mounted on the page (FX editing belongs to Settings).
- Route `/wallets` (guarded like the auth routes); the index redirects authenticated users
  there (it replaced the old `SignedInHome` placeholder). API types/mappers in
  `api/types.ts`, calls in `api/walletsApi.ts` (the HTTP client gained `patch`/`del`).

## The rail

The side column (below the tree on mobile) answers "what's about to happen to this money" and
"how has it been going". A per-currency split card used to sit here; it was removed
(2026-09-27) as noise for the common one- or two-currency user — the hero already counts
currencies and each foreign wallet row carries its "≈ base" line. The "Your baseline feeds
planning" teaser went the same day (its "planning pages coming next" copy was stale).

- **Coming up** (`ComingUpCard`, `hooks/useComingUp`, pure `data/comingUp.ts`, tested). Open
  planned **payments and income** due within `COMING_UP_DAYS` (30), overdue ones included (owed,
  so they land "now"), grouped by wallet. Set-asides are left out — they earmark money without
  moving it. Rows come from `usePlanned()` (the Planned tab's own `PlannedRowView`s, so the
  remainder, "in 3 days"/"2 days late" text and filtering agree with that tab); balances are
  `transferWallets` (opening + deltas) and goal reserves are `useWallets().reservations`. Each
  wallet shows now → after, up to three items (+N more), and one alert from walking its items in
  date order: **short** (first day it goes below zero, red) beats **reserved** (first day it drops
  under what it holds for goals, amber). Wallets with an alert sort first. Rows whose wallet is
  missing or archived are only counted ("N items have no wallet yet"). "See all" →
  `/transactions/planned`. `null` view (skeleton) until both balances and planned rows land.
- **Money in & out** (`MonthlyFlowCard`, `hooks/useMonthlyFlow`, pure `data/monthlyFlow.ts`,
  tested). Income vs spending per calendar month for the last `FLOW_MONTHS` (6), the running
  month included, in base currency. Same rule as every report: spend/income with a category only
  — transfers and adjustments never count. Reads **only the window**
  (`readLedgerSince(flowWindowStart(today))` on the `date` index), not the whole ledger. The chart
  is plain divs: per month one button (the hit target) holding an in and an out `FlowBar`
  (10px, 4px rounded top, 2px gap, `fp-chart-in`/`fp-chart-out`), a hairline top + baseline, and
  one compact scale reading (the peak, `formatMoneyCompact`). Hover/focus/tap selects a month;
  `MonthlyFlowReadout` above shows its title, net (signed) and in/out — its swatches are the
  legend. Mouse-leave falls back to the running month. Each button carries a full `aria-label`.

## Archiving

A node carries `archivedAt: string | null` (wire: `archived` boolean out, `archived_at` in —
see backend `balances.md`). Archiving is **view-level**: nothing is moved or rewritten.

- **Rules** in `data/archive.ts`: `hiddenByArchive` (an archived node *and everything beneath
  an archived group*; memoised ancestor walk, bounded against cycles), `activeNodes` (live =
  not deleted and not hidden), `hasArchivedAncestor`, `subtreeIds`.
- **Where the filter applies.** `useWallets` builds the view from `activeNodes` and returns
  the active set as `nodes` (so the transfer dialog, the "Place inside" picker, Preferences'
  default account, email-sync and integrations pickers all drop archived wallets), plus
  `archivedCount`. Ledger deltas, goal reservations and `heldCurrencies` still see every live
  node. `walletGroupOptions`/`groupParentOptions`, `scopeSections` (Spending's account filter),
  the goal contribution form and the planned confirm form filter through `activeNodes` too.
  **Existing entries keep resolving**: `useTransactions` returns `wallets` (active, for new
  entries/quick add/review), `editorWallets` (active first, then archived — so a default is
  never an archived wallet) and `archivedWalletIds`; the transaction dialog offers an archived wallet only
  when the entry already points at it, labelled "(archived)".
- **UI.** Archive lives **only** in the `NodeEditor` footer, as a quiet button between Delete
  and Save — it is a rare action, so the rows carry no archive control (user's call). It opens
  `ArchiveNodeDialog` (a neutral `ConfirmDialog`), driven by the pure
  `archiveTarget` (`data/archivedList.ts`): what leaves, how many wallets go with a group, and
  the money that stops counting toward the total.
- **Delete always confirms.** The editor's Delete and the rows' trash button both open
  `DeleteNodeDialog` (a danger `ConfirmDialog`: the wallets that go with a group, the ledger
  going with it, "archive it instead"); Settings › Archived reuses it with `archived` ("Delete
  forever", no archive hint). Its target is the same `archiveTarget`. `WalletsPage` renders
  the adjust, archive and delete dialogs **inside** the open editor's children (else at page
  level) so answering one never dismisses the editor. `WalletsGroupsCard` ends with an "N
  archived" link to `/settings/archived` when there are any.
- **Restore** (`restoreNode`) clears `archivedAt`; a node whose group is still archived would
  stay hidden, so it comes back at the **top level** instead. Settings › Archived is described
  in [settings.md](settings.md).

## Transfer money dialog

The main place to move money between wallets (Spending records it; see
[transactions.md](transactions.md#transfers-between-wallets)). Recreated from the design's
"Transfer money" dialog (1a).

- **Entry point.** An outline "Transfer" button (⇄ `TransferGlyph`) between "New group" and
  "Add wallet" in the `WalletsGroupsCard` header, on every screen size (on mobile the three
  share the row equally). Omitted unless the user has at least two wallets (`onTransfer` is
  undefined). `ResponsiveDialog`, so a centred dialog on desktop and a bottom sheet on mobile.
- **Balances are live.** `transferWallets(nodes, deltas, base)` gives each wallet its opening
  `amount` + the ledger deltas `useWallets` already computes — the figure the wallet row
  shows. Before (struck through) → after appear once an amount exists; FROM's after turns
  red below zero, TO's after is accent-ink.
- **Pure logic** in `data/transferDialog.ts` (tested): `resolvePair` (never the same wallet
  on both sides; each picker lists every wallet but the other side's), `previewTransfer`
  (after-balances, `over` = amount > FROM live balance, `canSubmit`), `amountChips`
  (25% / 50% / All, active when the amount equals the chip), `rateLine` (effective rate of the
  entered pair, else the stored rates, quoted so the number is ≥ 1), and the labels.
- **State** in `hooks/useTransferDialog.ts`. The FX "RECEIVES" figure is `null` (follow
  `autoReceived` — `suggestReceived`, the transaction dialog's conversion, padded to the currency's minor
  units so it reads "100.00") until edited; a typed value is shown as typed; changing the
  amount, a chip, either wallet or swapping sets it back to auto. Submit calls
  `createTransfer` (to_amount = received when currencies differ). The success state keeps the
  transfer id: **Undo** calls `deleteTransfer` and returns to the form with its values;
  **Done** resets and closes. Closing the dialog any other way also resets it.
- **Components**: `TransferDialog` → `TransferForm`, amount-first like the transaction dialog:
  the shared `AmountWell` (transfer tint; red with "More than the SR … in …" when over the
  balance), `TransferAmountChips` (shared `Chip`s), `TransferAccountPair` of two
  `TransferAccountCard`s — the whole card is a `DropdownMenu` trigger — with the round swap on
  the seam, `TransferFxBox`, "When?" as the transaction dialog's `TxDateChips` (tinted by
  `--tx-ink` on the form), the note, and `BodySubmit` (full-width submit + caption; no footer).
  Once written it shows the shared `DoneState` with the header hidden.
- The wallet card leads with the wallet's `IconChip` (34px) rather than the design's bare
  colour dot, matching the wallet rows.

## Adjust balance dialog

A wallet's stored `amount` is its **opening** balance; what the rows show is opening + the
ledger. When the two drift from the bank, the user types the real figure and the gap is
recorded as a balance adjustment
([transactions.md](transactions.md#balance-adjustments)) — the opening balance is never
rewritten to fake it.

- **Entry points.** `NodeEditor`, editing a saved wallet: the amount field is relabelled
  **"Opening balance"** (a money well with the currency as a `CurrencyPicker` pill inside it),
  and an accent "BALANCE NOW · <live balance>" strip (`BalanceNowStrip`) under it carries a
  quiet **Adjust balance** button (desktop and mobile; hidden while creating). Desktop also gets a `Scale` icon in
  `WalletRow`'s action cluster (`md:` and up — the mobile row has no width to spare). Both
  preselect the wallet; the dialog has no wallet picker.
- **Nesting.** Opened from the editor, `AdjustBalanceDialog` is rendered as the editor's
  `children` (the nested-picker rule in [icons.md](icons.md)); otherwise `WalletsPage`
  renders it at page level. It is the same element either way.
- **Pure logic** in `data/adjustBalance.ts` (tested): `adjustmentFor(current, target)` →
  `{ type, amount }` or `null` when they match; `previewAdjustment(wallet, targetMinor)`
  (current, next, signed difference, `canSubmit`); `differenceLabel`, `adjustSubmitLabel`,
  `adjustDoneSummary`. Live balances come from `transferWallets` (opening + deltas), the same
  figure the row shows.
- **State** in `hooks/useAdjustBalance.ts`: `openFor(walletId)`, the "Actual balance" string
  (parsed in the wallet's currency; negative allowed), date (default today), note. Submit calls
  `createAdjustment`; the done state keeps the row id so **Undo** deletes it.
- **Components**: `AdjustBalanceDialog` → `AdjustBalanceForm` (`AdjustWalletCard` — current
  struck through → new; `ActualBalanceWell`, the big neutral "What does it really hold?" figure
  — its own component because it takes a sign, which the shared `AmountWell` doesn't; Date
  (`DateField` with its relative hint) beside `AdjustDifferenceBox`; note; `BodySubmit`) or the
  shared `DoneState` with the header hidden. No footer.
