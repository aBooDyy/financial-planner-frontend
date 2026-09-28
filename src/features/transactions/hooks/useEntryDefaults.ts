import type { LocalBalanceNode } from '#/db/types'
import {
  entryToWalletId,
  entryWalletId,
} from '#/features/transactions/data/entryDefaults'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { useEntrySession } from '#/features/transactions/stores/entrySession'
import { usePreferencesStore } from '#/stores/preferences'

export type EntryDefaults = {
  walletId: string
  toWalletId: string
  date: string
}

/** Where a new entry starts: this session's last wallet and day, else the Settings default and today. */
export function useEntryDefaults(
  live: ReadonlyArray<LocalBalanceNode>,
): EntryDefaults {
  const remembered = useEntrySession((s) => s.walletId)
  const rememberedTo = useEntrySession((s) => s.toWalletId)
  const date = useEntrySession((s) => s.date)
  const preferred = usePreferencesStore((s) => s.defaultAccountId)
  const walletId = entryWalletId(live, [remembered, preferred])
  return {
    walletId,
    toWalletId: entryToWalletId(live, walletId, rememberedTo),
    date: date ?? ymd(startOfToday()),
  }
}
