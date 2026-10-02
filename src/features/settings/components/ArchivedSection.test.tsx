// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import { m, setAside, wallet } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { ArchivedSection } from './ArchivedSection'

beforeAll(stubBrowser)

beforeEach(async () => {
  await seedPlanningDb()
  await db.balanceNodes.put(
    wallet({
      id: 'old',
      name: 'Old savings',
      archivedAt: '2026-09-01T00:00:00Z',
    }),
  )
})

afterEach(cleanup)

describe('Deleting an archived wallet', () => {
  it('says the set-asides it still holds are freed', async () => {
    await db.setAsides.put(setAside({ walletId: 'old', amount: m(1900) }))
    render(<ArchivedSection />)
    fireEvent.click(await screen.findByTitle('Delete Old savings for good'))
    expect(
      await screen.findByText(
        'The SR 1,900.00 set aside in it is freed; its bills and goals plan for it again.',
      ),
    ).toBeTruthy()
  })

  it('says nothing about set-asides when it holds none', async () => {
    render(<ArchivedSection />)
    fireEvent.click(await screen.findByTitle('Delete Old savings for good'))
    await screen.findAllByText('Delete “Old savings” for good?')
    expect(screen.queryByText(/set aside in it/)).toBeNull()
  })
})
