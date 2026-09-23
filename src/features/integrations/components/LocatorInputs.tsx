import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '#/components/ui/input'
import type {
  Locator,
  LocatorField,
} from '#/features/integrations/api/ruleTypes'
import { Segmented } from '#/features/settings/components/Segmented'
import { ConstantInput } from './ConstantInput'
import type { ConstantChoices } from './ConstantInput'
import { PatternHelp } from './PatternHelp'

type Source = 'path' | 'const'

const SOURCES: { value: Source; label: string }[] = [
  { value: 'path', label: 'From the payload' },
  { value: 'const', label: 'Always the same' },
]

type Props = {
  id: string
  field: LocatorField
  label: string
  locator: Locator
  onChange: (locator: Locator) => void
  /** The status line's id, so a screen reader hears the resolved value change. */
  describedBy: string
  problem: string | null
  choices: ConstantChoices
}

/** Where a field comes from: a path (and, if needed, a pattern over what it finds) or a fixed value. */
export function LocatorInputs({
  id,
  field,
  label,
  locator,
  onChange,
  describedBy,
  problem,
  choices,
}: Props) {
  const source: Source = locator.const !== undefined ? 'const' : 'path'
  const [patternOpen, setPatternOpen] = useState(false)
  const showPattern = patternOpen || locator.regex !== undefined
  const invalid = problem ? true : undefined

  const switchSource = (next: Source) => {
    const kept = { ...locator }
    delete kept.path
    delete kept.const
    delete kept.regex
    delete kept.group
    const initial = field === 'currency' ? choices.baseCurrency : ''
    onChange(
      next === 'const' ? { ...kept, const: initial } : { ...kept, path: '' },
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Where ${label} comes from`}
        className="self-start"
      >
        <Segmented value={source} options={SOURCES} onChange={switchSource} />
      </div>

      {source === 'const' ? (
        <ConstantInput
          id={id}
          field={field}
          label={label}
          value={locator.const ?? ''}
          onChange={(value) => onChange({ ...locator, const: value })}
          describedBy={describedBy}
          invalid={invalid}
          choices={choices}
        />
      ) : (
        <>
          <Input
            id={id}
            dir="ltr"
            value={locator.path ?? ''}
            placeholder={`$.data.${field}`}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label={`${label} path`}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => onChange({ ...locator, path: e.target.value })}
            className="py-2 text-start font-mono text-[13px]"
          />
          {showPattern ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`${id}-pattern`}
                  className="shrink-0 text-[12px] font-semibold text-fp-text-2"
                >
                  Pattern
                </label>
                <Input
                  id={`${id}-pattern`}
                  dir="ltr"
                  value={locator.regex ?? ''}
                  placeholder="at\s+(.+?)\s+on"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  maxLength={200}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(e) =>
                    onChange({ ...locator, regex: e.target.value })
                  }
                  className="py-2 text-start font-mono text-[13px]"
                />
                <button
                  type="button"
                  aria-label={`Remove the ${label} pattern`}
                  onClick={() => {
                    const next = { ...locator }
                    delete next.regex
                    delete next.group
                    onChange(next)
                    setPatternOpen(false)
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
              <PatternHelp />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPatternOpen(true)}
              className="self-start text-[12px] font-semibold text-fp-accent-ink underline-offset-2 hover:underline"
            >
              Read part of the value with a pattern
            </button>
          )}
        </>
      )}
      {problem ? (
        <p role="alert" className="text-[12px] text-fp-danger">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
