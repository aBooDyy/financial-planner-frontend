import { Button } from '#/components/ui/button'

type Props = {
  balance: string
  onAdjust: () => void
}

/** A saved wallet's live balance, with the way to correct it when it drifts from the bank. */
export function BalanceNowStrip({ balance, onAdjust }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-fp-accent-soft px-[14px] py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold tracking-[0.06em] text-fp-accent-ink">
          BALANCE NOW
        </div>
        <div className="truncate text-[18px] font-extrabold text-fp-text tabular-nums">
          {balance}
        </div>
      </div>
      <Button
        type="button"
        variant="quiet"
        onClick={onAdjust}
        className="h-auto flex-none rounded-[11px] px-3 py-2 text-[13px] font-bold"
      >
        Adjust balance
      </Button>
    </div>
  )
}
