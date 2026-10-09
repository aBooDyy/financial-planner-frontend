import { describe, expect, it } from 'vitest'
import { bodyNoun, ledgerSourceOf } from './sources'

describe('ledgerSourceOf', () => {
  it('reads an inbox entry', () => {
    expect(ledgerSourceOf('email:c1')).toEqual({
      kind: 'email',
      connectionId: 'c1',
    })
  })

  it('reads a webhook entry, and one whose key was deleted', () => {
    expect(ledgerSourceOf('webhook:k1')).toEqual({
      kind: 'webhook',
      keyId: 'k1',
    })
    expect(ledgerSourceOf('webhook:')).toEqual({ kind: 'webhook', keyId: null })
  })

  it('ignores entries that did not come through the queue', () => {
    expect(ledgerSourceOf(null)).toBeNull()
    expect(ledgerSourceOf('csv:batch1')).toBeNull()
  })

  it('names a body by its format', () => {
    expect(bodyNoun('text')).toBe('email')
    expect(bodyNoun('json')).toBe('payload')
    expect(bodyNoun('text', 'webhook')).toBe('message')
    expect(bodyNoun('json', 'webhook')).toBe('payload')
  })
})
