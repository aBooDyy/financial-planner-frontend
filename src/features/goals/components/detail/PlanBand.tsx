import type { DetailBand } from '#/features/goals/data/goalDetail'
import { Button } from '#/components/ui/button'

type Props = {
  band: DetailBand
  busy: boolean
  onRecalc: () => void
  onConfirm: (plannedId: string) => void
  onUndo: () => void
}

const SMALL = 'h-auto rounded-[9px] px-[10px] py-2 text-[12px] font-bold'

/** The strip under the plan box: behind / ahead / off-plan, or "Plan updated · Undo". */
export function PlanBand({ band, busy, onRecalc, onConfirm, onUndo }: Props) {
  switch (band.kind) {
    case 'updated':
      return (
        <div className="flex items-center gap-[10px] border-t border-fp-border bg-fp-accent-soft px-3 py-[10px]">
          <p className="flex-1 text-[11.5px] leading-[1.45] text-fp-accent-ink">
            <b>{band.lead}</b> {band.text}
          </p>
          <Button
            variant="outline"
            onClick={onUndo}
            disabled={busy}
            className="h-auto rounded-[8px] px-[9px] py-[6px] text-[11.5px] font-bold"
          >
            Undo
          </Button>
        </div>
      )
    case 'behind':
      return (
        <div className="border-t border-fp-border bg-fp-warn/10 px-3 py-[10px]">
          <div className="text-[12px] font-bold text-fp-warn">{band.title}</div>
          <p className="mt-[2px] text-[11.5px] leading-[1.45] text-fp-text-2">
            {band.text}
          </p>
          {band.recalcLabel || band.confirmId ? (
            <div className="mt-[9px] flex gap-[7px]">
              {band.recalcLabel ? (
                <Button
                  onClick={onRecalc}
                  disabled={busy}
                  className={`${SMALL} min-w-0 flex-1`}
                >
                  {band.recalcLabel}
                </Button>
              ) : null}
              {band.confirmId && band.confirmLabel ? (
                <Button
                  variant="outline"
                  onClick={() => onConfirm(band.confirmId ?? '')}
                  className={`${SMALL} ${band.recalcLabel ? '' : 'flex-1'}`}
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
        <div className="flex items-center gap-[10px] border-t border-fp-border px-3 py-[10px]">
          <span className="flex-1 text-[12px] font-bold text-fp-accent-ink">
            {band.title}
          </span>
          {band.recalcLabel ? (
            <Button
              variant="outline"
              onClick={onRecalc}
              disabled={busy}
              className={SMALL}
            >
              {band.recalcLabel}
            </Button>
          ) : null}
        </div>
      )
    case 'off':
      return (
        <div className="flex flex-wrap items-center gap-x-1 border-t border-fp-border px-3 py-[9px] text-[11.5px] text-fp-text-2">
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
