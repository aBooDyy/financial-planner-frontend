// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LearnedLabel } from '#/features/text-templates/api/types'
import { FieldLabelRow } from './FieldLabelRow'
import { LabelChip } from './LabelChip'

afterEach(cleanup)

const label = (over: Partial<LearnedLabel> = {}): LearnedLabel => ({
  line: 7,
  text: 'Amount',
  offset: 1,
  source: 'nearby',
  verified: true,
  ...over,
})

describe('LabelChip', () => {
  it('says which label finds the value and where it sits', () => {
    const cases: Array<[Partial<LearnedLabel>, string]> = [
      [{}, 'Found by “Amount” · line above'],
      [{ offset: 0, source: 'same_line' }, 'Found by “Amount” · same line'],
      [{ offset: -2, source: 'picked' }, 'Found by “Amount” · 2 lines below'],
      [
        { text: 'مبلغ وقدره', offset: -1 },
        'Found by “مبلغ وقدره” · line below',
      ],
    ]
    for (const [over, text] of cases) {
      const { container, unmount } = render(
        <LabelChip field="amount" label={label(over)} />,
      )
      expect(container.textContent).toBe(text)
      unmount()
    }
  })

  it('says a field is read by keywords when no label was learned', () => {
    const { container } = render(
      <LabelChip
        field="merchant"
        label={label({
          line: null,
          text: null,
          offset: null,
          source: 'keywords',
        })}
      />,
    )
    expect(container.textContent).toMatch(/^Read by keywords/)
  })

  it('wears the warning tone when the rule could not find the value again', () => {
    const { container } = render(
      <LabelChip field="amount" label={label({ verified: false })} />,
    )
    expect(container.firstElementChild?.className).toContain('text-fp-warn')
  })
})

describe('FieldLabelRow', () => {
  const row = (over: Partial<Parameters<typeof FieldLabelRow>[0]> = {}) => {
    const props = {
      field: 'amount' as const,
      label: label(),
      pending: false,
      overridden: false,
      choosing: false,
      onChoose: vi.fn(),
      onAuto: vi.fn(),
      ...over,
    }
    render(<FieldLabelRow {...props} />)
    return props
  }

  it('asks for a label tap when the learned rule does not hold', () => {
    row({ label: label({ verified: false }) })
    expect(screen.getByRole('alert').textContent).toBe(
      'Couldn’t find this again — tap the label line',
    )
  })

  it('switches into label mode, and out again', () => {
    const idle = row()
    fireEvent.click(
      screen.getByRole('button', { name: 'Change the amount’s label' }),
    )
    expect(idle.onChoose).toHaveBeenCalledWith(true)
    cleanup()

    const choosing = row({ choosing: true })
    fireEvent.click(
      screen.getByRole('button', { name: 'Stop choosing the amount’s label' }),
    )
    expect(choosing.onChoose).toHaveBeenCalledWith(false)
  })

  it('offers Auto only once the user chose a label', () => {
    row()
    expect(screen.queryByRole('button', { name: /automatically/ })).toBeNull()
    cleanup()

    const props = row({ overridden: true, label: null, pending: true })
    expect(screen.getByText('Finding its label…')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Find the amount’s label automatically',
      }),
    )
    expect(props.onAuto).toHaveBeenCalled()
  })
})
