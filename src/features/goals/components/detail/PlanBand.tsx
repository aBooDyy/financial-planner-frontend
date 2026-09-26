import type { DetailBand } from '#/features/goals/data/goalDetail'
import { Button } from '#/components/ui/button'
import { PANE_BUTTON } from '../styles'

type Props = {
  band: DetailBand
  busy: boolean
  onRecalc: () => void
  onConfirm: (plannedId: string) => void
  onUndo: () => void
}

const BOX = 'rounded-[14px] px-[13px] py-3'

/** The box under the plan tiles: behind / ahead / off-plan, or "Plan updated · Undo". */
export function PlanBand({ band, busy, onRecalc, onConfirm, onUndo }: Props) {
  switch (band.kind) {
    case 'updated':
      return (
        <div
          className={`${BOX} flex items-center gap-[10px] bg-fp-accent-soft`}
        >
          <p className="flex-1 text-[12.5px] leading-[1.5] text-fp-accent-ink">
            <b className="font-extrabold">{band.lead}</b> {band.text}
          </p>
          <Button
            variant="quiet"
            onClick={onUndo}
            disabled={busy}
            className={PANE_BUTTON}
          >
            Undo
          </Button>
        </div>
      )
    case 'behind':
      return (
        <div className={`${BOX} bg-fp-spend-soft`}>
          <div className="text-[13.5px] font-extrabold text-fp-spend">
            {band.title}
          </div>
          <p className="mt-[3px] text-[12.5px] leading-[1.5] text-fp-text-2">
            {band.text}
          </p>
          {band.recalcLabel || band.confirmId ? (
            <div className="mt-[10px] flex flex-wrap gap-[6px]">
              {band.recalcLabel ? (
                <Button
                  onClick={onRecalc}
                  disabled={busy}
                  className={`${PANE_BUTTON} font-extrabold shadow-[0_6px_16px_-8px_var(--fp-accent)]`}
                >
                  {band.recalcLabel}
                </Button>
              ) : null}
              {band.confirmId && band.confirmLabel ? (
                <Button
                  variant="quiet"
                  onClick={() => onConfirm(band.confirmId ?? '')}
                  className={PANE_BUTTON}
                >
                  {band.confirmLabel}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    case 'ahead':
      return (
        <div
          className={`${BOX} flex items-center gap-[10px] bg-fp-accent-soft`}
        >
          <span className="flex-1 text-[12.5px] font-bold text-fp-accent-ink">
            {band.title}
          </span>
          {band.recalcLabel ? (
            <Button
              variant="quiet"
              onClick={onRecalc}
              disabled={busy}
              className={PANE_BUTTON}
            >
              {band.recalcLabel}
            </Button>
          ) : null}
        </div>
      )
    case 'off':
      return (
        <div
          className={`${BOX} flex flex-wrap items-center gap-x-1 bg-fp-surface-2 text-[12.5px] text-fp-text-2`}
        >
          <span>{band.text} ·</span>
          <button
            type="button"
            onClick={onRecalc}
            disabled={busy}
            className="font-bold text-fp-accent-ink hover:underline disabled:opacity-50"
          >
            Recalculate
          </button>
        </div>
      )
  }
}
