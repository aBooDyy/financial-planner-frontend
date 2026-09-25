// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { ImportDoneCard } from './ImportDoneCard'
import type { ReactNode } from 'react'
import type { LocalImportBatch } from '#/db/types'

// The card links into Spending; the route tree is not what is under test here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))

const BATCH: LocalImportBatch = {
  id: 'b1',
  source: 'csv',
  label: 'alrajhi.csv',
  templateId: null,
  rowCount: 3,
  importedCount: 2,
  skippedDuplicates: 1,
  errorCount: 0,
  walletIds: ['w1'],
  createdAt: '2026-09-01T00:00:00Z',
  undoneAt: null,
}

const renderCard = () =>
  render(
    <ImportDoneCard
      batch={BATCH}
      walletNames={['Main']}
      learnedSpellings={0}
      skippedCount={0}
      saved={{ kind: 'none' }}
      suggestedName="Al Rajhi"
      onSaveTemplate={() => undefined}
      onDownloadSkipped={() => undefined}
      onImportAnother={() => undefined}
      onUndo={() => undefined}
    />,
  )

// `globals` is off in this project, so Testing Library's auto-cleanup never registers.
afterEach(cleanup)

beforeEach(async () => {
  await db.importBatches.clear()
  await db.importBatches.put(BATCH)
})

describe('ImportDoneCard', () => {
  it('says what landed, and offers to take it back', async () => {
    renderCard()

    expect(screen.getByText('2 transactions imported into Main.')).toBeDefined()
    expect(screen.getByText('1 duplicates skipped')).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Undo this import' }),
    ).toBeDefined()
    expect(screen.getByText('See them in Spending')).toBeDefined()
  })

  it('says the import was undone once it has been', async () => {
    renderCard()
    await screen.findByText('2 transactions imported into Main.')

    await db.importBatches.put({ ...BATCH, undoneAt: '2026-09-02T00:00:00Z' })

    expect(await screen.findByText('Import undone.')).toBeDefined()
    expect(screen.getByText(/was removed/)).toBeDefined()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Undo this import' }),
      ).toBeNull(),
    )
    expect(screen.queryByText('See them in Spending')).toBeNull()
    // Bringing in another file is still the way out.
    expect(
      screen.getByRole('button', { name: 'Import another file' }),
    ).toBeDefined()
  })
})
