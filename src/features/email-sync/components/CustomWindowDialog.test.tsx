// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { CustomWindowDialog } from './CustomWindowDialog'

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 27, 12))
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})
afterAll(() => {
  vi.useRealTimers()
})
afterEach(cleanup)

const renderDialog = () => {
  const onPick = vi.fn()
  const onClose = vi.fn()
  render(<CustomWindowDialog onPick={onPick} onClose={onClose} />)
  return { onPick, onClose }
}

const pickDate = (iso: string) =>
  fireEvent.change(screen.getByLabelText('Emails received since'), {
    target: { value: iso },
  })

const syncButton = () => screen.getByRole('button', { name: 'Sync' })

describe('CustomWindowDialog', () => {
  it('syncs back to the whole of the picked date and closes', () => {
    const { onPick, onClose } = renderDialog()
    pickDate('2026-09-20')
    fireEvent.click(syncButton())
    expect(onPick).toHaveBeenCalledWith(8)
    expect(onClose).toHaveBeenCalled()
  })

  it('holds a date past the lookback ceiling back, and says why', () => {
    const { onPick } = renderDialog()
    pickDate('2025-01-01')
    fireEvent.click(syncButton())
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.getByText(/Pick a date from the last \d+ days/)).toBeTruthy()
  })
})
