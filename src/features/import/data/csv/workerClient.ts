import { configLimits } from '#/lib/config/appConfig'
import { toImportLimits } from './caps'
import { CSV_FILE_ERRORS, CsvFileError, csvErrorFromPayload } from './errors'
import type { CsvWorkerRequest, CsvWorkerResponse } from './messages'
import type { CsvReadResult } from './read'
import type { Dialect } from '../types'

/**
 * Typed front door to the CSV worker. The caps come from the live config here, on the main
 * thread, because the worker's own module registry would only ever see the bundled snapshot.
 */

export type CsvParseOptions = {
  overrides?: Partial<Dialect>
  /** `total` is null until the file's row count is known. */
  onProgress?: (rows: number, total: number | null) => void
  signal?: AbortSignal
}

let nextRequestId = 1

export const parseCsvFile = (
  file: File,
  options: CsvParseOptions = {},
): Promise<CsvReadResult> => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })
  const id = nextRequestId++

  return new Promise<CsvReadResult>((resolve, reject) => {
    let head: Extract<CsvWorkerResponse, { kind: 'head' }> | null = null
    const rows: string[][] = []

    const onAbort = (): void => {
      worker.terminate()
      reject(new CsvFileError(CSV_FILE_ERRORS.cancelled))
    }

    const settle = (finish: () => void): void => {
      worker.terminate()
      options.signal?.removeEventListener('abort', onAbort)
      finish()
    }

    const fail = (error: CsvFileError): void => settle(() => reject(error))

    worker.onmessage = (event: MessageEvent<CsvWorkerResponse>) => {
      const message = event.data
      if (message.id !== id) return
      switch (message.kind) {
        case 'progress':
          options.onProgress?.(message.rows, null)
          break
        case 'head':
          head = message
          break
        case 'rows':
          for (const row of message.rows) rows.push(row)
          options.onProgress?.(rows.length, head?.rowCount ?? null)
          break
        case 'done': {
          const summary = head
          if (!summary) {
            fail(new CsvFileError(CSV_FILE_ERRORS.unreadable))
            return
          }
          settle(() =>
            resolve({
              dialect: summary.dialect,
              headers: summary.headers,
              rows,
              rowCount: summary.rowCount,
              columnCount: summary.columnCount,
            }),
          )
          break
        }
        case 'error':
          fail(csvErrorFromPayload(message))
          break
      }
    }

    worker.onerror = (event) => {
      fail(new CsvFileError(CSV_FILE_ERRORS.unreadable, event.message))
    }

    if (options.signal?.aborted) {
      onAbort()
      return
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const request: CsvWorkerRequest = {
      kind: 'parse',
      id,
      file,
      limits: toImportLimits(configLimits()),
      ...(options.overrides ? { overrides: options.overrides } : {}),
    }
    worker.postMessage(request)
  })
}
