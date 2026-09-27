// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import { OfflineIndicator } from './OfflineIndicator'

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })

const goOffline = () =>
  act(() => {
    setOnline(false)
    window.dispatchEvent(new Event('offline'))
  })

const TRIGGER = /offline/i

beforeEach(async () => {
  setOnline(true)
  await db.outbox.clear()
})
afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('OfflineIndicator', () => {
  it('stays out of the way while online', () => {
    render(<OfflineIndicator />)
    expect(screen.queryByRole('button', { name: TRIGGER })).toBeNull()
  })

  it('appears when the connection drops and explains itself on press', async () => {
    render(<OfflineIndicator />)
    goOffline()

    fireEvent.click(screen.getByRole('button', { name: TRIGGER }))

    expect(await screen.findByText('You’re offline')).toBeTruthy()
    expect(screen.getByText(/syncs automatically/)).toBeTruthy()
    expect(screen.queryByText(/waiting to sync/)).toBeNull()
  })

  it('counts the changes waiting to sync', async () => {
    await db.outbox.bulkAdd([
      {
        op: 'create',
        entity: 'transaction',
        id: 't1',
        payload: {},
        baseVersion: null,
        createdAt: new Date().toISOString(),
      },
      {
        op: 'update',
        entity: 'transaction',
        id: 't2',
        payload: {},
        baseVersion: null,
        createdAt: new Date().toISOString(),
      },
    ])
    setOnline(false)
    render(<OfflineIndicator />)

    fireEvent.click(screen.getByRole('button', { name: TRIGGER }))

    expect(
      await screen.findByText('2 changes are waiting to sync.'),
    ).toBeTruthy()
  })

  it('leaves once back online', () => {
    setOnline(false)
    render(<OfflineIndicator />)
    expect(screen.getByRole('button', { name: TRIGGER })).toBeTruthy()

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('button', { name: TRIGGER })).toBeNull()
  })
})
