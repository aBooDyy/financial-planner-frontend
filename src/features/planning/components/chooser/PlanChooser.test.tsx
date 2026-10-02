// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PlanChooser } from './PlanChooser'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

afterEach(() => {
  cleanup()
  navigate.mockReset()
})

const preset = {
  name: 'Emergency fund',
  target: 900000,
  amount: null,
  mustHave: true,
}

function renderChooser(suggestion: typeof preset | null = null) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const onSuggestion = vi.fn()
  render(
    <PlanChooser
      open
      onClose={onClose}
      onPick={onPick}
      suggestion={suggestion}
      onSuggestion={onSuggestion}
    />,
  )
  return { onPick, onClose, onSuggestion }
}

describe('PlanChooser', () => {
  it('offers a bill, a goal and income', () => {
    const { onPick } = renderChooser()
    expect(screen.getByText('What are you planning for?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /A bill/ }))
    fireEvent.click(screen.getByRole('button', { name: /A goal/ }))
    fireEvent.click(screen.getByRole('button', { name: /Income/ }))
    expect(onPick.mock.calls.map((c) => c[0])).toEqual([
      'bill',
      'goal',
      'income',
    ])
  })

  it('points regular spending to budgets', () => {
    const { onClose } = renderChooser()
    fireEvent.click(screen.getByRole('button', { name: /Set a budget/ }))
    expect(onClose).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({
      to: '/transactions/$view',
      params: { view: 'budgets' },
    })
  })

  it('suggests an emergency fund only when one is offered', () => {
    renderChooser()
    expect(screen.queryByText('Start an emergency fund')).toBeNull()
    cleanup()
    const { onSuggestion } = renderChooser(preset)
    fireEvent.click(screen.getByText('Start an emergency fund'))
    expect(onSuggestion).toHaveBeenCalledWith(preset)
  })
})
