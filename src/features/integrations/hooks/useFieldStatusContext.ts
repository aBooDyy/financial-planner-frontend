import { useMemo } from 'react'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Extraction } from '#/features/integrations/api/ruleTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import type { StatusContext } from '#/features/integrations/data/fieldStatus'
import { formatMoney } from '#/lib/currency'
import { formatDate, parseISODate } from '#/lib/date'
import { usePreferencesStore } from '#/stores/preferences'

/** Everything a field's status line needs to say its value in the user's own terms. */
export function useFieldStatusContext(
  apiKey: IntegrationKey,
  walletNames: ReadonlyMap<string, string>,
  catalog: CategoryCatalog,
  extraction: Extraction | null,
  hasSample: boolean,
): StatusContext {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  return useMemo(() => {
    const categoryName = (slug: string): string | null => {
      for (const category of catalog.all) {
        if (category.slug === slug) return category.name
        const sub = catalog.subsOf(category.slug).find((s) => s.slug === slug)
        if (sub) return sub.name
      }
      return null
    }
    return {
      hasSample,
      extraction,
      defaults: {
        currency: apiKey.defaultCurrency,
        walletName: apiKey.defaultWalletId
          ? (walletNames.get(apiKey.defaultWalletId) ?? null)
          : null,
        categoryName: apiKey.defaultCategory
          ? categoryName(apiKey.defaultCategory)
          : null,
        type: apiKey.defaultType === 'income' ? 'INCOME' : 'SPEND',
      },
      walletName: (id) => walletNames.get(id) ?? null,
      categoryName,
      formatAmount: (minor, currency) => formatMoney(minor, currency),
      formatDate: (iso) => {
        const parsed = parseISODate(iso)
        return parsed ? formatDate(parsed, dateFormat) : iso
      },
    }
  }, [apiKey, walletNames, catalog, extraction, hasSample, dateFormat])
}
