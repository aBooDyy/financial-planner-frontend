import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePaydayNoticeStore } from '#/features/planned/stores/paydayNotice'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { money, plural } from '#/features/planning/view/format'

/**
 * Automatic payday mode's quiet confirmation (03 §4): "Set aside SR 5,600 for 5 items · 2
 * need a look · Review" — shown once, on whichever page is open, then the notice is spent.
 * **Review** opens the payday review on Planning › Upcoming.
 */
export function usePaydayNoticeToast(): void {
  const notice = usePaydayNoticeStore((s) => s.notice)
  const dismiss = usePaydayNoticeStore((s) => s.dismiss)
  const openSheet = usePlanningUi((s) => s.openSheet)
  const navigate = useNavigate()

  useEffect(() => {
    if (!notice) return
    const message = [
      `Set aside ${money(notice.total, notice.base)} for ${plural(notice.count, 'item')}`,
      notice.review > 0 ? `${notice.review} need a look` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    toast(
      message,
      notice.review > 0
        ? {
            label: 'Review',
            run: () => {
              openSheet({ kind: 'review', payday: null })
              void navigate({
                to: '/planning/$section',
                params: { section: 'upcoming' },
              })
            },
          }
        : undefined,
    )
    dismiss()
  }, [notice, dismiss, openSheet, navigate])
}
