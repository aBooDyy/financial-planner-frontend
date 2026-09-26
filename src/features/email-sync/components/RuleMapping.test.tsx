// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmailSample } from '#/features/email-sync/api/types'
import { NumberChoice } from './NumberChoice'
import { SampleLines } from './SampleLines'

afterEach(cleanup)

const SAMPLE: EmailSample = {
  senderEmail: 'alerts@bank.com',
  senderName: 'Bank',
  subject: 'Purchase',
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
      name: /Amount: SAR 38.50, fills Amount, Currency, press Enter to use for Merchant/,
    })
    expect(amountLine).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^At: Jarir/ }))
    expect(onTap).toHaveBeenCalledWith(3)
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
