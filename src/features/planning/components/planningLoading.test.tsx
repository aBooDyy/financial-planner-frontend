// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { stubBrowser } from '#/features/planning/testing/dom'
import { SectionHeading } from './lists/SectionHeading'
import { Next30Card } from './overview/Next30Card'
import { PaycheckCard } from './overview/PaycheckCard'
import { VerdictCard } from './overview/VerdictCard'
import { HeadedCard } from './upcoming/HeadedCard'
import { PeriodCardSkeleton } from './upcoming/PeriodCardSkeleton'
import { YearAheadSkeleton } from './upcoming/YearAheadSkeleton'

/**
 * While the plan loads, every Planning card renders its frame, heading and actions, and only
 * the data-driven parts stand in as skeletons. No figure is ever drawn.
 */

beforeAll(stubBrowser)
afterEach(cleanup)

const noop = () => {}

const placeholders = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]').length

const hasFigure = (text: string | null) => /\d/.test(text ?? '')

const mount = (card: ReactElement) => render(card).container

describe('Planning while the plan loads', () => {
  it('the verdict keeps its card, with skeleton title, reason and action', () => {
    const el = mount(<VerdictCard copy={null} onAction={noop} />)
    expect(screen.getByRole('region', { name: 'Verdict' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(placeholders(el)).toBe(5)
  })

  it('each paycheck keeps its title, with a skeleton bar and legend', () => {
    const el = mount(<PaycheckCard bar={null} base="SAR" onSection={noop} />)
    expect(screen.getByText('Each paycheck')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    // The caption, the bar, then three legend rows of swatch, label and amount.
    expect(placeholders(el)).toBe(2 + 3 * 3)
    expect(hasFigure(el.textContent)).toBe(false)
  })

  it('next 30 days keeps its title, See all and the dated axis, never its empty line', () => {
    const el = mount(
      <Next30Card
        events={null}
        due={[]}
        today="2026-10-03"
        onSeeAll={noop}
        onEvent={noop}
      />,
    )
    expect(screen.getByText('Next 30 days')).toBeTruthy()
    expect(screen.getByRole('button', { name: /see all/i })).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.queryByText(/No bills or paydays/)).toBeNull()
    expect(placeholders(el)).toBeGreaterThan(0)
  })

  it('a list heading keeps its title and Add, with a skeleton summary', () => {
    const el = mount(
      <SectionHeading title="Bills" loading addLabel="Add bill" onAdd={noop} />,
    )
    expect(screen.getByText('Bills')).toBeTruthy()
    expect(screen.getByRole('button', { name: /add bill/i })).toBeTruthy()
    expect(placeholders(el)).toBe(1)
  })

  it('where it’s headed keeps its title, with skeleton parts and no figure', () => {
    const el = mount(<HeadedCard bar={null} base="SAR" />)
    expect(screen.getByText('Where it’s headed')).toBeTruthy()
    expect(screen.queryByText(/Add your income/)).toBeNull()
    expect(placeholders(el)).toBe(3 * 3 + 2)
    expect(hasFigure(el.textContent)).toBe(false)
  })

  it('upcoming and year-ahead placeholders hold no text', () => {
    for (const card of [
      <PeriodCardSkeleton key="p" rows={3} />,
      <YearAheadSkeleton key="d" desktop />,
      <YearAheadSkeleton key="m" desktop={false} />,
    ]) {
      const el = mount(card)
      expect(placeholders(el)).toBeGreaterThan(0)
      expect(el.textContent).toBe('')
      cleanup()
    }
  })
})
