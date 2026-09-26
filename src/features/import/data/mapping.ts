import { inferDateFormat } from './csv/dates'
import { suggestColumns } from './roles'
import {
  COLUMN_ROLES,
  emptyAliases,
  isExclusiveRole,
  pendingCategoryId,
  roleColumn,
} from './types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormatToken } from './csv/dates'
import type {
  Aliases,
  AmountMode,
  AmountUnit,
  ColumnRole,
  Dialect,
  Mapping,
  MappingDefaults,
} from './types'

/**
 * The mapping while it is still being answered. A `Mapping` needs an `AmountMode`, which
 * needs columns the user has not picked yet — so the wizard carries the *shape* they chose
 * (`amountKind`) plus the roles, and resolves the two into a `Mapping` only once they agree.
 * Everything here is pure: the hooks hold one of these in state and nothing else.
 */

export type AmountKind = AmountMode['kind']

export const AMOUNT_KINDS: ReadonlyArray<AmountKind> = [
  'split',
  'signed',
  'typed',
]

export type MappingDraft = {
  dialect: Dialect
  dateFormat: DateFormatToken | null
  dateAmbiguous: boolean
  roles: ColumnRole[]
  amountKind: AmountKind
  /** Read only in `signed` mode: what a leading minus in the file means. */
  negativeMeans: TxType
  amountUnit: AmountUnit
  defaults: MappingDefaults
  aliases: Aliases
}

/** The columns a draft's chosen shape needs, or null while one is still missing. */
export const amountModeFor = (draft: MappingDraft): AmountMode | null => {
  const column = (role: ColumnRole) => roleColumn(draft.roles, role)
  if (draft.amountKind === 'split') {
    const outColumn = column('amountOut')
    const inColumn = column('amountIn')
    return outColumn < 0 || inColumn < 0
      ? null
      : { kind: 'split', outColumn, inColumn }
  }
  const single = column('amount')
  if (single < 0) return null
  if (draft.amountKind === 'signed') {
    return {
      kind: 'signed',
      column: single,
      negativeMeans: draft.negativeMeans,
    }
  }
  const typeColumn = column('type')
  return typeColumn < 0 ? null : { kind: 'typed', column: single, typeColumn }
}

/** The draft as a real `Mapping`, or null while step ② is unanswered. */
export const toMapping = (draft: MappingDraft): Mapping | null => {
  const amount = amountModeFor(draft)
  if (amount === null) return null
  const { amountKind: _kind, negativeMeans: _sign, ...rest } = draft
  return { ...rest, amount }
}

/**
 * The date format, re-read from the column currently holding the date role. Inference is
 * per column and over every value in it, so it moves with the role rather than with a cell.
 */
export const withDateInference = (
  draft: MappingDraft,
  matrix: ReadonlyArray<ReadonlyArray<string>>,
): MappingDraft => {
  const column = roleColumn(draft.roles, 'date')
  if (column < 0) return { ...draft, dateFormat: null, dateAmbiguous: false }
  const inference = inferDateFormat(matrix.map((row) => row[column] ?? ''))
  return {
    ...draft,
    dateFormat: inference.format,
    dateAmbiguous: inference.ambiguous,
  }
}

export type DraftSeed = {
  dialect: Dialect
  headers: ReadonlyArray<string>
  matrix: ReadonlyArray<ReadonlyArray<string>>
  currency: CurrencyCode
  walletId?: string | null
  /** Where a row that names no category of its own lands, by direction — `fallbackCategoriesOf`. */
  fallbackCategories: Record<TxType, string>
}

/**
 * The categories rows fall back to, one per direction: the catalog's required "Other" /
 * "Other income", and otherwise the type's first category. Empty only before the categories
 * have been pulled.
 */
export const fallbackCategoriesOf = (
  catalog: CategoryCatalog,
): Record<TxType, string> => ({
  spend: catalog.fallbackFor('spend')?.id ?? '',
  income: catalog.fallbackFor('income')?.id ?? '',
})

/** Each category's direction by id — the catalog's, and the ones this import will create. */
export const categoryTypesOf = (
  catalog: CategoryCatalog,
  categories: Aliases['categories'],
): Record<string, TxType> => {
  const types: Record<string, TxType> = {}
  for (const root of catalog.all) {
    types[root.id] = root.type
    for (const sub of root.subs) types[sub.id] = sub.type
  }
  for (const target of Object.values(categories)) {
    if (target.kind === 'create') types[pendingCategoryId(target)] = target.type
  }
  return types
}

/** Everything detection proposes about a freshly read file, as one draft. */
export const draftForFile = (seed: DraftSeed): MappingDraft => {
  const plan = suggestColumns(seed.headers, seed.matrix)
  return withDateInference(
    {
      dialect: seed.dialect,
      dateFormat: null,
      dateAmbiguous: false,
      roles: plan.roles,
      amountKind: plan.amount?.kind ?? 'signed',
      negativeMeans: 'spend',
      amountUnit: plan.amountUnit,
      defaults: {
        walletId: seed.walletId ?? null,
        currency: seed.currency,
        type: 'spend',
        categoryIds: { ...seed.fallbackCategories },
      },
      aliases: emptyAliases(),
    },
    seed.matrix,
  )
}

/**
 * Give a column a role. A role only one column may hold moves rather than collides — the
 * column that held it becomes `skip`, which is what the user meant by picking it again.
 */
export const assignRole = (
  draft: MappingDraft,
  column: number,
  role: ColumnRole,
  matrix: ReadonlyArray<ReadonlyArray<string>>,
): MappingDraft => {
  if (draft.roles[column] === role) return draft
  const roles = [...draft.roles]
  if (isExclusiveRole(role)) {
    const held = roles.indexOf(role)
    if (held >= 0) roles[held] = 'skip'
  }
  roles[column] = role
  const next = { ...draft, roles }
  return roleColumn(roles, 'date') === roleColumn(draft.roles, 'date')
    ? next
    : withDateInference(next, matrix)
}

const clear = (roles: ColumnRole[], role: ColumnRole): void => {
  const column = roles.indexOf(role)
  if (column >= 0) roles[column] = 'skip'
}

/**
 * Switch the amount shape, carrying the columns already picked across. The three shapes
 * cannot be half-configured, so the roles the new shape has no use for are dropped here
 * rather than left to mean nothing.
 */
export const withAmountKind = (
  draft: MappingDraft,
  amountKind: AmountKind,
): MappingDraft => {
  if (draft.amountKind === amountKind) return draft
  const roles = [...draft.roles]
  if (amountKind === 'split') {
    const single = roles.indexOf('amount')
    if (single >= 0) {
      roles[single] = roles.includes('amountOut') ? 'skip' : 'amountOut'
    }
  } else {
    if (!roles.includes('amount')) {
      const source = roles.includes('amountOut')
        ? roles.indexOf('amountOut')
        : roles.indexOf('amountIn')
      if (source >= 0) roles[source] = 'amount'
    }
    clear(roles, 'amountOut')
    clear(roles, 'amountIn')
  }
  return { ...draft, amountKind, roles }
}

/** The roles worth offering for a shape — the ones the other two shapes read are hidden. */
export const roleOptionsFor = (
  amountKind: AmountKind,
): ReadonlyArray<ColumnRole> => {
  const hidden: ReadonlyArray<ColumnRole> =
    amountKind === 'split'
      ? ['amount', 'type']
      : amountKind === 'signed'
        ? ['amountOut', 'amountIn', 'type']
        : ['amountOut', 'amountIn']
  return COLUMN_ROLES.filter((role) => !hidden.includes(role))
}

export type MappingReadiness = {
  ready: boolean
  /** Shown as text, never only as a tooltip — the user must know what is missing. */
  reason: string | null
}

const amountReason = (draft: MappingDraft): string | null => {
  const has = (role: ColumnRole) => draft.roles.includes(role)
  if (draft.amountKind === 'split') {
    if (!has('amountOut') && !has('amountIn')) {
      return 'Pick the columns that hold money out and money in.'
    }
    if (!has('amountOut')) return 'Pick the column that holds money out.'
    if (!has('amountIn')) return 'Pick the column that holds money in.'
    return null
  }
  if (!has('amount')) return 'Pick the column that holds the amount.'
  if (draft.amountKind === 'typed' && !has('type')) {
    return 'Pick the column that says whether a row is money in or money out.'
  }
  return null
}

/** Whether step ② is answered, and what is missing when it is not. */
export const mappingReadiness = (draft: MappingDraft): MappingReadiness => {
  if (!draft.roles.includes('date')) {
    return { ready: false, reason: 'Pick the column that holds the date.' }
  }
  const reason = amountReason(draft)
  return reason === null
    ? { ready: true, reason: null }
    : { ready: false, reason }
}
