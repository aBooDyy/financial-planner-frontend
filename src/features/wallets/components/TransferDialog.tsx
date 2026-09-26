import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { TransferDialogState } from '#/features/wallets/hooks/useTransferDialog'
import type { RatesMap } from '#/lib/config/rates'
import type { DateFormat } from '#/lib/date'
import { DoneState } from '#/components/dialog/DoneState'
import { TransferForm } from './TransferForm'

type Props = {
  t: TransferDialogState
  rates: RatesMap
  dateFormat: DateFormat
}

/** Wallets' "Transfer money": a dialog on desktop, a bottom sheet on mobile. */
export function TransferDialog({ t, rates, dateFormat }: Props) {
  const { from, to, preview, done } = t
  if (!from || !to || !preview) return null

  return (
    <ResponsiveDialog
      open={t.open}
      onOpenChange={(open) => {
        if (!open) t.close()
      }}
      title={done ? 'Transfer complete' : 'Transfer money'}
      hideHeader={done !== null}
      contentClassName="sm:max-w-[460px]"
    >
      {done ? (
        <DoneState
          title={done.title}
          sub={done.sub}
          onUndo={() => void t.undo()}
          onDone={t.close}
        />
      ) : (
        <TransferForm
          t={t}
          from={from}
          to={to}
          preview={preview}
          rates={rates}
          dateFormat={dateFormat}
        />
      )}
    </ResponsiveDialog>
  )
}
