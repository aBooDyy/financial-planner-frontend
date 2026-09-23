import type { CsvErrorPayload } from './errors'
import type { ImportLimits } from './caps'
import type { CsvReadResult } from './read'
import type { Dialect } from '../types'

/**
 * The CSV worker's protocol: the message union and the rule for framing a finished read
 * into messages. It carries no runtime dependency on either side, so the worker and its
 * client can share it without importing each other.
 */

/**
 * Rows come back in slices rather than one array: deserialising a 50 000-row matrix in a
 * single message is one long task on the receiving thread, and several short ones are not.
 */
export const ROW_CHUNK = 5000

export type CsvWorkerRequest = {
  kind: 'parse'
  id: number
  file: File
  limits: ImportLimits
  overrides?: Partial<Dialect>
}

export type CsvWorkerResponse =
  | { kind: 'progress'; id: number; rows: number }
  | {
      kind: 'head'
      id: number
      dialect: Dialect
      headers: string[]
      rowCount: number
      columnCount: number
    }
  | { kind: 'rows'; id: number; start: number; rows: string[][] }
  | { kind: 'done'; id: number }
  | ({ kind: 'error'; id: number } & CsvErrorPayload)

/** Frame a finished read as the messages that carry it back to the main thread. */
export const streamCsvResult = (
  id: number,
  result: CsvReadResult,
  emit: (message: CsvWorkerResponse) => void,
): void => {
  emit({
    kind: 'head',
    id,
    dialect: result.dialect,
    headers: result.headers,
    rowCount: result.rowCount,
    columnCount: result.columnCount,
  })
  for (let start = 0; start < result.rows.length; start += ROW_CHUNK) {
    emit({
      kind: 'rows',
      id,
      start,
      rows: result.rows.slice(start, start + ROW_CHUNK),
    })
  }
  emit({ kind: 'done', id })
}
