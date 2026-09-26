// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorDraft } from '#/features/goals/hooks/useGoalEditor'
import { IncomePaydayField } from './IncomePaydayField'

afterEach(cleanup)

const SEP_24 = new Date(2026, 8, 24)

const draft = (over: Partial<EditorDraft>): EditorDraft => ({
  name: 'Bonus',
  amount: '5000',
  currency: 'SAR',
  color: '#1F9D6B',
  frequency: 'monthly',
  day: '27',
  walletId: null,
  anchorISO: '',
  storedAnchor: null,
  kind: 'onetime',
  saved: '',
  dueISO: '',
  setAsideDay: '',
  payOnDue: false,
  customRepeat: false,
  customInterval: '28',
  customUnit: 'day',
  ...over,
})

const renderField = (d: EditorDraft) => {
  const onDay = vi.fn()
  const onNextPayday = vi.fn()
  render(
    <IncomePaydayField
      draft={d}
      today={SEP_24}
      dateFormat="dmy"
      onDay={onDay}
      onNextPayday={onNextPayday}
    />,
  )
  return { onDay, onNextPayday }
}

describe('IncomePaydayField', () => {
  it('asks a monthly stream for its day of the month', () => {
    renderField(draft({}))
    expect(screen.getByLabelText('Paid on')).toBeTruthy()
    expect(screen.queryByLabelText('Next payday')).toBeNull()
  })

  it('asks any other cadence for its next payday, defaulting to the computed one', () => {
    const { onNextPayday } = renderField(draft({ frequency: 'quarterly' }))
    const input = screen.getByLabelText<HTMLInputElement>('Next payday')
    expect(input.value).toBe('2026-10-27')
    expect(screen.getByText('Then every quarter from this date')).toBeTruthy()
    fireEvent.change(input, { target: { value: '2026-12-27' } })
    expect(onNextPayday).toHaveBeenCalledWith('2026-12-27')
  })
})
