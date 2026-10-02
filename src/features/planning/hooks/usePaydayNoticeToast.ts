import { useEffect } from 'react'
import { usePaydayNoticeStore } from '#/features/planned/stores/paydayNotice'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { money, plural } from '#/features/planning/view/format'

/**
 * Automatic payday mode's quiet confirmation (03 §4): "Set aside SR 5,600 for 5 items · 2
 * need a look · Review" — shown once, then the notice is spent.
 */
export function usePaydayNoticeToast(): void {
  const notice = usePaydayNoticeStore((s) => s.notice)
  const dismiss = usePaydayNoticeStore((s) => s.dismiss)
  const base = usePlannedData().inputs.base
  const openSheet = usePlanningUi((s) => s.openSheet)

  useEffect(() => {
    if (!notice) return
    const message = [
      `Set aside ${money(notice.total, base)} for ${plural(notice.count, 'item')}`,
      notice.review > 0 ? `${notice.review} need a look` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    toast(
      message,
      notice.review > 0
        ? {
            label: 'Review',
            run: () => openSheet({ kind: 'review', payday: null }),
          }
        : undefined,
    )
    dismiss()
  }, [notice, dismiss, base, openSheet])
}
