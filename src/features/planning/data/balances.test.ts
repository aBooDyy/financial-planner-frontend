import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode, LocalSetAside } from '#/db/types'
import { releasesForPayment } from '#/features/setAsides/data/payment'
import { isLiveSetAside, setAsideFor } from '#/features/setAsides/data/totals'
import {
  RATES,
  bill,
  goal,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { balanceFigures } from './balances'
import type { BalanceFigures, MoneyFigures } from './balances'

const group = (over: Partial<LocalBalanceNode>) =>
  wallet({ kind: 'group', amount: null, currency: null, ...over })

describe('balanceFigures', () => {
  const MAIN = wallet({ id: 'main', amount: m(5400) })
  const SAVINGS = wallet({ id: 'savings', amount: m(10000), parentId: 'bank' })
  const BANK = group({ id: 'bank' })
  const RENT = bill({ id: 'rent', name: 'Rent' })
  const INS = bill({ id: 'ins', name: 'Car insurance' })

  it('shows Balance, Set aside and Free to spend on a wallet, with its lines', () => {
    const f = balanceFigures({
      nodes: [MAIN],
      walletDeltas: {},
      setAsides: [
        setAside({
          goalId: null,
          billId: 'rent',
          walletId: 'main',
          amount: m(1100),
        }),
        setAside({
          goalId: null,
          billId: 'ins',
          walletId: 'main',
          amount: m(800),
        }),
        setAside({
          goalId: null,
          billId: 'ins',
          walletId: 'main',
          amount: m(500),
          releasedAt: '2026-09-01',
        }),
      ],
      goals: [],
      bills: [RENT, INS],
      base: 'SAR',
      rates: RATES,
    })
    expect(f.wallets.main).toMatchObject({
      balance: m(5400),
      setAside: m(1900),
      free: m(3500),
      overBy: 0,
    })
    expect(f.wallets.main.lines.map((l) => l.ownerName)).toEqual([
      'Rent',
      'Car insurance',
    ])
  })

  it('flags an over-committed wallet', () => {
    const f = balanceFigures({
      nodes: [MAIN],
      walletDeltas: { main: -m(5000) },
      setAsides: [setAside({ goalId: 'g', walletId: 'main', amount: m(600) })],
      goals: [goal({ id: 'g' })],
      bills: [],
      base: 'SAR',
      rates: RATES,
    })
    expect(f.wallets.main).toMatchObject({
      balance: m(400),
      free: -m(200),
      overBy: m(200),
    })
  })

  it('sums groups and the header in base currency, leaving archived wallets out', () => {
    const usd = wallet({
      id: 'usd',
      currency: 'USD',
      amount: m(100),
      parentId: 'bank',
    })
    const old = wallet({ id: 'old', amount: m(999), archivedAt: '2026-01-01' })
    const f = balanceFigures({
      nodes: [MAIN, BANK, SAVINGS, usd, old],
      walletDeltas: {},
      setAsides: [
        setAside({
          goalId: 'g',
          walletId: 'usd',
          amount: m(40),
          currency: 'USD',
        }),
        setAside({ goalId: 'g', walletId: 'old', amount: m(100) }),
      ],
      goals: [goal({ id: 'g' })],
      bills: [],
      base: 'SAR',
      rates: RATES,
    })
    expect(f.groups.bank).toEqual({
      balance: m(10000) + m(375),
      setAside: m(150),
      free: m(10000) + m(375) - m(150),
    })
    expect(f.header.balance).toBe(m(5400) + m(10375))
    // The archived wallet's own row still reads true; it just isn't in any total.
    expect(f.wallets.old.setAside).toBe(m(100))
  })
})

// --- Property-style: the invariants of 03 §2 hold for any tree, any set-asides, any payments.

/** A small deterministic PRNG, so a failing case can be replayed. */
function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Case = {
  nodes: LocalBalanceNode[]
  setAsides: LocalSetAside[]
  deltas: Record<string, number>
}

function randomCase(seed: number): Case {
  const rnd = prng(seed)
  const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)]
  const int = (max: number) => Math.floor(rnd() * max)
  const groups = Array.from({ length: 1 + int(3) }, (_, i) =>
    group({
      id: `g${i}`,
      parentId: i > 0 && rnd() < 0.5 ? `g${int(i)}` : null,
      archivedAt: rnd() < 0.15 ? '2026-01-01' : null,
    }),
  )
  const wallets = Array.from({ length: 2 + int(6) }, (_, i) =>
    wallet({
      id: `w${i}`,
      parentId: rnd() < 0.6 ? pick(groups).id : null,
      currency: rnd() < 0.3 ? 'USD' : 'SAR',
      amount: m(int(20000)),
      archivedAt: rnd() < 0.1 ? '2026-01-01' : null,
    }),
  )
  const owners = ['b1', 'b2', 'g1', 'g2']
  const setAsides = Array.from({ length: int(25) }, (_, i) => {
    const owner = pick(owners)
    const w = pick(wallets)
    const outside = rnd() < 0.1
    return setAside({
      id: `s${i}`,
      goalId: owner.startsWith('g') ? owner : null,
      billId: owner.startsWith('b') ? owner : null,
      occurrence: owner.startsWith('b') ? '2026-11-01' : null,
      source: outside ? 'outside' : 'wallet',
      walletId: outside ? null : w.id,
      externalLabel: outside ? 'Cash' : null,
      amount: m(1 + int(3000)),
      currency: w.currency ?? 'SAR',
      date: `2026-09-${String(1 + int(28)).padStart(2, '0')}`,
      releasedAt: rnd() < 0.15 ? '2026-09-30' : null,
    })
  })
  const deltas = Object.fromEntries(
    wallets.map((w) => [w.id, m(int(4000)) - m(2000)]),
  )
  return { nodes: [...groups, ...wallets], setAsides, deltas }
}

const figuresOf = (c: Case): BalanceFigures =>
  balanceFigures({
    nodes: c.nodes,
    walletDeltas: c.deltas,
    setAsides: c.setAsides,
    goals: [goal({ id: 'g1' }), goal({ id: 'g2' })],
    bills: [bill({ id: 'b1' }), bill({ id: 'b2' })],
    base: 'SAR',
    rates: RATES,
  })

function expectInvariants(c: Case, f: BalanceFigures): void {
  const sum = (list: MoneyFigures[]) =>
    list.reduce(
      (a, x) => ({
        balance: a.balance + x.balance,
        setAside: a.setAside + x.setAside,
        free: a.free + x.free,
      }),
      { balance: 0, setAside: 0, free: 0 },
    )
  for (const w of Object.values(f.wallets)) {
    expect(w.setAside).toBe(w.lines.reduce((a, l) => a + l.amount, 0))
    expect(w.free).toBe(w.balance - w.setAside)
    expect(w.inBase.free).toBe(w.inBase.balance - w.inBase.setAside)
  }
  const nodes = new Map(c.nodes.map((n) => [n.id, n]))
  const hidden = (id: string | null): boolean => {
    if (id === null) return false
    const n = nodes.get(id)
    return !n || n.archivedAt !== null || hidden(n.parentId)
  }
  const activeWallets = c.nodes.filter(
    (n) => n.kind === 'wallet' && !hidden(n.id),
  )
  expect(f.header).toEqual(
    sum(activeWallets.map((w) => f.wallets[w.id].inBase)),
  )
  expect(f.header.free).toBe(f.header.balance - f.header.setAside)
  for (const [groupId, figures] of Object.entries(f.groups)) {
    const inside = (id: string | null): boolean =>
      id !== null && (id === groupId || inside(nodes.get(id)?.parentId ?? null))
    expect(figures).toEqual(
      sum(
        activeWallets
          .filter((w) => inside(w.parentId))
          .map((w) => f.wallets[w.id].inBase),
      ),
    )
  }
  // Set aside for an owner = Σ over wallets (+ held outside), the same money either way.
  for (const owner of ['b1', 'b2', 'g1', 'g2']) {
    const inWallets = Object.values(f.wallets)
      .flatMap((w) =>
        w.lines
          .filter((l) => l.ownerId === owner)
          .map((l) => ({ amount: l.amount, currency: w.currency })),
      )
      .reduce(
        (a, l) => a + (l.currency === 'USD' ? l.amount * 3.75 : l.amount),
        0,
      )
    const outside = c.setAsides
      .filter(
        (a) =>
          isLiveSetAside(a) &&
          a.source === 'outside' &&
          (a.goalId ?? a.billId) === owner,
      )
      .reduce(
        (s, a) => s + (a.currency === 'USD' ? a.amount * 3.75 : a.amount),
        0,
      )
    expect(
      Math.abs(
        inWallets + outside - setAsideFor(owner, c.setAsides, 'SAR', RATES),
      ),
    ).toBeLessThan(2)
  }
}

describe('the 03 §2 invariants, over random wallets, set-asides and payments', () => {
  it('always agree at wallet, group, header and owner level', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const c = randomCase(seed)
      expectInvariants(c, figuresOf(c))
    }
  })

  it('never move a Balance when money is set aside, and still agree after payments release it', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const c = randomCase(seed)
      const before = figuresOf(c)
      const rnd = prng(seed * 7)

      // Setting money aside moves no money.
      const target = c.nodes.find((n) => n.kind === 'wallet')
      if (!target) continue
      const more = setAside({
        id: 'extra',
        goalId: 'g1',
        walletId: target.id,
        amount: m(123),
        currency: target.currency ?? 'SAR',
      })
      const withMore = { ...c, setAsides: [...c.setAsides, more] }
      const after = figuresOf(withMore)
      for (const id of Object.keys(before.wallets))
        expect(after.wallets[id].balance).toBe(before.wallets[id].balance)
      expectInvariants(withMore, after)

      // A payment from a wallet releases (part of) what it held there and spends money.
      const payer = target.id
      const amount = m(Math.floor(rnd() * 5000))
      const parts = releasesForPayment(
        withMore.setAsides,
        { goalId: 'g1' },
        payer,
        amount,
        target.currency ?? 'SAR',
        RATES,
      )
      const released = withMore.setAsides.flatMap((a) => {
        const part = parts.find((p) => p.id === a.id)
        if (!part) return [a]
        if (part.amount === undefined || part.amount >= a.amount)
          return [{ ...a, releasedAt: '2026-10-01' }]
        return [
          { ...a, amount: part.amount, releasedAt: '2026-10-01' },
          { ...a, id: `${a.id}-rest`, amount: a.amount - part.amount },
        ]
      })
      const paid: Case = {
        ...withMore,
        setAsides: released,
        deltas: {
          ...withMore.deltas,
          [payer]: (withMore.deltas[payer] ?? 0) - amount,
        },
      }
      expectInvariants(paid, figuresOf(paid))
    }
  })
})
