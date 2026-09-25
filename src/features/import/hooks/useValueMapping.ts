import { useCallback, useEffect, useMemo } from 'react'
import { walletOptionsFrom } from '#/features/import/data/matching'
import { lookup, roleColumn } from '#/features/import/data/types'
import {
  ADJUSTMENT,
  CREATE,
  MOVEMENT_TARGETS,
  NEW,
  SKIP,
  TRANSFER,
  UNSET,
  categoryValue,
  chosenValue,
  distinctOf,
  distinctValues,
  proposalsFor,
  seedFor,
  valueRows,
  withAliases,
  withNewCategory,
  withNewMerchant,
  withNewWallet,
} from '#/features/import/data/values'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { DistinctValue } from '#/features/import/data/matching'
import type {
  Aliases,
  CategoryTarget,
  ColumnRole,
  MerchantTarget,
  WalletTarget,
} from '#/features/import/data/types'
import type {
  NoteReader,
  Proposals,
  RowNotes,
  TargetGroup,
  ValueCatalogue,
  ValueGroup,
  ValueKind,
} from '#/features/import/data/values'

/**
 * A kind of value the file carries no column for. It is said out loud rather than omitted:
 * a missing account column ends as every row failing in review, and a step that silently
 * shows nothing gives the user nowhere to go.
 */
export type ValueNotice = {
  kind: ValueKind
  title: string
  body: string
  /** True when there is no fallback either, so the rows have nothing to land on. */
  unresolved: boolean
}

/**
 * Step ③ as state. It reads the distinct values straight out of the **raw matrix**, proposes
 * a target for each, and writes the answer into `mapping.aliases`. It never derives a row:
 * a file of fifty thousand rows holds a few dozen distinct account names, and answering one
 * of them must cost the few dozen, not the fifty thousand.
 *
 * Nothing here touches the database either — a target the user asks us to create is recorded
 * with the id it will be created under, and the commit materialises it.
 */

const NO_NOTES: RowNotes = { hint: null, newLabel: null }

const KINDS: ReadonlyArray<ValueKind> = [
  'wallet',
  'category',
  'merchant',
  'type',
  'currency',
]

const TITLES: Readonly<Record<ValueKind, string>> = {
  wallet: 'Accounts',
  category: 'Categories',
  merchant: 'Merchants',
  type: 'Money in or out',
  currency: 'Currencies',
}

const EMPTY: DistinctValue[] = []

/** Kinds whose absence changes what every row becomes, so it is explained rather than hidden. */
const EXPLAINED: ReadonlyArray<ValueKind> = ['wallet', 'category']

const SUBCATEGORY_JOIN = ' › '

/**
 * Takes the roles alone, not the draft: this feeds the distinct values, which are a walk over
 * every row of the file, and a draft identity that changes with every answer would make that
 * walk the price of an answer.
 */
const columnsOf = (roles: ReadonlyArray<ColumnRole>) => ({
  wallet: roleColumn(roles, 'wallet'),
  category: roleColumn(roles, 'category'),
  subcategory: roleColumn(roles, 'subcategory'),
  merchant: roleColumn(roles, 'merchant'),
  type: roleColumn(roles, 'type'),
  currency: roleColumn(roles, 'currency'),
})

const cell = (row: ReadonlyArray<string>, column: number): string =>
  column < 0 ? '' : (row[column] ?? '').trim()

/**
 * A file that spells a category across two columns is asked about as the pair, spelled the
 * way `rows.ts` looks it up — "Food › Groceries" normalises to the same key as "Food
 * Groceries", so the combined answer is the one a row finds first.
 */
const categoryValues = (
  matrix: ReadonlyArray<ReadonlyArray<string>>,
  category: number,
  subcategory: number,
): DistinctValue[] => {
  if (category < 0) return EMPTY
  if (subcategory < 0) return distinctValues(matrix, category)
  return distinctOf(
    matrix.map((row) => {
      const parent = cell(row, category)
      const child = cell(row, subcategory)
      return child === '' ? parent : `${parent}${SUBCATEGORY_JOIN}${child}`
    }),
  )
}

const walletTargets = (catalogue: ValueCatalogue): TargetGroup[] => {
  const groups: TargetGroup[] = []
  for (const wallet of catalogue.wallets) {
    const label = wallet.group ?? null
    const option = {
      value: wallet.id,
      label: wallet.currency
        ? `${wallet.name} · ${wallet.currency}`
        : wallet.name,
    }
    const group = groups.find((entry) => entry.label === label)
    if (group) group.options.push(option)
    else groups.push({ label, options: [option] })
  }
  return groups
}

/** The user's categories, then the two answers that are not one. */
const categoryTargets = (catalogue: ValueCatalogue): TargetGroup[] => {
  const parents = catalogue.categories.filter(
    (option) => option.subcategory === null,
  )
  const groups = parents.map((parent) => ({
    label: parent.name,
    options: [
      {
        value: categoryValue(parent.category, null),
        label: parent.name,
      },
      ...catalogue.categories
        .filter(
          (option) =>
            option.category === parent.category && option.subcategory !== null,
        )
        .map((option) => ({
          value: categoryValue(option.category, option.subcategory),
          label: `${parent.name} › ${option.name}`,
        })),
    ],
  }))
  return [...groups, MOVEMENT_TARGETS]
}

/** Why a movement answer changes what its rows become — said under the value. */
const MOVEMENT_NOTES: Readonly<Record<string, RowNotes>> = {
  [TRANSFER]: {
    hint: 'Paired with the other side in the file — same amount, another account, within 2 days.',
    newLabel: null,
  },
  [ADJUSTMENT]: {
    hint: 'Corrects the account’s balance; never counted as income or spending.',
    newLabel: null,
  },
}

const merchantTargets = (catalogue: ValueCatalogue): TargetGroup[] => [
  {
    label: null,
    options: [...catalogue.merchants.merchants]
      .sort(
        (a, b) =>
          b.timesSeen - a.timesSeen ||
          a.displayName.localeCompare(b.displayName),
      )
      .map((merchant) => ({
        value: merchant.id,
        label: merchant.displayName,
      })),
  },
]

const TYPE_TARGETS: TargetGroup[] = [
  {
    label: null,
    options: [
      { value: 'spend', label: 'Money out' },
      { value: 'income', label: 'Money in' },
    ],
  },
]

/** Currencies are picked from the whole ISO table, so the select is given no groups of ours. */
const NO_TARGETS: TargetGroup[] = []

const proposalsBy = (
  distinct: Readonly<Record<ValueKind, DistinctValue[]>>,
  catalogue: ValueCatalogue,
): Readonly<Record<ValueKind, Proposals>> => ({
  wallet: proposalsFor('wallet', distinct.wallet, catalogue),
  category: proposalsFor('category', distinct.category, catalogue),
  merchant: proposalsFor('merchant', distinct.merchant, catalogue),
  type: proposalsFor('type', distinct.type, catalogue),
  currency: proposalsFor('currency', distinct.currency, catalogue),
})

export function useValueMapping(csv: CsvImport, draft: MappingDraft) {
  const { updateMapping } = csv.actions
  const matrix = csv.matrix
  const categoryCatalog = csv.catalog
  const columns = useMemo(() => columnsOf(draft.roles), [draft.roles])

  const catalogue: ValueCatalogue = useMemo(
    () => ({
      wallets: walletOptionsFrom(
        csv.walletGroups,
        (id) => csv.context.walletCurrencies[id] ?? null,
      ),
      categories: csv.categories,
      merchants: csv.merchantIndex,
    }),
    [csv.walletGroups, csv.categories, csv.merchantIndex, csv.context],
  )

  const distinct = useMemo(
    (): Readonly<Record<ValueKind, DistinctValue[]>> => ({
      wallet:
        columns.wallet < 0 ? EMPTY : distinctValues(matrix, columns.wallet),
      category: categoryValues(matrix, columns.category, columns.subcategory),
      merchant:
        columns.merchant < 0 ? EMPTY : distinctValues(matrix, columns.merchant),
      type: columns.type < 0 ? EMPTY : distinctValues(matrix, columns.type),
      currency:
        columns.currency < 0 ? EMPTY : distinctValues(matrix, columns.currency),
    }),
    [matrix, columns],
  )

  const proposals = useMemo(
    () => proposalsBy(distinct, catalogue),
    [distinct, catalogue],
  )

  const targets = useMemo(
    (): Readonly<Record<ValueKind, TargetGroup[]>> => ({
      wallet: walletTargets(catalogue),
      category: categoryTargets(catalogue),
      merchant: merchantTargets(catalogue),
      type: TYPE_TARGETS,
      currency: NO_TARGETS,
    }),
    [catalogue],
  )

  // High-confidence answers arrive already filled in; anything the user has answered is
  // never revisited, so the pass is idempotent and a re-derive cannot undo a choice.
  useEffect(() => {
    updateMapping((current) => {
      let aliases = current.aliases
      for (const kind of KINDS) {
        const seeds = seedFor(kind, distinct[kind], aliases, proposals[kind])
        if (seeds.length > 0) aliases = withAliases(aliases, kind, seeds)
      }
      return aliases === current.aliases ? current : { ...current, aliases }
    })
  }, [distinct, proposals, updateMapping])

  const defaults = useMemo(
    () => ({
      wallet:
        catalogue.wallets.find(
          (wallet) => wallet.id === draft.defaults.walletId,
        )?.name ?? null,
      category:
        catalogue.categories.find(
          (option) =>
            option.category === draft.defaults.category &&
            option.subcategory === null,
        )?.name ?? draft.defaults.category,
    }),
    [catalogue, draft.defaults.walletId, draft.defaults.category],
  )

  const notices: ValueNotice[] = useMemo(
    () =>
      EXPLAINED.filter((kind) => columns[kind] < 0).map((kind) => {
        if (kind === 'category') {
          return {
            kind,
            title: TITLES.category,
            body: `No column in this file holds a category, so every row is filed under ${defaults.category}. Mark the category column in the previous step, or change that default there.`,
            unresolved: false,
          }
        }
        return {
          kind,
          title: TITLES.wallet,
          body: defaults.wallet
            ? `No column in this file holds an account, so every row goes to ${defaults.wallet}. Mark the account column in the previous step, or change that account there.`
            : 'No column in this file holds an account, and no fallback account is set — every row will be blocked in review. Mark the account column in the previous step, or pick an account for rows with none.',
          unresolved: defaults.wallet === null,
        }
      }),
    [columns, defaults],
  )

  const merchantsById = useMemo(
    () => new Map(catalogue.merchants.merchants.map((m) => [m.id, m])),
    [catalogue],
  )

  const aliasesByMerchant = useMemo(() => {
    const byId = new Map<string, string[]>()
    for (const alias of catalogue.merchants.aliases) {
      const spelling = alias.rawSample ?? alias.normalizedKey
      const list = byId.get(alias.merchantId)
      if (list) list.push(spelling)
      else byId.set(alias.merchantId, [spelling])
    }
    return byId
  }, [catalogue])

  const describe: NoteReader = useCallback(
    (kind, key, value) => {
      if (value === NEW)
        return newTargetNote(kind, key, draft.aliases, categoryCatalog)
      if (kind === 'category') return MOVEMENT_NOTES[value] ?? NO_NOTES
      if (kind !== 'merchant') return NO_NOTES
      const merchant = merchantsById.get(value)
      if (merchant === undefined) return NO_NOTES
      const spellings = (aliasesByMerchant.get(merchant.id) ?? []).filter(
        (raw) => raw !== merchant.displayName,
      )
      const learned = merchant.learnedCategory
        ? categoryCatalog.get(merchant.learnedCategory).name
        : null
      const parts = [
        spellings.length > 0
          ? `also known as: ${spellings.slice(0, 3).join(', ')}`
          : null,
        learned ? `usually ${learned}` : null,
      ].filter((part): part is string => part !== null)
      return {
        hint: parts.length > 0 ? parts.join(' · ') : null,
        newLabel: null,
      }
    },
    [merchantsById, aliasesByMerchant, draft.aliases, categoryCatalog],
  )

  const groups: ValueGroup[] = useMemo(
    () =>
      KINDS.filter((kind) => distinct[kind].length > 0).map((kind) => {
        const rows = valueRows(
          kind,
          distinct[kind],
          draft.aliases,
          proposals[kind],
          describe,
        )
        return {
          kind,
          title: TITLES[kind],
          rows,
          found: rows.filter((row) => !row.blank).length,
          matched: rows.filter((row) => !row.blank && row.matched).length,
          options: targets[kind],
        }
      }),
    [distinct, proposals, targets, draft.aliases, describe],
  )

  const setValue = useCallback(
    (kind: ValueKind, key: string, value: string) =>
      updateMapping((current) => ({
        ...current,
        aliases: withAliases(current.aliases, kind, [{ key, value }]),
      })),
    [updateMapping],
  )

  /**
   * Answer every value still unmatched with one target. Values already answered are left
   * alone, so this settles the leftovers rather than undoing the matcher or the user.
   */
  const fillUnmatched = useCallback(
    (kind: ValueKind, value: string) =>
      updateMapping((current) => ({
        ...current,
        aliases: withAliases(
          current.aliases,
          kind,
          distinct[kind]
            .filter(
              (entry) =>
                entry.key !== '' &&
                chosenValue(kind, entry.key, current.aliases) === UNSET,
            )
            .map((entry) => ({ key: entry.key, value })),
        ),
      })),
    [updateMapping, distinct],
  )

  const createWallet = useCallback(
    (key: string, target: WalletTarget) =>
      updateMapping((current) => ({
        ...current,
        aliases: withNewWallet(current.aliases, key, target),
      })),
    [updateMapping],
  )

  const createCategory = useCallback(
    (key: string, target: CategoryTarget) =>
      updateMapping((current) => ({
        ...current,
        aliases: withNewCategory(current.aliases, key, target),
      })),
    [updateMapping],
  )

  const createMerchant = useCallback(
    (key: string, target: MerchantTarget) =>
      updateMapping((current) => ({
        ...current,
        aliases: withNewMerchant(current.aliases, key, target),
      })),
    [updateMapping],
  )

  /** Run the matcher over every value again, including ones already answered. */
  const autoMatchAgain = useCallback(
    (kind: ValueKind) =>
      updateMapping((current) => ({
        ...current,
        aliases: withAliases(
          current.aliases,
          kind,
          seedFor(kind, distinct[kind], current.aliases, proposals[kind], true),
        ),
      })),
    [updateMapping, distinct, proposals],
  )

  const merchantsSkipped = useMemo(() => {
    const rows = distinct.merchant.filter((value) => value.key !== '')
    return (
      rows.length > 0 &&
      rows.every(
        (value) => chosenValue('merchant', value.key, draft.aliases) === SKIP,
      )
    )
  }, [distinct, draft.aliases])

  /**
   * Merchants are optional: skipping leaves every description in the note rather than
   * binding it to a record, and un-skipping re-runs the matcher rather than leaving the
   * whole group blank.
   */
  const setMerchantsSkipped = useCallback(
    (skipped: boolean) =>
      updateMapping((current) => {
        const keys = distinct.merchant.filter((value) => value.key !== '')
        const cleared = withAliases(
          current.aliases,
          'merchant',
          keys.map((value) => ({ key: value.key, value: UNSET })),
        )
        if (!skipped) {
          return {
            ...current,
            aliases: withAliases(
              cleared,
              'merchant',
              seedFor('merchant', keys, cleared, proposals.merchant),
            ),
          }
        }
        return {
          ...current,
          aliases: withAliases(
            cleared,
            'merchant',
            keys.map((value) => ({ key: value.key, value: SKIP })),
          ),
        }
      }),
    [updateMapping, distinct, proposals],
  )

  const readiness = useMemo(() => {
    if (draft.defaults.walletId !== null) return { ready: true, reason: null }
    const wallets = groups.find((group) => group.kind === 'wallet')
    const unmatched = wallets?.rows.find((row) => !row.blank && !row.matched)
    if (unmatched === undefined) return { ready: true, reason: null }
    return {
      ready: false,
      reason: `Choose an account for “${unmatched.raw}”, or pick a default account in the previous step.`,
    }
  }, [groups, draft.defaults.walletId])

  return {
    groups,
    notices,
    defaults,
    readiness,
    merchantsSkipped,
    setValue,
    fillUnmatched,
    createWallet,
    createCategory,
    createMerchant,
    autoMatchAgain,
    setMerchantsSkipped,
  }
}

const newTargetNote = (
  kind: ValueKind,
  key: string,
  aliases: Aliases,
  categoryCatalog: CategoryCatalog,
): RowNotes => {
  if (kind === 'wallet') {
    const target = lookup(aliases.wallets, key)
    return target?.kind === 'create'
      ? {
          hint: 'Created at zero when you import.',
          newLabel: `New account · ${target.name} · ${target.currency}`,
        }
      : NO_NOTES
  }
  if (kind === 'category') {
    const target = lookup(aliases.categories, key)
    if (target?.kind !== 'create') return NO_NOTES
    return target.subcategory === null
      ? { hint: null, newLabel: `New category · ${target.name}` }
      : {
          hint: null,
          newLabel: `New subcategory · ${categoryCatalog.get(target.category).name}${SUBCATEGORY_JOIN}${target.name}`,
        }
  }
  const target = lookup(aliases.merchants, key)
  return target?.kind === 'create'
    ? { hint: null, newLabel: `New merchant · ${target.displayName}` }
    : NO_NOTES
}

export { CREATE, NEW, SKIP, UNSET }

export type ValueMapping = ReturnType<typeof useValueMapping>
