# App Config & Open Currencies

`GET /api/v1/config` publishes the app's shared data: the full **ISO-4217 currency table**
(code, name, symbol, minor unit), the **current FX rates**, the default base currency, and
the **limits** the server enforces (import caps, email-scan bounds). It replaced the closed
five-code currency union that used to live in `lib/currency.ts`.

Two things are layered on top of it, both below: the **user's own currencies**, which are
synced user data rather than config, and the **rates opt-out**, which lets a user pin the
rates they convert at while still taking a refreshed currency table.

## The store (`src/lib/config/`)

| File               | Role                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appConfig.ts`     | The store (zustand) + `AppConfig`/`CurrencyMeta` types and the non-React accessors (`getAppConfig`, `currencyMeta`, `currencyList`, `configLimits`) and hooks (`useCurrencyList`, `useConfigLimits`). |
| `bundledConfig.ts` | **Generated** snapshot committed to the repo — the offline/first-run floor.                                                                                                                           |
| `configApi.ts`     | Wire boundary: `snake_case` payload → `AppConfig`; rate **strings** parsed to numbers here, once.                                                                                                     |
| `configCache.ts`   | The Dexie row (`appConfig`, key `'me'`).                                                                                                                                                              |
| `useAppConfig.ts`  | The bootstrap hook, called once from `routes/__root.tsx`.                                                                                                                                             |
| `rates.ts`         | `mergeRates` / `useMergedRates` (defaults + overrides), `defaultRateFor`, `isRateOverridden`.                                                                                                         |

**Bootstrap order: bundled snapshot → cached Dexie row → background network refresh.** The
store is _constructed_ from the bundle, so config is never absent and nothing blocks first
paint. A failed fetch is silent — this is the one place where a stale value beats an error.
The refresh runs when the session is `authenticated` (the endpoint is authenticated) and
re-runs on a new session. `applyConfig` no-ops when the `version` stamp is unchanged.
`clearLocalDb()` deliberately **keeps** the `appConfig` row: it holds no user data.

**A cached row is filled from the bundle on load** (`loadCachedConfig`): `limits` is merged
key by key and a missing `integrations` block takes the bundled one. The server keeps the same
`version` when it only _adds_ fields, so a row cached before a field existed would otherwise
hold `undefined` for it until the next version bump — and `applyConfig`'s version check would
keep it that way. `toAppConfig` likewise falls back to the bundled `integrations` when an older
server omits it.

The server's `version` is now `<CONFIG_VERSION>+<rates revision>` — rates move without a
deploy, so the stamp moves with them and a refresh lands whenever either half changes.

The cached row never _replaces_ a fresher one: the load is guarded so a refresh that landed
first wins. **`GET /config` mints no error codes at all** — there is no `config.*` family in
the backend catalog, and nothing here surfaces a failure to the user, because a config that
is one deploy stale is not a thing worth interrupting anybody for.

### Auto-update rates — the opt-out

`usePreferencesStore.autoUpdateRates` (Settings → Currencies & rates) is passed to
`applyConfig(fresh, keepRates)`. With it **off**, the currency table and limits still refresh
but `config.rates` is left exactly as it was: a user who has priced their world at today's
numbers doesn't want them moving under a total they already reasoned about.

`ratesVersion` records which config the rates in use came from, so the store can tell "pinned
and behind" from "current". `useAppConfig` re-runs its refresh when the preference flips,
which is what makes turning auto-update back on adopt the rates the last refresh skipped —
and it caches **the config in use**, not the one fetched, so a reload while offline converts
at the same rates the user was just seeing.

### Regenerating the snapshot

```bash
pnpm generate-config            # defaults to ../financial-planner-backend
pnpm generate-config -- --backend <path>
```

`scripts/generate-bundled-config.mjs` parses the backend's `app/config/currencies.py`
(`CONFIG_VERSION`, `DEFAULT_BASE_CURRENCY`, `_TABLE`) and the limit defaults in
`app/config/settings.py`, then writes and prettier-formats `bundledConfig.ts`. It is
idempotent and fails loudly (non-zero exit, nothing written) rather than emitting a partial
table. **Re-run it in the same commit as any backend seed change.**

A limit the script's `LIMIT_KEYS` doesn't list is silently missing from the snapshot and only
surfaces as a type error — add the pair there when `settings.py` grows a published cap.

The script also writes `integrations: { webhookUrl: null, webhookPath }`, the path being
`api_prefix` from `settings.py` joined to `WEBHOOK_ROUTE` from
`app/contracts/integrations/ingest_webhook_request.py`. The public URL is deployment
configuration (`WEBHOOK_BASE_URL`), so the snapshot never knows it.

## Currencies are data, not a type

`CurrencyCode` is `string`. Widening the union removed compile-time safety on purpose; it is
replaced by a runtime guard at the two gates where a code enters the app:

1. **The wire** — every feature's `api/types.ts` mapper calls `fromWireCurrency` /
   `fromWireCurrencyOrNull`, which **throw** on a code the store doesn't know (balances
   node/settings/rate, goals income/goal/allocation, spending transaction/budget/recurring,
   inbound-imports staged import, integration key).
2. **The CSV parse boundary** — `resolveCurrencyCode` / `isSupportedCurrency` are called
   _before_ the amount is parsed, so an unlisted code reads as
   `import.row.currency_unsupported` and not as an unreadable amount. See
   [import.md](import.md).

Everywhere else a currency is just a string that came through one of those gates. No branded
type — it would force a cast at every construction site across five features.

`lib/currency.ts` reads the table from the store's `byCode` index — **the ISO table plus the
user's own currencies**, which is why those gates let a user-defined code through and why
`decimalsFor` sizes its amounts correctly: `decimalsFor` (0 for JPY, 3 for KWD/BHD/IQD/…, 2
otherwise), `isSupportedCurrency`, `currencySymbol`, `currencyName`, `supportedCurrencies()`. `toMinor`/`toMajor`/`parseAmountToMinor`/`minorToInputValue`/
`formatMoney`/`convertMinor` kept their signatures and take their scale from `decimalsFor`,
so every money path was fixed by fixing the data. `amountInputProps(code)` gives an amount
field its `inputMode`/`step`/`placeholder` — a JPY input takes no decimals, a KWD input three.

## Currencies the user defines

A user can add a currency ISO-4217 doesn't carry (points, a metal, a local unit). It is
**synced user data**, not config: `db.customCurrencies`, the `customCurrency`
outbox entity, `customCurrenciesApi` + the push/pull handlers in
`features/settings/data/sync.ts`.

It still has to reach the **synchronous** currency helpers, which read the store — so
`useCustomCurrencies` (from `__root.tsx`) mirrors the live Dexie rows into
`useAppConfigStore.custom`, and `byCode` indexes both. That one move is what makes a
user-defined code work everywhere: `decimalsFor` scales it, `fromWireCurrency` lets its rows
through, `CurrencyPicker` offers it, `mergeRates` prices it.

- A custom code that **collides with an ISO one** is dropped in `applyCustomCurrencies`, once,
  rather than at each of the three readers. The server refuses to create one; this is what
  keeps a stale local row from restating the real currency's rate.
- **Codes are three characters** — every backend money column is `String(3)`.
- **`code` and `minorUnit` are fixed after creation** (stored amounts are scaled by one and
  found by the other); the dialog shows them read-only when editing.
- **A custom currency can't be the base.** `CurrencyPicker` takes `isoOnly` for that one use.
- Deletes are optimistic; a `409 settings.custom_currency.in_use` re-pulls, so a currency
  something still holds money in comes back rather than stranding those amounts at rate `0`.

## Rates: config, then custom currencies, then overrides

The backend no longer seeds per-user rate rows. `GET /exchange-rates` returns **overrides
only** (empty for a fresh user); the published rates come from config. So every rates map is
built once with `useMergedRates(rateRows)` — **config seed, then a custom currency's own
rate, then the user's override** — in `useBalances`, `useGoals` and `useTransactions`
(`mergeRates` is the same thing outside React). A currency in none of them (CUP, IRR, KPW,
SSP, SYP, VES, ZWG ship no rate) simply has no rate, and `convertMinor` keeps returning `0`
for that pair rather than inventing one.

A custom currency's rate lives on the currency row, not in `t_exchange_rates` — nothing
publishes a rate for a currency only one person uses, and two homes for it would be two
answers. `defaultRateFor` returns it, so such a row never reads as "Edited".

`PATCH /exchange-rates/{currency}` is copy-on-write and `version` is **optional**:
`setExchangeRate` sends no `version` when the user is editing a currency that so far had only
a config default (the server creates the row), and the stored `version` once a row exists.

## UI

- `src/components/CurrencyPicker.tsx` — the one currency control: shadcn `Command` in a
  `Popover`, searching code or name, with the base + recently used codes (persisted in
  `usePreferencesStore.recentCurrencies`) on top. Used by the wallet, goal, transaction/budget
  and import-review editors, the `TopNav` base switch and Settings.
- **Settings → Currencies & rates** (`/settings/currencies`) lists **every** currency, not
  only the ones the user holds: a rate you can only reach by first holding the money is a
  rate you can't prepare with. Three cards — base + auto-update, "Your currencies" (add /
  edit / delete), and the searchable full table.
  - `useCurrencyRates()` builds the view model: each row carries `perBase` ("1 CODE = n
    BASE", what the field edits) alongside the absolute stored rate, so switching base
    re-reads every row without rewriting one.
  - Held currencies sort to the top and wear a badge — `heldCurrencies(base, sources)` in
    `features/balances/data/selectors.ts`, via `useBalances().held`.
  - The list is **windowed** (`hooks/useVirtualRows`, shared with the import review grid):
    ~150 rows each carrying an input costs more than the screen is worth. Rows are therefore
    fixed-height (`RATE_ROW_HEIGHT`) — keep them that way.
  - An edited row shows an "Edited" badge and a **reset** control that writes the published
    rate back (there is no delete-override endpoint).
- **Email sync** takes its bounds from `limits`: the manual-scan limit is capped by
  `email_sync_max_limit` and the lookback options by `email_sync_max_lookback_days`.

## Limits are read, not re-declared

`configLimits()` returns the block **synchronously and never throws** — the bundled snapshot
guarantees a value — which is what lets non-React code read it. Two consumers matter:

- **The CSV reader.** `importMaxRows` / `importMaxBytes` are read on the main thread in
  `workerClient.ts` and passed **into the worker with the parse request**. The worker has its
  own module registry, so a store it imported would only ever hold the bundled snapshot and
  would quietly ignore a refreshed server config. `data/csv/caps.ts` therefore takes the
  numbers as an argument and knows nothing about the store.
- **Email sync**, above, with the old hard-coded constants left only as a fallback.
- **Integrations** ([integrations.md](integrations.md)): `integrationKeysMax` disables
  _New key_ with a sentence at the ceiling, `integrationRulesMax` caps _Add rule_ and prints
  "n of 10", and `integrationPayloadMaxBytes` refuses an oversized sample payload before it is
  sent to the rule tester. `useIntegrationsConfig()` gives the endpoint card
  `webhookUrl ?? apiOriginUrl(webhookPath)` (the origin the app reaches the API on).

The one cap that is **not** published is the import template's 64 KiB `config` limit: it is
hard-coded on both sides (`MAX_CONFIG_BYTES` here, `import_template_rules.py` there) and the
two must move together until `limits` grows an `import_template_max_bytes`.
