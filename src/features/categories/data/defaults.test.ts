import { describe, expect, it } from 'vitest'
import { ICON_IDS } from '#/lib/icons/catalog.gen'
import { CATEGORIES, SPEND_CLASS_DEFAULTS } from './defaults'

describe('the built-in catalog', () => {
  it('references only icons the pack ships', () => {
    const shipped = new Set<string>(ICON_IDS)
    const missing = CATEGORIES.flatMap((c) => [
      { where: c.id, icon: c.icon },
      ...c.subs.map((s) => ({ where: `${c.id}/${s.id}`, icon: s.icon })),
    ]).filter((e) => !shipped.has(e.icon))

    expect(missing).toEqual([])
  })

  it('has a unique slug per level', () => {
    const roots = CATEGORIES.map((c) => c.id)
    expect(new Set(roots).size).toBe(roots.length)

    for (const c of CATEGORIES) {
      const subs = c.subs.map((s) => s.id)
      expect(new Set(subs).size).toBe(subs.length)
    }
  })

  it('tags every spending root but other, and no income root', () => {
    const spend = CATEGORIES.filter((c) => c.type === 'spend').map((c) => c.id)
    const income = CATEGORIES.filter((c) => c.type === 'income').map(
      (c) => c.id,
    )

    expect(spend.filter((id) => !(id in SPEND_CLASS_DEFAULTS))).toEqual([
      'other',
    ])
    expect(income.filter((id) => id in SPEND_CLASS_DEFAULTS)).toEqual([])
    expect(
      Object.keys(SPEND_CLASS_DEFAULTS).filter((id) => !spend.includes(id)),
    ).toEqual([])
  })
})
