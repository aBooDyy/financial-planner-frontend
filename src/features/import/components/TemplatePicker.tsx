import { Check } from 'lucide-react'
import { ONE_TIME_TEMPLATE } from '#/features/import/hooks/useCsvImport'

/** One saved mapping, as the picker needs it — filled from the synced table. */
export type TemplateOption = {
  id: string
  name: string
  /** "used 4 times" — shown verbatim beside the name. */
  hint?: string
  /** The header signature matched this file. A recommendation, never an application. */
  matchesFile?: boolean
  /** Listed but not choosable: a mapping this client cannot read has to be rebuilt. */
  disabled?: boolean
}

type Props = {
  templates: ReadonlyArray<TemplateOption>
  value: string
  onChange: (id: string) => void
}

const ROW =
  'flex cursor-pointer items-start gap-3 rounded-xl border px-[13px] py-[11px] text-[13.5px] transition'

const DOT =
  'mt-[2px] flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border'

/**
 * How the file should be read. The user always chooses: a signature match pre-selects an
 * entry and says so, because a mapping that applies itself and is wrong costs far more than
 * one the user spent two seconds confirming.
 */
export function TemplatePicker({ templates, value, onChange }: Props) {
  if (templates.length === 0) {
    return (
      <p className="text-[13px] text-fp-text-2">
        We’ll set this up in the next two steps, and you can save it as a
        template at the end.
      </p>
    )
  }

  const options: ReadonlyArray<TemplateOption> = [
    ...templates,
    {
      id: ONE_TIME_TEMPLATE,
      name: 'Set it up for this file',
      hint: 'a one-time mapping — nothing is saved',
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="How should we read it?"
      className="flex flex-col gap-2"
    >
      {options.map((option) => {
        const selected = option.id === value
        const disabled = option.disabled === true
        return (
          <label
            key={option.id}
            className={`${ROW} ${
              disabled
                ? 'cursor-not-allowed border-fp-border bg-fp-surface-2 opacity-70'
                : selected
                  ? 'border-fp-accent bg-fp-accent-soft'
                  : 'border-fp-border bg-fp-surface hover:border-fp-border-strong'
            }`}
          >
            <input
              type="radio"
              name="import-template"
              className="sr-only"
              checked={selected}
              disabled={disabled}
              value={option.id}
              onChange={() => onChange(option.id)}
            />
            <span
              className={`${DOT} ${
                selected
                  ? 'border-fp-accent bg-fp-accent text-white'
                  : 'border-fp-border-strong'
              }`}
            >
              {selected ? <Check size={11} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1 font-semibold text-fp-text">
              {option.name}
            </span>
            {option.matchesFile ? (
              <span className="shrink-0 text-[12px] font-semibold text-fp-accent-ink">
                ✓ looks like this file
              </span>
            ) : null}
            {option.hint ? (
              <span className="shrink-0 text-[12px] text-fp-text-3">
                {option.hint}
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}
