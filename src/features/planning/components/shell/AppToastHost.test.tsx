// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePaydayNoticeStore } from '#/features/planned/stores/paydayNotice'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { AppToastHost } from './AppToastHost'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

beforeEach(() => {
  navigate.mockReset()
  usePlanningUi.setState({ sheet: null, detail: null })
  usePlanningToast.setState({ toast: null })
})

afterEach(cleanup)

describe('AppToastHost', () => {
  it('shows the Automatic-mode payday notice on any page and opens the review from it', () => {
    render(<AppToastHost />)
    act(() =>
      usePaydayNoticeStore.getState().show({
        at: '2026-10-25',
        count: 5,
        total: 560_000,
        base: 'SAR',
        review: 2,
      }),
    )
    expect(
      screen.getByText('Set aside SR 5,600 for 5 items · 2 need a look'),
    ).toBeTruthy()
    expect(usePaydayNoticeStore.getState().notice).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'review',
      payday: null,
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/planning/$section',
      params: { section: 'upcoming' },
    })
  })
})
