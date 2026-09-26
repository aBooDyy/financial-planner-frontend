import { Layers } from 'lucide-react'
import { Fragment } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '#/components/ui/select'
import type {
  ScopeOption,
  ScopeSection,
} from '#/features/transactions/data/selectors'

type Props = {
  sections: ReadonlyArray<ScopeSection>
  /** A filter can pick a whole group; an entry is always written to one wallet. */
  groupsSelectable: boolean
  /** The balances are still being summed; the accounts themselves are listed already. */
  amountsLoading?: boolean
}

const INDENT_PX = 18

function OptionContent({
  option,
  amountsLoading,
}: {
  option: ScopeOption
  amountsLoading: boolean
}) {
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
      <span className="fp-sensitive ms-auto ps-3 text-[12px] font-semibold whitespace-nowrap text-fp-text-3 tabular-nums">
        <ValueOrSkeleton
          value={amountsLoading ? null : option.amountStr}
          className="h-3 w-14"
        />
      </span>
    </>
  )
}

/** The accounts laid out like the Wallets tree, for a `Select`'s content. */
export function AccountTreeGroups({
  sections,
  groupsSelectable,
  amountsLoading = false,
}: Props) {
  return sections.map((section, i) => (
    <Fragment key={section.options[0]?.value ?? i}>
      {i > 0 ? <SelectSeparator /> : null}
      <SelectGroup>
        {section.label ? (
          <SelectLabel className="text-[11px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
            {section.label}
          </SelectLabel>
        ) : null}
        {section.options.map((option) => {
          const indent = { paddingInlineStart: 8 + option.depth * INDENT_PX }
          return option.kind === 'group' && !groupsSelectable ? (
            <SelectLabel
              key={option.value}
              style={indent}
              className="flex items-center gap-2 py-[7px] pe-2 text-[13px] text-fp-text"
            >
              <OptionContent option={option} amountsLoading={amountsLoading} />
            </SelectLabel>
          ) : (
            <SelectItem
              key={option.value}
              value={option.value}
              style={indent}
              className="text-[13px] *:[span]:last:min-w-0 *:[span]:last:flex-1"
            >
              <OptionContent option={option} amountsLoading={amountsLoading} />
            </SelectItem>
          )
        })}
      </SelectGroup>
    </Fragment>
  ))
}
