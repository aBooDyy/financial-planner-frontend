import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { activeNodes } from '#/features/wallets/data/archive'
import type { CurrencyCode } from '#/lib/currency'

export type PlanningWallet = {
  id: string
  name: string
  color: string
  currency: CurrencyCode
}

export type PlanningWallets = {
  /** Active wallets, in tree order. */
  list: PlanningWallet[]
  /** Every wallet ever named on a row, archived ones included, for labels. */
  byId: ReadonlyMap<string, PlanningWallet>
  base: CurrencyCode
}

/** The wallets money can be planned in, and a name lookup for every wallet. */
export function usePlanningWallets(): PlanningWallets {
  const { nodes, inputs } = usePlannedData()
  const base = inputs.base
  return useMemo(() => {
    const toWallet = (n: (typeof nodes)[number]): PlanningWallet => ({
      id: n.id,
      name: n.name,
      color: n.color,
      currency: n.currency ?? base,
    })
    const wallets = nodes.filter((n) => n.kind === 'wallet')
    return {
      list: activeNodes(nodes)
        .filter((n) => n.kind === 'wallet')
        .sort((a, b) => a.position - b.position)
        .map(toWallet),
      byId: new Map(wallets.map((n) => [n.id, toWallet(n)])),
      base,
    }
  }, [nodes, base])
}
