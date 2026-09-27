import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { usePreferencesStore } from '#/stores/preferences'
import { useSessionStore } from '#/stores/session'
import { formatMoney } from '#/lib/currency'
import {
  archiveNode,
  deleteNode,
  toggleCollapse,
} from '#/features/wallets/data/mutations'
import { useAdjustBalance } from '#/features/wallets/hooks/useAdjustBalance'
import { useComingUp } from '#/features/wallets/hooks/useComingUp'
import { useMonthlyFlow } from '#/features/wallets/hooks/useMonthlyFlow'
import { useWallets } from '#/features/wallets/hooks/useWallets'
import { useNodeEditor } from '#/features/wallets/hooks/useNodeEditor'
import { useTransferDialog } from '#/features/wallets/hooks/useTransferDialog'
import { transferWallets } from '#/features/wallets/data/transferDialog'
import { archiveTarget } from '#/features/wallets/data/archivedList'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { AdjustBalanceDialog } from './AdjustBalanceDialog'
import { ArchiveNodeDialog } from './ArchiveNodeDialog'
import { ComingUpCard } from './ComingUpCard'
import { DeleteNodeDialog } from './DeleteNodeDialog'
import { MonthlyFlowCard } from './MonthlyFlowCard'
import { NodeEditor } from './NodeEditor'
import { TotalHeroCard } from './TotalHeroCard'
import { TransferDialog } from './TransferDialog'
import { WalletsGroupsCard } from './WalletsGroupsCard'

export function WalletsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const {
    base,
    nodes,
    deltas,
    reservations,
    rates,
    view,
    archivedCount,
    balancesLoading,
  } = useWallets()
  const editor = useNodeEditor(base)
  const wallets = transferWallets(nodes, deltas, base)
  const transfer = useTransferDialog(wallets, rates)
  const onTransfer = wallets.length >= 2 ? transfer.openDialog : undefined
  const adjust = useAdjustBalance(wallets)
  const comingUp = useComingUp({
    wallets,
    reservations,
    rates,
    balancesLoading,
  })
  const monthlyFlow = useMonthlyFlow(base, rates, !balancesLoading)
  const editingWallet = wallets.find((w) => w.id === editor.editing?.id)
  const navigate = useNavigate()
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const targetOf = (id: string | null) =>
    id ? archiveTarget(nodes, id, { deltas, base, rates }) : null
  const archiving = targetOf(archivingId)
  const deleting = targetOf(deletingId)

  if (!user) return null

  const openEdit = (id: string) => {
    const node = nodes.find((n) => n.id === id)
    if (node) editor.openEdit(node)
  }

  const confirmArchive = () => {
    if (!archiving) return
    void archiveNode(archiving.id)
    if (editor.editing?.id === archiving.id) editor.close()
    setArchivingId(null)
  }

  const confirmDelete = () => {
    if (!deleting) return
    void deleteNode(deleting.id)
    if (editor.editing?.id === deleting.id) editor.close()
    setDeletingId(null)
  }

  const nestedDialogs = (
    <>
      <AdjustBalanceDialog a={adjust} dateFormat={dateFormat} />
      <ArchiveNodeDialog
        target={archiving}
        onClose={() => setArchivingId(null)}
        onConfirm={confirmArchive}
      />
      <DeleteNodeDialog
        target={deleting}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
      />
    </>
  )

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav user={user} active="wallets" onSignOut={() => void logout()} />

      <div className="flex-1 overflow-auto">
        <span role="status" className="sr-only">
          {balancesLoading ? 'Loading your balances…' : ''}
        </span>
        <div
          aria-busy={balancesLoading}
          className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-start gap-4 px-[14px] py-4 pb-[30px] md:grid-cols-[minmax(0,1fr)_330px] md:gap-6 md:px-6 md:py-[26px] md:pb-[90px]"
        >
          <div className="flex min-w-0 flex-col gap-4">
            <TotalHeroCard view={view} loading={balancesLoading} base={base} />
            <WalletsGroupsCard
              rows={view.rows}
              loading={balancesLoading}
              onAddWallet={() => editor.openAdd('wallet')}
              onTransfer={onTransfer}
              onAddGroup={() => editor.openAdd('group')}
              onToggle={(id) => void toggleCollapse(id)}
              onEdit={openEdit}
              onAdjust={adjust.openFor}
              onDelete={setDeletingId}
              onAddInside={(id) => editor.openAdd('wallet', id)}
              onOpenGoal={(goalId) =>
                void navigate({ to: '/goals', search: { goal: goalId } })
              }
              archivedCount={archivedCount}
            />
          </div>

          <div className="flex flex-col gap-4">
            <ComingUpCard view={comingUp} />
            <MonthlyFlowCard view={monthlyFlow} />
          </div>
        </div>
      </div>

      <MobileTabBar active="wallets" />

      <TransferDialog t={transfer} rates={rates} dateFormat={dateFormat} />

      {editor.editing ? (
        <NodeEditor
          editing={editor.editing}
          nodes={nodes}
          onField={editor.setField}
          onSave={() => void editor.save()}
          onArchive={() => setArchivingId(editor.editing?.id ?? null)}
          onDelete={() => setDeletingId(editor.editing?.id ?? null)}
          onClose={editor.close}
          currentBalance={
            !editingWallet
              ? undefined
              : balancesLoading
                ? null
                : formatMoney(editingWallet.balance, editingWallet.currency)
          }
          onAdjust={
            editingWallet ? () => adjust.openFor(editingWallet.id) : undefined
          }
        >
          {nestedDialogs}
        </NodeEditor>
      ) : (
        nestedDialogs
      )}
    </div>
  )
}
