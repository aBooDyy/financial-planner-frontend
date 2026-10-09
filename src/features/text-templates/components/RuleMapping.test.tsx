// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TextSample } from '#/features/text-templates/api/types'
import { NumberChoice } from './NumberChoice'
import { SampleLines } from './SampleLines'

afterEach(cleanup)

const SAMPLE: TextSample = {
  bodyLines: ['Dear customer', '', 'Amount: SAR 38.50', 'At: Jarir'],
}

const FROM_EMAIL = {
  decimal: 'auto' as const,
  currency: { mode: 'from_email' as const, code: null },
}

describe('SampleLines', () => {
  it('fills the target with a tapped line and names what each line carries', () => {
    const onTap = vi.fn()
    render(
      <SampleLines
        sample={SAMPLE}
        picks={{ amount: { line: 2 }, currency: { line: 2 }, merchant: null }}
        options={FROM_EMAIL}
        target="merchant"
        onTap={onTap}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const amountLine = screen.getByRole('button', {
      name: /Amount: SAR 38.50, tagged Amount, Currency, press Enter to tag as Merchant/,
    })
    expect(amountLine).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^At: Jarir/ }))
    expect(onTap).toHaveBeenCalledWith(3)
  })

  it('highlights the tagged amount and currency codes inside their line', () => {
    const { container } = render(
      <SampleLines
        sample={SAMPLE}
        picks={{
          amount: { line: 2, start: 12, end: 17 },
          currency: { line: 2 },
          merchant: null,
        }}
        options={FROM_EMAIL}
        target={null}
        onTap={() => undefined}
      />,
    )
    const marked = [
      ...container.querySelectorAll('.font-bold.text-fp-accent-ink'),
    ]
    expect(marked.map((el) => el.textContent)).toEqual(['SAR', '38.50'])
  })

  it('asks about the line the rule would guess the merchant from', () => {
    render(
      <SampleLines
        sample={SAMPLE}
        picks={{ amount: { line: 2 }, currency: { line: 2 }, merchant: null }}
        options={FROM_EMAIL}
        target="merchant"
        merchantGuess={3}
        onTap={() => undefined}
      />,
    )
    expect(
      screen.getByRole('button', { name: /^At: Jarir, may be the merchant/ }),
    ).toBeTruthy()
  })

  it('marks the line that labels a tagged value, apart from the value itself', () => {
    render(
      <SampleLines
        sample={SAMPLE}
        picks={{ amount: { line: 2 }, currency: { line: 2 }, merchant: null }}
        options={FROM_EMAIL}
        target={null}
        labelMarks={new Map([[0, ['amount']]])}
        onTap={() => undefined}
      />,
    )
    const label = screen.getByRole('button', {
      name: /^Dear customer, labels Amount$/,
    })
    expect(label.textContent).toContain('Amount label')
    expect(label.className).toContain('bg-fp-surface-2')
  })

  it('lets only the label candidates be tapped while choosing a label', () => {
    const onTap = vi.fn()
    render(
      <SampleLines
        sample={SAMPLE}
        picks={{ amount: { line: 2 }, currency: { line: 2 }, merchant: null }}
        options={FROM_EMAIL}
        target="merchant"
        labelMode={{ field: 'amount', candidates: new Set([0]) }}
        onTap={onTap}
      />,
    )
    const candidate = screen.getByRole('button', {
      name: /^Dear customer, press Enter to use as the Amount’s label$/,
    })
    const far = screen.getByRole('button', { name: /^At: Jarir$/ })
    expect(far).toHaveProperty('disabled', true)
    fireEvent.click(candidate)
    expect(onTap).toHaveBeenCalledWith(0)
  })

  it('does not mark a currency line when the currency is fixed', () => {
    render(
      <SampleLines
        sample={SAMPLE}
        picks={{ amount: { line: 2 }, currency: { line: 0 }, merchant: null }}
        options={{ decimal: 'auto', currency: { mode: 'fixed', code: 'SAR' } }}
        target={null}
        onTap={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: /^Dear customer$/ })).toBeTruthy()
  })
})

describe('NumberChoice', () => {
  it('asks which number is the amount when the line has several', () => {
    const onChoose = vi.fn()
    render(
      <NumberChoice
        line="Card 4471 charged SAR 38.50"
        pick={{ line: 1 }}
        onChoose={onChoose}
      />,
    )
    expect(
      screen.getByRole('radio', { name: 'The one next to the currency' }),
    ).toHaveProperty('ariaChecked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: '38.50' }))
    expect(onChoose).toHaveBeenCalledWith({ line: 1, start: 22, end: 27 })
  })

  it('stays out of the way for a line with one number', () => {
    const { container } = render(
      <NumberChoice
        line="Amount 38.50"
        pick={{ line: 0 }}
        onChoose={() => undefined}
      />,
    )
    expect(container.textContent).toBe('')
  })
})
