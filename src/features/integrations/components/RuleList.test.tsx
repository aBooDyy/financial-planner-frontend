// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuleDraft } from '#/features/integrations/data/ruleDraft'
import { FieldRow } from './FieldRow'
import { RuleList } from './RuleList'

afterEach(cleanup)

const rule = (name: string, over: Partial<RuleDraft> = {}): RuleDraft => ({
  id: name,
  key: name,
  name,
  match: null,
  fields: {},
  ...over,
})

describe('RuleList', () => {
  it('summarises each rule from itself and marks the one that handles the sample', () => {
    render(
      <RuleList
        rules={[
          rule('Purchase', {
            match: {
              path: '$.event',
              op: 'EQUALS',
              value: 'purchase',
              ignoreCase: true,
            },
            fields: {
              amount: { path: '$.amount' },
              currency: { const: 'SAR' },
            },
          }),
          rule('Anything else'),
        ]}
        verdicts={['skipped', 'fires']}
        flagged={new Set([0])}
        disabled={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
        onMove={vi.fn()}
      />,
    )
    const [first, second] = screen.getAllByRole('listitem')
    expect(first.textContent).toContain('When $.event is “purchase”')
    expect(first.textContent).toContain('amount · currency')
    expect(first.textContent).toContain('Needs a fix')
    expect(second.textContent).toContain('Always matches')
    expect(second.textContent).toContain('Handles the sample')
  })

  it('moves a rule with the arrow keys on its handle and says so', () => {
    const onMove = vi.fn()
    render(
      <RuleList
        rules={[rule('A'), rule('B'), rule('C')]}
        verdicts={[]}
        flagged={new Set()}
        disabled={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
        onMove={onMove}
      />,
    )
    const handle = screen.getByRole('button', {
      name: /Reorder “B”, position 2 of 3/,
    })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onMove).toHaveBeenLastCalledWith(1, 0)
    expect(screen.getByText('Moved “B” to position 1 of 3.')).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('button', { name: /Reorder “C”/ }), {
      key: 'ArrowDown',
    })
    expect(onMove).toHaveBeenCalledTimes(1)
  })
})

describe('FieldRow', () => {
  it('describes its inputs with the resolved value, so it is announced', () => {
    render(
      <FieldRow
        field="amount"
        locator={{ path: '$.text', regex: '([0-9.]+)' }}
        isTarget
        status={{ tone: 'ok', lead: 'Reads ', value: 'SAR 152.75' }}
        problem={null}
        choices={{
          walletGroups: [],
          catalog: {
            all: [],
            byType: () => [],
            get: () => {
              throw new Error('unused')
            },
            subsOf: () => [],
            sub: () => null,
            labelOf: () => '',
          },
          baseCurrency: 'SAR',
        }}
        onChange={vi.fn()}
        onTarget={vi.fn()}
      />,
    )
    const path = screen.getByLabelText('Amount path')
    const status = document.getElementById(
      path.getAttribute('aria-describedby')!,
    )
    expect(status?.textContent).toBe('Reads SAR 152.75')
    expect(path.getAttribute('dir')).toBe('ltr')
    expect(screen.getByRole('button', { pressed: true }).textContent).toContain(
      'Tap a value in the payload',
    )
  })
})
