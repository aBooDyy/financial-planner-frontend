import { useLogout } from '#/features/auth/hooks/useLogout'
import { usePreferencesStore } from '#/stores/preferences'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import {
  deleteNode,
  setBaseCurrency,
  toggleCollapse,
} from '#/features/balances/data/mutations'
import { useBalances } from '#/features/balances/hooks/useBalances'
import { useNodeEditor } from '#/features/balances/hooks/useNodeEditor'
import { useTransferDialog } from '#/features/balances/hooks/useTransferDialog'
import { transferWallets } from '#/features/balances/data/transferDialog'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { BaselineTeaserCard } from './BaselineTeaserCard'
import { CurrencyBreakdownCard } from './CurrencyBreakdownCard'
import { NodeEditor } from './NodeEditor'
import { TotalHeroCard } from './TotalHeroCard'
import { TransferDialog } from './TransferDialog'
import { WalletsGroupsCard } from './WalletsGroupsCard'

export function BalancesPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const { base, nodes, deltas, rates, view } = useBalances()
  const editor = useNodeEditor(base)
  const wallets = transferWallets(nodes, deltas, base)
  const transfer = useTransferDialog(wallets, rates)
  const onTransfer = wallets.length >= 2 ? transfer.openDialog : undefined

  if (!user) return null

  const openEdit = (id: string) => {
    const node = nodes.find((n) => n.id === id)
    if (node) editor.openEdit(node)
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        active="balances"
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-start gap-4 px-[14px] py-4 pb-[30px] md:grid-cols-[minmax(0,1fr)_330px] md:gap-6 md:px-6 md:py-[26px] md:pb-[90px]">
          <div className="flex min-w-0 flex-col gap-4">
            <TotalHeroCard view={view} base={base} onTransfer={onTransfer} />
            <WalletsGroupsCard
              rows={view.rows}
              onAddWallet={() => editor.openAdd('wallet')}
              onTransfer={onTransfer}
              onAddGroup={() => editor.openAdd('group')}
              onToggle={(id) => void toggleCollapse(id)}
              onEdit={openEdit}
              onDelete={(id) => void deleteNode(id)}
              onAddInside={(id) => editor.openAdd('wallet', id)}
            />
          </div>

          <div className="flex flex-col gap-4">
            <CurrencyBreakdownCard breakdown={view.breakdown} base={base} />
            <BaselineTeaserCard />
          </div>
        </div>
      </div>

      <MobileTabBar active="balances" />

      <TransferDialog t={transfer} rates={rates} dateFormat={dateFormat} />

      {editor.editing ? (
        <NodeEditor
          editing={editor.editing}
          nodes={nodes}
          onField={editor.setField}
          onSave={() => void editor.save()}
          onDelete={() => void editor.remove()}
          onClose={editor.close}
        />
      ) : null}
    </div>
  )
}
