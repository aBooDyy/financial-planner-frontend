import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { AdjustBalanceState } from '#/features/balances/hooks/useAdjustBalance'
import type { DateFormat } from '#/lib/date'
import { AdjustBalanceForm } from './AdjustBalanceForm'
import { TransferDone } from './TransferDone'

type Props = {
  a: AdjustBalanceState
  dateFormat: DateFormat
}

/** Balances' "Adjust balance": set a wallet to what it really holds, recording the gap. */
export function AdjustBalanceDialog({ a, dateFormat }: Props) {
  const { wallet, preview, done } = a
  if (!wallet || !preview) return null

  return (
    <ResponsiveDialog
      open={a.open}
      onOpenChange={(open) => {
        if (!open) a.close()
      }}
      title={
        done ? (
          <span className="sr-only">Balance adjusted</span>
        ) : (
          'Adjust balance'
        )
      }
      contentClassName="sm:max-w-[460px]"
      bodyClassName="pb-6"
    >
      {done ? (
        <TransferDone
          title={done.title}
          sub={done.sub}
          onUndo={() => void a.undo()}
          onDone={a.close}
        />
      ) : (
        <AdjustBalanceForm
          a={a}
          wallet={wallet}
          preview={preview}
          dateFormat={dateFormat}
        />
      )}
    </ResponsiveDialog>
  )
}
