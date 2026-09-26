// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ContributionRowView,
  GoalDetailView,
} from '#/features/goals/data/goalDetail'
import { ContributionsList } from './ContributionsList'
import { GoalProgress } from './GoalProgress'
import { PlanBox } from './PlanBox'

afterEach(cleanup)

const contribution = (
  over: Partial<ContributionRowView>,
): ContributionRowView => ({
  key: over.key ?? 'k',
  mark: 'future',
  dateStr: 'Oct 1',
  caption: 'Planned',
  amountStr: 'SR 1,500',
  plannedId: null,
  allocationId: null,
  ...over,
})

const detail = (over: Partial<GoalDetailView> = {}): GoalDetailView => ({
  subtitle: 'Goal · SR 13,000 by Mar 1, 2027',
  pctStr: '31%',
  bar: { savedPct: 30.8, awaitingPct: 11.5 },
  savedCaption: 'SR 4,000 saved · SR 1,500 awaiting confirm',
  leftCaption: 'SR 9,000 left',
  plan: {
    left: {
      label: 'Saved plan · Jun 12',
      amountStr: 'SR 1,500',
      unit: '/mo',
      sub: '× 8 set-asides',
    },
    right: {
      label: 'From today',
      amountStr: 'SR 1,800',
      unit: '/mo',
      sub: '× 5 set-asides',
    },
    highlightRight: false,
  },
  band: {
    kind: 'behind',
    title: 'SR 1,500 behind plan',
    text: "The Sep 1 set-aside hasn't been confirmed.",
    recalcLabel: 'Recalculate to SR 1,800',
    confirmLabel: 'Confirm Sep',
    confirmId: 'p-sep',
  },
  contributions: [],
  earlierCount: 0,
  addSub: '',
  ...over,
})

describe('GoalProgress', () => {
  it('draws the settled and the awaiting segments with their captions', () => {
    render(<GoalProgress detail={detail()} color="#F59E0B" />)
    expect(document.querySelector('[data-segment="settled"]')).not.toBeNull()
    expect(document.querySelector('[data-segment="awaiting"]')).not.toBeNull()
    expect(screen.getByText('31%')).toBeDefined()
    expect(screen.getByText('SR 4,000 saved')).toBeDefined()
    expect(screen.getByText('· SR 1,500 awaiting confirm')).toBeDefined()
  })
})

describe('PlanBox', () => {
  const renderBox = (d: GoalDetailView) => {
    const actions = { onRecalc: vi.fn(), onConfirm: vi.fn(), onUndo: vi.fn() }
    const plan = d.plan
    if (!plan) throw new Error('no plan')
    render(<PlanBox plan={plan} band={d.band} busy={false} {...actions} />)
    return actions
  }

  it('offers both ways out of being behind', () => {
    const { onRecalc, onConfirm } = renderBox(detail())
    expect(screen.getByText('Saved plan · Jun 12')).toBeDefined()
    expect(screen.getByText('From today')).toBeDefined()
    fireEvent.click(
      screen.getByRole('button', { name: 'Recalculate to SR 1,800' }),
    )
    expect(onRecalc).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Sep' }))
    expect(onConfirm).toHaveBeenCalledWith('p-sep')
  })

  it('offers an undo right after a rewrite', () => {
    const { onUndo } = renderBox(
      detail({
        band: {
          kind: 'updated',
          lead: 'Plan updated Sep 24.',
          text: 'Oct–Feb planned set-asides now SR 1,800 each.',
        },
      }),
    )
    expect(screen.getByText('Plan updated Sep 24.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('keeps the off-plan note to a quiet line', () => {
    const { onRecalc } = renderBox(
      detail({
        band: {
          kind: 'off',
          text: "Plan is SR 200/mo off from today's numbers",
        },
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))
    expect(onRecalc).toHaveBeenCalled()
  })
})

describe('ContributionsList', () => {
  const renderList = (d: GoalDetailView) => {
    const handlers = {
      onAdd: vi.fn(),
      onConfirm: vi.fn(),
      onRemoveAllocation: vi.fn(),
    }
    render(<ContributionsList detail={d} color="#F59E0B" {...handlers} />)
    return handlers
  }

  it('opens the confirm for a planned row and adds a contribution', () => {
    const { onConfirm, onAdd } = renderList(
      detail({
        contributions: [
          contribution({
            key: 'sep',
            mark: 'due',
            dateStr: 'Sep 1',
            caption: 'Planned · needs confirming',
            plannedId: 'p-sep',
          }),
        ],
      }),
    )
    fireEvent.click(screen.getByText('Sep 1'))
    expect(onConfirm).toHaveBeenCalledWith('p-sep')
    fireEvent.click(screen.getByRole('button', { name: /Add contribution/ }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('lets a set-aside be taken back', () => {
    const { onRemoveAllocation } = renderList(
      detail({
        contributions: [
          contribution({
            key: 'jul',
            mark: 'confirmed',
            dateStr: 'Jul 1',
            caption: 'Main Checking · confirmed',
            allocationId: 'a-jul',
          }),
        ],
      }),
    )
    fireEvent.click(screen.getByText('Jul 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }))
    expect(onRemoveAllocation).toHaveBeenCalledWith('a-jul')
  })

  it('folds the oldest rows behind "Show earlier"', () => {
    renderList(
      detail({
        contributions: ['Jan 1', 'Feb 1', 'Mar 1'].map((dateStr) =>
          contribution({ key: dateStr, mark: 'confirmed', dateStr }),
        ),
        earlierCount: 2,
      }),
    )
    expect(screen.queryByText('Jan 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 earlier' }))
    expect(screen.getByText('Jan 1')).toBeDefined()
  })
})
