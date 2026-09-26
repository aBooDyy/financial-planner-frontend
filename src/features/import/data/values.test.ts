import { describe, expect, it } from 'vitest'
import { buildCatalog } from '#/features/categories/data/catalog'
import { categoryOptions } from './matching'
import { emptyAliases } from './types'
import {
  ADJUSTMENT,
  MOVEMENT_TARGETS,
  NEW,
  SKIP,
  TRANSFER,
  UNSET,
  categoryTargetGroups,
  chosenValue,
  distinctOf,
  preferredFirst,
  proposalFor,
  proposalsFor,
  seedFor,
  valueRows,
  withAlias,
  withAliases,
  withNewWallet,
} from './values'
import type { TargetGroup, ValueCatalogue } from './values'

const catalogue: ValueCatalogue = {
  wallets: [
    { id: 'w1', name: 'Main', currency: 'SAR', group: null },
    { id: 'w2', name: 'Rainy day', currency: 'SAR', group: 'Savings' },
  ],
  categories: categoryOptions(buildCatalog([])),
  merchants: { merchants: [], aliases: [] },
}

const values = (
  entries: ReadonlyArray<[string, number]>,
): ReturnType<typeof distinctOf> =>
  distinctOf(entries.flatMap(([raw, count]) => Array(count).fill(raw)))

describe('proposalFor', () => {
  it('fills an exact account in and only offers a partial one', () => {
    expect(proposalFor('wallet', 'Main', catalogue)).toMatchObject({
      value: 'w1',
      tier: 'auto',
    })
    expect(proposalFor('wallet', 'Rainy day fund', catalogue).tier).toBe('auto')
    expect(proposalFor('wallet', 'MADA CARD 4471', catalogue)).toMatchObject({
      value: UNSET,
      tier: 'none',
      ambiguity: null,
    })
  })

  it('reads the file’s own words for types and currencies', () => {
    expect(proposalFor('type', 'DR', catalogue).value).toBe('spend')
    expect(proposalFor('type', 'CR', catalogue).value).toBe('income')
    expect(proposalFor('currency', 'sar', catalogue).value).toBe('SAR')
    expect(proposalFor('currency', 'wat', catalogue).tier).toBe('none')
  })
})

describe('proposalFor — a value that names a group', () => {
  const inGroup = (
    wallets: ReadonlyArray<{ id: string; name: string }>,
  ): ValueCatalogue => ({
    ...catalogue,
    wallets: wallets.map((wallet) => ({
      ...wallet,
      currency: 'SAR' as const,
      group: 'Al Bilad',
    })),
  })

  const ONE = inGroup([{ id: 'w1', name: 'Main' }])
  const TWO = inGroup([
    { id: 'w1', name: 'Main' },
    { id: 'w2', name: 'Savings' },
  ])

  it('answers the group when only one account is in it', () => {
    expect(proposalFor('wallet', 'Al Bilad', ONE)).toMatchObject({
      value: 'w1',
      tier: 'auto',
      ambiguity: null,
    })
    expect(proposalFor('wallet', 'ALBILAD', ONE).value).toBe('w1')
  })

  it('asks, and says why, when several accounts are in it', () => {
    const proposal = proposalFor('wallet', 'Al Bilad', TWO)

    expect(proposal.value).toBe(UNSET)
    expect(proposal.tier).toBe('none')
    expect(proposal.ambiguity).toEqual({
      hint: 'Matches the group “Al Bilad” — choose which account.',
      group: 'Al Bilad',
    })
  })

  it('never seeds an ambiguous value into the aliases', () => {
    const found = values([['Al Bilad', 4329]])

    expect(
      seedFor(
        'wallet',
        found,
        emptyAliases(),
        proposalsFor('wallet', found, ONE),
      ),
    ).toEqual([{ key: 'al bilad', value: 'w1' }])
    expect(
      seedFor(
        'wallet',
        found,
        emptyAliases(),
        proposalsFor('wallet', found, TWO),
      ),
    ).toEqual([])
  })

  it('carries the reason and the group onto the row', () => {
    const found = values([['Al Bilad', 4329]])
    const [row] = valueRows(
      'wallet',
      found,
      emptyAliases(),
      proposalsFor('wallet', found, TWO),
    )

    expect(row).toMatchObject({
      matched: false,
      ambiguous: true,
      preferGroup: 'Al Bilad',
    })
    expect(row.hint).toContain('Al Bilad')
  })

  it('drops the reason once the user has answered', () => {
    const answered = withAliases(emptyAliases(), 'wallet', [
      { key: 'al bilad', value: 'w2' },
    ])
    const found = values([['Al Bilad', 4329]])
    const [row] = valueRows(
      'wallet',
      found,
      answered,
      proposalsFor('wallet', found, TWO),
    )

    expect(row).toMatchObject({ matched: true, ambiguous: false, hint: null })
  })
})

describe('preferredFirst', () => {
  const options: TargetGroup[] = [
    { label: 'Al Rajhi', options: [] },
    { label: 'Al Bilad', options: [] },
  ]

  it('offers the named group before the rest, and is a no-op without one', () => {
    expect(preferredFirst(options, 'Al Bilad').map((g) => g.label)).toEqual([
      'Al Bilad',
      'Al Rajhi',
    ])
    expect(preferredFirst(options, null)).toBe(options)
    expect(preferredFirst(options, 'Nowhere')).toBe(options)
  })
})

describe('seedFor', () => {
  it('answers what it is sure of, never the blank row, never twice', () => {
    const found = values([
      ['Main', 3],
      ['', 2],
      ['MADA CARD 4471', 1],
    ])

    const proposals = proposalsFor('wallet', found, catalogue)

    const seeds = seedFor('wallet', found, emptyAliases(), proposals)
    expect(seeds).toEqual([{ key: 'main', value: 'w1' }])

    const answered = withAliases(emptyAliases(), 'wallet', [
      { key: 'main', value: 'w2' },
    ])
    expect(seedFor('wallet', found, answered, proposals)).toEqual([])
    expect(seedFor('wallet', found, answered, proposals, true)).toEqual([
      { key: 'main', value: 'w1' },
    ])
  })
})

describe('withAlias', () => {
  it('tells an unanswered value from one answered "nothing"', () => {
    const skipped = withAlias(emptyAliases(), 'wallet', 'main', SKIP)
    expect(chosenValue('wallet', 'main', skipped)).toBe(SKIP)

    const cleared = withAlias(skipped, 'wallet', 'main', UNSET)
    expect(chosenValue('wallet', 'main', cleared)).toBe(UNSET)
    expect(Object.keys(cleared.wallets)).toHaveLength(0)
  })

  it('records a target that does not exist yet under its final id', () => {
    const aliases = withNewWallet(emptyAliases(), 'mada card 4471', {
      kind: 'create',
      walletId: 'new-id',
      name: 'MADA card',
      currency: 'SAR',
    })

    expect(chosenValue('wallet', 'mada card 4471', aliases)).toBe(NEW)
    expect(aliases.wallets['mada card 4471']).toMatchObject({
      kind: 'create',
      walletId: 'new-id',
    })
  })
})

describe('valueRows', () => {
  it('puts what still needs an answer first and the blank row last', () => {
    const found = values([
      ['Main', 9],
      ['', 4],
      ['MADA CARD 4471', 2],
    ])
    const aliases = withAliases(emptyAliases(), 'wallet', [
      { key: 'main', value: 'w1' },
    ])

    const rows = valueRows(
      'wallet',
      found,
      aliases,
      proposalsFor('wallet', found, catalogue),
    )

    expect(rows.map((row) => row.raw)).toEqual(['MADA CARD 4471', 'Main', ''])
    expect(rows[0].matched).toBe(false)
    expect(rows[1]).toMatchObject({
      matched: true,
      proposed: true,
      tier: 'auto',
    })
    expect(rows[2].blank).toBe(true)
  })

  it('drops the auto mark once the user overrules it', () => {
    const found = values([['Main', 3]])
    const aliases = withAliases(emptyAliases(), 'wallet', [
      { key: 'main', value: 'w2' },
    ])

    const [row] = valueRows(
      'wallet',
      found,
      aliases,
      proposalsFor('wallet', found, catalogue),
    )
    expect(row).toMatchObject({ matched: true, proposed: false })
  })
})

describe('movement answers — transfers and balance adjustments', () => {
  it('proposes a transfer or an adjustment from the words an export uses', () => {
    expect(proposalFor('category', 'Transfer', catalogue)).toMatchObject({
      value: TRANSFER,
      tier: 'auto',
    })
    expect(
      proposalFor('category', 'Balance adjustment', catalogue),
    ).toMatchObject({ value: ADJUSTMENT, tier: 'auto' })
    expect(
      proposalFor('category', 'Bank transfer fee', catalogue),
    ).toMatchObject({ value: TRANSFER, tier: 'check' })
  })

  it('writes and reads them back as their own target kinds', () => {
    let aliases = withAlias(emptyAliases(), 'category', 'transfer', TRANSFER)
    aliases = withAlias(aliases, 'category', 'adjust', ADJUSTMENT)
    expect(aliases.categories).toEqual({
      transfer: { kind: 'transfer' },
      adjust: { kind: 'adjustment' },
    })
    expect(chosenValue('category', 'transfer', aliases)).toBe(TRANSFER)
    expect(chosenValue('category', 'adjust', aliases)).toBe(ADJUSTMENT)
  })

  it('offers both next to the user’s categories', () => {
    expect(MOVEMENT_TARGETS.options.map((option) => option.value)).toEqual([
      TRANSFER,
      ADJUSTMENT,
    ])
  })
})

describe('categoryTargetGroups', () => {
  const groups = categoryTargetGroups(categoryOptions(buildCatalog([])))

  it('puts every money-out parent before every money-in one', () => {
    const sections = groups.map((group) => group.section)
    expect(sections[0]).toBe('Money out')
    expect(sections.at(-1)).toBe('Money in')
    expect(sections.lastIndexOf('Money out')).toBeLessThan(
      sections.indexOf('Money in'),
    )
  })

  it('tags parents and children alike with their direction', () => {
    const income = groups.find((group) => group.section === 'Money in')
    expect(income?.options.every((option) => option.tag === 'Money in')).toBe(
      true,
    )
  })
})
