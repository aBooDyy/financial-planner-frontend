import { csvErrorPayload } from './errors'
import { readCsv } from './read'
import { streamCsvResult } from './messages'
import type { CsvWorkerRequest, CsvWorkerResponse } from './messages'

/**
 * The CSV worker: an adapter, nothing more. The pipeline is `read.ts` and the framing is
 * `messages.ts`, so a 50 000-row file costs the main thread only the messages it receives.
 */

// The project compiles against lib.dom, where `self` is a Window; inside a worker it is the
// worker scope, and this is the slice of it the protocol needs.
type WorkerScope = {
  postMessage: (message: CsvWorkerResponse) => void
  onmessage: ((event: MessageEvent<CsvWorkerRequest>) => void) | null
}

const scope = self as unknown as WorkerScope

const post = (message: CsvWorkerResponse): void => scope.postMessage(message)

const run = async (request: CsvWorkerRequest): Promise<void> => {
  const { id } = request
  try {
    const bytes = new Uint8Array(await request.file.arrayBuffer())
    const result = readCsv(bytes, {
      limits: request.limits,
      overrides: request.overrides,
      onProgress: (rows) => post({ kind: 'progress', id, rows }),
    })
    streamCsvResult(id, result, post)
  } catch (error) {
    post({ kind: 'error', id, ...csvErrorPayload(error) })
  }
}

scope.onmessage = (event: MessageEvent<CsvWorkerRequest>) => {
  void run(event.data)
}
