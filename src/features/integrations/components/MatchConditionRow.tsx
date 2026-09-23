import { Crosshair, Plus, X } from 'lucide-react'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils'
import type {
  MatchCondition,
  MatchOp,
} from '#/features/integrations/api/ruleTypes'

const OPS: { value: MatchOp; label: string }[] = [
  { value: 'EQUALS', label: 'is' },
  { value: 'CONTAINS', label: 'contains' },
  { value: 'EXISTS', label: 'is present' },
]

const EMPTY: MatchCondition = {
  path: '',
  op: 'EQUALS',
  value: '',
  ignoreCase: true,
}

type Props = {
  match: MatchCondition | null
  picking: boolean
  problem: string | null
  onChange: (match: MatchCondition | null) => void
  onPick: (on: boolean) => void
}

/** "Apply this rule when …" — one condition, or none for a rule that always applies. */
export function MatchConditionRow({
  match,
  picking,
  problem,
  onChange,
  onPick,
}: Props) {
  if (!match) {
    return (
      <section
        aria-labelledby="rule-match-heading"
        className="flex flex-col gap-1.5"
      >
        <h4 id="rule-match-heading" className="text-[14px] font-bold">
          Apply this rule when
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] text-fp-text-2">
            Always — it runs for every payload that reaches it.
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(EMPTY)
              onPick(true)
            }}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-fp-accent-ink hover:underline"
          >
            <Plus size={13} strokeWidth={2.2} />
            Add a condition
          </button>
        </div>
      </section>
    )
  }

  const set = (patch: Partial<MatchCondition>) =>
    onChange({ ...match, ...patch })

  return (
    <section
      aria-labelledby="rule-match-heading"
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-fp-surface p-3',
        picking
          ? 'border-fp-accent ring-[3px] ring-fp-accent/15'
          : 'border-fp-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id="rule-match-heading" className="text-[14px] font-bold">
          Apply this rule when
        </h4>
        <button
          type="button"
          aria-label="Remove the condition"
          onClick={() => {
            onChange(null)
            onPick(false)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            dir="ltr"
            value={match.path}
            placeholder="$.event"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Condition path"
            aria-invalid={problem ? true : undefined}
            onChange={(e) => set({ path: e.target.value })}
            className="py-2 text-start font-mono text-[13px]"
          />
          <button
            type="button"
            aria-pressed={picking}
            onClick={() => onPick(!picking)}
            title="Pick from the payload"
            className={cn(
              'flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[12px] font-semibold',
              picking
                ? 'border-fp-accent bg-fp-accent-soft text-fp-accent-ink'
                : 'border-fp-border text-fp-text-2 hover:text-fp-text',
            )}
          >
            <Crosshair size={14} strokeWidth={2} />
            Pick
          </button>
        </div>
        <Select
          value={match.op}
          onValueChange={(op) => set({ op: op as MatchOp })}
        >
          <SelectTrigger
            aria-label="Comparison"
            className="w-full py-2 text-[13px] sm:w-[124px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {match.op !== 'EXISTS' ? (
          <Input
            dir="auto"
            value={match.value}
            placeholder="purchase"
            aria-label="Value to compare with"
            maxLength={200}
            onChange={(e) => set({ value: e.target.value })}
            className="py-2 text-[13px] sm:w-[34%]"
          />
        ) : null}
      </div>
      {match.op !== 'EXISTS' ? (
        <label className="flex items-center gap-2 self-start text-[12.5px] text-fp-text-2">
          <Checkbox
            checked={match.ignoreCase}
            onCheckedChange={(on) => set({ ignoreCase: on === true })}
          />
          Ignore upper and lower case
        </label>
      ) : null}
      {problem ? (
        <p role="alert" className="text-[12px] text-fp-danger">
          {problem}
        </p>
      ) : picking ? (
        <p className="text-[12px] text-fp-accent-ink">
          Tap a value in the payload to compare against it.
        </p>
      ) : null}
    </section>
  )
}
