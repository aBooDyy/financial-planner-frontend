// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/db'
import { openPlannerReads } from '#/features/planned/data/plannerTables'
import { goal, m } from '#/features/planned/testing/fixtures'
import { usePlannedData } from './usePlannedData'
import type { PlannedData } from './usePlannedData'

const seen: Record<string, PlannedData> = {}

function Consumer({ name }: { name: string }) {
  seen[name] = usePlannedData()
  return null
}

beforeEach(async () => {
  await Promise.all([db.goals.clear(), db.plannedTransactions.clear()])
  await db.goals.put(goal({ id: 'umrah', target: m(1000) }))
})

afterEach(cleanup)

describe('usePlannedData', () => {
  it('serves every consumer from one set of reads and one derivation', async () => {
    const view = render(
      <>
        <Consumer name="a" />
        <Consumer name="b" />
      </>,
    )
    await waitFor(() => expect(seen.a.loading).toBe(false))

    const reads = openPlannerReads()
    const rates = seen.a.inputs.rates
    expect(reads).toBeGreaterThan(0)
    expect(seen.b.inputs).toBe(seen.a.inputs)
    expect(seen.b.state).toBe(seen.a.state)

    // A third consumer joins the open reads instead of adding its own.
    view.rerender(
      <>
        <Consumer name="a" />
        <Consumer name="b" />
        <Consumer name="c" />
      </>,
    )
    expect(openPlannerReads()).toBe(reads)
    expect(seen.c.loading).toBe(false)
    expect(seen.c.state).toBe(seen.a.state)

    await act(async () => {
      await db.goals.put(goal({ id: 'car', target: m(5000) }))
    })
    await waitFor(() => expect(seen.a.inputs.goals).toHaveLength(2))
    expect(seen.b.inputs).toBe(seen.a.inputs)
    // Same rates, same object: reads keyed on them aren't restarted by other tables.
    expect(seen.a.inputs.rates).toBe(rates)

    view.unmount()
    expect(openPlannerReads()).toBe(0)
  })
})
