import { useMemo } from 'react'
import { activeFilterChips } from '#/features/search/data/chips'
import {
  categoryOptions,
  walletOptions,
} from '#/features/search/data/filterOptions'
import type {
  CategoryOption,
  WalletOption,
} from '#/features/search/data/filterOptions'
import type {
  ActiveFilterChip,
  SearchFilters,
} from '#/features/search/data/types'
import { currencySymbol } from '#/lib/currency'
import { useSearchBasics } from './useSearchBasics'

export type SearchFilterOptions = {
  roots: CategoryOption[]
  wallets: WalletOption[]
  baseSymbol: string
  chips: ActiveFilterChip[]
}

/** What the filter panel offers, and a chip for each filter `filters` sets. */
export function useSearchFilterOptions(
  filters: SearchFilters,
  enabled: boolean,
): SearchFilterOptions {
  const { nodeRows, base, catalog, dateFormat } = useSearchBasics(enabled)
  const nodes = useMemo(
    () => (nodeRows ?? []).filter((n) => n.deleted === 0),
    [nodeRows],
  )
  const roots = useMemo(() => categoryOptions(catalog), [catalog])
  const wallets = useMemo(() => walletOptions(nodes), [nodes])
  const chips = useMemo(
    () => activeFilterChips(filters, { catalog, nodes, base, dateFormat }),
    [filters, catalog, nodes, base, dateFormat],
  )
  return { roots, wallets, baseSymbol: currencySymbol(base), chips }
}
