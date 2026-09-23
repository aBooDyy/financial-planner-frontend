import { Input } from '#/components/ui/input'
import type {
  TemplateSave,
  TemplateSaveMode,
} from '#/features/import/hooks/useTemplateSave'

type Props = { save: TemplateSave }

const CHOICE =
  'flex cursor-pointer items-center gap-2 rounded-full border px-[11px] py-[6px] text-[12.5px] font-semibold transition'

const on = 'border-fp-accent bg-fp-accent-soft text-fp-accent-ink'
const off =
  'border-fp-border bg-fp-surface text-fp-text-2 hover:border-fp-border-strong'

/**
 * Saving the mapping, as an explicit choice in the step footer. *Don't save* is a real
 * answer, not a skipped step — a one-time mapping leaves nothing behind
 * ([ADR-12](08-risks-and-decisions)).
 */
export function TemplateSaveField({ save }: Props) {
  const choices: { mode: TemplateSaveMode; label: string }[] = [
    ...(save.target
      ? [{ mode: 'update' as const, label: `Update “${save.target.name}”` }]
      : []),
    { mode: 'new', label: 'Save as a new template' },
    { mode: 'none', label: 'Don’t save' },
  ]

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-fp-border bg-fp-surface p-[15px] shadow-fp">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] font-bold">Saving this mapping</span>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Saving this mapping"
        >
          {choices.map((choice) => {
            const selected = save.mode === choice.mode
            return (
              <label
                key={choice.mode}
                className={`${CHOICE} ${selected ? on : off}`}
              >
                <input
                  type="radio"
                  name="template-save"
                  className="sr-only"
                  checked={selected}
                  value={choice.mode}
                  onChange={() => save.setMode(choice.mode)}
                />
                {choice.label}
              </label>
            )
          })}
        </div>
      </div>

      {save.mode === 'new' ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="template-name"
            className="text-[12.5px] text-fp-text-2"
          >
            Template name
          </label>
          <Input
            id="template-name"
            value={save.name}
            onChange={(e) => save.setName(e.target.value)}
            placeholder="Al Rajhi — current account"
            aria-invalid={save.nameError !== null}
            className="rounded-[10px] border-fp-border-strong px-2.5 py-2 text-[13.5px]"
          />
          {save.nameError ? (
            <p role="alert" className="text-[12px] text-fp-danger">
              {save.nameError}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-fp-text-3">
          {save.mode === 'update'
            ? 'Your answers here replace what that template remembers.'
            : 'A one-time mapping — nothing is saved, and nothing is cluttered.'}
        </p>
      )}
    </section>
  )
}
