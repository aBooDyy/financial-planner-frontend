import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { LocalBalanceNode } from '#/db/types'
import type {
  AdjustmentDirection,
  AdjustmentEditor as AdjustmentEditorApi,
} from '#/features/transactions/hooks/useAdjustmentEditor'
import { amountInputProps, currencySymbol } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'

type Props = {
  editor: AdjustmentEditorApi
  wallets: LocalBalanceNode[]
  dateFormat: DateFormat
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

const DIRECTIONS: ReadonlyArray<{ value: AdjustmentDirection; label: string }> =
  [
    { value: 'in', label: 'Added to balance' },
    { value: 'out', label: 'Taken from balance' },
  ]

const segment = (active: boolean) =>
  `flex-1 rounded-[8px] py-2 text-[13px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

/** Edit a balance adjustment: which way, how much, when, and why — or delete it. */
export function AdjustmentEditor({ editor, wallets, dateFormat }: Props) {
  const { editing } = editor
  if (!editing) return null
  const wallet = wallets.find((w) => w.id === editing.walletId)

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) editor.close()
      }}
      title="Edit balance adjustment"
      contentClassName="sm:max-w-[440px]"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void editor.remove()}
            className="text-fp-danger hover:text-fp-danger"
          >
            Delete
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={editor.close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void editor.save()}
            disabled={!editor.canSave}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div
          role="radiogroup"
          aria-label="Direction"
          className="inline-flex w-full rounded-[12px] border border-fp-border bg-fp-surface-2 p-[3px]"
        >
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={editing.direction === d.value}
              onClick={() => editor.setField('direction', d.value)}
              className={segment(editing.direction === d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div>
          <Label className={LABEL}>
            Amount{' '}
            <span className="font-medium text-fp-text-3">
              ({currencySymbol(editing.currency)})
            </span>
          </Label>
          <Input
            value={editing.amount}
            onChange={(e) => editor.setField('amount', e.target.value)}
            aria-label="Amount"
            {...amountInputProps(editing.currency)}
            className="tabular-nums"
          />
        </div>

        <div>
          <Label className={LABEL}>Date</Label>
          <DateField
            value={editing.date}
            onChange={(iso) => editor.setField('date', iso)}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>

        <div>
          <Label className={LABEL}>
            Note <span className="font-medium text-fp-text-3">(optional)</span>
          </Label>
          <Input
            value={editing.note}
            onChange={(e) => editor.setField('note', e.target.value)}
            placeholder="e.g. Matched bank statement"
          />
        </div>

        <p className="text-[12px] text-fp-text-3">
          {wallet ? `Corrects ${wallet.name}'s balance` : 'Corrects a balance'}{' '}
          · not counted as spending or income
        </p>
      </div>
    </ResponsiveDialog>
  )
}
