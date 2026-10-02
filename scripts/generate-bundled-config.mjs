// Regenerates `src/lib/config/bundledConfig.ts` from the backend's currency seed.
//
//   pnpm generate-config [-- --backend ../financial-planner-backend]
//
// Run it in the same commit as any change to `app/config/currencies.py`, to the limit
// defaults in `app/config/settings.py` or to the published constants in
// `app/config/limits.py`; the snapshot is what a first-run or offline client uses before
// `GET /config` answers. It parses the Python literals rather than importing
// them, so it needs no Python toolchain — and it refuses to write a partial table.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(HERE, '..')
const OUT = resolve(FRONTEND, 'src/lib/config/bundledConfig.ts')

const LIMIT_KEYS = [
  ['import_max_rows', 'importMaxRows'],
  ['import_max_bytes', 'importMaxBytes'],
  ['email_sync_max_lookback_days', 'emailSyncMaxLookbackDays'],
  ['email_sync_max_limit', 'emailSyncMaxLimit'],
  ['email_rules_max', 'emailRulesMax'],
  ['email_rule_samples_max', 'emailRuleSamplesMax'],
  ['email_rule_senders_max', 'emailRuleSendersMax'],
  ['email_rule_terms_max', 'emailRuleTermsMax'],
  ['transaction_bulk_max', 'transactionBulkMax'],
  ['integration_keys_max', 'integrationKeysMax'],
  ['integration_rules_max', 'integrationRulesMax'],
  ['integration_payload_max_bytes', 'integrationPayloadMaxBytes'],
  ['planned_bulk_max', 'plannedBulkMax'],
  ['planned_max', 'plannedMax'],
]

// Limits the backend keeps as module constants in `app/config/limits.py`, not settings.
const CONSTANT_LIMIT_KEYS = [
  ['SET_ASIDE_BATCH_MAX', 'setAsideBatchMax'],
  ['SAFE_HORIZON_DAYS_MIN', 'safeHorizonDaysMin'],
  ['SAFE_HORIZON_DAYS_MAX', 'safeHorizonDaysMax'],
]

const MIN_CURRENCIES = 100
const ALLOWED_MINOR_UNITS = [0, 2, 3]

function fail(message) {
  console.error(`generate-bundled-config: ${message}`)
  process.exit(1)
}

function backendDir() {
  const flag = process.argv.indexOf('--backend')
  const given =
    flag !== -1 ? process.argv[flag + 1] : process.env.FP_BACKEND_DIR
  return resolve(FRONTEND, given ?? '../financial-planner-backend')
}

function read(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return fail(
      `cannot read ${path} — pass --backend <path to the backend repo>`,
    )
  }
}

const unescape = (value) => value.replace(/\\(["\\])/g, '$1')

function parseCurrencies(source) {
  const table = /_TABLE[^=]*=\s*\(([\s\S]*?)\n\)/.exec(source)
  if (!table) fail('could not locate the _TABLE literal in currencies.py')

  const row =
    /\(\s*"([A-Z]{3})",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)",\s*(\d+),\s*(?:"([0-9.]+)"|None)\s*\)/g
  const currencies = []
  const rates = {}
  const declared = (table[1].match(/\n\s*\(\s*"/g) ?? []).length

  for (const match of table[1].matchAll(row)) {
    const [, code, name, symbol, minorUnit, rate] = match
    const unit = Number(minorUnit)
    if (!ALLOWED_MINOR_UNITS.includes(unit)) {
      fail(`${code} has an unexpected minor unit (${minorUnit})`)
    }
    currencies.push({
      code,
      name: unescape(name),
      symbol: unescape(symbol),
      minorUnit: unit,
    })
    if (rate !== undefined) {
      const value = Number(rate)
      if (!Number.isFinite(value) || value <= 0) {
        fail(`${code} has an unusable default rate (${rate})`)
      }
      rates[code] = value
    }
  }

  if (currencies.length !== declared) {
    fail(
      `parsed ${currencies.length} of ${declared} table rows — the literal's shape changed`,
    )
  }
  if (currencies.length < MIN_CURRENCIES) {
    fail(
      `only ${currencies.length} currencies parsed; the table looks truncated`,
    )
  }
  return { currencies, rates }
}

function parseSingle(source, pattern, what, file) {
  const match = pattern.exec(source)
  if (!match) fail(`could not read ${what} from ${file}`)
  return match[1]
}

function parseLimits(source) {
  const limits = {}
  for (const [pythonKey, key] of LIMIT_KEYS) {
    const raw = parseSingle(
      source,
      new RegExp(`\\n\\s*${pythonKey}:\\s*int\\s*=\\s*([0-9_]+)`),
      pythonKey,
      'settings.py',
    )
    limits[key] = Number(raw.replace(/_/g, ''))
    if (!Number.isInteger(limits[key]) || limits[key] <= 0) {
      fail(`${pythonKey} is not a positive integer (${raw})`)
    }
  }
  return limits
}

function parseConstantLimits(source) {
  const limits = {}
  for (const [pythonName, key] of CONSTANT_LIMIT_KEYS) {
    const raw = parseSingle(
      source,
      new RegExp(`\\n${pythonName}\\s*=\\s*([0-9_]+)\\s*\\n`),
      pythonName,
      'limits.py',
    )
    limits[key] = Number(raw.replace(/_/g, ''))
    if (!Number.isInteger(limits[key]) || limits[key] <= 0) {
      fail(`${pythonName} is not a positive integer (${raw})`)
    }
  }
  return limits
}

const quote = (value) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function render({ version, base, currencies, rates, limits, webhookPath }) {
  const currencyLines = currencies
    .map(
      (c) =>
        `  { code: ${quote(c.code)}, name: ${quote(c.name)}, symbol: ${quote(
          c.symbol,
        )}, minorUnit: ${c.minorUnit} },`,
    )
    .join('\n')
  const rateLines = Object.entries(rates)
    .map(([code, rate]) => `  ${code}: ${rate},`)
    .join('\n')
  const limitLines = Object.entries(limits)
    .map(([key, value]) => `    ${key}: ${value},`)
    .join('\n')

  return `// GENERATED FILE — do not edit by hand.
// Run \`pnpm generate-config\` after any change to the backend's currency seed.
//
// The offline/first-run floor for the app config: the client starts from this snapshot,
// then prefers the cached Dexie row and finally a fresh \`GET /config\`. Rates here are the
// static deploy seed; a user's own overrides always win over them.
import type { AppConfig, CurrencyMeta } from './appConfig'

const CURRENCIES: CurrencyMeta[] = [
${currencyLines}
]

const RATES: Record<string, number> = {
${rateLines}
}

export const BUNDLED_CONFIG: AppConfig = {
  version: ${quote(version)},
  currencies: CURRENCIES,
  rates: RATES,
  defaultBaseCurrency: ${quote(base)},
  limits: {
${limitLines}
  },
  integrations: {
    webhookUrl: null,
    webhookPath: ${quote(webhookPath)},
  },
}
`
}

function format(path) {
  try {
    execFileSync(
      process.execPath,
      [
        resolve(FRONTEND, 'node_modules/prettier/bin/prettier.cjs'),
        '--write',
        path,
      ],
      { stdio: 'pipe' },
    )
  } catch (error) {
    fail(`prettier could not format the generated file: ${error.message}`)
  }
}

const backend = backendDir()
const currenciesPy = read(resolve(backend, 'app/config/currencies.py'))
const settingsPy = read(resolve(backend, 'app/config/settings.py'))

const version = parseSingle(
  currenciesPy,
  /CONFIG_VERSION\s*=\s*"([^"]+)"/,
  'CONFIG_VERSION',
  'currencies.py',
)
const base = parseSingle(
  currenciesPy,
  /DEFAULT_BASE_CURRENCY\s*=\s*"([A-Z]{3})"/,
  'DEFAULT_BASE_CURRENCY',
  'currencies.py',
)
const { currencies, rates } = parseCurrencies(currenciesPy)
const limits = {
  ...parseLimits(settingsPy),
  ...parseConstantLimits(read(resolve(backend, 'app/config/limits.py'))),
}
// The deployment's public webhook URL is runtime configuration, so the snapshot only knows the
// path; the client joins it to the origin it reaches the API on until `GET /config` answers.
const webhookPath =
  parseSingle(
    settingsPy,
    /\n\s*api_prefix:\s*str\s*=\s*"([^"]+)"/,
    'api_prefix',
    'settings.py',
  ) +
  parseSingle(
    read(
      resolve(backend, 'app/contracts/integrations/ingest_webhook_request.py'),
    ),
    /WEBHOOK_ROUTE\s*=\s*"([^"]+)"/,
    'WEBHOOK_ROUTE',
    'ingest_webhook_request.py',
  )

if (!currencies.some((c) => c.code === base)) {
  fail(`the default base currency ${base} is not in the table`)
}
if (rates[base] === undefined) {
  fail(`the default base currency ${base} has no default rate`)
}

writeFileSync(
  OUT,
  render({ version, base, currencies, rates, limits, webhookPath }),
  'utf8',
)
format(OUT)

console.log(
  `generate-bundled-config: ${currencies.length} currencies, ${
    Object.keys(rates).length
  } default rates, config version ${version} → src/lib/config/bundledConfig.ts`,
)
