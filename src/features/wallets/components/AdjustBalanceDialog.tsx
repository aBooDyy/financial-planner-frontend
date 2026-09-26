import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { AdjustBalanceState } from '#/features/wallets/hooks/useAdjustBalance'
import type { DateFormat } from '#/lib/date'
import { AdjustBalanceForm } from './AdjustBalanceForm'
import { DoneState } from '#/components/dialog/DoneState'

type Props = {
  a: AdjustBalanceState
  dateFormat: DateFormat
}

/** Wallets' "Adjust balance": set a wallet to what it really holds, recording the gap. */
export function AdjustBalanceDialog({ a, dateFormat }: Props) {
  const { wallet, preview, done } = a
  if (!wallet || !preview) return null

  return (
    <ResponsiveDialog
      open={a.open}
      onOpenChange={(open) => {
        if (!open) a.close()
      }}
      title={done ? 'Balance adjusted' : 'Adjust balance'}
      hideHeader={done !== null}
      contentClassName="sm:max-w-[460px]"
    >
      {done ? (
        <DoneState
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
