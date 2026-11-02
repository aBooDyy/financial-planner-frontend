import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { whatIf } from '#/features/planning/data/whatIf'
import type { WhatIfResult } from '#/features/planning/data/whatIf'
import { useWhatIf } from '#/features/planning/stores/whatIf'

/** The plan with what is being tried, against the plan as it stands; null with nothing switched on. */
export function useWhatIfResult(): WhatIfResult | null {
  const { inputs, state, userId, today, todayDate } = usePlannedData()
  const items = useWhatIf((s) => s.items)
  return useMemo(
    () =>
      items.some((i) => i.on)
        ? whatIf({ inputs, state, items, userId, today: todayDate })
        : null,
    // `todayDate` is a new object each render; `today` is the day it stands for.
    [inputs, state, items, userId, today],
  )
}
