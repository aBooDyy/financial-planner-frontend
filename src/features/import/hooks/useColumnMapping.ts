import { useCallback, useMemo } from 'react'
import { messageForCode } from '#/lib/errorMessages'
import {
  assignRole,
  mappingReadiness,
  roleOptionsFor,
  withAmountKind,
} from '#/features/import/data/mapping'
import { missedRoles } from '#/features/import/data/roles'
import type { TxType } from '#/features/transactions/api/types'
import type {
  AmountKind,
  MappingDraft,
  MappingReadiness,
} from '#/features/import/data/mapping'
import type { MappingUpdater } from '#/features/import/hooks/useCsvImport'
import type { RoleHint } from '#/features/import/data/roles'
import type { IssueCount } from '#/features/import/data/rowScan'
import type {
  AmountUnit,
  ColumnRole,
  MappingDefaults,
} from '#/features/import/data/types'

/**
 * Step ② as state: the assignment rules, what is still missing, and the evidence the pass
 * over the file found. It takes only the pieces it needs, so it is testable without the
 * wizard around it.
 */

export type ColumnMappingInput = {
  draft: MappingDraft
  headers: ReadonlyArray<string>
  /** What detection proposed — a role still equal to it wears the `✓ auto` mark. */
  suggested: ReadonlyArray<ColumnRole>
  /** How many rows each issue touches — from the pass, not from rows held in memory. */
  issues: ReadonlyArray<IssueCount>
  update: (updater: MappingUpdater) => void
}

/**
 * The roles worth naming when nothing carries them: both end as a silent default on every
 * row, and the account one ends as every row failing.
 */
const WANTED: ReadonlyArray<ColumnRole> = ['wallet', 'category']

export function useColumnMapping({
  draft,
  headers,
  suggested,
  issues,
  update,
}: ColumnMappingInput) {
  const setRole = useCallback(
    (column: number, role: ColumnRole) =>
      update((current, matrix) => assignRole(current, column, role, matrix)),
    [update],
  )

  const setAmountKind = useCallback(
    (kind: AmountKind) => update((current) => withAmountKind(current, kind)),
    [update],
  )

  const setNegativeMeans = useCallback(
    (negativeMeans: TxType) =>
      update((current) => ({ ...current, negativeMeans })),
    [update],
  )

  const setAmountUnit = useCallback(
    (amountUnit: AmountUnit) =>
      update((current) => ({ ...current, amountUnit })),
    [update],
  )

  const setDefaults = useCallback(
    (patch: Partial<MappingDefaults>) =>
      update((current) => ({
        ...current,
        defaults: { ...current.defaults, ...patch },
      })),
    [update],
  )

  const isAuto = useCallback(
    (column: number) =>
      draft.roles[column] !== 'skip' &&
      draft.roles[column] === suggested[column],
    [draft.roles, suggested],
  )

  const roleOptions = useMemo(
    () => roleOptionsFor(draft.amountKind),
    [draft.amountKind],
  )

  const readiness: MappingReadiness = useMemo(
    () => mappingReadiness(draft),
    [draft],
  )

  const warnings = useMemo(
    () =>
      issues.map(
        ({ code, count }) =>
          `${count} ${count === 1 ? 'row' : 'rows'}: ${messageForCode(code)}`,
      ),
    [issues],
  )

  const hints: ReadonlyArray<RoleHint> = useMemo(
    () => missedRoles(headers, draft.roles, WANTED),
    [headers, draft.roles],
  )

  /** No account column and no fallback means every row fails, two steps from here. */
  const needsAccount =
    !draft.roles.includes('wallet') && draft.defaults.walletId === null

  return {
    roles: draft.roles,
    hints,
    needsAccount,
    amountKind: draft.amountKind,
    negativeMeans: draft.negativeMeans,
    amountUnit: draft.amountUnit,
    defaults: draft.defaults,
    dateFormat: draft.dateFormat,
    dateAmbiguous: draft.dateAmbiguous,
    roleOptions,
    readiness,
    warnings,
    isAuto,
    setRole,
    setAmountKind,
    setNegativeMeans,
    setAmountUnit,
    setDefaults,
  }
}

export type ColumnMapping = ReturnType<typeof useColumnMapping>
