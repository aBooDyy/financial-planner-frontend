import type { CountsOption } from '#/features/transactions/data/countsToward'
import type { CountsToward } from '#/features/transactions/hooks/useCountsToward'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { cn } from '#/lib/utils'
import { CountsTowardMore } from './CountsTowardMore'

type Props = {
  counts: CountsToward
  onSelect: (id: string | null) => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

function OptionCard({
  name,
  sub,
  color,
  active,
  onClick,
}: {
  name: string
  sub: string
  color: string | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-[10px] rounded-[12px] border px-[12px] py-[9px] text-start',
        active
          ? 'border-fp-accent bg-fp-accent-soft'
          : 'border-fp-border-strong bg-fp-surface-2 hover:border-fp-text-3',
      )}
    >
      <span
        aria-hidden
        className="size-[9px] flex-none rounded-full border-[1.5px]"
        style={
          color
            ? { background: color, borderColor: color }
            : { borderColor: 'var(--fp-border-strong)' }
        }
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-[13.5px] font-semibold',
            active ? 'text-fp-accent-ink' : 'text-fp-text',
          )}
        >
          {name}
        </span>
        <span className="truncate text-[11.5px] text-fp-text-3">{sub}</span>
      </span>
    </button>
  )
}

/** 1e: what an entry counts toward — nothing, a goal / obligation, or (income) a stream. */
export function CountsTowardField({ counts, onSelect }: Props) {
  const { options, selectedId } = counts
  const card = (o: CountsOption) => (
    <OptionCard
      key={o.id}
      name={o.name}
      sub={o.sub}
      color={o.color}
      active={selectedId === o.id}
      onClick={() => onSelect(o.id)}
    />
  )

  return (
    <div>
      <Label className={LABEL}>
        Counts toward{' '}
        <span className="font-medium text-fp-text-3">(optional)</span>
      </Label>
      <div role="radiogroup" className="flex flex-col gap-[6px]">
        <OptionCard
          name="Nothing"
          sub={counts.isIncome ? 'Regular income' : 'Regular spending'}
          color={null}
          active={selectedId === null}
          onClick={() => onSelect(null)}
        />
        {options.top.map(card)}
        {options.rest.length > 0 ? (
          <CountsTowardMore
            options={options.rest}
            isIncome={counts.isIncome}
            onSelect={onSelect}
          />
        ) : null}
      </div>

      {counts.linkHint ? (
        <div className="mt-[8px] flex items-start gap-[10px] rounded-[11px] bg-fp-accent-soft px-3 py-[9px]">
          <p
            className={cn(
              'min-w-0 flex-1 text-[12.5px] leading-[1.45] text-fp-accent-ink',
              counts.optOut && 'line-through opacity-60',
            )}
          >
            {counts.linkHint}
          </p>
          <label className="flex flex-none items-center gap-[6px] text-[11.5px] font-semibold text-fp-text-2">
            Don’t link
            <Switch
              checked={counts.optOut}
              onCheckedChange={counts.setOptOut}
              aria-label="Don’t link"
            />
          </label>
        </div>
      ) : null}
      {counts.infoHint ? (
        <p className="mt-[8px] rounded-[11px] border border-fp-border bg-fp-surface-2 px-3 py-[9px] text-[12px] leading-[1.45] text-fp-text-2">
          {counts.infoHint}
        </p>
      ) : null}
    </div>
  )
}
