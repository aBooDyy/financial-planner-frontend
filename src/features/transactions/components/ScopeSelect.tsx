import { Layers } from 'lucide-react'
import { Fragment } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  scopeFromValue,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import type {
  Scope,
  ScopeOption,
  ScopeSection,
} from '#/features/transactions/data/selectors'

type Props = {
  sections: ScopeSection[]
  value: Scope
  onChange: (scope: Scope) => void
}

const INDENT_PX = 18

function OptionContent({ option }: { option: ScopeOption }) {
  return (
    <>
      {option.icon && option.color ? (
        <IconChip
          id={option.icon}
          color={option.color}
          size={20}
          iconSize={12}
          className="rounded-[6px]"
        />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-[6px] bg-fp-surface-2">
          <Layers size={12} strokeWidth={2} className="text-fp-text-2" />
        </span>
      )}
      <span
        className={`truncate ${option.kind === 'wallet' ? 'font-medium' : 'font-bold'}`}
      >
        {option.name}
      </span>
      <span className="ms-auto ps-3 text-[12px] font-semibold whitespace-nowrap text-fp-text-3 tabular-nums">
        {option.amountStr}
      </span>
    </>
  )
}

/** The Spending page's account filter, laid out like the Balances tree. */
export function ScopeSelect({ sections, value, onChange }: Props) {
  return (
    <Select
      value={scopeToValue(value)}
      onValueChange={(v) => onChange(scopeFromValue(v))}
    >
      <SelectTrigger
        title="Filter all tabs by account"
        className="w-auto min-w-[172px] max-w-[300px] rounded-[11px] border-fp-border-strong px-[11px] py-[9px] text-[13px] font-semibold"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-[260px]">
        {sections.map((section, i) => (
          <Fragment key={section.options[0]?.value ?? i}>
            {i > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              {section.label ? (
                <SelectLabel className="text-[11px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
                  {section.label}
                </SelectLabel>
              ) : null}
              {section.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  style={{
                    paddingInlineStart: 8 + option.depth * INDENT_PX,
                  }}
                  className="text-[13px]"
                >
                  <OptionContent option={option} />
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}
