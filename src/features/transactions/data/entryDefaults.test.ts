import { describe, expect, it } from 'vitest'
import { entryToWalletId, entryWalletId } from './entryDefaults'

const live = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('entryWalletId', () => {
  it('takes the first preferred wallet that is still live', () => {
    expect(entryWalletId(live, ['b', 'c'])).toBe('b')
    expect(entryWalletId(live, ['gone', 'c'])).toBe('c')
    expect(entryWalletId(live, [null, 'c'])).toBe('c')
  })

  it('falls back to the first wallet, or none', () => {
    expect(entryWalletId(live, [null, 'gone'])).toBe('a')
    expect(entryWalletId([], ['a'])).toBe('')
  })
})

describe('entryToWalletId', () => {
  it('keeps a remembered destination unless it is the source', () => {
    expect(entryToWalletId(live, 'a', 'c')).toBe('c')
    expect(entryToWalletId(live, 'c', 'c')).toBe('a')
    expect(entryToWalletId(live, 'a', null)).toBe('b')
  })

  it('stays on the source when it is the only wallet', () => {
    expect(entryToWalletId([{ id: 'a' }], 'a', null)).toBe('a')
  })
})
