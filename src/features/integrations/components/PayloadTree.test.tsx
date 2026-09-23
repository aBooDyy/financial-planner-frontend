// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTree } from '#/features/integrations/data/payloadTree'
import { PayloadTree } from './PayloadTree'

afterEach(cleanup)

const PAYLOAD = {
  event: 'purchase',
  transaction: { amount: '152.75', 'amount.total': 1500 },
  items: [{ sku: 'A1' }],
  text: 'SAR 152.75 spent',
}

const renderTree = (payload: object = PAYLOAD, explainWords = true) => {
  const onBind = vi.fn()
  render(
    <PayloadTree
      root={buildTree(payload)}
      onBind={onBind}
      marks={new Map([['$.event', ['Condition']]])}
      highlighted={new Set()}
      targetLabel="Amount"
      label="Sample payload"
      explainWords={explainWords}
    />,
  )
  return { onBind, tree: screen.getByRole('tree', { name: 'Sample payload' }) }
}

const item = (name: RegExp) => screen.getByRole('treeitem', { name })

describe('PayloadTree', () => {
  it('renders nested objects, arrays and the words of a string', () => {
    const { tree } = renderTree()
    expect(tree.getAttribute('dir')).toBe('ltr')
    expect(item(/^transaction: 2 keys/).getAttribute('aria-expanded')).toBe(
      'true',
    )
    expect(item(/^\[0\]: 1 key/)).toBeTruthy()
    expect(item(/^sku: "A1"/)).toBeTruthy()
    const text = item(/^text:/)
    expect(
      within(text)
        .getAllByRole('treeitem')
        .map((t) => t.textContent),
    ).toEqual(['SAR', '152.75', 'spent'])
    expect(item(/^event:.*fills Condition/)).toBeTruthy()
  })

  it('binds the path of a tapped value, quoting a key with a dot in it', () => {
    const { onBind } = renderTree()
    fireEvent.click(screen.getByText('"152.75"'))
    expect(onBind).toHaveBeenLastCalledWith({
      path: '$.transaction.amount',
      value: '152.75',
    })
    fireEvent.click(screen.getByText('1500'))
    expect(onBind).toHaveBeenLastCalledWith({
      path: '$.transaction["amount.total"]',
      value: 1500,
    })
  })

  it('binds one word of a string with the tokens it came from', () => {
    const { onBind } = renderTree()
    fireEvent.click(screen.getByText('152.75', { selector: '[role=treeitem]' }))
    const binding = onBind.mock.calls[0][0]
    expect(binding.path).toBe('$.text')
    expect(binding.piece.index).toBe(1)
    expect(binding.piece.tokens[1].text).toBe('152.75')
  })

  it('walks with the arrows, opens and closes, and binds on Enter', () => {
    const { tree, onBind } = renderTree()
    const first = item(/^event:/)
    expect(first.tabIndex).toBe(0)
    first.focus()

    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item(/^transaction:/))

    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(item(/^transaction:/).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: /^amount:/ })).toBeNull()

    fireEvent.keyDown(tree, { key: 'ArrowRight' })
    fireEvent.keyDown(tree, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(item(/^amount: "152.75"/))

    fireEvent.keyDown(tree, { key: 'Enter' })
    expect(onBind).toHaveBeenLastCalledWith({
      path: '$.transaction.amount',
      value: '152.75',
    })

    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(item(/^transaction:/))

    fireEvent.keyDown(tree, { key: 'End' })
    expect(document.activeElement?.textContent).toBe('spent')
    fireEvent.keyDown(tree, { key: ' ' })
    expect(onBind.mock.lastCall?.[0].piece.index).toBe(2)

    fireEvent.keyDown(tree, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('shows the path of the focused node', () => {
    renderTree()
    fireEvent.mouseEnter(screen.getByText('"A1"'))
    expect(screen.getByText('$.items[0].sku')).toBeTruthy()
  })

  it('explains a word as a pattern only where a tap writes one', () => {
    renderTree(PAYLOAD, false)
    fireEvent.mouseEnter(
      screen.getByText('spent', { selector: '[role=treeitem]' }),
    )
    expect(screen.getByText('$.text')).toBeTruthy()
    cleanup()
    renderTree()
    fireEvent.mouseEnter(
      screen.getByText('spent', { selector: '[role=treeitem]' }),
    )
    expect(
      screen.getByText('$.text · one word, read with a pattern'),
    ).toBeTruthy()
  })
})
