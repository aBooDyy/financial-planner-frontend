import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode, LocalBalanceSettings } from '#/db/types'
import type {
  BalanceNode,
  BalanceSettings,
  CreateNodeWire,
  PlanningSettings,
  UpdateNodeWire,
  UpdateSettingsWire,
} from '#/features/wallets/api/types'
import {
  DEFAULT_PLANNING_SETTINGS,
  toWireHorizon,
  toWireKind,
  toWirePaydayMode,
} from '#/features/wallets/api/types'

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
  archivedAt: n.archivedAt,
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
  safeHorizon: s.safeHorizon,
  safeHorizonDays: s.safeHorizonDays,
  paydayMode: s.paydayMode,
  mainIncomeStreamId: s.mainIncomeStreamId,
  incomeVaries: s.incomeVaries,
  incomeFloor: s.incomeFloor,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
  version: s.version,
  dirty: 0,
})

/** The planning settings a row holds, with the defaults filled in for an older row. */
export const planningSettingsOf = (
  l: LocalBalanceSettings | null | undefined,
): PlanningSettings => ({
  safeHorizon: l?.safeHorizon ?? DEFAULT_PLANNING_SETTINGS.safeHorizon,
  safeHorizonDays: l?.safeHorizonDays ?? null,
  paydayMode: l?.paydayMode ?? DEFAULT_PLANNING_SETTINGS.paydayMode,
  mainIncomeStreamId: l?.mainIncomeStreamId ?? null,
  incomeVaries: l?.incomeVaries ?? false,
  incomeFloor: l?.incomeFloor ?? null,
})

/**
 * Drop what a setting does not use, as the server does: days only with 'days', a floor only
 * while income varies.
 */
export const normalizedPlanning = (p: PlanningSettings): PlanningSettings => ({
  ...p,
  safeHorizonDays: p.safeHorizon === 'days' ? p.safeHorizonDays : null,
  incomeFloor: p.incomeVaries ? p.incomeFloor : null,
})

/**
 * The PATCH body. It is a full representation — anything omitted resets to its default — so
 * every field goes, every time.
 */
export const localSettingsToUpdateWire = (
  l: LocalBalanceSettings,
): UpdateSettingsWire => {
  const p = normalizedPlanning(planningSettingsOf(l))
  return {
    version: l.version,
    base_currency: l.baseCurrency,
    safe_horizon: toWireHorizon(p.safeHorizon),
    safe_horizon_days: p.safeHorizonDays,
    payday_mode: toWirePaydayMode(p.paydayMode),
    main_income_stream_id: p.mainIncomeStreamId,
    income_varies: p.incomeVaries,
    income_floor: p.incomeFloor,
  }
}

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
  archived: Boolean(l.archivedAt),
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
  archived: Boolean(l.archivedAt),
  amount: l.amount,
  currency: l.currency,
})
