// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ArchiveNodeDialog } from './ArchiveNodeDialog'
import { DeleteNodeDialog } from './DeleteNodeDialog'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  Element.prototype.hasPointerCapture = () => false
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})
afterEach(cleanup)

const TARGET = {
  id: 'main',
  kind: 'wallet' as const,
  name: 'Main bank',
  walletCount: 0,
  holdingStr: null,
}

const renderArchive = (
  heldStr: string | null,
  moveTargets = [
    { id: 'savings', name: 'Savings' },
    { id: 'cash', name: 'Cash' },
  ],
) => {
  const onConfirm = vi.fn()
  render(
    <ArchiveNodeDialog
      target={TARGET}
      heldStr={heldStr}
      moveTargets={moveTargets}
      onClose={() => undefined}
      onConfirm={onConfirm}
    />,
  )
  return onConfirm
}

describe('Archiving a wallet that holds set-asides', () => {
  it('moves them to another wallet by default', () => {
    const onConfirm = renderArchive('SR 1,900.00')
    expect(
      screen.getByText(
        'SR 1,900.00 is set aside in it. Archived wallets hold no set-asides.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Archive wallet' }))
    expect(onConfirm).toHaveBeenCalledWith({
      kind: 'move',
      walletId: 'savings',
    })
  })

  it('frees them when asked, or when there is nowhere to move them', () => {
    const onConfirm = renderArchive('SR 1,900.00')
    fireEvent.click(screen.getByRole('radio', { name: 'Free them up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive wallet' }))
    expect(onConfirm).toHaveBeenLastCalledWith({ kind: 'free' })
    cleanup()

    const alone = renderArchive('SR 1,900.00', [])
    expect(screen.queryByRole('radio', { name: 'Move them to' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archive wallet' }))
    expect(alone).toHaveBeenCalledWith({ kind: 'free' })
  })

  it('asks nothing of a wallet holding none', () => {
    const onConfirm = renderArchive(null)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archive wallet' }))
    expect(onConfirm).toHaveBeenCalledWith(null)
  })
})

describe('Deleting a wallet that holds set-asides', () => {
  it('says they are freed', () => {
    render(
      <DeleteNodeDialog
        target={TARGET}
        heldStr="SR 1,900.00"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )
    expect(
      screen.getByText(
        'The SR 1,900.00 set aside in it is freed; its bills and goals plan for it again.',
      ),
    ).toBeTruthy()
  })
})
