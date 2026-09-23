import { Plus } from 'lucide-react'
import type {
  IntegrationRule,
  Locator,
  LocatorField,
} from '#/features/integrations/api/ruleTypes'
import { statusLine } from '#/features/integrations/data/fieldStatus'
import type { StatusContext } from '#/features/integrations/data/fieldStatus'
import { isBound } from '#/features/integrations/data/ruleDraft'
import type { Target } from '#/features/integrations/data/ruleEditorState'
import type { RuleProblem } from '#/features/integrations/data/ruleErrors'
import {
  FIELD_META,
  FIELD_ORDER,
  isHopField,
} from '#/features/integrations/data/ruleFields'
import type { ConstantChoices } from './ConstantInput'
import { FieldRow } from './FieldRow'

type Props = {
  fields: IntegrationRule['fields']
  target: Target | null
  statusContext: StatusContext
  problem: RuleProblem | null
  choices: ConstantChoices
  onChange: (field: LocatorField, locator: Locator | null) => void
  onTarget: (target: Target | null) => void
}

/** The fields this rule reads: amount, currency and date always; the rest once added. */
export function FieldList({
  fields,
  target,
  statusContext,
  problem,
  choices,
  onChange,
  onTarget,
}: Props) {
  const shown = FIELD_ORDER.filter((f) => isHopField(f) || f in fields)
  const addable = FIELD_ORDER.filter((f) => !shown.includes(f))

  return (
    <section
      aria-labelledby="rule-fields-heading"
      className="flex flex-col gap-3"
    >
      <h4 id="rule-fields-heading" className="text-[14px] font-bold">
        Fields
      </h4>
      {shown.map((field) => {
        const locator = fields[field] ?? {}
        return (
          <FieldRow
            key={field}
            field={field}
            locator={locator}
            isTarget={target === field}
            status={statusLine(field, isBound(locator), statusContext)}
            problem={problem?.fields[field] ?? null}
            choices={choices}
            onChange={(next) => onChange(field, next)}
            onTarget={(on) => onTarget(on ? field : null)}
          />
        )
      })}
      {addable.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-fp-text-2">
            Also read
          </span>
          <div className="flex flex-wrap gap-2">
            {addable.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => {
                  onChange(field, {})
                  onTarget(field)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-fp-border bg-fp-surface px-3 py-1.5 text-[12.5px] font-semibold text-fp-text-2 hover:border-fp-accent hover:text-fp-text"
              >
                <Plus size={13} strokeWidth={2.2} />
                {FIELD_META[field].label}
                {FIELD_META[field].hint ? (
                  <span className="font-normal text-fp-text-3">
                    ({FIELD_META[field].hint})
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
