import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { TransferDialogState } from '#/features/balances/hooks/useTransferDialog'
import type { RatesMap } from '#/lib/config/rates'
import type { DateFormat } from '#/lib/date'
import { TransferDone } from './TransferDone'
import { TransferForm } from './TransferForm'

type Props = {
  t: TransferDialogState
  rates: RatesMap
  dateFormat: DateFormat
}

/** Balances' "Transfer money": a dialog on desktop, a bottom sheet on mobile. */
export function TransferDialog({ t, rates, dateFormat }: Props) {
  const { from, to, preview, done } = t
  if (!from || !to || !preview) return null

  return (
    <ResponsiveDialog
      open={t.open}
      onOpenChange={(open) => {
        if (!open) t.close()
      }}
      title={
        done ? (
          <span className="sr-only">Transfer complete</span>
        ) : (
          'Transfer money'
        )
      }
      contentClassName="sm:max-w-[460px]"
      bodyClassName="pb-6"
    >
      {done ? (
        <TransferDone
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
