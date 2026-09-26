import { AlertTriangle, Info } from 'lucide-react'
import { useColumnMapping } from '#/features/import/hooks/useColumnMapping'
import { AmountModeField } from './AmountModeField'
import { ColumnRoleRow, GRID, ROLE_LABELS } from './ColumnRoleRow'
import { MappingDefaults } from './MappingDefaults'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'

type Props = {
  csv: CsvImport
  draft: MappingDraft
}

const CARD =
  'flex flex-col overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

const SAMPLES_PER_COLUMN = 3

const NO_HEADERS: string[] = []

const NO_ISSUES: never[] = []

const NOTE = 'flex items-start gap-1.5 text-[12.5px] text-fp-text-2'

/** Step ②: one row per column of the file — the header, the evidence, and the role. */
export function ColumnMappingStep({ csv, draft }: Props) {
  const mapping = useColumnMapping({
    draft,
    headers: csv.file?.headers ?? NO_HEADERS,
    suggested: csv.suggestedRoles,
    issues: csv.scan.result?.issues ?? NO_ISSUES,
    update: csv.actions.updateMapping,
  })
  const file = csv.file
  if (file === null) return null

  const samplesFor = (column: number): string[] =>
    file.sample.slice(0, SAMPLES_PER_COLUMN).map((row) => row[column] ?? '')

  return (
    <>
      <section
        role="table"
        aria-label="Columns in your file"
        aria-rowcount={draft.roles.length + 1}
        className={CARD}
      >
        {/* Kept in the accessibility tree on mobile, where the layout stacks and only the
            visual header is redundant. */}
        <div
          role="row"
          aria-rowindex={1}
          className={`${GRID} sr-only border-b border-fp-border bg-fp-surface-2 text-[12.5px] font-semibold text-fp-text-2 md:not-sr-only md:grid md:px-[14px] md:py-3`}
        >
          <span role="columnheader">Column</span>
          <span role="columnheader">Sample values</span>
          <span role="columnheader">This column holds</span>
        </div>

        {draft.roles.map((role, column) => (
          <ColumnRoleRow
            key={column}
            column={column}
            header={file.headers[column] ?? ''}
            samples={samplesFor(column)}
            role={role}
            options={mapping.roleOptions}
            auto={mapping.isAuto(column)}
            onChange={(next) => mapping.setRole(column, next)}
          />
        ))}
      </section>

      <section className={`${CARD} gap-4 p-[18px]`}>
        <AmountModeField
          amountKind={mapping.amountKind}
          negativeMeans={mapping.negativeMeans}
          amountUnit={mapping.amountUnit}
          onKindChange={mapping.setAmountKind}
          onNegativeMeansChange={mapping.setNegativeMeans}
          onUnitChange={mapping.setAmountUnit}
        />

        <MappingDefaults
          defaults={mapping.defaults}
          walletGroups={csv.walletGroups}
          categories={csv.categories}
          baseCurrency={csv.baseCurrency}
          onChange={mapping.setDefaults}
        />
      </section>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {csv.scan.running ? (
          <p className="text-[12.5px] text-fp-text-2">
            Reading {new Intl.NumberFormat().format(csv.scan.done)} of{' '}
            {new Intl.NumberFormat().format(csv.scan.total)} rows…
          </p>
        ) : (
          <>
            {mapping.hints.map((hint) => (
              <p key={hint.column} className={NOTE}>
                <Info
                  size={14}
                  strokeWidth={1.9}
                  aria-hidden
                  className="mt-[2px] shrink-0 text-fp-text-3"
                />
                “{hint.header}” isn’t mapped. Set it to {ROLE_LABELS[hint.role]}{' '}
                if that is what it holds — otherwise every row falls back to the
                default below.
              </p>
            ))}
            {mapping.needsAccount ? (
              <p className={NOTE}>
                <Info
                  size={14}
                  strokeWidth={1.9}
                  aria-hidden
                  className="mt-[2px] shrink-0 text-fp-text-3"
                />
                No column is marked as Account, and no account is set for rows
                with none — every row would be blocked in review.
              </p>
            ) : null}
            {mapping.warnings.map((warning) => (
              <p key={warning} className={NOTE}>
                <AlertTriangle
                  size={14}
                  strokeWidth={1.9}
                  aria-hidden
                  className="mt-[2px] shrink-0 text-fp-danger"
                />
                {warning}
              </p>
            ))}
            {mapping.warnings.length > 0 ? (
              <p className="text-[12px] text-fp-text-3">
                They are flagged in review — nothing is imported until you say
                so.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
