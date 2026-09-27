import { Fragment } from 'react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '#/components/ui/dropdown-menu'
import {
  isCovered,
  isPicked,
  togglePick,
} from '#/features/transactions/data/scopePicker'
import type {
  Scope,
  ScopeSection,
} from '#/features/transactions/data/selectors'
import { AccountOptionContent } from './AccountTreeGroups'

type Props = {
  sections: ReadonlyArray<ScopeSection>
  ancestors: ReadonlyMap<string, string[]>
  value: Scope
  amountsLoading: boolean
  onChange: (scope: Scope) => void
}

const INDENT_PX = 18
const CHECK_GUTTER_PX = 32

/**
 * The accounts laid out like the Wallets tree, each with a tick. "All accounts" clears the
 * ticks and closes the menu; ticking an account keeps it open for the next one.
 */
export function ScopeMenuTree({
  sections,
  ancestors,
  value,
  amountsLoading,
  onChange,
}: Props) {
  return sections.map((section, i) => (
    <Fragment key={section.options[0]?.value ?? i}>
      {i > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroup>
        {section.label ? (
          <DropdownMenuLabel className="text-[11px] font-bold tracking-[0.04em] text-fp-text-3 uppercase">
            {section.label}
          </DropdownMenuLabel>
        ) : null}
        {section.options.map((option) => {
          const covered = isCovered(value, option.value, ancestors)
          const everything = option.kind === 'all'
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={
                everything
                  ? value.type === 'all'
                  : covered || isPicked(value, option.value)
              }
              disabled={covered}
              onSelect={(e) => {
                if (everything) {
                  onChange({ type: 'all' })
                  return
                }
                e.preventDefault()
                onChange(togglePick(value, option.value, ancestors))
              }}
              style={{
                paddingInlineStart: CHECK_GUTTER_PX + option.depth * INDENT_PX,
              }}
              className="text-[13px]"
            >
              <AccountOptionContent
                option={option}
                amountsLoading={amountsLoading}
              />
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuGroup>
    </Fragment>
  ))
}
