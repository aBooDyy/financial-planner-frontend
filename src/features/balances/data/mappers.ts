import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode, LocalBalanceSettings } from '#/db/types'
import type {
  BalanceNode,
  BalanceSettings,
  CreateNodeWire,
  UpdateNodeWire,
} from '#/features/balances/api/types'
import { toWireKind } from '#/features/balances/api/types'

/** Server node → local record (freshly synced: clean, not deleted). */
export const serverNodeToLocal = (n: BalanceNode): LocalBalanceNode => ({
  id: n.id,
  kind: n.kind,
  parentId: n.parentId,
  name: n.name,
  color: n.color,
  icon: n.icon,
  note: n.note,
  position: n.position,
  collapsed: n.collapsed,
  amount: n.amount,
  currency: n.currency,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
  version: n.version,
  dirty: 0,
  deleted: 0,
})

export const serverSettingsToLocal = (
  s: BalanceSettings,
): LocalBalanceSettings => ({
  id: SETTINGS_KEY,
  baseCurrency: s.baseCurrency,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  version: s.version,
  dirty: 0,
})

export const localNodeToCreateWire = (l: LocalBalanceNode): CreateNodeWire => ({
  id: l.id,
  kind: toWireKind(l.kind),
  parent_id: l.parentId,
  name: l.name,
  color: l.color,
  icon: l.icon,
  note: l.note,
  position: l.position,
  collapsed: l.collapsed,
  amount: l.amount,
  currency: l.currency,
})

// The update is based on the last-synced `version` (optimistic locking base).
export const localNodeToUpdateWire = (l: LocalBalanceNode): UpdateNodeWire => ({
  version: l.version,
  name: l.name,
  color: l.color,
  icon: l.icon,
  note: l.note,
  parent_id: l.parentId,
  position: l.position,
  collapsed: l.collapsed,
  amount: l.amount,
  currency: l.currency,
})
