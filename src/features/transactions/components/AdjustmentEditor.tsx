import { useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import type { LocalBalanceNode } from '#/db/types'
import { adjustmentDeleteCopy } from '#/features/transactions/data/scheduleEditor'
import type {
  AdjustmentDirection,
  AdjustmentEditor as AdjustmentEditorApi,
} from '#/features/transactions/hooks/useAdjustmentEditor'
import { parseAmountToMinor } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import { EditorDialog } from './EditorDialog'

type Props = {
  editor: AdjustmentEditorApi
  wallets: LocalBalanceNode[]
  dateFormat: DateFormat
}

const DIRECTIONS: ReadonlyArray<{ value: AdjustmentDirection; label: string }> =
  [
    { value: 'in', label: 'Added to balance' },
    { value: 'out', label: 'Taken from balance' },
  ]

/** Edit a balance adjustment: which way, how much, when, and why — or delete it. */
export function AdjustmentEditor({ editor, wallets, dateFormat }: Props) {
  const { editing } = editor
  if (!editing) return null
  return (
    <AdjustmentForm
      key={editing.id}
      editor={editor}
      wallets={wallets}
      dateFormat={dateFormat}
    />
  )
}

function AdjustmentForm({ editor, wallets, dateFormat }: Props) {
  const [attempted, setAttempted] = useState(false)
  const editing = editor.editing
  if (!editing) return null
  const wallet = wallets.find((w) => w.id === editing.walletId) ?? null
  const amountMinor = parseAmountToMinor(editing.amount, editing.currency)
  const amountMissing = attempted && (amountMinor ?? 0) <= 0
  const hint = editor.canSave
    ? null
    : editing.date
      ? 'Add an amount to continue'
      : 'Pick a date to continue'

  return (
    <EditorDialog
      title="Edit balance adjustment"
      onClose={editor.close}
      contentClassName="sm:max-w-[440px]"
      hint={hint}
      submitLabel="Save"
      onSubmit={() =>
        editor.canSave ? void editor.save() : setAttempted(true)
      }
      remove={{
        ...adjustmentDeleteCopy(wallet?.name ?? null),
        onConfirm: () => void editor.remove(),
      }}
    >
      <PillSwitch
        label="Direction"
        options={DIRECTIONS}
        value={editing.direction}
        onChange={(d) => editor.setField('direction', d)}
      />

      <div>
        <AmountWell
          question="How much?"
          currency={editing.currency}
          amount={editing.amount}
          onAmount={(v) => editor.setField('amount', v)}
          invalid={amountMissing}
          tone="neutral"
        />
        <FieldMessage
          error={amountMissing ? 'Enter an amount above 0.' : null}
        />
      </div>

      <div>
        <FieldLabel>Date</FieldLabel>
        <DateField
          value={editing.date}
          onChange={(iso) => editor.setField('date', iso)}
          dateFormat={dateFormat}
          ariaLabel="Date"
          invalid={attempted && !editing.date}
          hint
        />
      </div>

      <div>
        <FieldLabel htmlFor="adjustment-note" optional>
          Note
        </FieldLabel>
        <Input
          id="adjustment-note"
          value={editing.note}
          onChange={(e) => editor.setField('note', e.target.value)}
          placeholder="e.g. Matched bank statement"
        />
      </div>

      <p className="text-center text-[12px] leading-[1.45] text-fp-text-3">
        {wallet ? `Corrects ${wallet.name}’s balance` : 'Corrects a balance'} ·
        not counted as spending or income
      </p>
    </EditorDialog>
  )
}
