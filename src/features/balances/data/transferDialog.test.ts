import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import {
  afterTone,
  amountChips,
  autoReceived,
  doneSummary,
  overMessage,
  previewTransfer,
  rateLine,
  receiveLabel,
  resolvePair,
  submitLabel,
  transferWallets,
} from './transferDialog'
import type { TransferWallet } from './transferDialog'

const RATES = { SAR: 1, USD: 3.75 }

const wallet = (over: Partial<TransferWallet>): TransferWallet => ({
  id: 'w',
  name: 'Wallet',
  color: '#1F9D6B',
  icon: 'wallet',
  currency: 'SAR',
  balance: 0,
  ...over,
})

const main = wallet({ id: 'main', name: 'Main Checking', balance: 1_842_050 })
const savings = wallet({ id: 'sav', name: 'Savings', balance: 4_200_000 })
const usd = wallet({
  id: 'usd',
  name: 'Dollar card',
  currency: 'USD',
  balance: 50_000,
})

const node = (over: Partial<LocalBalanceNode>): LocalBalanceNode => ({
  id: 'n',
  kind: 'wallet',
  parentId: null,
  name: 'Node',
  color: '#123456',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: null,
  currency: null,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

describe('transferWallets', () => {
  it('keeps wallets only, with opening + ledger as the live balance', () => {
    const out = transferWallets(
      [
        node({ id: 'g', kind: 'group' }),
        node({ id: 'a', amount: 10_000, currency: 'USD', icon: 'bank' }),
        node({ id: 'b', amount: null, currency: null }),
      ],
      { a: -2_500, b: 700 },
      'SAR',
    )
    expect(out.map((w) => [w.id, w.balance, w.currency, w.icon])).toEqual([
      ['a', 7_500, 'USD', 'bank'],
      ['b', 700, 'SAR', 'wallet'],
    ])
  })
})

describe('resolvePair', () => {
  const all = [main, savings, usd]

  it('defaults to the first wallet and the first other one', () => {
    const { from, to } = resolvePair(all, null, null)
    expect([from?.id, to?.id]).toEqual(['main', 'sav'])
  })

  it('never lets both sides be the same wallet', () => {
    const { from, to } = resolvePair(all, 'sav', 'sav')
    expect([from?.id, to?.id]).toEqual(['sav', 'main'])
  })

  it('falls back when a chosen wallet has gone', () => {
    const { from, to } = resolvePair(all, 'gone', 'usd')
    expect([from?.id, to?.id]).toEqual(['main', 'usd'])
  })

  it('leaves the destination empty with one wallet', () => {
    expect(resolvePair([main], null, null).to).toBeUndefined()
  })
})

describe('previewTransfer', () => {
  it('moves the amount from one balance to the other within a currency', () => {
    const p = previewTransfer(main, savings, 200_000, null)
    expect(p).toMatchObject({
      hasAmount: true,
      isFx: false,
      received: 200_000,
      fromAfter: 1_642_050,
      toAfter: 4_400_000,
      over: false,
      canSubmit: true,
    })
  })

  it('credits the received figure across currencies', () => {
    const p = previewTransfer(main, usd, 375_000, 100_000)
    expect(p.isFx).toBe(true)
    expect(p.toAfter).toBe(150_000)
    expect(p.canSubmit).toBe(true)
  })

  it('blocks more than the source holds', () => {
    const p = previewTransfer(main, savings, 1_842_051, null)
    expect(p.over).toBe(true)
    expect(p.canSubmit).toBe(false)
  })

  it('allows exactly the whole balance', () => {
    expect(previewTransfer(main, savings, 1_842_050, null).canSubmit).toBe(true)
  })

  it('needs a positive amount, and a positive received figure across currencies', () => {
    expect(previewTransfer(main, savings, null, null).canSubmit).toBe(false)
    expect(previewTransfer(main, savings, -5, null).hasAmount).toBe(false)
    expect(previewTransfer(main, usd, 1_000, 0).canSubmit).toBe(false)
  })
})

describe('afterTone', () => {
  it('stays muted with no amount', () => {
    expect(afterTone(false, true, 10)).toBe('muted')
  })
  it('marks the receiving side with the accent', () => {
    expect(afterTone(true, true, 10)).toBe('accent')
  })
  it('turns the sending side red only below zero', () => {
    expect(afterTone(true, false, 0)).toBe('text')
    expect(afterTone(true, false, -1)).toBe('danger')
  })
})

describe('amountChips', () => {
  it('offers a quarter, a half and all of the balance', () => {
    const chips = amountChips(main, null)
    expect(chips.map((c) => [c.label, c.minor])).toEqual([
      ['25%', 460_513],
      ['50%', 921_025],
      ['All · SR 18,420.50', 1_842_050],
    ])
    expect(chips.some((c) => c.active)).toBe(false)
  })

  it('marks the chip matching the amount', () => {
    expect(amountChips(main, 1_842_050).map((c) => c.active)).toEqual([
      false,
      false,
      true,
    ])
  })

  it('disables every chip on an empty or overdrawn wallet', () => {
    const empty = wallet({ balance: -100 })
    expect(amountChips(empty, null).every((c) => c.disabled)).toBe(true)
  })
})

describe('rateLine', () => {
  it('quotes the stored rate so the figure is at least 1', () => {
    expect(rateLine('USD', 'SAR', 0, 0, RATES)).toBe('1 USD = 3.7500 SAR')
    expect(rateLine('SAR', 'USD', 0, 0, RATES)).toBe('1 USD = 3.7500 SAR')
  })

  it('uses the entered pair once both sides exist', () => {
    expect(rateLine('SAR', 'USD', 380_000, 100_000, RATES)).toBe(
      '1 USD = 3.8000 SAR',
    )
  })

  it('says so when a currency has no rate', () => {
    expect(rateLine('SAR', 'XYZ', 0, 0, RATES)).toBe('No rate for SAR → XYZ')
  })
})

describe('labels', () => {
  it('reads the submit button off the amount', () => {
    expect(submitLabel(200_000, 'SAR')).toBe('Transfer SR 2,000.00')
    expect(submitLabel(null, 'SAR')).toBe('Enter an amount')
    expect(submitLabel(0, 'SAR')).toBe('Enter an amount')
  })

  it('names the source and its balance in the over guard', () => {
    expect(overMessage(main)).toBe(
      'More than the SR 18,420.50 in Main Checking.',
    )
  })

  it('shouts the receiving wallet', () => {
    expect(receiveLabel(usd)).toBe('DOLLAR CARD RECEIVES')
  })

  it('summarises a same-currency transfer', () => {
    expect(doneSummary(main, savings, 200_000, 200_000)).toEqual({
      title: 'Transferred SR 2,000.00',
      sub: 'Main Checking → Savings',
    })
  })

  it('adds what arrived for a cross-currency one', () => {
    expect(doneSummary(main, usd, 200_000, 53_333).sub).toBe(
      'Main Checking → Dollar card · received $533.33',
    )
  })
})

describe('autoReceived', () => {
  it('pads the derived amount to the destination minor units', () => {
    expect(autoReceived('375', 'SAR', 'USD', RATES)).toBe('100.00')
    expect(autoReceived('100', 'USD', 'SAR', RATES)).toBe('375.00')
  })

  it('keeps cents the conversion produces', () => {
    expect(autoReceived('10', 'SAR', 'USD', RATES)).toBe('2.67')
  })

  it('is empty without a positive amount', () => {
    expect(autoReceived('', 'SAR', 'USD', RATES)).toBe('')
    expect(autoReceived('0', 'SAR', 'USD', RATES)).toBe('')
  })
})
