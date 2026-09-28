import { useState } from 'react'
import type { PeriodMode, RangeMode } from '#/features/transactions/constants'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import { CustomRangeDialog } from './CustomRangeDialog'

type Props = {
  mode: PeriodMode
  /** The span on screen, which the custom range dialog opens on. */
  shown: IsoSpan
  onSetMode: (m: RangeMode) => void
  onPickCustom: (span: IsoSpan) => void
}

const MODES: RangeMode[] = ['year', 'month', 'week', 'day']

const seg = (active: boolean) =>
  `flex-1 rounded-[8px] px-3 py-[6px] text-[12.5px] @xl:flex-none ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

/** Year / Month / Week / Day, and Custom — which always opens the range dialog to (re)pick. */
export function PeriodModeSwitch({
  mode,
  shown,
  onSetMode,
  onPickCustom,
}: Props) {
  const [picking, setPicking] = useState(false)

  return (
    <div className="flex w-full rounded-[11px] border border-fp-border bg-fp-surface-2 p-[3px] @xl:inline-flex @xl:w-auto">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSetMode(m)}
          className={seg(mode === m)}
        >
          {m[0].toUpperCase() + m.slice(1)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-haspopup="dialog"
        className={seg(mode === 'custom')}
      >
        Custom
      </button>
      {picking ? (
        <CustomRangeDialog
          initial={shown}
          onPick={onPickCustom}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  )
}
