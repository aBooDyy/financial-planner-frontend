import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { buildYearAhead } from '#/features/planning/data/yearAhead'
import type { YearAhead } from '#/features/planning/data/yearAhead'

/** Upcoming's Year ahead: twelve months (or `months`), stretched to the latest goal date. */
export function useYearAhead(
  months?: number,
): YearAhead & { loading: boolean } {
  const data = usePlannedData()
  return useMemo(
    () => ({
      loading: data.loading,
      ...buildYearAhead(data.inputs, data.state, data.today, { months }),
    }),
    [data.loading, data.inputs, data.state, data.today, months],
  )
}
