// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { numericInputProps, sanitizeNumeric } from '#/lib/numericInput'

describe('sanitizeNumeric', () => {
  it('drops letters and symbols', () => {
    expect(sanitizeNumeric('12a3', { decimals: 2 })).toBe('123')
    expect(sanitizeNumeric('SAR 1,234.50', { decimals: 2 })).toBe('1234.50')
    expect(sanitizeNumeric('abc', { decimals: 2 })).toBe('')
  })

  it('converts Arabic-Indic digits and the Arabic decimal mark to ASCII', () => {
    expect(sanitizeNumeric('١٢٣٫٤٥', { decimals: 2 })).toBe('123.45')
    expect(sanitizeNumeric('۱۲۳', { decimals: 2 })).toBe('123')
  })

  it('keeps only the first point and caps the fraction at the currency decimals', () => {
    expect(sanitizeNumeric('1.2.3', { decimals: 2 })).toBe('1.23')
    expect(sanitizeNumeric('1.2345', { decimals: 3 })).toBe('1.234')
    expect(sanitizeNumeric('12.5', { decimals: 0 })).toBe('125')
  })

  it('leaves the fraction uncapped when no decimals are given', () => {
    expect(sanitizeNumeric('0.000123456', {})).toBe('0.000123456')
  })

  it('allows a leading minus only on signed fields', () => {
    expect(sanitizeNumeric('-50', { decimals: 2 })).toBe('50')
    expect(sanitizeNumeric('-50', { decimals: 2, signed: true })).toBe('-50')
    expect(sanitizeNumeric('5-0', { decimals: 2, signed: true })).toBe('50')
  })
})

function Field() {
  const [value, setValue] = useState('')
  return (
    <input
      aria-label="Amount"
      value={value}
      {...numericInputProps({ decimals: 2 }, setValue)}
    />
  )
}

describe('numericInputProps', () => {
  it('asks for the decimal keypad, or the plain one for whole numbers', () => {
    const noop = () => {}
    expect(numericInputProps({ decimals: 2 }, noop).inputMode).toBe('decimal')
    expect(numericInputProps({ decimals: 0 }, noop).inputMode).toBe('numeric')
  })

  it('never lets a rejected character into the field', () => {
    render(<Field />)
    const input = screen.getByLabelText<HTMLInputElement>('Amount')
    fireEvent.change(input, { target: { value: '١٢x' } })
    expect(input.value).toBe('12')
    fireEvent.change(input, { target: { value: '12e' } })
    expect(input.value).toBe('12')
  })
})
