// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReviewPayloadTree } from '#/features/integrations/components/ReviewPayloadTree'
import { BodyPreview } from './BodyPreview'
import { PayloadViewContext } from './payloadView'

afterEach(cleanup)

const base = { truncated: false, loading: false, error: null }

describe('BodyPreview', () => {
  it('renders a text body as tappable lines that hand the line back', () => {
    const onUseLine = vi.fn()
    render(
      <BodyPreview
        {...base}
        format="text"
        lines={['Merchant: CARREFOUR', 'Amount: SAR 245.00']}
        onUseLine={onUseLine}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Amount: SAR 245.00' }))

    expect(onUseLine).toHaveBeenCalledWith('Amount: SAR 245.00')
    expect(screen.getByText('Tap a line to use its amount')).toBeTruthy()
  })

  it('renders a JSON body pretty-printed when no payload view is mounted', () => {
    const { container } = render(
      <BodyPreview
        {...base}
        format="json"
        lines={['{"amount":"12.50","merchant":"Cafe"}']}
        onUseLine={vi.fn()}
      />,
    )

    expect(container.querySelector('pre')?.textContent).toBe(
      '{\n  "amount": "12.50",\n  "merchant": "Cafe"\n}',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows a JSON body that does not parse as it was received', () => {
    const { container } = render(
      <BodyPreview {...base} format="json" lines={['{not json']} />,
    )

    expect(container.querySelector('pre')?.textContent).toBe('{not json')
  })

  it('renders a JSON body as the payload tree, and a tap hands the value to the form', () => {
    const onPick = vi.fn()
    render(
      <PayloadViewContext.Provider value={ReviewPayloadTree}>
        <BodyPreview
          {...base}
          format="json"
          lines={['{"transaction":{"amount":"12.50"},"merchant":"Cafe"}']}
          picking={{ target: 'amount', onTarget: vi.fn(), onPick }}
        />
      </PayloadViewContext.Provider>,
    )

    expect(screen.getByRole('tree', { name: 'Payload' })).toBeTruthy()
    fireEvent.click(screen.getByText('"12.50"'))

    expect(onPick).toHaveBeenCalledWith({ value: '12.50', text: '12.50' })
    expect(
      screen
        .getByRole('button', { name: 'Amount' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('lets the user choose which field a tap fills', () => {
    const onTarget = vi.fn()
    render(
      <PayloadViewContext.Provider value={ReviewPayloadTree}>
        <BodyPreview
          {...base}
          format="json"
          lines={['{"merchant":"Cafe"}']}
          picking={{ target: 'amount', onTarget, onPick: vi.fn() }}
        />
      </PayloadViewContext.Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Merchant' }))

    expect(onTarget).toHaveBeenCalledWith('merchant')
  })

  it('shows a truncated payload as text, saying why, since it no longer parses', () => {
    const cut = '{"amount":"12.50","note":"aaaa'
    const { container } = render(
      <PayloadViewContext.Provider value={ReviewPayloadTree}>
        <BodyPreview {...base} truncated format="json" lines={[cut]} />
      </PayloadViewContext.Provider>,
    )

    expect(screen.queryByRole('tree')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toBe(cut)
    expect(screen.getByText(/only the first part was kept/)).toBeTruthy()
  })

  it('names what is missing by the body’s format', () => {
    render(<BodyPreview {...base} format="json" lines={[]} />)

    expect(screen.getByText(/before payloads were kept/)).toBeTruthy()
  })
})
