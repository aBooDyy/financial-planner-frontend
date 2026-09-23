import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Dialect } from '../../types'
import type { DateFormatToken } from '../dates'

/**
 * Loader for the fixture corpus: small, anonymised files shaped like real bank exports,
 * each with a sibling `.expected.json` stating the dialect, the inferred date format and a
 * few parsed amounts. Node-only — the corpus is a test asset, never shipped.
 */

const DIR = dirname(fileURLToPath(import.meta.url))

export type ExpectedAmount = {
  row: number
  column: number
  currency: string
  /** null when the cell is not a readable amount. */
  minor: number | null
  negative?: boolean
}

export type ExpectedFixture = {
  exercises: string
  dialect: Dialect
  headers: string[]
  rowCount: number
  columnCount: number
  dates: {
    column: number
    format: DateFormatToken | null
    ambiguous: boolean
    samples: Array<{ row: number; iso: string | null }>
  }
  amounts: ExpectedAmount[]
  notes?: string
}

export type CsvFixture = {
  name: string
  bytes: Uint8Array
  expected: ExpectedFixture
}

export const fixtureBytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(DIR, name)))

export const loadFixture = (name: string): CsvFixture => ({
  name,
  bytes: fixtureBytes(name),
  expected: JSON.parse(
    readFileSync(join(DIR, name.replace(/\.csv$/, '.expected.json')), 'utf8'),
  ) as ExpectedFixture,
})

export const fixtureNames = (): string[] =>
  readdirSync(DIR)
    .filter((file) => file.endsWith('.csv'))
    .sort()

export const loadFixtures = (): CsvFixture[] => fixtureNames().map(loadFixture)
