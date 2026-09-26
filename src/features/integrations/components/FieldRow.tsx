import { Eraser, X } from 'lucide-react'
import { cn } from '#/lib/utils'
import type {
  Locator,
  LocatorField,
} from '#/features/integrations/api/ruleTypes'
import type { StatusLine } from '#/features/integrations/data/fieldStatus'
import { FIELD_META, isHopField } from '#/features/integrations/data/ruleFields'
import { isBound } from '#/features/integrations/data/ruleDraft'
import type { ConstantChoices } from './ConstantInput'
import { FieldOptions } from './FieldOptions'
import { FieldStatusText } from './FieldStatusText'
import { LocatorInputs } from './LocatorInputs'

type Props = {
  field: LocatorField
  locator: Locator
  isTarget: boolean
  status: StatusLine
  problem: string | null
  choices: ConstantChoices
  onChange: (locator: Locator | null) => void
  onTarget: (on: boolean) => void
}

/**
 * One field of the rule: where it comes from, the options that belong to it, and the line
 * that says what it resolved to in the sample. That line describes the inputs, so a screen
 * reader hears the value change as the user types.
 */
export function FieldRow({
  field,
  locator,
  isTarget,
  status,
  problem,
  choices,
  onChange,
  onTarget,
}: Props) {
  const meta = FIELD_META[field]
  const id = `rule-field-${field}`
  const statusId = `${id}-status`
  const bound = isBound(locator)
  const optional = !isHopField(field)

  return (
    <section
      aria-labelledby={`${id}-label`}
      className={cn(
        'flex flex-col gap-[10px] rounded-[14px] border-[1.5px] bg-fp-surface p-3 transition',
        isTarget
          ? 'border-fp-accent ring-[3px] ring-fp-accent/15'
          : 'border-fp-border',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={isTarget}
          onClick={() => onTarget(!isTarget)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 text-start"
        >
          <span
            aria-hidden
            className={cn(
              'h-3 w-3 shrink-0 rounded-full border-2',
              isTarget
                ? 'border-fp-accent bg-fp-accent'
                : bound
                  ? 'border-fp-accent'
                  : 'border-fp-border-strong',
            )}
          />
          <span id={`${id}-label`} className="text-[14px] font-extrabold">
            {meta.label}
          </span>
          <span className="truncate text-[11.5px] font-semibold text-fp-text-3">
            {isTarget
              ? 'Tap a value in the payload'
              : optional
                ? (meta.hint ?? 'optional')
                : ''}
          </span>
        </button>
        {optional ? (
          <IconButton
            label={`Remove ${meta.label}`}
            onClick={() => onChange(null)}
          >
            <X size={15} strokeWidth={2} />
          </IconButton>
        ) : bound ? (
          <IconButton
            label={`Clear ${meta.label}`}
            onClick={() => onChange({})}
          >
            <Eraser size={15} strokeWidth={1.9} />
          </IconButton>
        ) : null}
      </div>

      <LocatorInputs
        id={id}
        field={field}
        label={meta.label}
        locator={locator}
        onChange={onChange}
        describedBy={statusId}
        problem={problem}
        choices={choices}
      />

      {bound ? (
        <FieldOptions
          id={id}
          field={field}
          locator={locator}
          onChange={onChange}
        />
      ) : null}

      <FieldStatusText id={statusId} status={status} />
    </section>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-fp-border text-fp-text-3 transition hover:border-fp-border-strong hover:text-fp-text"
    >
      {children}
    </button>
  )
}
