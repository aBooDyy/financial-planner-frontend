import { download } from '#/features/settings/data/exportData'
import { messageForCode } from '#/lib/errorMessages'
import { hasErrors } from './types'
import type { Dialect, ParsedRow } from './types'

/**
 * *Download skipped rows*: the rows that did not make it, exactly as the file wrote them,
 * plus a `_reason` column. The user fixes them in a spreadsheet and re-imports only those,
 * which is why the cells are verbatim and the delimiter is the file's own.
 */

export const REASON_COLUMN = '_reason'

export const skipReason = (row: ParsedRow): string => {
  if (row.draft === null || hasErrors(row.issues)) {
    const issue =
      row.issues.find((i) => i.level === 'error') ?? row.issues.at(0)
    if (issue === undefined) return 'Could not be read.'
    const message = messageForCode(issue.code)
    return issue.detail ? `${message} (${issue.detail})` : message
  }
  return 'You left this row out.'
}

const cell = (value: string, delimiter: string): string =>
  value.includes(delimiter) || /["\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value

export const buildSkippedCsv = (
  rows: ReadonlyArray<ParsedRow>,
  headers: ReadonlyArray<string>,
  delimiter: string,
): string => {
  const width = rows.reduce((max, row) => Math.max(max, row.raw.length), 0)
  const columns = [...headers]
  while (columns.length < width) columns.push(`column_${columns.length + 1}`)

  const line = (values: ReadonlyArray<string>) =>
    values.map((value) => cell(value, delimiter)).join(delimiter)

  return [
    line([...columns, REASON_COLUMN]),
    ...rows.map((row) => {
      const cells = columns.map((_, at) => row.raw[at] ?? '')
      return line([...cells, skipReason(row)])
    }),
  ].join('\n')
}

/** `alrajhi-2026-08.csv` → `alrajhi-2026-08-skipped.csv`. */
export const skippedFileName = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? `${name}-skipped.csv` : `${name.slice(0, dot)}-skipped.csv`
}

export function downloadSkippedRows(
  rows: ReadonlyArray<ParsedRow>,
  file: { name: string; headers: ReadonlyArray<string>; dialect: Dialect },
): void {
  download(
    skippedFileName(file.name),
    'text/csv;charset=utf-8',
    buildSkippedCsv(rows, file.headers, file.dialect.delimiter),
  )
}
