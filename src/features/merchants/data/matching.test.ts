import { describe, expect, it } from 'vitest'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import cases from './__fixtures__/normalize_key_cases.json'
import {
  AUTO_MATCH_SCORE,
  CHECK_MATCH_SCORE,
  identityKey,
  matchMerchant,
  normalizeKey,
  scoreKeys,
} from './matching'

/**
 * `normalize_key_cases.json` is copied verbatim from the backend suite. If these fail, the
 * two normalisers have drifted and merchant identity is broken in both directions.
 */
describe('normalizeKey (shared case table)', () => {
  it.each(cases.cases)('normalises $input', ({ input, expected }) => {
    expect(normalizeKey(input)).toBe(expected)
  })

  it('covers the whole fixture', () => {
    expect(cases.cases).toHaveLength(22)
  })

  it('keeps digits so branch codes stay distinct merchants', () => {
    expect(normalizeKey('CARREFOUR 402')).not.toBe(
      normalizeKey('CARREFOUR 118'),
    )
  })

  it('reaches the fixed point the server stores (truncation can leave a space)', () => {
    const long = 'SUPERMARKET '.repeat(12)
    expect(normalizeKey(long).endsWith(' ')).toBe(true)
    expect(identityKey(long).endsWith(' ')).toBe(false)
    for (const { input } of cases.cases) {
      const key = identityKey(input)
      expect(normalizeKey(key)).toBe(key)
    }
  })

  it('drops non-ASCII letters, so an Arabic-only name has no identity', () => {
    expect(identityKey('ماركت الثميري')).toBe('')
  })
})

describe('scoreKeys', () => {
  it('scores exact equality at 100', () => {
    expect(scoreKeys('carrefour', 'carrefour')).toBe(100)
  })

  it('scores a whole-token run at 70', () => {
    expect(
      scoreKeys('carrefour hypermarket riyadh', 'carrefour hypermarket'),
    ).toBe(70)
  })

  it('does not treat a mid-token substring as containment', () => {
    expect(scoreKeys('carrefourish', 'carrefour')).toBeLessThan(
      AUTO_MATCH_SCORE,
    )
  })

  it('scores token overlap between the check and auto thresholds', () => {
    const score = scoreKeys('tamimi markets 4471', 'tamimi safeway 118')
    expect(score).toBeGreaterThanOrEqual(CHECK_MATCH_SCORE)
    expect(score).toBeLessThan(AUTO_MATCH_SCORE)
  })

  it('scores a near-miss on a short string at 60', () => {
    expect(scoreKeys('netflix', 'netflx')).toBe(60)
  })

  it('scores unrelated strings at 0', () => {
    expect(scoreKeys('netflix', 'carrefour')).toBe(0)
  })
})

let seq = 0
const merchant = (over: Partial<LocalMerchant> = {}): LocalMerchant => ({
  id: `m${(seq += 1)}`,
  displayName: 'Carrefour',
  learnedCategoryId: null,
  learnedType: null,
  timesSeen: 0,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '',
  updatedAt: '',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

const alias = (
  merchantId: string,
  raw: string,
  over: Partial<LocalMerchantAlias> = {},
): LocalMerchantAlias => ({
  id: `a${(seq += 1)}`,
  merchantId,
  normalizedKey: identityKey(raw),
  rawSample: raw,
  origin: 'import',
  createdAt: '',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

describe('matchMerchant', () => {
  it('short-circuits at 100 on an exact alias hit', () => {
    const shop = merchant({ displayName: 'Carrefour' })
    const other = merchant({ displayName: 'CARREFOUR HYPER 4471' })
    const match = matchMerchant('carrefour hyper 4471', {
      merchants: [shop, other],
      aliases: [alias(shop.id, 'CARREFOUR HYPER 4471')],
    })
    expect(match?.merchant.id).toBe(shop.id)
    expect(match?.score).toBe(100)
    expect(match?.alias?.normalizedKey).toBe('carrefour hyper 4471')
  })

  it('binds a near variant below the exact score', () => {
    const shop = merchant({ displayName: 'Carrefour Hypermarket' })
    const match = matchMerchant('CARREFOUR HYPERMARKET RIYADH', {
      merchants: [shop],
      aliases: [alias(shop.id, 'Carrefour Hypermarket')],
    })
    expect(match?.merchant.id).toBe(shop.id)
    expect(match?.score).toBe(AUTO_MATCH_SCORE)
    expect(match?.alias).toBeNull()
  })

  it('ignores deleted merchants and their aliases', () => {
    const gone = merchant({ displayName: 'Carrefour', deleted: 1 })
    expect(
      matchMerchant('Carrefour', {
        merchants: [gone],
        aliases: [alias(gone.id, 'Carrefour')],
      }),
    ).toBeNull()
  })

  it('has no identity to match on for a name that normalises to nothing', () => {
    const shop = merchant()
    expect(
      matchMerchant('!!!', {
        merchants: [shop],
        aliases: [alias(shop.id, 'Carrefour')],
      }),
    ).toBeNull()
  })

  it('breaks a tie towards the merchant seen more often', () => {
    const rare = merchant({ displayName: 'Uber Eats', timesSeen: 1 })
    const common = merchant({ displayName: 'Uber Trip', timesSeen: 40 })
    const match = matchMerchant('UBER *TRIP RIDE', {
      merchants: [rare, common],
      aliases: [],
    })
    expect(match?.merchant.id).toBe(common.id)
  })
})
