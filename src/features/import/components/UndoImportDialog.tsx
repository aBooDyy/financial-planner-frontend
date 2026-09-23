import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
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
  const removable = plan?.removable.length ?? 0
  const edited = plan?.edited ?? []

  return (
    <ResponsiveDialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        removable === 1
          ? 'Remove the transaction this import added?'
          : `Remove all ${number.format(removable)} transactions this import added?`
      }
      description="Accounts, categories and merchants it created are kept."
      footer={
        <>
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Keep them
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || removable === 0}
            onClick={onConfirm}
          >
            {busy ? 'Removing…' : 'Remove them'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-fp-text-2">
        <p>
          {plan === null
            ? null
            : `“${plan.batch.label}” added ${number.format(plan.batch.importedCount)} transactions.`}{' '}
          Removing them puts your balances, budgets and spending back where they
          were.
        </p>

        {edited.length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-xl bg-fp-surface-2 p-3">
            <p className="font-semibold text-fp-text">
              {edited.length === 1
                ? '1 of them has changed since, and is kept:'
                : `${number.format(edited.length)} of them have changed since, and are kept:`}
            </p>
            <ul className="flex flex-col gap-1">
              {edited.slice(0, EDITED_SHOWN).map((tx) => (
                <li key={tx.id} className="truncate">
                  {describe(tx)}
                </li>
              ))}
            </ul>
            {edited.length > EDITED_SHOWN ? (
              <p>
                …and {number.format(edited.length - EDITED_SHOWN)} more you have
                edited.
              </p>
            ) : null}
          </div>
        ) : null}

        <p>
          Accounts, categories and merchants this import created stay. They may
          already hold other transactions, and an empty account is easier to
          live with than one that disappeared.
        </p>
      </div>
    </ResponsiveDialog>
  )
}
