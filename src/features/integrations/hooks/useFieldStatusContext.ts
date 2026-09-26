import { useMemo } from 'react'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
import type { Extraction } from '#/features/integrations/api/ruleTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import type {
  CategoryWords,
  StatusContext,
} from '#/features/integrations/data/fieldStatus'
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
    const category = (id: string): CategoryWords | null => {
      const entry = catalog.get(id)
      if (entry.id === DELETED_CATEGORY_ID) return null
      const parent = catalog.parentOf(id)
      return parent
        ? { root: parent.name, sub: entry.name }
        : { root: entry.name, sub: null }
    }
    return {
      hasSample,
      extraction,
      defaults: {
        currency: apiKey.defaultCurrency,
        walletName: apiKey.defaultWalletId
          ? (walletNames.get(apiKey.defaultWalletId) ?? null)
          : null,
        categoryName:
          apiKey.defaultCategoryId && catalog.has(apiKey.defaultCategoryId)
            ? catalog.labelOf(apiKey.defaultCategoryId)
            : null,
        type: apiKey.defaultType === 'income' ? 'INCOME' : 'SPEND',
      },
      walletName: (id) => walletNames.get(id) ?? null,
      category,
      formatAmount: (minor, currency) => formatMoney(minor, currency),
      formatDate: (iso) => {
        const parsed = parseISODate(iso)
        return parsed ? formatDate(parsed, dateFormat) : iso
      },
    }
  }, [apiKey, walletNames, catalog, extraction, hasSample, dateFormat])
}
