import { useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { spendFromGoal } from '#/features/planning/actions/goalMoney'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { money } from '#/features/planning/view/format'
import { parseAmountToMinor } from '#/lib/currency'
import { WalletPills } from '#/features/planning/components/editors/fields/WalletPills'

type Props = { goalId: string; onClose: () => void }

/**
 * Use it (02, D20): spend from a goal. The category is asked the first time and remembered on
 * the goal; the payment releases what the goal held in the paying wallet.
 */
export function UseItSheet(props: Props) {
  return usePlanningReady() ? <UseItSheetBody {...props} /> : null
}

function UseItSheetBody({ goalId, onClose }: Props) {
  const { inputs } = usePlannedData()
  const planning = usePlanning()
  const wallets = usePlanningWallets()
  const goal = inputs.goals.find((g) => g.id === goalId)
  const status = planning.goals[goalId] as
    | (typeof planning.goals)[string]
    | undefined
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState(
    status?.heldIn.find((h) => h.walletId)?.walletId ??
      goal?.saveWalletId ??
      wallets.list.at(0)?.id ??
      '',
  )
  const [categoryId, setCategoryId] = useState<string | null>(
    goal?.useCategoryId ?? null,
  )
  const [busy, setBusy] = useState(false)

  if (!goal) return null
  const minor = parseAmountToMinor(amount, goal.currency) ?? 0
  const block =
    minor <= 0
      ? 'Enter how much you spent'
      : !walletId
        ? 'Pick the wallet it was paid from'
        : !categoryId
          ? 'Pick what it was spent on'
          : null

  const submit = async () => {
    if (block || !categoryId) return
    setBusy(true)
    try {
      await spendFromGoal(goalId, { amount: minor, walletId, categoryId })
      toast(`${money(minor, goal.currency)} spent from ${goal.name}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Use money from ${goal.name}`}
      description={
        status
          ? `${money(status.setAside, goal.currency)} is set aside for it.`
          : undefined
      }
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel={`Record ${money(minor, goal.currency)} spent`}
          onSubmit={() => void submit()}
        />
      }
    >
      <AmountWell
        question="How much did you spend?"
        currency={goal.currency}
        amount={amount}
        onAmount={setAmount}
        tone="spend"
        autoFocus
      />
      <div>
        <FieldLabel>Paid from</FieldLabel>
        <WalletPills
          label="Paid from"
          wallets={wallets.list}
          value={walletId}
          onChange={setWalletId}
        />
      </div>
      <div>
        <FieldLabel>What was it spent on?</FieldLabel>
        <CategoryPicker
          type="spend"
          categoryId={categoryId}
          onChange={setCategoryId}
          none={
            categoryId === null
              ? { label: 'Choose a category', onPick: () => undefined }
              : undefined
          }
        />
        <FieldMessage help="We remember it for this goal." />
      </div>
    </ResponsiveDialog>
  )
}
