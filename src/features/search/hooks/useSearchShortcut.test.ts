// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isSearchShortcut } from './useSearchShortcut'

const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', init)
  Object.defineProperty(e, 'target', { value: target })
  return e
}

describe('isSearchShortcut', () => {
  it('takes Cmd+K and Ctrl+K anywhere', () => {
    const input = document.createElement('input')
    expect(isSearchShortcut(key({ key: 'k', metaKey: true }))).toBe(true)
    expect(isSearchShortcut(key({ key: 'K', ctrlKey: true }, input))).toBe(true)
  })

  it('takes a bare slash only outside editable fields', () => {
    const input = document.createElement('input')
    const area = document.createElement('textarea')
    expect(isSearchShortcut(key({ key: '/' }))).toBe(true)
    expect(isSearchShortcut(key({ key: '/' }, input))).toBe(false)
    expect(isSearchShortcut(key({ key: '/' }, area))).toBe(false)
  })

  it('ignores other keys and modified slashes', () => {
    expect(isSearchShortcut(key({ key: 'k' }))).toBe(false)
    expect(
      isSearchShortcut(key({ key: 'k', ctrlKey: true, altKey: true })),
    ).toBe(false)
    expect(isSearchShortcut(key({ key: '/', ctrlKey: true }))).toBe(false)
  })
})
