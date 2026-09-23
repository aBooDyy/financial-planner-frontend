import { describe, expect, it } from 'vitest'
import { ROW_CHUNK, streamCsvResult } from './messages'
import { readCsv } from './read'
import type { CsvWorkerResponse } from './messages'

const LIMITS = { maxRows: 60_000, maxBytes: 20 * 1024 * 1024 }

const generate = (rows: number): Uint8Array => {
  const lines = ['Date,Description,Amount,Currency']
  for (let i = 0; i < rows; i += 1) {
    lines.push(`2026-06-16,"MERCHANT, ${i}",${i / 100},SAR`)
  }
  return new TextEncoder().encode(lines.join('\n'))
}

const frame = (rows: number): CsvWorkerResponse[] => {
  const result = readCsv(generate(rows), { limits: LIMITS })
  const messages: CsvWorkerResponse[] = []
  streamCsvResult(7, result, (message) => messages.push(message))
  return messages
}

describe('streamCsvResult', () => {
  it('opens with the file summary and closes with done', () => {
    const messages = frame(3)
    expect(messages[0]).toMatchObject({ kind: 'head', id: 7, rowCount: 3 })
    expect(messages.at(-1)).toEqual({ kind: 'done', id: 7 })
  })

  /**
   * The size cap is the point: deserialising 50 000 rows in one message is a single long
   * task on the receiving thread, and several short ones are not.
   */
  it('never puts more than a chunk of rows in one message', () => {
    const messages = frame(ROW_CHUNK * 2 + 1)
    const slices = messages.filter((message) => message.kind === 'rows')
    expect(slices).toHaveLength(3)
    expect(slices.map((slice) => slice.rows.length)).toEqual([
      ROW_CHUNK,
      ROW_CHUNK,
      1,
    ])
    expect(slices.map((slice) => slice.start)).toEqual([
      0,
      ROW_CHUNK,
      ROW_CHUNK * 2,
    ])
  })

  it('reassembles into exactly the rows that were read', () => {
    const rows: string[][] = []
    for (const message of frame(ROW_CHUNK + 2)) {
      if (message.kind === 'rows') rows.push(...message.rows)
    }
    expect(rows).toHaveLength(ROW_CHUNK + 2)
    expect(rows[0]).toEqual(['2026-06-16', 'MERCHANT, 0', '0', 'SAR'])
    expect(rows.at(-1)?.[1]).toBe(`MERCHANT, ${ROW_CHUNK + 1}`)
  })
})
