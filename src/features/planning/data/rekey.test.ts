import { describe, expect, it } from 'vitest'
import {
  bill,
  m,
  planned,
  setAside,
} from '#/features/planned/testing/fixtures'
import { paymentRowsOf } from './occurrences'
import { strandedSetAsides } from './rekey'

const payment = (occurrence: string, status: 'open' | 'done' | 'skipped') =>
  planned({
    origin: 'bill',
    role: 'payment',
    goalId: null,
    billId: 'rent',
    occurrence,
    status,
  })
const heldFor = (occurrence: string, over = {}) =>
  setAside({ goalId: null, billId: 'rent', occurrence, amount: m(500), ...over })

describe('strandedSetAsides', () => {
  it('moves money from an occurrence the schedule lost onto the nearest open one', () => {
    // Due on the 1st until the user moved it to the 5th.
    const rent = bill({ id: 'rent', nextDue: '2026-11-05' })
    const nov = heldFor('2026-11-01')
    const dec = heldFor('2026-12-01')
    const kept = heldFor('2026-11-05')
    expect(
      strandedSetAsides(rent, new Map(), [nov, dec, kept]),
    ).toEqual([
      { id: nov.id, occurrence: '2026-11-05' },
      { id: dec.id, occurrence: '2026-12-05' },
    ])
  })

  it('moves an earlier due date’s money back, and an ended bill’s onto its last occurrence', () => {
    const rent = bill({
      id: 'rent',
      nextDue: '2026-10-25',
      endsOn: '2026-12-31',
    })
    const nov = heldFor('2026-11-01')
    const feb = heldFor('2027-02-01')
    expect(strandedSetAsides(rent, new Map(), [nov, feb])).toEqual([
      { id: nov.id, occurrence: '2026-10-25' },
      { id: feb.id, occurrence: '2026-12-25' },
    ])
  })

  it('follows a new repeat and a one-off’s new date', () => {
    const yearly = bill({ id: 'rent', nextDue: '2027-03-01', frequency: 'annual' })
    const apr = heldFor('2027-04-01')
    expect(strandedSetAsides(yearly, new Map(), [apr])).toEqual([
      { id: apr.id, occurrence: '2027-03-01' },
    ])
    const once = bill({ id: 'rent', nextDue: '2027-05-10', frequency: null })
    const may = heldFor('2027-05-01')
    expect(strandedSetAsides(once, new Map(), [may])).toEqual([
      { id: may.id, occurrence: '2027-05-10' },
    ])
  })

  it('rolls money on a skipped occurrence on, and leaves a paid one’s leftover alone', () => {
    const rent = bill({ id: 'rent', nextDue: '2026-12-01' })
    const rows = paymentRowsOf('rent', [
      payment('2026-10-01', 'done'),
      payment('2026-11-01', 'skipped'),
    ])
    const leftover = heldFor('2026-10-01')
    const skipped = heldFor('2026-11-01')
    expect(strandedSetAsides(rent, rows, [leftover, skipped])).toEqual([
      { id: skipped.id, occurrence: '2026-12-01' },
    ])
  })

  it('touches nothing released, nothing of a closed bill and nothing on schedule', () => {
    const rent = bill({ id: 'rent', nextDue: '2026-11-05' })
    const released = heldFor('2026-11-01', { releasedAt: '2026-10-01' })
    expect(strandedSetAsides(rent, new Map(), [released])).toEqual([])
    expect(
      strandedSetAsides({ ...rent, closedAt: '2026-10-01' }, new Map(), [
        heldFor('2026-11-01'),
      ]),
    ).toEqual([])
    expect(
      strandedSetAsides(rent, new Map(), [heldFor('2027-01-05')]),
    ).toEqual([])
  })

  it('carries a month-end bill’s drifted occurrences back onto its day', () => {
    // Stepped from Feb 28 before the schedule kept its anchor: March landed on the 28th.
    const eom = bill({ id: 'rent', nextDue: '2027-03-31' })
    const rows = paymentRowsOf('rent', [
      payment('2027-01-31', 'done'),
      payment('2027-02-28', 'done'),
    ])
    const drifted = heldFor('2027-03-28')
    expect(strandedSetAsides(eom, rows, [drifted])).toEqual([
      { id: drifted.id, occurrence: '2027-03-31' },
    ])
  })
})
