import { Undo2 } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { NoteBox } from '#/components/dialog/NoteBox'
import { batchPlan, planPhrase } from '#/features/import/data/importCounts'
import { formatMoney } from '#/lib/currency'
import type { LocalTransaction } from '#/db/types'
import type { UndoPlan } from '#/features/import/data/batches'

type Props = {
  plan: UndoPlan | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

const EDITED_SHOWN = 5

const describe = (tx: LocalTransaction): string =>
  `${tx.date} · ${tx.note ?? formatMoney(tx.amount, tx.currency)}`

/** Undo asks once, and says exactly what it will and will not touch. */
export function UndoImportDialog({ plan, busy, onClose, onConfirm }: Props) {
  const number = new Intl.NumberFormat()
  const removing = {
    transactions: plan?.removable.length ?? 0,
    transfers: plan?.removableTransfers.length ?? 0,
  }
  const removable = removing.transactions + removing.transfers
  const edited = plan?.edited ?? []

  return (
    <ConfirmDialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        removable === 1
          ? `Remove the ${removing.transfers === 1 ? 'transfer' : 'transaction'} this import added?`
          : `Remove all ${planPhrase(removing)} this import added?`
      }
      tone="danger"
      icon={<Undo2 />}
      cancelLabel="Keep them"
      confirmLabel={busy ? 'Removing…' : 'Remove them'}
      busy={busy}
      confirmDisabled={removable === 0}
      onConfirm={onConfirm}
      note="Accounts, categories and merchants this import created stay. They may already hold other transactions, and an empty account is easier to live with than one that disappeared."
    >
      <p>
        {plan === null
          ? null
          : `“${plan.batch.label}” added ${planPhrase(batchPlan(plan.batch))}.`}{' '}
        Removing them puts your balances, budgets and spending back where they
        were.
      </p>

      {edited.length > 0 ? (
        <NoteBox tone="warn">
          <p>
            {edited.length === 1
              ? '1 of them has changed since, and is kept:'
              : `${number.format(edited.length)} of them have changed since, and are kept:`}
          </p>
          <ul className="mt-1 flex flex-col gap-[2px] font-medium">
            {edited.slice(0, EDITED_SHOWN).map((tx) => (
              <li key={tx.id} className="truncate">
                {describe(tx)}
              </li>
            ))}
          </ul>
          {edited.length > EDITED_SHOWN ? (
            <p className="mt-1 font-medium">
              …and {number.format(edited.length - EDITED_SHOWN)} more you have
              edited.
            </p>
          ) : null}
        </NoteBox>
      ) : null}
    </ConfirmDialog>
  )
}
