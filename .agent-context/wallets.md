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
- **Rates**: `useWallets` takes the planner's map (`usePlannedData().inputs.rates`, one object
  per set of rates); Settings' `useWalletBasics` builds one with `useStableRates(rateRows)`
  (`src/hooks/`). Both are the config's seed rates with the user's override rows on top, kept
  stable so they can key a live query or a memo (`useMergedRates` returns a new object every
  render). The server stores overrides only; an unpriced
  currency has no rate and `convertMinor` returns `0` for that pair.
- `heldCurrencies(base, sources)` lists the currencies the user actually holds (wallets,
  goals, bills, transactions, set-asides, overrides); anything that renders a rate list uses it.
- `src/features/wallets/data/selectors.ts` — pure `buildWalletsView(nodes, base, rates,
walletDeltas?, setAsideLines?)` builds the flattened tree (honoring collapse), grand total,
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
- **Set aside · Free to spend (03 §2, §8, D14).** The 5th arg, `setAsideLines` (per-wallet
  lines from `walletSetAsides` in `features/setAsides/data/totals.ts` — see
  [set-asides.md](set-asides.md)), gives each wallet row `setAside` (Σ its lines, never capped)
  and `free = balance − setAside`, with `setAsideLines` (one per bill/goal: `ownerId`, `owner`,
  `ownerName`, colour, amount) for the expandable list. Groups roll both up in base currency
  over their active wallets, so a group's Set aside and Free are the sums of its rows.
  Setting aside more than a wallet holds is allowed (D31 warns, never blocks): `free` goes
  negative, `overCommitted` is set and `overStr` reads "SR 200.00 over". `useWallets` reads
  `goals`, `bills` and `setAsides` to build the lines; only **live** wallet set-asides in a live
  wallet count (release is explicit). The words are D14's — never "available", "reserved" or
  "pots". The engine's `planning/data/balances.ts` derives the same three numbers for the
  headline (`useMoneyFigures`); both read the same lines and deltas, so they agree.

### The ledger read and the loading state

- **`useWallets` reads nothing of its own.** Wallets, settings, rates, goals, bills and
  set-asides come from the planner's shared snapshot (`usePlannedData`, see
  [planned.md](planned.md)) — the one Safe to spend and Coming up already read — and balances
  from `useWalletDeltas(rates)` (`features/transactions/hooks/`), the running totals read once
  for every consumer, so `useMoneyFigures` and `useWallets` share it. The page therefore reads
  no table twice, and the tree's figures and Safe to spend come from the same snapshot.
  `hooks/useWallets.test.ts` compares deltas and the full view against the old every-row
  derivation and pins the shared read.
- **Settings needs no balances.** Its panes (Preferences, Email sync, Integrations, Currencies)
  use `useWalletBasics()` — active wallets, base, rates, rate rows, three small live reads — and
  Currencies adds `useHeldCurrencies(base, rateRows)` (`features/settings/hooks/`): wallets,
  bills, goals, set-asides, the ledger's `currency` totals (deleted rows included) and rate rows.
  Neither opens the planner's reads.
- **Two flags.** `loading` = the nodes are not known yet (`usePlannedData().nodesLoading`).
  `balancesLoading` = any input a figure derives from is still missing: every planner table
  (the nodes, the settings — `null`, not `undefined`, when there is no row — the rates, goals,
  bills, set-asides…) or the wallet totals. The old flag
  ignored all but nodes and rates, so balances first drew as bare opening balances and then
  jumped. While `balancesLoading`, the view is built with **no deltas and no set-asides**, so
  the tree is right but its figures are not — and must not be shown.
- **Skeletons for figures only.** The page renders every card, the tree (names, icons, child
  counts, actions), titles, labels, the base pill and the wallet/group/currency counts at once;
  each figure goes through the shared `ValueOrSkeleton` with `loading` passed down —
  `SafeToSpendCard` (the headline and its sum, group-bar values, the bar itself), `GroupRow` (subtotal), `WalletRow`
  (balance; the foreign base line waits), and the editor's `BalanceNowStrip` (`currentBalance: null`). The set-aside line and
  list need no flag: they are drawn only once the figures land.
  The page grid is `aria-busy` with one `sr-only` `role="status"`.
  `components/walletsLoading.test.tsx` pins chrome present, no money figure, skeletons in place.

## UI & wiring

- Feature lives in `src/features/wallets/` (`api/`, `data/`, `hooks/`, `components/`,
  `constants.ts`). `useWallets` is the reactive read (over `usePlannedData` + `useWalletDeltas`), `useWalletBasics`
  the light one for screens that only name wallets; `useNodeEditor`
  drives the add/edit sheet. Components are dumb; `WalletsPage` composes them.
- Recreated shell: the **shared chrome** now lives in `src/components/chrome/` (`TopNav`,
  `MobileTabBar`, `AccountMenu`, `BrandMark`, `sections.ts`), section-aware via an `active`
  prop and reused by both Wallets and Goals — Wallets/Goals nav items navigate (TanStack
  `Link`), Budget is disabled. Wallets-specific UI: `SafeToSpendCard` (see [The headline](#the-headline--safe-to-spend)), `WalletsGroupsCard`
  (+ `GroupRow`/`WalletRow`), the rail (`ComingUpCard`, `MonthlyFlowCard` — see
  [The rail](#the-rail)), and
  `NodeEditor` (centered modal on desktop, bottom sheet on mobile). Every wallet and group row
  leads with an `IconChip` — the node's glyph in its colour on a 12%-tint square — in place of
  the old 11px colour dot, which is what makes a tree of eight accounts readable at a glance.
  `NodeEditor` puts a 56px chip above the name field as the `IconPicker`'s trigger; the picker
  is rendered **inside** the editor's `ResponsiveDialog` children, never beside it
  ([icons.md](icons.md#a-nested-picker-goes-inside-the-parent-dialogs-children)).
  `SafeToSpendCard` gains no icon — an aggregate has none to be.
  `SafeToSpendCard`'s group bar is the shared `SegmentedBar`: each root group's chunk names
  itself, its base-currency total and its share on hover/focus/tap, which is what
  `GroupBar.pctStr` exists for. Only positive root nodes get a chunk, and shares are taken
  over their sum — not the netted grand total — so a negative root (a card in debt) can never
  push the shares past 100%
  ([styling-and-theming.md](styling-and-theming.md#shadcnui-integration)).
  **Known gap:** at 320px the group row still overflows the card by ~28px and the trailing
  trash button clips. The chip costs horizontal room the row never had; `min-w-0 truncate` on
  the group name fixed clipping from 375px up, and the row overflowed by ~54px _before_ the
  chip, so this is an improvement, not a regression. Fixing it properly means shrinking the
  chip or the action cluster — a design decision. **Wallet rows (03 §8).** **Balance** stays the big
  figure (it is what the bank app shows). A wallet holding set-aside money adds
  `WalletSetAsideLine` — *"Set aside SR 1,900.00 · Free to spend SR 3,500.00"*, or in red *"Set
  aside SR 5,600.00 · SR 200.00 over"* — and `SetAsideLines`: folded, one button naming the two
  largest (*"Rent SR 3,000.00 · Car insurance SR 800.00 · +1"*); open, one line per bill/goal
  (colour, name, amount, chevron) that opens it on Planning (`/planning/bills|goals?open=…`).
  Which wallets are open is page state (`WalletsPage`: `expanded`); the headline's *Set aside*
  line opens them all. A **group row** adds the same line under its name — its Set aside · Free
  sums. Without set-asides a row is just name + balance. Figures are `whitespace-nowrap`; only
  the name truncates. The row's actions are Edit, Adjust (desktop) and a **⋯ menu**
  (`WalletMenu`): **Set aside…** (opens the Planning `AddMoneySheet` with `owner: null` and the
  wallet: it starts in that wallet and asks *For* — a bill or goal picker, Bills / Goals groups),
  **Adjust balance** (so phones reach it too) and **Delete** (the trash icon moved into the
  menu, which also gave the 320px row back some width). `ExchangeRatesCard` exists
  but is **not** mounted on the page (FX editing belongs to Settings).
- Route `/wallets` (guarded like the auth routes); the index redirects authenticated users
  there (it replaced the old `SignedInHome` placeholder). API types/mappers in
  `api/types.ts`, calls in `api/walletsApi.ts` (the HTTP client gained `patch`/`del`).

## The headline — Safe to spend

`SafeToSpendCard` replaced the "Total liquid cash" hero (03 §8, D13, D18). **Safe to spend** is
the big number (red below zero, with *"SR 300.00 short before payday"*), then the window —
*until payday · Oct 25* / *until Oct 31* / *next 14 days* (the Settings › Planning choice) —
then the sum: *Balance − Set aside − Bills before payday (not set aside yet) [− To set aside
before payday] [+ Income before payday] = Safe to spend*, each line the engine's own term
(`useMoneyFigures().safe`, `planning/data/safeToSpend.ts`), the optional ones only when
non-zero. Pure copy in `data/safeHeader.ts#safeHeaderView` (tested). Figures are
`formatMoney` (two decimals) so a calculator agrees with every line. Lines link: *Set aside* →
scrolls to the tree (`WALLETS_TREE_ID`); *Bills* /
*To set aside* / *Income* → Planning › Upcoming. Always visible on desktop; on a phone it folds
behind *How it adds up*. **Budgets are never subtracted** (D18): `useBudgetsLeft` (live; reads
only the rows inside the budgets' current windows) feeds `transactions/data/selectors#budgetsLeft`
and `budgetsCaption` writes *"Budgets left until payday: Groceries SR 600.00 · Dining over by
SR 50.00 · +1 more"* (the phrase is the budgets' shared window: per paycheck → "until payday",
else "this month", "this week", …; mixed → none). The counts line and the group bar stay
below. The whole card waits (`header: null` → skeletons) until both `useWallets` and
`useMoneyFigures` have landed.

## The rail

The side column (below the tree on mobile) answers "what's about to happen to this money" and
"how has it been going". A per-currency split card used to sit here; it was removed
(2026-09-27) as noise for the common one- or two-currency user — the hero already counts
currencies and each foreign wallet row carries its "≈ base" line. The "Your baseline feeds
planning" teaser went the same day (its "planning pages coming next" copy was stale).

- **Coming up** (`ComingUpCard`, `hooks/useComingUp`, pure `data/comingUp.ts`, tested). Open
  planned **payments and income** due within `COMING_UP_DAYS` (30), overdue ones included (owed,
  so they land "now"), grouped by wallet. Rows come from `usePlanned()` (the Planned tab's own
  `PlannedRowView`s, so the remainder and "in 3 days"/"2 days late" text agree with Upcoming);
  balances are `transferWallets` (opening + deltas), what each wallet holds set aside is
  `useWallets().setAsideLines`, and the set-aside rows come from `usePlannedData().inputs`.
  Each wallet walks **Free to spend** *now → after* (03 §9: "Free SR 800.00 → SR 1,300.00"), up
  to three items (+N more), each a link to the planned row on Planning › Upcoming
  (`?open=planned:<id>`). **A payment releases its own set-aside as it lands (F8)**: the live
  set-asides of its bill occurrence (or its goal) **in that wallet** — never another wallet's —
  so paying a bill that was saved for leaves Free unchanged and never warns. One alert from
  walking the items in date order: **short** (the balance goes below zero, red) beats
  **setAside** (*"Dips into set-aside money on Oct 1"*, amber: a step takes Free lower, below
  zero — a wallet already over-committed whose payment is covered by its own set-aside is not
  blamed). Wallets
  with an alert sort first. Rows whose wallet is missing or archived are not priced per wallet;
  they are summed instead (F9): *"No wallet yet: −SR 650.00 · 2 items"* (income adds, payments
  subtract, base currency), so the card agrees with Balance ahead. Planned set-asides are not
  listed (they move no money). `null` view (skeleton) until both balances and planned rows land.
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
  `archivedCount`. Ledger deltas, set-aside lines and `heldCurrencies` still see every live
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
- **Set-asides leave with it (03 §6).** Archived wallets never hold set-asides. When the node
  (a wallet, or any wallet under a group) holds some, `ArchiveNodeDialog` says how much and
  asks: **Move them to [wallet]** (default, the first other active wallet — a label move,
  `moveSetAsidesOutOf`) or **Free them up** (`freeSetAsidesUnder`); with nowhere to move them,
  only Free. Its `onConfirm(choice)` runs that batch, then `archiveNode`. **Deleting frees
  them**: `deleteNode` calls `freeSetAsidesUnder` first (one release batch queued ahead of the
  node delete — the server releases them on delete too, so either order settles), and
  `DeleteNodeDialog` (`heldStr`) says so — on Wallets and in Settings › Archived alike. Both in
  `data/heldMoney.ts` (tested); the amount is `heldTotalStr(setAsideRows, walletIdsUnder(nodes,
  id), base, rates)` (`data/setAsideMoves.ts`), in base.
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
- **Set-aside money moving with it (03 §6).** `useTransferDialog(wallets, rates, holdings)`
  takes every wallet's set-aside lines and rows (`useWallets().setAsideLines` / `setAsideRows`).
  When the amount goes beyond FROM's Free to spend, submit first swaps the form for
  `TransferSetAsidePrompt`: *"SR 400.00 of this is set aside (Car insurance SR 300.00, Umrah
  SR 100.00). Move those set-asides with it?"* — **Move them** (the transfer is written, then
  `moveSetAsides` moves those rows to TO, stamped with the transfer id — one batch) / **Leave
  them** (FROM is left over-committed, red on its row) / *Change the amount*. Which ones: the
  share beyond Free comes out of FROM's lines largest first (`pickHeld`), each owner's live rows
  oldest first with the last one split (`partsForPicks`) — pure in `data/setAsideMoves.ts`.
  The done line adds "· SR 400.00 set aside moved with it"; **Undo** deletes the transfer and
  moves those set-asides (live rows in TO carrying the transfer id) back to FROM.

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
- **Below its set-asides.** `AdjustBalanceDialog` takes `setAsideIn` (what each wallet holds
  set aside); when the typed balance is below it the form warns, never blocks (03 §6,
  `adjustWarning`): *"Main bank holds SR 1,900.00 set aside. At SR 1,500.00 it would be SR
  400.00 over-committed."*
- **Components**: `AdjustBalanceDialog` → `AdjustBalanceForm` (`AdjustWalletCard` — current
  struck through → new; `ActualBalanceWell`, the big neutral "What does it really hold?" figure
  — its own component because it takes a sign, which the shared `AmountWell` doesn't; Date
  (`DateField` with its relative hint) beside `AdjustDifferenceBox`; note; `BodySubmit`) or the
  shared `DoneState` with the header hidden. No footer.
