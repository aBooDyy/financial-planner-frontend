import { describe, expect, it } from 'vitest'
import {
  GROUP_ICON,
  INCOME_CATEGORY_ICON,
  SPEND_CATEGORY_ICON,
  WALLET_ICON,
  iconIdOr,
} from './fallbacks'

describe('iconIdOr', () => {
  it('passes a known id through', () => {
    expect(iconIdOr('piggy-bank', SPEND_CATEGORY_ICON)).toBe('piggy-bank')
  })

  it('falls back on an id the pack does not define', () => {
    expect(iconIdOr('not-an-icon', INCOME_CATEGORY_ICON)).toBe(
      INCOME_CATEGORY_ICON,
    )
  })

  it('falls back on null and undefined', () => {
    expect(iconIdOr(null, WALLET_ICON)).toBe(WALLET_ICON)
    expect(iconIdOr(undefined, GROUP_ICON)).toBe(GROUP_ICON)
  })
})
